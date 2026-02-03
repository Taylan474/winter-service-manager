import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'
import { supabase } from '../lib/supabase'
import * as dataCache from '../lib/data-cache'

// Mock data-cache module
vi.mock('../lib/data-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof dataCache>()
  return {
    ...actual,
    fetchUserRoleWithCache: vi.fn(),
    dataCache: {
      clear: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
      invalidate: vi.fn(),
      invalidatePattern: vi.fn(),
    },
  }
})

// Mock child components to simplify tests
vi.mock('../pages/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}))

vi.mock('../pages/Cities', () => ({
  default: ({ onLogout }: { onLogout: () => void }) => (
    <div data-testid="cities-page">
      Cities Page
      <button onClick={onLogout}>Logout</button>
    </div>
  ),
}))

vi.mock('../pages/Streets', () => ({
  default: () => <div data-testid="streets-page">Streets Page</div>,
}))

vi.mock('../pages/Billing', () => ({
  default: () => <div data-testid="billing-page">Billing Page</div>,
}))

vi.mock('../pages/WorkHours', () => ({
  default: () => <div data-testid="workhours-page">WorkHours Page</div>,
}))

vi.mock('../components/ForcePasswordChange', () => ({
  default: ({ onPasswordChanged, onLogout }: { onPasswordChanged: () => void; onLogout: () => void }) => (
    <div data-testid="force-password-change">
      Force Password Change
      <button onClick={onPasswordChanged} data-testid="password-changed-btn">Password Changed</button>
      <button onClick={onLogout} data-testid="logout-btn">Logout</button>
    </div>
  ),
}))

vi.mock('../components/ConnectionIndicator', () => ({
  default: () => <div data-testid="connection-indicator">Connected</div>,
}))

// Helper to render App with Router
const renderApp = () => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}

// Helper to create a mock user with all required Supabase User properties
const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: { password_changed: true },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

// Helper to create a mock session with all required properties
// Using 'as any' to bypass strict type checking since tests only need partial data
const createMockSession = (user = createMockUser()) => ({
  user,
  access_token: 'mock-token',
  refresh_token: 'mock-refresh',
  expires_in: 3600,
  token_type: 'bearer',
} as any)

describe('App - Loading State Tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let authStateChangeCallback: ((event: any, session: any) => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    authStateChangeCallback = null
    
    // Default: capture the auth state change callback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback: any) => {
      authStateChangeCallback = callback
      return {
        data: {
          subscription: {
            id: 'mock-subscription-id',
            callback: callback,
            unsubscribe: vi.fn(),
          },
        },
      } as any
    })
    
    // Clean up localStorage
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Normal Flow', () => {
    it('should show loading state briefly then resolve to login when no session', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      renderApp()

      // Should show loading initially
      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Should resolve to login page
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      // Loading should be gone
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })

    it('should show loading state then resolve to content when session exists', async () => {
      const mockUser = createMockUser()
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'admin',
        name: 'Test User',
      })

      renderApp()

      // Should show loading initially
      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Should resolve to cities page
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      // Loading should be gone
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })
  })

  describe('Session Timeout (>3s)', () => {
    it('should end loading after session timeout and show login', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      // Session takes too long - never resolves
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      renderApp()

      // Should show loading initially
      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Advance time past the 3s session timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      // Should show login page (fallback)
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      // Loading should be gone
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    }, 10000)

    it('should end loading gracefully when session call rejects', async () => {
      vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('Network error'))

      renderApp()

      // Should show loading initially
      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Should resolve to login page after error
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })
  })

  describe('fetchUserRole Timeout (>5s)', () => {
    it('should fallback to mitarbeiter role when fetchUserRoleWithCache times out', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      const mockUser = createMockUser()
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      // fetchUserRoleWithCache never resolves (simulating timeout)
      vi.mocked(dataCache.fetchUserRoleWithCache).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      renderApp()

      // Should show loading initially
      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Advance time past the 5s role fetch timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100)
      })

      // Should show cities page (with fallback mitarbeiter role)
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      // Loading should be gone
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    }, 10000)

    it('should fallback to mitarbeiter role when fetchUserRoleWithCache returns null', async () => {
      const mockUser = createMockUser()
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      // Returns null (user not found in DB)
      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue(null)

      renderApp()

      // Should show loading initially
      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Should show cities page
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })
  })

  describe('No Session', () => {
    it('should show Login page immediately after loading ends', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      // fetchUserRoleWithCache should NOT be called when no session
      expect(dataCache.fetchUserRoleWithCache).not.toHaveBeenCalled()
    })
  })

  describe('Session Exists', () => {
    it('should fetch user role and show content', async () => {
      const mockUser = createMockUser()
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'admin',
        name: 'Test Admin',
      })

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      expect(dataCache.fetchUserRoleWithCache).toHaveBeenCalledWith('user-123')
    })
  })

  describe('Database Error on Role Fetch', () => {
    it('should fallback to mitarbeiter and show content when fetchUserRoleWithCache throws', async () => {
      const mockUser = createMockUser()
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      // Simulate database error
      vi.mocked(dataCache.fetchUserRoleWithCache).mockRejectedValue(new Error('Database connection failed'))

      renderApp()

      // Should show loading initially
      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Should still show cities page (fallback to mitarbeiter)
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })
  })

  describe('onAuthStateChange Events', () => {
    it('should properly update state on SIGNED_IN without infinite loading', async () => {
      const mockUser = createMockUser()

      // Start with no session
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'mitarbeiter',
        name: 'New User',
      })

      renderApp()

      // Wait for login page first
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      // Simulate SIGNED_IN event
      await act(async () => {
        if (authStateChangeCallback) {
          authStateChangeCallback('SIGNED_IN', createMockSession(mockUser))
        }
      })

      // Should show cities page after sign in
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      // Loading should be gone
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })

    it('should reset state and show login on SIGNED_OUT', async () => {
      const mockUser = createMockUser()
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'admin',
        name: 'Test User',
      })

      renderApp()

      // Wait for cities page first
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      // Simulate SIGNED_OUT event
      await act(async () => {
        if (authStateChangeCallback) {
          authStateChangeCallback('SIGNED_OUT', null)
        }
      })

      // Should show login page
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      // Loading should be gone
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })

    it('should handle USER_UPDATED event without refetching role', async () => {
      const mockUser = createMockUser()
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'admin',
        name: 'Test User',
      })

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      const callCountBefore = vi.mocked(dataCache.fetchUserRoleWithCache).mock.calls.length

      // Simulate USER_UPDATED event
      await act(async () => {
        if (authStateChangeCallback) {
          authStateChangeCallback('USER_UPDATED', createMockSession(mockUser))
        }
      })

      // Should not refetch role
      expect(vi.mocked(dataCache.fetchUserRoleWithCache).mock.calls.length).toBe(callCountBefore)

      // Should still show cities page
      expect(screen.getByTestId('cities-page')).toBeInTheDocument()
    })

    it('should ignore SIGNED_IN during user creation (localStorage flag)', async () => {
      const mockUser = createMockUser()

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      // Set localStorage flag indicating user creation
      localStorage.setItem('winterdienst_new_user_data', JSON.stringify({ name: 'New User' }))

      // Simulate SIGNED_IN event during user creation
      await act(async () => {
        if (authStateChangeCallback) {
          authStateChangeCallback('SIGNED_IN', createMockSession(mockUser))
        }
      })

      // Should still show login page (event ignored)
      expect(screen.getByTestId('login-page')).toBeInTheDocument()

      // Clean up
      localStorage.removeItem('winterdienst_new_user_data')
    })
  })

  describe('Logout', () => {
    it('should clear state, cache, and show login on logout', async () => {
      const mockUser = createMockUser()
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'admin',
        name: 'Test User',
      })

      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      await userEvent.click(logoutButton)

      // Should show login page
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      // Cache should be cleared
      expect(dataCache.dataCache.clear).toHaveBeenCalled()

      // signOut should be called
      expect(supabase.auth.signOut).toHaveBeenCalled()

      // Loading should NOT be shown
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })

    it('should still clear state even if signOut fails', async () => {
      const mockUser = createMockUser()
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'admin',
        name: 'Test User',
      })

      vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error('Sign out failed'))

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      // Click logout button
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      await userEvent.click(logoutButton)

      // Should still show login page despite error
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })
  })

  describe('Combined Worst Case', () => {
    it('should end loading within 10 seconds even when both session and role fetch timeout', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      // Session resolves slowly but before timeout
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { session: createMockSession() },
                  error: null,
                }),
              2900 // Just under 3s timeout
            )
          )
      )

      // Role fetch never resolves
      vi.mocked(dataCache.fetchUserRoleWithCache).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      renderApp()

      // Should show loading initially
      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Advance time - session should resolve at 2.9s
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })

      // Now advance more for role timeout (5s from when fetchUserRole is called)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5100)
      })

      // Should show cities page
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      // Loading should be gone - total time ~8s which is under 10s limit
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    }, 15000)

    it('should end loading when session times out (worst case: no session data)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      // Session never resolves
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () => new Promise(() => {})
      )

      renderApp()

      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Advance time past session timeout
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100)
      })

      // Should show login page (no session = no user)
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    }, 10000)
  })

  describe('Loading Spinner', () => {
    it('should display "Lade..." text during loading', async () => {
      // Make getSession slow so we can observe loading state
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { session: null }, error: null }), 100)
          )
      )

      renderApp()

      // Check for loading text
      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Wait for loading to end
      await waitFor(
        () => {
          expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
        },
        { timeout: 500 }
      )
    })

    it('should have spinner element during loading', async () => {
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { session: null }, error: null }), 100)
          )
      )

      renderApp()

      // Check for spinner class
      const spinner = document.querySelector('.spinner')
      expect(spinner).toBeInTheDocument()

      await waitFor(
        () => {
          expect(document.querySelector('.spinner')).not.toBeInTheDocument()
        },
        { timeout: 500 }
      )
    })
  })

  describe('Password Not Changed', () => {
    it('should show ForcePasswordChange component when password_changed is false', async () => {
      const mockUser = createMockUser({
        user_metadata: { password_changed: false },
      })
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'mitarbeiter',
        name: 'New User',
      })

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('force-password-change')).toBeInTheDocument()
      })

      // Should NOT show cities page
      expect(screen.queryByTestId('cities-page')).not.toBeInTheDocument()
      // Should NOT show login
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
      // Loading should be gone
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })

    it('should show main content after password is changed', async () => {
      const mockUser = createMockUser({
        user_metadata: { password_changed: false },
      })
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'mitarbeiter',
        name: 'New User',
      })

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('force-password-change')).toBeInTheDocument()
      })

      // Click password changed button
      const passwordChangedBtn = screen.getByTestId('password-changed-btn')
      await userEvent.click(passwordChangedBtn)

      // Should show cities page now
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })
    })

    it('should allow logout from ForcePasswordChange', async () => {
      const mockUser = createMockUser({
        user_metadata: { password_changed: false },
      })
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'mitarbeiter',
        name: 'New User',
      })

      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null })

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('force-password-change')).toBeInTheDocument()
      })

      // Click logout button
      const logoutBtn = screen.getByTestId('logout-btn')
      await userEvent.click(logoutBtn)

      // Should show login page
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })
    })

    it('should assume password already changed for legacy users without metadata', async () => {
      const mockUser = createMockUser({
        user_metadata: {}, // No password_changed field
      })
      const mockSession = createMockSession(mockUser)

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'admin',
        name: 'Legacy User',
      })

      renderApp()

      // Should show cities page (not force password change)
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('force-password-change')).not.toBeInTheDocument()
    })
  })

  describe('Never Hangs Guarantee', () => {
    it('should NEVER hang indefinitely - loading always ends within reasonable time', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })

      // Worst possible scenario: everything hangs
      vi.mocked(supabase.auth.getSession).mockImplementation(() => new Promise(() => {}))
      vi.mocked(dataCache.fetchUserRoleWithCache).mockImplementation(() => new Promise(() => {}))

      renderApp()

      expect(screen.getByText('Lade...')).toBeInTheDocument()

      // Advance time by 10 seconds (should be more than enough)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000)
      })

      // Loading MUST be gone by now
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()

      // Should show login (no session obtained)
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    }, 15000)

    it('should guarantee isLoading becomes false in all edge cases', async () => {
      const scenarios = [
        { name: 'null session', session: null, roleData: null },
        { name: 'session with null user', session: { user: null }, roleData: null },
        {
          name: 'session with role error',
          session: { user: createMockUser() },
          roleData: new Error('DB Error'),
        },
        {
          name: 'session with empty role',
          session: { user: createMockUser() },
          roleData: { role: '', name: '' },
        },
      ]

      for (const scenario of scenarios) {
        vi.clearAllMocks()

        vi.mocked(supabase.auth.getSession).mockResolvedValue({
          data: { session: scenario.session as any },
          error: null,
        })

        if (scenario.roleData instanceof Error) {
          vi.mocked(dataCache.fetchUserRoleWithCache).mockRejectedValue(scenario.roleData)
        } else {
          vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue(scenario.roleData)
        }

        const { unmount } = renderApp()

        // Wait for loading to complete
        await waitFor(
          () => {
            expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
          },
          { timeout: 1000 }
        )

        unmount()
      }
    })
  })

  describe('Auth State Flow', () => {
    it('should handle rapid auth state changes without breaking', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })

      vi.mocked(dataCache.fetchUserRoleWithCache).mockResolvedValue({
        role: 'mitarbeiter',
        name: 'User',
      })

      renderApp()

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
      })

      // Rapid sign in/out
      await act(async () => {
        if (authStateChangeCallback) {
          authStateChangeCallback('SIGNED_IN', createMockSession())
        }
      })

      await act(async () => {
        if (authStateChangeCallback) {
          authStateChangeCallback('SIGNED_OUT', null)
        }
      })

      await act(async () => {
        if (authStateChangeCallback) {
          authStateChangeCallback('SIGNED_IN', createMockSession())
        }
      })

      // Should eventually show cities page
      await waitFor(() => {
        expect(screen.getByTestId('cities-page')).toBeInTheDocument()
      })

      // No infinite loading
      expect(screen.queryByText('Lade...')).not.toBeInTheDocument()
    })
  })
})
