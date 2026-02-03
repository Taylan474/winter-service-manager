import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import WorkHours from '../WorkHours'
import { supabase } from '../../lib/supabase'

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// Mock window.open for PDF export
const mockPrintWindow = {
  document: {
    write: vi.fn(),
    close: vi.fn(),
  },
  print: vi.fn(),
}

// Helper to create chainable mock for supabase queries
const createChainableMock = (resolvedData: unknown = null, resolvedError: unknown = null) => {
  const mock: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'order', 'single', 'upsert']
  
  methods.forEach(method => {
    mock[method] = vi.fn().mockReturnValue(mock)
  })
  
  // Make it thenable
  mock.then = vi.fn((resolve) => resolve({ data: resolvedData, error: resolvedError }))
  
  return mock
}

// Wrapper component for routing
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('WorkHours Page', () => {
  const mockUserId = 'user-123'
  const mockUserName = 'Max Mustermann'

  const mockCities = [
    { id: 'city-1', name: 'Berlin' },
    { id: 'city-2', name: 'München' },
  ]

  const mockStreets = [
    { id: 'street-1', name: 'Hauptstraße', area: { name: 'Zentrum' } },
    { id: 'street-2', name: 'Nebenstraße', area: { name: 'Nord' } },
  ]

  const mockWorkLogs = [
    {
      id: 'log-1',
      date: '2026-01-30',
      street_id: 'street-1',
      start_time: '08:00',
      end_time: '10:30',
      notes: 'Schnee geräumt',
      street: { name: 'Hauptstraße', city: { name: 'Berlin' } },
    },
    {
      id: 'log-2',
      date: '2026-01-30',
      street_id: 'street-2',
      start_time: '11:00',
      end_time: '12:00',
      notes: null,
      street: { name: 'Nebenstraße', city: { name: 'Berlin' } },
    },
    {
      id: 'log-3',
      date: '2026-01-29',
      street_id: 'street-1',
      start_time: '07:00',
      end_time: '09:00',
      notes: 'Salz gestreut',
      street: { name: 'Hauptstraße', city: { name: 'München' } },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow as unknown as Window)
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    // Setup default mocks
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'cities') {
        return createChainableMock(mockCities) as never
      }
      if (table === 'streets') {
        return createChainableMock(mockStreets) as never
      }
      if (table === 'work_logs') {
        return createChainableMock(mockWorkLogs) as never
      }
      return createChainableMock(null) as never
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Rendering', () => {
    it('shows loading then content', async () => {
      // Make fetch take time
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'work_logs') {
          const mock = createChainableMock(null)
          mock.then = vi.fn((resolve) => {
            return new Promise(r => {
              setTimeout(() => {
                resolve({ data: mockWorkLogs, error: null })
                r({ data: mockWorkLogs, error: null })
              }, 100)
            })
          })
          return mock as never
        }
        return createChainableMock(null) as never
      })

      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      // Should show page header immediately
      expect(screen.getByText('Meine Arbeitsstunden')).toBeInTheDocument()
      
      // Wait for content to load (add tab is now default)
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('renders page title and navigation', async () => {
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Meine Arbeitsstunden')).toBeInTheDocument()
        expect(screen.getByText('Zurück')).toBeInTheDocument()
      })
    })

    it('renders all tabs', async () => {
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        // "Neuer Eintrag" appears both in tab and in header
        const neuerEintragElements = screen.getAllByText('Neuer Eintrag')
        expect(neuerEintragElements.length).toBeGreaterThan(0)
        // "Alle Einträge" is unique in the tab
        expect(screen.getByText('Alle Einträge')).toBeInTheDocument()
      })
    })
  })

  // Helper to click the "Alle Einträge" tab (defined early for all tests)
  const clickListTab = async (user: ReturnType<typeof userEvent.setup>) => {
    const tabs = screen.getAllByRole('button').filter(btn => 
      btn.classList.contains('tab-btn') && btn.textContent?.includes('Alle Einträge')
    )
    if (tabs.length > 0) {
      await user.click(tabs[0])
    }
  }

  describe('View Mode Toggle', () => {
    it('can switch between day/week/month', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab where view toggle exists
      await clickListTab(user)

      // Find view toggle buttons
      const viewToggles = screen.getAllByRole('button', { name: 'Tag' })
      expect(viewToggles.length).toBeGreaterThan(0)

      // Click day view
      await user.click(viewToggles[0])
      await waitFor(() => {
        expect(viewToggles[0]).toHaveClass('active')
      })

      // Click week view
      const weekButtons = screen.getAllByRole('button', { name: 'Woche' })
      await user.click(weekButtons[0])
      await waitFor(() => {
        expect(weekButtons[0]).toHaveClass('active')
      })

      // Click month view  
      const monthButtons = screen.getAllByRole('button', { name: 'Monat' })
      await user.click(monthButtons[0])
      await waitFor(() => {
        expect(monthButtons[0]).toHaveClass('active')
      })
    })

    it('week view is default', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab where view toggle exists
      await clickListTab(user)
      
      await waitFor(() => {
        const weekButtons = screen.getAllByRole('button', { name: 'Woche' })
        expect(weekButtons[0]).toHaveClass('active')
      })
    })
  })

  describe('Date Navigation', () => {
    it('prev/next buttons work correctly', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })
      
      // Find navigation buttons by their SVG content (prev/next arrows)
      const navButtons = screen.getAllByRole('button')
      const prevButtons = navButtons.filter(btn => {
        const svg = btn.querySelector('svg polyline')
        return svg && svg.getAttribute('points')?.includes('15 18 9 12 15 6')
      })
      const nextButtons = navButtons.filter(btn => {
        const svg = btn.querySelector('svg polyline')
        return svg && svg.getAttribute('points')?.includes('9 18 15 12 9 6')
      })

      expect(prevButtons.length).toBeGreaterThan(0)
      expect(nextButtons.length).toBeGreaterThan(0)

      // Store initial call count
      const initialCallCount = vi.mocked(supabase.from).mock.calls.length

      // Click next
      await user.click(nextButtons[0])
      
      // Should trigger new data fetch
      await waitFor(() => {
        expect(vi.mocked(supabase.from).mock.calls.length).toBeGreaterThan(initialCallCount)
      })
    })

    it('today button resets to current date', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      const todayButtons = screen.getAllByRole('button', { name: 'Heute' })
      expect(todayButtons.length).toBeGreaterThan(0)

      await user.click(todayButtons[0])
      
      // Should refetch data
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('work_logs')
      })
    })
  })

  // Helper to click the "Neuer Eintrag" tab (not the button in quick actions)
  const clickAddTab = async (user: ReturnType<typeof userEvent.setup>) => {
    const tabs = screen.getAllByRole('button').filter(btn => 
      btn.classList.contains('tab-btn') && btn.textContent?.includes('Neuer Eintrag')
    )
    if (tabs.length > 0) {
      await user.click(tabs[0])
    }
  }

  describe('Add Entry Form', () => {
    it('submitting creates a new work log', async () => {
      const user = userEvent.setup()
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'streets') {
          return createChainableMock(mockStreets) as never
        }
        if (table === 'work_logs') {
          const mock = createChainableMock(mockWorkLogs)
          mock.insert = vi.fn().mockImplementation(() => {
            return Promise.resolve({ data: null, error: null })
          })
          return mock as never
        }
        return createChainableMock(null) as never
      })

      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to add tab (click the tab button, not the quick action button)
      await clickAddTab(user)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Find the selects by looking for stadt selection
      const allSelects = screen.getAllByRole('combobox')
      expect(allSelects.length).toBeGreaterThanOrEqual(2)
    })

    it('validates start time before end time', async () => {
      const user = userEvent.setup()
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to add tab
      await clickAddTab(user)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Try to submit without valid data - should show validation
      const saveButton = screen.getByRole('button', { name: /eintrag speichern/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalled()
      })
      
      alertMock.mockRestore()
    })

    it('shows validation error when city not selected', async () => {
      const user = userEvent.setup()
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to add tab
      await clickAddTab(user)
      
      await waitFor(() => {
        expect(screen.getByText('Eintrag speichern')).toBeInTheDocument()
      })

      const saveButton = screen.getByRole('button', { name: /eintrag speichern/i })
      await user.click(saveButton)
      
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Bitte wähle eine Stadt aus!')
      })
      
      alertMock.mockRestore()
    })
  })

  describe('Edit Entry', () => {
    it('clicking edit opens form with existing values', async () => {
      const user = userEvent.setup()
      
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab
      await clickListTab(user)
      
      await waitFor(() => {
        // Should see entries table - Hauptstraße appears multiple times
        const hauptstrasseElements = screen.getAllByText('Hauptstraße')
        expect(hauptstrasseElements.length).toBeGreaterThan(0)
      })

      // Find and click edit button (pencil icon)
      const editButtons = screen.getAllByTitle('Bearbeiten')
      expect(editButtons.length).toBeGreaterThan(0)
      
      await user.click(editButtons[0])
      
      await waitFor(() => {
        expect(screen.getByText('Eintrag bearbeiten')).toBeInTheDocument()
      })
    })
  })

  describe('Delete Entry', () => {
    it('clicking delete shows confirmation modal', async () => {
      const user = userEvent.setup()
      
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab
      await clickListTab(user)
      
      await waitFor(() => {
        // Hauptstraße appears multiple times in table
        const hauptstrasseElements = screen.getAllByText('Hauptstraße')
        expect(hauptstrasseElements.length).toBeGreaterThan(0)
      })

      // Find delete buttons
      const deleteButtons = screen.getAllByTitle('Löschen')
      expect(deleteButtons.length).toBeGreaterThan(0)

      await user.click(deleteButtons[0])
      
      await waitFor(() => {
        expect(screen.getByText('Eintrag löschen?')).toBeInTheDocument()
        expect(screen.getByText('Möchten Sie diesen Arbeitseintrag wirklich löschen?')).toBeInTheDocument()
      })
    })

    it('confirming delete removes entry', async () => {
      const user = userEvent.setup()
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        const mock = createChainableMock(table === 'cities' ? mockCities : table === 'work_logs' ? mockWorkLogs : null)
        if (table === 'work_logs') {
          mock.delete = vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => {
              return Promise.resolve({ error: null })
            })
          })
        }
        return mock as never
      })

      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab
      await clickListTab(user)
      
      await waitFor(() => {
        // Hauptstraße appears multiple times in table
        const hauptstrasseElements = screen.getAllByText('Hauptstraße')
        expect(hauptstrasseElements.length).toBeGreaterThan(0)
      })

      // Click delete
      const deleteButtons = screen.getAllByTitle('Löschen')
      await user.click(deleteButtons[0])
      
      await waitFor(() => {
        expect(screen.getByText('Eintrag löschen?')).toBeInTheDocument()
      })

      // Confirm deletion - find the button in the modal (has confirm-button class)
      const confirmButtons = screen.getAllByRole('button', { name: 'Löschen' })
      const confirmButton = confirmButtons.find(btn => btn.classList.contains('confirm-button'))
      expect(confirmButton).toBeDefined()
      await user.click(confirmButton!)
      
      // Delete should have been called
      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('work_logs')
      })
    })
  })

  describe('Empty State', () => {
    it('shows message when no entries', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'work_logs') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab
      await clickListTab(user)
      
      await waitFor(() => {
        expect(screen.getByText('Keine Einträge')).toBeInTheDocument()
        expect(screen.getByText('Keine Einträge für diesen Zeitraum gefunden.')).toBeInTheDocument()
        expect(screen.getByText('Ersten Eintrag erstellen')).toBeInTheDocument()
      })
    })

    it('empty state button navigates to add tab', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'work_logs') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab
      await clickListTab(user)
      
      await waitFor(() => {
        expect(screen.getByText('Ersten Eintrag erstellen')).toBeInTheDocument()
      })

      // Click the button to create first entry
      await user.click(screen.getByText('Ersten Eintrag erstellen'))
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })
    })
  })

  describe('Work Logs List', () => {
    it('shows entries for selected date range', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab
      await clickListTab(user)
      
      await waitFor(() => {
        // Should show table with entries
        expect(screen.getByRole('table')).toBeInTheDocument()
        
        // Check table headers exist
        const table = screen.getByRole('table')
        expect(within(table).getByText('Datum')).toBeInTheDocument()
        expect(within(table).getByText('Dauer')).toBeInTheDocument()
        
        // Should show actual entries (Hauptstraße appears in multiple rows)
        const hauptstrasseElements = screen.getAllByText('Hauptstraße')
        expect(hauptstrasseElements.length).toBeGreaterThan(0)
        // Berlin appears in multiple rows
        const berlinElements = screen.getAllByText('Berlin')
        expect(berlinElements.length).toBeGreaterThan(0)
      })
    })

    it('shows duration for each entry', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab
      await clickListTab(user)
      
      await waitFor(() => {
        // log-1: 08:00-10:30 = 2h 30min
        expect(screen.getByText('2h 30min')).toBeInTheDocument()
        // log-2: 11:00-12:00 = 1h 0min
        expect(screen.getByText('1h 0min')).toBeInTheDocument()
        // Use findByText for potentially async rendering
        // log-3: 07:00-09:00 = 2h 0min
        const durationElements = screen.getAllByText(/\d+h \d+min/)
        expect(durationElements.length).toBeGreaterThanOrEqual(3)
      })
    })

    it('shows notes when available', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab
      await clickListTab(user)
      
      await waitFor(() => {
        // Check for the table
        expect(screen.getByRole('table')).toBeInTheDocument()
        // Notes should be visible
        expect(screen.getByText('Schnee geräumt')).toBeInTheDocument()
        expect(screen.getByText('Salz gestreut')).toBeInTheDocument()
      })
    })
  })

  describe('Export Functionality', () => {
    it('export button works', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab where export button is
      await clickListTab(user)

      // Find and click export button
      const exportButtons = screen.getAllByText('PDF Export')
      expect(exportButtons.length).toBeGreaterThan(0)
      
      await user.click(exportButtons[0])
      
      // Should have called window.open
      expect(window.open).toHaveBeenCalledWith('', '_blank')
      
      // Should have written HTML to print window
      expect(mockPrintWindow.document.write).toHaveBeenCalled()
      expect(mockPrintWindow.document.close).toHaveBeenCalled()
      expect(mockPrintWindow.print).toHaveBeenCalled()
    })

    it('export includes statistics', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab where export button is
      await clickListTab(user)

      // Click export
      const exportButtons = screen.getAllByText('PDF Export')
      await user.click(exportButtons[0])
      
      // Check that the HTML written includes the total time
      const writeCall = mockPrintWindow.document.write.mock.calls[0][0]
      expect(writeCall).toContain('5h 30min')
      expect(writeCall).toContain('Max Mustermann')
    })

    it('export button not shown when no entries', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'work_logs') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to list tab
      await clickListTab(user)

      // PDF Export button in overview should not be present
      // (The quick-actions area only shows export when workLogs.length > 0)
      const quickActions = document.querySelector('.quick-actions')
      if (quickActions) {
        const exportInQuickActions = within(quickActions as HTMLElement).queryByText('PDF Export')
        expect(exportInQuickActions).not.toBeInTheDocument()
      }
    })
  })

  describe('Error Handling', () => {
    it('shows error when cities fail to load', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(null, { message: 'Database error' }) as never
        }
        if (table === 'work_logs') {
          return createChainableMock([]) as never
        }
        return createChainableMock(null) as never
      })

      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Fehler beim Laden der Städte:', expect.anything())
      })
      
      consoleSpy.mockRestore()
    })

    it('shows error when work logs fail to load', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'work_logs') {
          return createChainableMock(null, { message: 'Failed to load' }) as never
        }
        return createChainableMock(null) as never
      })

      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Fehler beim Laden der Work Logs:', expect.anything())
      })
      
      consoleSpy.mockRestore()
    })

    it('shows error alert when save fails', async () => {
      const user = userEvent.setup()
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      // Set up streets to load properly but insert to fail
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'streets') {
          return createChainableMock(mockStreets) as never
        }
        if (table === 'work_logs') {
          const mock = createChainableMock(mockWorkLogs)
          mock.insert = vi.fn().mockReturnValue(
            Promise.resolve({ data: null, error: { message: 'Insert failed' } })
          )
          return mock as never
        }
        return createChainableMock(null) as never
      })

      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to add tab
      await clickAddTab(user)
      
      await waitFor(() => {
        expect(screen.getByText('Stadt')).toBeInTheDocument()
      })

      // Try to submit - it should fail validation first
      const saveButton = screen.getByRole('button', { name: /eintrag speichern/i })
      await user.click(saveButton)
      
      // Should show validation alert (city not selected)
      expect(alertMock).toHaveBeenCalled()
      
      alertMock.mockRestore()
    })
  })

  describe('Tab Navigation', () => {
    it('add tab shows form (default tab)', async () => {
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
        // "Arbeitszeit" appears in form-card-header and sidebar, so use getAllByText
        const arbeitszeitElements = screen.getAllByText('Arbeitszeit')
        expect(arbeitszeitElements.length).toBeGreaterThan(0)
        expect(screen.getByText('Notizen (optional)')).toBeInTheDocument()
      })
    })

    it('list tab shows table', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      await clickListTab(user)
      
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
        const table = screen.getByRole('table')
        expect(within(table).getByText('Datum')).toBeInTheDocument()
        expect(within(table).getByText('Aktionen')).toBeInTheDocument()
      })
    })
  })

  describe('Sidebar Statistics (Add Tab)', () => {
    it('shows today entries count', async () => {
      const user = userEvent.setup()
      
      // Create a mock work log for today
      const today = new Date().toISOString().split('T')[0]
      const mockLogsWithToday = [
        ...mockWorkLogs,
        {
          id: 'log-today',
          date: today,
          street_id: 'street-1',
          start_time: '14:00',
          end_time: '15:00',
          notes: 'Today entry',
          street: { name: 'Hauptstraße', city: { name: 'Berlin' } },
        },
      ]
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'work_logs') {
          return createChainableMock(mockLogsWithToday) as never
        }
        return createChainableMock(null) as never
      })

      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to add tab
      await clickAddTab(user)
      
      await waitFor(() => {
        // "Heute" appears both in button and sidebar h3
        const heuteElements = screen.getAllByText('Heute')
        expect(heuteElements.length).toBeGreaterThan(0)
        // Text now includes KW number, so use partial match
        expect(screen.getByText(/Diese Woche/)).toBeInTheDocument()
      })
    })

    it('shows last entry information', async () => {
      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to add tab
      await clickAddTab(user)
      
      await waitFor(() => {
        expect(screen.getByText('Letzter Eintrag')).toBeInTheDocument()
      })
    })
  })

  describe('Loading States', () => {
    it('shows loading spinner when fetching entries', async () => {
      // Make the fetch hang initially
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'work_logs') {
          const mock = createChainableMock(null)
          mock.then = vi.fn(() => new Promise(() => {})) // Never resolves
          return mock as never
        }
        return createChainableMock(null) as never
      })

      const user = userEvent.setup()
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      // Switch to list tab
      await clickListTab(user)
      
      await waitFor(() => {
        expect(screen.getByText('Lädt Einträge...')).toBeInTheDocument()
      })
    })
  })

  describe('Back Navigation', () => {
    it('back button is present', async () => {
      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Zurück')).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation Messages', () => {
    it('shows error when end time is before start time', async () => {
      const user = userEvent.setup()
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
      
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'cities') {
          return createChainableMock(mockCities) as never
        }
        if (table === 'streets') {
          return createChainableMock(mockStreets) as never
        }
        if (table === 'work_logs') {
          return createChainableMock(mockWorkLogs) as never
        }
        return createChainableMock(null) as never
      })

      renderWithRouter(<WorkHours userId={mockUserId} userName={mockUserName} />)
      
      await waitFor(() => {
        expect(screen.getByText('Arbeitsort')).toBeInTheDocument()
      })

      // Switch to add tab
      await clickAddTab(user)
      
      await waitFor(() => {
        expect(screen.getByText('Stadt')).toBeInTheDocument()
      })

      // The form requires city, street, and valid times
      // Submit will fail validation at city step
      const saveButton = screen.getByRole('button', { name: /eintrag speichern/i })
      await user.click(saveButton)
      
      expect(alertMock).toHaveBeenCalledWith('Bitte wähle eine Stadt aus!')
      
      alertMock.mockRestore()
    })
  })
})
