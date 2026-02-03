import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from '../../pages/Login'
import { supabase } from '../../lib/supabase'

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}))

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form', () => {
    render(<Login />)
    
    expect(screen.getByText('Winterdienst Login')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('deine@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /einloggen/i })).toBeInTheDocument()
  })

  it('shows info message about contacting admin', () => {
    render(<Login />)
    
    // Should show info about contacting admin for account
    const infoText = screen.getByText(/administrator/i)
    expect(infoText).toBeInTheDocument()
  })

  it('does NOT show registration option', () => {
    render(<Login />)
    
    // Registration should be completely removed
    expect(screen.queryByText(/registrieren/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/jetzt registrieren/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/dein name/i)).not.toBeInTheDocument()
  })

  it('shows error message when email is invalid', async () => {
    render(<Login />)
    
    const emailInput = screen.getByPlaceholderText('deine@example.com')
    const passwordInput = screen.getByPlaceholderText('••••••••')
    const loginButton = screen.getByRole('button', { name: /einloggen/i })
    
    await userEvent.type(emailInput, 'invalid-email')
    await userEvent.type(passwordInput, 'test123')
    await userEvent.click(loginButton)
    
    await waitFor(() => {
      expect(screen.getByText(/bitte eine gültige email/i)).toBeInTheDocument()
    })
  })

  it('shows error when email is empty', async () => {
    render(<Login />)
    
    const loginButton = screen.getByRole('button', { name: /einloggen/i })
    await userEvent.click(loginButton)
    
    await waitFor(() => {
      expect(screen.getByText(/bitte email eingeben/i)).toBeInTheDocument()
    })
  })

  it('shows error when password is empty', async () => {
    render(<Login />)
    
    const emailInput = screen.getByPlaceholderText('deine@example.com')
    const loginButton = screen.getByRole('button', { name: /einloggen/i })
    
    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.click(loginButton)
    
    await waitFor(() => {
      expect(screen.getByText(/bitte passwort eingeben/i)).toBeInTheDocument()
    })
  })

  it('calls supabase signInWithPassword on valid login', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: 'user-123' } as never, session: {} as never },
      error: null,
    })

    render(<Login />)
    
    const emailInput = screen.getByPlaceholderText('deine@example.com')
    const passwordInput = screen.getByPlaceholderText('••••••••')
    const loginButton = screen.getByRole('button', { name: /einloggen/i })
    
    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(loginButton)
    
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })

  it('shows error message on login failure', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' } as never,
    })

    render(<Login />)
    
    const emailInput = screen.getByPlaceholderText('deine@example.com')
    const passwordInput = screen.getByPlaceholderText('••••••••')
    const loginButton = screen.getByRole('button', { name: /einloggen/i })
    
    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'wrongpassword')
    await userEvent.click(loginButton)
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  it('disables submit button while loading', async () => {
    // Make the login hang
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<Login />)
    
    const emailInput = screen.getByPlaceholderText('deine@example.com')
    const passwordInput = screen.getByPlaceholderText('••••••••')
    const loginButton = screen.getByRole('button', { name: /einloggen/i })
    
    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(loginButton)
    
    await waitFor(() => {
      expect(loginButton).toBeDisabled()
    })
  })

  it('trims whitespace from email input', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: { id: 'user-123' } as never, session: {} as never },
      error: null,
    })

    render(<Login />)
    
    const emailInput = screen.getByPlaceholderText('deine@example.com')
    const passwordInput = screen.getByPlaceholderText('••••••••')
    const loginButton = screen.getByRole('button', { name: /einloggen/i })
    
    await userEvent.type(emailInput, '  test@example.com  ')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(loginButton)
    
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })
})