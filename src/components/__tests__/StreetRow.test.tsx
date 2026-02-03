import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StreetRow from '../StreetRow'
import { supabase } from '../../lib/supabase'
import * as localeConfig from '../../lib/locale-config'

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// Mock locale-config
vi.mock('../../lib/locale-config', async () => {
  const actual = await vi.importActual('../../lib/locale-config')
  return {
    ...actual,
    formatTimestamp: vi.fn((timestamp) => {
      if (!timestamp) return null
      // Return a mock formatted time
      const date = new Date(timestamp)
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false })
    }),
  }
})

// Helper to create chainable mock for supabase queries
const createChainableMock = (resolvedData: unknown = null, resolvedError: unknown = null) => {
  const mock: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'single', 'upsert']
  
  methods.forEach(method => {
    mock[method] = vi.fn().mockReturnValue(mock)
  })
  
  // Make it thenable
  mock.then = vi.fn((resolve) => resolve({ data: resolvedData, error: resolvedError }))
  
  return mock
}

// Helper to create mock channel
const createMockChannel = () => {
  const handlers: Record<string, (payload: unknown) => void> = {}
  const channel = {
    on: vi.fn((event: string, opts: unknown, callback: (payload: unknown) => void) => {
      // Store callback for later triggering
      const table = (opts as { table?: string })?.table ?? event
      handlers[table] = callback
      return channel
    }),
    subscribe: vi.fn((callback?: (status: string, err?: Error) => void) => {
      if (callback) callback('SUBSCRIBED')
      return channel
    }),
    _handlers: handlers,
    _triggerEvent: (table: string, payload: unknown) => {
      if (handlers[table]) handlers[table](payload)
    },
  }
  return channel
}

describe('StreetRow Component', () => {
  const mockStreet = {
    id: 'street-123',
    name: 'Hauptstraße',
    isBG: false,
  }

  const mockStreetWithBG = {
    id: 'street-456',
    name: 'Nebengasse',
    isBG: true,
  }

  const mockUsers = [
    { id: 'user-1', name: 'Max Mustermann' },
    { id: 'user-2', name: 'Anna Schmidt' },
  ]

  const mockDailyStatus = {
    street_id: 'street-123',
    date: new Date().toISOString().split('T')[0],
    status: 'offen',
    assigned_users: [],
    started_at: null,
    finished_at: null,
    current_round: 1,
    total_rounds: 1,
  }

  const mockStatusHistory: {
    id: string;
    street_id: string;
    date: string;
    round_number: number;
    status: string;
    started_at: string;
    finished_at: string;
    assigned_users: string[];
  }[] = []

  let mockChannel: ReturnType<typeof createMockChannel>

  beforeEach(() => {
    vi.clearAllMocks()
    mockChannel = createMockChannel()

    // Setup default mocks
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'current-user-id' } },
      error: null,
    } as never)

    vi.mocked(supabase.channel).mockReturnValue(mockChannel as never)
    vi.mocked(supabase.removeChannel).mockReturnValue(undefined as never)

    // Setup from() mock to handle different tables
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'users') {
        return createChainableMock(mockUsers) as never
      }
      if (table === 'daily_street_status') {
        return createChainableMock(mockDailyStatus) as never
      }
      if (table === 'street_status_entries') {
        return createChainableMock(mockStatusHistory) as never
      }
      return createChainableMock(null) as never
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Rendering', () => {
    it('shows street name', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText('Hauptstraße')).toBeInTheDocument()
      })
    })

    it('shows loading state then status', async () => {
      // Make the status fetch take time
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          const mock = createChainableMock(null)
          mock.then = vi.fn((resolve) => {
            setTimeout(() => resolve({ data: mockDailyStatus, error: null }), 100)
            return new Promise(r => setTimeout(() => r({ data: mockDailyStatus, error: null }), 100))
          })
          return mock as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      // Should show loading initially
      expect(screen.getByText('Lädt...')).toBeInTheDocument()
      
      // Wait for status to load
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('BG Badge', () => {
    it('shows BG badge when street.isBG is true', async () => {
      render(<StreetRow street={mockStreetWithBG} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText('BG')).toBeInTheDocument()
        expect(screen.getByText('BG')).toHaveClass('bg-badge')
      })
    })

    it('does not show BG badge when street.isBG is false', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText('Hauptstraße')).toBeInTheDocument()
      })
      
      expect(screen.queryByText('BG')).not.toBeInTheDocument()
    })
  })

  describe('Status Selection', () => {
    it('changing status triggers saveStreetStatus', async () => {
      const user = userEvent.setup()
      
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })

      const statusSelect = screen.getByRole('combobox')
      await user.selectOptions(statusSelect, 'auf_dem_weg')
      
      await waitFor(() => {
        // Should have called from() for daily_street_status to upsert
        expect(supabase.from).toHaveBeenCalledWith('daily_street_status')
      })
    })

    it('displays all status options', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })

      const statusSelect = screen.getByRole('combobox')
      const options = within(statusSelect).getAllByRole('option')
      
      expect(options).toHaveLength(3)
      expect(options[0]).toHaveTextContent('Offen')
      expect(options[1]).toHaveTextContent('Auf dem Weg')
      expect(options[2]).toHaveTextContent('Erledigt')
    })
  })

  describe('Round Badge', () => {
    it('shows "Runde X" when currentRound > 1', async () => {
      const statusWithRound2 = { ...mockDailyStatus, current_round: 2 }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(statusWithRound2) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText('Runde 2')).toBeInTheDocument()
      })
    })

    it('does not show round badge when currentRound is 1', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText('Hauptstraße')).toBeInTheDocument()
      })
      
      expect(screen.queryByText(/Runde/)).not.toBeInTheDocument()
    })
  })

  describe('New Round Button', () => {
    it('only shows when status is "erledigt" and role is not "gast"', async () => {
      const completedStatus = { ...mockDailyStatus, status: 'erledigt' }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(completedStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Neue Runde/i })).toBeInTheDocument()
      })
    })

    it('does not show when role is "gast"', async () => {
      const completedStatus = { ...mockDailyStatus, status: 'erledigt' }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(completedStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="gast" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })
      
      expect(screen.queryByRole('button', { name: /Neue Runde/i })).not.toBeInTheDocument()
    })

    it('does not show when status is not "erledigt"', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })
      
      expect(screen.queryByRole('button', { name: /Neue Runde/i })).not.toBeInTheDocument()
    })

    it('clicking increments round and resets status', async () => {
      const user = userEvent.setup()
      const completedStatus = { ...mockDailyStatus, status: 'erledigt' }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(completedStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Neue Runde/i })).toBeInTheDocument()
      })

      const newRoundBtn = screen.getByRole('button', { name: /Neue Runde/i })
      await user.click(newRoundBtn)
      
      // Should call insert for street_status_entries
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('street_status_entries')
      })
    })
  })

  describe('User Assignment', () => {
    it('shows user assignment section when status is "auf_dem_weg"', async () => {
      const inProgressStatus = { ...mockDailyStatus, status: 'auf_dem_weg' }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(inProgressStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText('Mitarbeiter zuweisen:')).toBeInTheDocument()
      })
      
      // Should show user names
      expect(screen.getByText('Max Mustermann')).toBeInTheDocument()
      expect(screen.getByText('Anna Schmidt')).toBeInTheDocument()
    })

    it('toggling user updates assigned users', async () => {
      const user = userEvent.setup()
      const inProgressStatus = { ...mockDailyStatus, status: 'auf_dem_weg' }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(inProgressStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText('Max Mustermann')).toBeInTheDocument()
      })

      // Find and click the checkbox for Max Mustermann
      const checkboxes = screen.getAllByRole('checkbox')
      await user.click(checkboxes[0])
      
      // Should trigger save
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('daily_street_status')
      })
    })

    it('does not show user assignment section when status is not "auf_dem_weg"', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })
      
      expect(screen.queryByText('Mitarbeiter zuweisen:')).not.toBeInTheDocument()
    })
  })

  describe('Time Display', () => {
    it('shows start time when available', async () => {
      const statusWithStartTime = { 
        ...mockDailyStatus, 
        status: 'auf_dem_weg',
        started_at: '2026-01-31T08:30:00Z' 
      }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(statusWithStartTime) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Start:/)).toBeInTheDocument()
      })
    })

    it('shows finish time when available', async () => {
      const statusWithTimes = { 
        ...mockDailyStatus, 
        status: 'erledigt',
        started_at: '2026-01-31T08:30:00Z',
        finished_at: '2026-01-31T09:45:00Z'
      }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(statusWithTimes) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Fertig:/)).toBeInTheDocument()
      })
    })
  })

  describe('Duration Calculation', () => {
    it('correctly calculates time difference', async () => {
      const statusWithTimes = { 
        ...mockDailyStatus, 
        status: 'erledigt',
        started_at: '2026-01-31T08:00:00Z',
        finished_at: '2026-01-31T09:30:00Z'
      }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(statusWithTimes) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        // 08:00 to 09:30 = 1h 30min
        expect(screen.getByText(/Dauer:/)).toBeInTheDocument()
        expect(screen.getByText(/1h 30min/)).toBeInTheDocument()
      })
    })

    it('handles times without timezone suffix', async () => {
      const statusWithTimes = { 
        ...mockDailyStatus, 
        status: 'erledigt',
        started_at: '2026-01-31T10:00:00',
        finished_at: '2026-01-31T10:45:00'
      }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(statusWithTimes) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        // 45 minutes
        expect(screen.getByText(/Dauer:/)).toBeInTheDocument()
        expect(screen.getByText(/0h 45min/)).toBeInTheDocument()
      })
    })
  })

  describe('Role Restrictions', () => {
    it('guest cannot change status', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      render(<StreetRow street={mockStreet} role="gast" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })

      const statusSelect = screen.getByRole('combobox')
      expect(statusSelect).toBeDisabled()
      expect(statusSelect).toHaveClass('disabled')
      
      alertMock.mockRestore()
    })

    it('guest cannot assign users', async () => {
      const inProgressStatus = { ...mockDailyStatus, status: 'auf_dem_weg' }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(inProgressStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="gast" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText('Mitarbeiter zuweisen:')).toBeInTheDocument()
      })

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeDisabled()
      })
    })

    it('admin can change status', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })

      const statusSelect = screen.getByRole('combobox')
      expect(statusSelect).not.toBeDisabled()
    })

    it('mitarbeiter can change status', async () => {
      render(<StreetRow street={mockStreet} role="mitarbeiter" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })

      const statusSelect = screen.getByRole('combobox')
      expect(statusSelect).not.toBeDisabled()
    })
  })

  describe('History', () => {
    it('shows completed rounds in history', async () => {
      const user = userEvent.setup()
      const historyData = [
        {
          id: 'entry-1',
          street_id: 'street-123',
          date: new Date().toISOString().split('T')[0],
          round_number: 1,
          status: 'erledigt',
          started_at: '2026-01-31T06:00:00Z',
          finished_at: '2026-01-31T07:00:00Z',
          assigned_users: ['user-1'],
        },
      ]
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(mockDailyStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock(historyData) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText(/abgeschlossene Runde/)).toBeInTheDocument()
      })

      // Click to expand history
      const historyButton = screen.getByText(/abgeschlossene Runde/)
      await user.click(historyButton)
      
      await waitFor(() => {
        expect(screen.getByText('Runde 1')).toBeInTheDocument()
      })
    })

    it('does not show history button when no completed rounds', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(mockDailyStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })
      
      expect(screen.queryByText(/abgeschlossene Runde/)).not.toBeInTheDocument()
    })
  })

  describe('Realtime Subscription', () => {
    it('sets up channel with correct filters', async () => {
      const dateString = new Date().toISOString().split('T')[0]
      
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled()
      })

      // Verify channel was created with correct name pattern
      const channelCall = vi.mocked(supabase.channel).mock.calls[0]
      expect(channelCall[0]).toContain('street-status-')
      expect(channelCall[0]).toContain(mockStreet.id)
      expect(channelCall[0]).toContain(dateString)

      // Verify .on() was called for postgres_changes
      expect(mockChannel.on).toHaveBeenCalled()
      
      // Check that filters include the street_id
      const onCalls = mockChannel.on.mock.calls
      const dailyStatusCall = onCalls.find((call: unknown[]) => {
        const opts = call[1] as { table?: string }
        return opts?.table === 'daily_street_status'
      })
      expect(dailyStatusCall).toBeDefined()
      expect((dailyStatusCall![1] as { filter?: string }).filter).toContain(`street_id=eq.${mockStreet.id}`)
    })

    it('subscribes to both daily_street_status and street_status_entries tables', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled()
      })

      const onCalls = mockChannel.on.mock.calls
      
      // Should have subscriptions for both tables
      const dailyStatusSubscription = onCalls.find((call: unknown[]) => {
        const opts = call[1] as { table?: string }
        return opts?.table === 'daily_street_status'
      })
      const entriesSubscription = onCalls.find((call: unknown[]) => {
        const opts = call[1] as { table?: string }
        return opts?.table === 'street_status_entries'
      })
      
      expect(dailyStatusSubscription).toBeDefined()
      expect(entriesSubscription).toBeDefined()
    })

    it('cleans up channel on unmount', async () => {
      const { unmount } = render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled()
      })

      unmount()
      
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel)
    })

    it('creates new channel when street or date changes', async () => {
      const { rerender } = render(
        <StreetRow street={mockStreet} role="admin" selectedDate={new Date('2026-01-31')} />
      )
      
      await waitFor(() => {
        expect(supabase.channel).toHaveBeenCalled()
      })

      const initialCallCount = vi.mocked(supabase.channel).mock.calls.length

      // Change the date
      rerender(
        <StreetRow street={mockStreet} role="admin" selectedDate={new Date('2026-02-01')} />
      )
      
      await waitFor(() => {
        expect(vi.mocked(supabase.channel).mock.calls.length).toBeGreaterThan(initialCallCount)
      })

      // Should remove the old channel
      expect(supabase.removeChannel).toHaveBeenCalled()
    })
  })

  describe('formatTimestamp', () => {
    it('uses locale-config for timezone handling', async () => {
      const statusWithTimes = { 
        ...mockDailyStatus, 
        status: 'auf_dem_weg',
        started_at: '2026-01-31T08:30:00Z',
      }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(statusWithTimes) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.getByText(/Start:/)).toBeInTheDocument()
      })

      // Verify formatTimestamp from locale-config was called
      expect(localeConfig.formatTimestamp).toHaveBeenCalledWith('2026-01-31T08:30:00Z')
    })

    it('handles null timestamps gracefully', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })

      // Should not show time badges when timestamps are null
      expect(screen.queryByText(/Start:/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Fertig:/)).not.toBeInTheDocument()
    })
  })

  describe('Assigned User Names Display', () => {
    it('displays assigned user names in checkboxes when status is auf_dem_weg', async () => {
      const statusWithAssignedUsers = { 
        ...mockDailyStatus, 
        status: 'auf_dem_weg',
        assigned_users: ['user-1', 'user-2'],
        started_at: '2026-01-31T08:00:00Z',
      }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(statusWithAssignedUsers) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        // User names should appear in the users assignment section
        expect(screen.getByText('Max Mustermann')).toBeInTheDocument()
        expect(screen.getByText('Anna Schmidt')).toBeInTheDocument()
      })
      
      // Both checkboxes should be checked for assigned users
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toBeChecked()
      expect(checkboxes[1]).toBeChecked()
      
      // Should show the count of assigned users
      expect(screen.getByText(/2/)).toBeInTheDocument()
      expect(screen.getByText(/ausgewählt/)).toBeInTheDocument()
    })
  })

  describe('Status Insert on No Data', () => {
    it('creates new status entry when no data exists for street/date', async () => {
      // Return null for initial fetch to trigger insert
      let callCount = 0
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          const mock = createChainableMock(null)
          // First call returns null (no data), subsequent calls return the inserted data
          mock.then = vi.fn((resolve) => {
            callCount++
            if (callCount === 1) {
              return resolve({ data: null, error: null })
            }
            return resolve({ data: mockDailyStatus, error: null })
          })
          return mock as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        // Should have attempted to insert new status
        expect(supabase.from).toHaveBeenCalledWith('daily_street_status')
      })
    })
  })

  describe('Status CSS Classes', () => {
    it('applies correct class for offen status', async () => {
      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        expect(screen.queryByText('Lädt...')).not.toBeInTheDocument()
      })

      const statusSelect = screen.getByRole('combobox')
      expect(statusSelect).toHaveClass('status-offen')
    })

    it('applies correct class for auf_dem_weg status', async () => {
      const inProgressStatus = { ...mockDailyStatus, status: 'auf_dem_weg' }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(inProgressStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        const statusSelect = screen.getByRole('combobox')
        expect(statusSelect).toHaveClass('status-auf_dem_weg')
      })
    })

    it('applies correct class for erledigt status', async () => {
      const completedStatus = { ...mockDailyStatus, status: 'erledigt' }
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'daily_street_status') {
          return createChainableMock(completedStatus) as never
        }
        if (table === 'users') {
          return createChainableMock(mockUsers) as never
        }
        if (table === 'street_status_entries') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      render(<StreetRow street={mockStreet} role="admin" selectedDate={new Date()} />)
      
      await waitFor(() => {
        const statusSelect = screen.getByRole('combobox')
        expect(statusSelect).toHaveClass('status-erledigt')
      })
    })
  })
})
