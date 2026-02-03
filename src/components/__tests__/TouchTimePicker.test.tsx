import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TouchTimePicker from '../TouchTimePicker'

describe('TouchTimePicker Component', () => {
  const mockOnChange = vi.fn()

  const defaultProps = {
    value: '',
    onChange: mockOnChange
  }

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  describe('Initial Rendering', () => {
    it('displays "--:--" when no value is provided', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      expect(screen.getByText('--:--')).toBeInTheDocument()
    })

    it('displays current value when provided', () => {
      render(<TouchTimePicker value="08:30" onChange={mockOnChange} />)
      
      expect(screen.getByText('08:30')).toBeInTheDocument()
    })

    it('renders time display button', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
      expect(button).toHaveClass('time-display-btn')
    })

    it('renders clock icon in button', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const svg = document.querySelector('.time-display-btn svg')
      expect(svg).toBeInTheDocument()
    })
  })

  describe('Opening Picker', () => {
    it('clicking button shows modal', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      expect(screen.getByText('Zeit wählen')).toBeInTheDocument()
    })

    it('shows custom label when provided', () => {
      render(<TouchTimePicker value="" onChange={mockOnChange} label="Startzeit" />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      expect(screen.getByText('Startzeit')).toBeInTheDocument()
    })

    it('starts on hour step when opened', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      expect(screen.getByText('Stunde wählen:')).toBeInTheDocument()
    })

    it('parses existing value when opened', () => {
      render(<TouchTimePicker value="14:25" onChange={mockOnChange} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Preview should show parsed hour and minute
      const hourPreview = document.querySelector('.preview-hour')
      const minutePreview = document.querySelector('.preview-minute')
      
      expect(hourPreview).toHaveTextContent('14')
      expect(minutePreview).toHaveTextContent('25')
    })
  })

  describe('Hours Grid', () => {
    it('only shows hours 02-18 (work hours)', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const hourGrid = document.querySelector('.hour-grid')
      expect(hourGrid).toBeInTheDocument()
      
      // Should have 17 hour buttons (02 to 18 inclusive)
      const hourButtons = hourGrid?.querySelectorAll('.time-btn')
      expect(hourButtons?.length).toBe(17)
      
      // Check first and last hours
      expect(screen.getByRole('button', { name: '02' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '18' })).toBeInTheDocument()
      
      // Should NOT have hours outside work range
      expect(screen.queryByRole('button', { name: '00' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '01' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '19' })).not.toBeInTheDocument()
    })

    it('highlights currently selected hour', () => {
      render(<TouchTimePicker value="10:00" onChange={mockOnChange} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const hour10Button = screen.getByRole('button', { name: '10' })
      expect(hour10Button).toHaveClass('selected')
    })
  })

  describe('Hour Selection', () => {
    it('clicking hour moves to minute step', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Select an hour
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      // Should now show minute step
      expect(screen.getByText('Minute wählen:')).toBeInTheDocument()
      expect(screen.queryByText('Stunde wählen:')).not.toBeInTheDocument()
    })

    it('updates selectedHour in preview', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Select an hour
      const hour14Button = screen.getByRole('button', { name: '14' })
      fireEvent.click(hour14Button)
      
      // Preview should show selected hour
      const hourPreview = document.querySelector('.preview-hour')
      expect(hourPreview).toHaveTextContent('14')
    })
  })

  describe('Minute Selection', () => {
    it('shows minute grid with 5-minute intervals', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Go to minute step
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      // Should have minute buttons 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
      expect(screen.getByRole('button', { name: '00' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '05' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '55' })).toBeInTheDocument()
    })

    it('clicking minute calls onChange with formatted time', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Select hour 08
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      // Select minute 30
      const minute30Button = screen.getByRole('button', { name: '30' })
      fireEvent.click(minute30Button)
      
      expect(mockOnChange).toHaveBeenCalledWith('08:30')
    })

    it('closes picker after minute selection', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Select hour
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      // Select minute
      const minute30Button = screen.getByRole('button', { name: '30' })
      fireEvent.click(minute30Button)
      
      // Modal should be closed
      expect(screen.queryByText('Zeit wählen')).not.toBeInTheDocument()
    })
  })

  describe('Step Navigation', () => {
    it('can go back from minute step to hour step using back button', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Go to minute step
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      expect(screen.getByText('Minute wählen:')).toBeInTheDocument()
      
      // Click back button
      const backButton = screen.getByRole('button', { name: /Zurück zur Stunde/i })
      fireEvent.click(backButton)
      
      // Should be back on hour step
      expect(screen.getByText('Stunde wählen:')).toBeInTheDocument()
    })

    it('can switch to hour step by clicking hour preview', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Go to minute step
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      // Click hour preview
      const hourPreview = document.querySelector('.preview-hour')
      if (hourPreview) {
        fireEvent.click(hourPreview)
      }
      
      // Should be back on hour step
      expect(screen.getByText('Stunde wählen:')).toBeInTheDocument()
    })

    it('can switch to minute step by clicking minute preview', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // We're on hour step, click minute preview
      const minutePreview = document.querySelector('.preview-minute')
      if (minutePreview) {
        fireEvent.click(minutePreview)
      }
      
      // Should be on minute step
      expect(screen.getByText('Minute wählen:')).toBeInTheDocument()
    })
  })

  describe('Preview Display', () => {
    it('shows selected hour in header', () => {
      render(<TouchTimePicker value="12:45" onChange={mockOnChange} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const hourPreview = document.querySelector('.preview-hour')
      expect(hourPreview).toHaveTextContent('12')
    })

    it('shows selected minute in header', () => {
      render(<TouchTimePicker value="12:45" onChange={mockOnChange} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const minutePreview = document.querySelector('.preview-minute')
      expect(minutePreview).toHaveTextContent('45')
    })

    it('highlights active step in preview', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Hour step should be active initially
      const hourPreview = document.querySelector('.preview-hour')
      expect(hourPreview).toHaveClass('active')
      
      // Move to minute step
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      // Minute step should now be active
      const minutePreview = document.querySelector('.preview-minute')
      expect(minutePreview).toHaveClass('active')
    })

    it('shows separator between hour and minute', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const separator = document.querySelector('.preview-separator')
      expect(separator).toHaveTextContent(':')
    })
  })

  describe('Closing Picker', () => {
    it('clicking overlay closes picker', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      expect(screen.getByText('Zeit wählen')).toBeInTheDocument()
      
      const overlay = document.querySelector('.time-picker-overlay')
      if (overlay) {
        fireEvent.click(overlay)
      }
      
      expect(screen.queryByText('Zeit wählen')).not.toBeInTheDocument()
    })

    it('clicking X button closes picker', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      expect(screen.getByText('Zeit wählen')).toBeInTheDocument()
      
      const closeButton = document.querySelector('.close-picker-btn')
      if (closeButton) {
        fireEvent.click(closeButton)
      }
      
      expect(screen.queryByText('Zeit wählen')).not.toBeInTheDocument()
    })

    it('clicking modal content does not close picker', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const modal = document.querySelector('.time-picker-modal')
      if (modal) {
        fireEvent.click(modal)
      }
      
      // Modal should still be open
      expect(screen.getByText('Zeit wählen')).toBeInTheDocument()
    })
  })

  describe('Time Formatting', () => {
    it('returns time in HH:MM format with leading zeros for hour', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Select hour 05
      const hour05Button = screen.getByRole('button', { name: '05' })
      fireEvent.click(hour05Button)
      
      // Select minute 05
      const minute05Button = screen.getByRole('button', { name: '05' })
      fireEvent.click(minute05Button)
      
      expect(mockOnChange).toHaveBeenCalledWith('05:05')
    })

    it('returns time in HH:MM format with leading zeros for minute', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Select hour 10
      const hour10Button = screen.getByRole('button', { name: '10' })
      fireEvent.click(hour10Button)
      
      // Select minute 00
      const minute00Button = screen.getByRole('button', { name: '00' })
      fireEvent.click(minute00Button)
      
      expect(mockOnChange).toHaveBeenCalledWith('10:00')
    })

    it('correctly formats double-digit hours', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Select hour 15
      const hour15Button = screen.getByRole('button', { name: '15' })
      fireEvent.click(hour15Button)
      
      // Select minute 45
      const minute45Button = screen.getByRole('button', { name: '45' })
      fireEvent.click(minute45Button)
      
      expect(mockOnChange).toHaveBeenCalledWith('15:45')
    })
  })

  describe('Edge Cases', () => {
    it('handles edge time 02:00 (start of work hours)', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const hour02Button = screen.getByRole('button', { name: '02' })
      fireEvent.click(hour02Button)
      
      const minute00Button = screen.getByRole('button', { name: '00' })
      fireEvent.click(minute00Button)
      
      expect(mockOnChange).toHaveBeenCalledWith('02:00')
    })

    it('handles edge time 18:55 (end of work hours)', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const hour18Button = screen.getByRole('button', { name: '18' })
      fireEvent.click(hour18Button)
      
      const minute55Button = screen.getByRole('button', { name: '55' })
      fireEvent.click(minute55Button)
      
      expect(mockOnChange).toHaveBeenCalledWith('18:55')
    })

    it('defaults to 06:00 when value is empty', () => {
      render(<TouchTimePicker value="" onChange={mockOnChange} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const hourPreview = document.querySelector('.preview-hour')
      const minutePreview = document.querySelector('.preview-minute')
      
      expect(hourPreview).toHaveTextContent('06')
      expect(minutePreview).toHaveTextContent('00')
    })

    it('handles invalid value gracefully', () => {
      render(<TouchTimePicker value="invalid" onChange={mockOnChange} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Should fall back to defaults
      const hourPreview = document.querySelector('.preview-hour')
      const minutePreview = document.querySelector('.preview-minute')
      
      expect(hourPreview).toHaveTextContent('06')
      expect(minutePreview).toHaveTextContent('00')
    })

    it('preserves minute selection while changing hour', () => {
      render(<TouchTimePicker value="08:30" onChange={mockOnChange} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Minute should be preserved from initial value
      const minutePreview = document.querySelector('.preview-minute')
      expect(minutePreview).toHaveTextContent('30')
    })
  })

  describe('Accessibility', () => {
    it('buttons have type="button" to prevent form submission', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const triggerButton = screen.getByRole('button')
      expect(triggerButton).toHaveAttribute('type', 'button')
    })

    it('hour buttons have type="button"', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const hourButtons = document.querySelectorAll('.hour-grid .time-btn')
      hourButtons.forEach((btn) => {
        expect(btn).toHaveAttribute('type', 'button')
      })
    })

    it('minute buttons have type="button"', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Go to minute step
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      const minuteButtons = document.querySelectorAll('.minute-grid .time-btn')
      minuteButtons.forEach((btn) => {
        expect(btn).toHaveAttribute('type', 'button')
      })
    })

    it('back button has type="button"', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Go to minute step
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      const backButton = screen.getByRole('button', { name: /Zurück zur Stunde/i })
      expect(backButton).toHaveAttribute('type', 'button')
    })

    it('close button has type="button"', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      const closeButton = document.querySelector('.close-picker-btn')
      expect(closeButton).toHaveAttribute('type', 'button')
    })

    it('hour buttons are properly labeled with hour values', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Hour buttons should show formatted hours
      expect(screen.getByRole('button', { name: '02' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '06' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '18' })).toBeInTheDocument()
    })

    it('minute buttons are properly labeled with minute values', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Go to minute step
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      
      // Minute buttons should show formatted minutes
      expect(screen.getByRole('button', { name: '00' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '15' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '45' })).toBeInTheDocument()
    })
  })

  describe('Multiple opens and closes', () => {
    it('resets to hour step when reopened', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const triggerButton = screen.getByRole('button')
      
      // First open - go to minute step
      fireEvent.click(triggerButton)
      const hour08Button = screen.getByRole('button', { name: '08' })
      fireEvent.click(hour08Button)
      expect(screen.getByText('Minute wählen:')).toBeInTheDocument()
      
      // Close via overlay
      const overlay = document.querySelector('.time-picker-overlay')
      if (overlay) {
        fireEvent.click(overlay)
      }
      
      // Reopen - should be back on hour step
      fireEvent.click(triggerButton)
      expect(screen.getByText('Stunde wählen:')).toBeInTheDocument()
    })

    it('does not call onChange when closing without selection', () => {
      render(<TouchTimePicker {...defaultProps} />)
      
      const button = screen.getByRole('button')
      fireEvent.click(button)
      
      // Close without selecting
      const closeButton = document.querySelector('.close-picker-btn')
      if (closeButton) {
        fireEvent.click(closeButton)
      }
      
      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })
})
