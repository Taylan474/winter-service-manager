import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForcePasswordChange from '../ForcePasswordChange'
import { supabase } from '../../lib/supabase'

// Mock supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
    },
    from: vi.fn(() => ({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  },
}))

describe('ForcePasswordChange', () => {
  const mockOnPasswordChanged = vi.fn()
  const mockOnLogout = vi.fn()
  const mockUser = { id: 'user-123', email: 'test@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the password change form', () => {
    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    expect(screen.getByText('Passwort ändern erforderlich')).toBeInTheDocument()
    // Use labelText or specific queries for inputs
    expect(screen.getByLabelText(/neues passwort/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/passwort bestätigen/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /passwort ändern/i })).toBeInTheDocument()
  })

  it('should show logout button', () => {
    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const logoutButton = screen.getByRole('button', { name: /abmelden/i })
    expect(logoutButton).toBeInTheDocument()
  })

  it('should call onLogout when logout button is clicked', async () => {
    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const logoutButton = screen.getByRole('button', { name: /abmelden/i })
    await userEvent.click(logoutButton)

    expect(mockOnLogout).toHaveBeenCalled()
  })

  it('should show error when passwords do not match', async () => {
    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const passwordInput = screen.getByLabelText(/neues passwort/i)
    const confirmInput = screen.getByLabelText(/passwort bestätigen/i)
    const submitButton = screen.getByRole('button', { name: /passwort ändern/i })

    await userEvent.type(passwordInput, 'ValidPass123!')
    await userEvent.type(confirmInput, 'DifferentPass456!')
    await userEvent.click(submitButton)

    await waitFor(() => {
      // Use more specific query to find the error message
      const errorMessage = document.querySelector('.message.error')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage?.textContent).toMatch(/passw(ö|o)rter stimmen nicht/i)
    })
  })

  it('should show error when password is too short', async () => {
    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const passwordInput = screen.getByLabelText(/neues passwort/i)
    const confirmInput = screen.getByLabelText(/passwort bestätigen/i)
    const submitButton = screen.getByRole('button', { name: /passwort ändern/i })

    await userEvent.type(passwordInput, 'short')
    await userEvent.type(confirmInput, 'short')
    await userEvent.click(submitButton)

    await waitFor(() => {
      // Use more specific query to find the error message
      const errorMessage = document.querySelector('.message.error')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage?.textContent).toMatch(/mindestens 8 zeichen/i)
    })
  })

  it('should show error when password lacks uppercase', async () => {
    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const passwordInput = screen.getByLabelText(/neues passwort/i)
    const confirmInput = screen.getByLabelText(/passwort bestätigen/i)
    const submitButton = screen.getByRole('button', { name: /passwort ändern/i })

    await userEvent.type(passwordInput, 'lowercase123!')
    await userEvent.type(confirmInput, 'lowercase123!')
    await userEvent.click(submitButton)

    await waitFor(() => {
      // Use more specific query to find the error message
      const errorMessage = document.querySelector('.message.error')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage?.textContent).toMatch(/großbuchstabe/i)
    })
  })

  it('should show error when password lacks number', async () => {
    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const passwordInput = screen.getByLabelText(/neues passwort/i)
    const confirmInput = screen.getByLabelText(/passwort bestätigen/i)
    const submitButton = screen.getByRole('button', { name: /passwort ändern/i })

    await userEvent.type(passwordInput, 'NoNumbers!')
    await userEvent.type(confirmInput, 'NoNumbers!')
    await userEvent.click(submitButton)

    await waitFor(() => {
      // Use more specific query to find the error message (not the requirement text)
      const errorMessage = document.querySelector('.message.error')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage?.textContent).toMatch(/zahl/i)
    })
  })

  it('should show password strength indicator', async () => {
    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const passwordInput = screen.getByLabelText(/neues passwort/i)

    await userEvent.type(passwordInput, 'weak')
    
    // Should show weak strength initially
    await waitFor(() => {
      const strengthIndicator = screen.getByText(/schwach/i)
      expect(strengthIndicator).toBeInTheDocument()
    })
  })

  it('should call supabase updateUser on successful password change', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: { id: 'user-123' } as never },
      error: null,
    })

    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const passwordInput = screen.getByLabelText(/neues passwort/i)
    const confirmInput = screen.getByLabelText(/passwort bestätigen/i)
    const submitButton = screen.getByRole('button', { name: /passwort ändern/i })

    await userEvent.type(passwordInput, 'ValidPassword123!')
    await userEvent.type(confirmInput, 'ValidPassword123!')
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'ValidPassword123!',
        data: { password_changed: true },
      })
    })
  })

  it('should show error on auth update failure', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'Password update failed' } as never,
    })

    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const passwordInput = screen.getByLabelText(/neues passwort/i)
    const confirmInput = screen.getByLabelText(/passwort bestätigen/i)
    const submitButton = screen.getByRole('button', { name: /passwort ändern/i })

    await userEvent.type(passwordInput, 'ValidPassword123!')
    await userEvent.type(confirmInput, 'ValidPassword123!')
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/password update failed/i)).toBeInTheDocument()
    })
  })

  it('should disable submit button while loading', async () => {
    // Make the update hang
    vi.mocked(supabase.auth.updateUser).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(
      <ForcePasswordChange
        user={mockUser}
        onPasswordChanged={mockOnPasswordChanged}
        onLogout={mockOnLogout}
      />
    )

    const passwordInput = screen.getByLabelText(/neues passwort/i)
    const confirmInput = screen.getByLabelText(/passwort bestätigen/i)
    const submitButton = screen.getByRole('button', { name: /passwort ändern/i })

    await userEvent.type(passwordInput, 'ValidPassword123!')
    await userEvent.type(confirmInput, 'ValidPassword123!')
    await userEvent.click(submitButton)

    await waitFor(() => {
      expect(submitButton).toBeDisabled()
    })
  })
})
