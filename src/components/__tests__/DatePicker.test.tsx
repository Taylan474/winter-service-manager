import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DatePicker from '../DatePicker'

// Mock TouchCalendar component to avoid complexity in tests
vi.mock('../TouchCalendar', () => ({
  default: ({ onDateChange, onClose }: { 
    selectedDate: Date;
    onDateChange: (date: Date) => void; 
    onClose: () => void;
  }) => (
    <div data-testid="touch-calendar">
      <input
        type="date"
        data-testid="calendar-date-input"
        onChange={(e) => {
          if (e.target.value) {
            onDateChange(new Date(e.target.value))
          }
        }}
      />
      <button onClick={onClose} data-testid="calendar-close">Close</button>
    </div>
  )
}))

describe('DatePicker Component', () => {
  const mockOnDateChange = vi.fn()
  const mockOnViewModeChange = vi.fn()
  
  // Fixed date for consistent testing: January 15, 2026 (Thursday)
  const testDate = new Date(2026, 0, 15)
  
  const defaultProps = {
    selectedDate: testDate,
    onDateChange: mockOnDateChange
  }

  beforeEach(() => {
    mockOnDateChange.mockClear()
    mockOnViewModeChange.mockClear()
    // Mock Date to control "today" for consistent tests
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 20)) // Set "today" to January 20, 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Day View', () => {
    it('displays formatted date in German', () => {
      render(<DatePicker {...defaultProps} viewMode="day" />)
      
      // Should display: "Donnerstag, 15. Januar 2026" (German format)
      expect(screen.getByText(/Donnerstag/i)).toBeInTheDocument()
      expect(screen.getByText(/15/)).toBeInTheDocument()
      expect(screen.getByText(/Januar/i)).toBeInTheDocument()
      expect(screen.getByText(/2026/)).toBeInTheDocument()
    })

    it('displays different dates correctly', () => {
      const customDate = new Date(2026, 5, 22) // June 22, 2026 (Monday)
      render(<DatePicker selectedDate={customDate} onDateChange={mockOnDateChange} viewMode="day" />)
      
      expect(screen.getByText(/Montag/i)).toBeInTheDocument()
      expect(screen.getByText(/22/)).toBeInTheDocument()
      expect(screen.getByText(/Juni/i)).toBeInTheDocument()
    })
  })

  describe('Week View', () => {
    it('displays week range with KW number', () => {
      render(<DatePicker {...defaultProps} viewMode="week" />)
      
      // Week of January 15, 2026: Monday 12.01.2026 - Sunday 18.01.2026 (KW 3)
      expect(screen.getByText(/12\.01\.2026/)).toBeInTheDocument()
      expect(screen.getByText(/18\.01\.2026/)).toBeInTheDocument()
      expect(screen.getByText(/KW 3/)).toBeInTheDocument()
    })

    it('displays correct week bounds for different dates', () => {
      const customDate = new Date(2026, 0, 1) // January 1, 2026 (Thursday)
      render(<DatePicker selectedDate={customDate} onDateChange={mockOnDateChange} viewMode="week" />)
      
      // Week of January 1, 2026: Monday 29.12.2025 - Sunday 04.01.2026 (KW 1)
      expect(screen.getByText(/29\.12\.2025/)).toBeInTheDocument()
      expect(screen.getByText(/04\.01\.2026/)).toBeInTheDocument()
      expect(screen.getByText(/KW 1/)).toBeInTheDocument()
    })
  })

  describe('View Toggle', () => {
    it('shows view toggle when showViewToggle is true', () => {
      const { container } = render(
        <DatePicker 
          {...defaultProps} 
          showViewToggle={true}
          onViewModeChange={mockOnViewModeChange}
        />
      )
      
      const viewToggle = container.querySelector('.view-toggle')
      expect(viewToggle).toBeInTheDocument()
      
      const toggleButtons = viewToggle?.querySelectorAll('button')
      expect(toggleButtons?.length).toBe(2)
      expect(toggleButtons?.[0].textContent).toBe('Tag')
      expect(toggleButtons?.[1].textContent).toBe('Woche')
    })

    it('does not show view toggle when showViewToggle is false', () => {
      const { container } = render(<DatePicker {...defaultProps} showViewToggle={false} />)
      
      const viewToggle = container.querySelector('.view-toggle')
      expect(viewToggle).not.toBeInTheDocument()
    })

    it('clicking Tag button switches to day view', () => {
      const { container } = render(
        <DatePicker 
          {...defaultProps} 
          viewMode="week"
          showViewToggle={true}
          onViewModeChange={mockOnViewModeChange}
        />
      )
      
      const viewToggle = container.querySelector('.view-toggle')
      const tagButton = viewToggle?.querySelector('button')
      expect(tagButton).toBeInTheDocument()
      fireEvent.click(tagButton!)
      
      expect(mockOnViewModeChange).toHaveBeenCalledWith('day')
    })

    it('clicking Woche button switches to week view', () => {
      const { container } = render(
        <DatePicker 
          {...defaultProps} 
          viewMode="day"
          showViewToggle={true}
          onViewModeChange={mockOnViewModeChange}
        />
      )
      
      const viewToggle = container.querySelector('.view-toggle')
      const buttons = viewToggle?.querySelectorAll('button')
      const wocheButton = buttons?.[1]
      expect(wocheButton).toBeInTheDocument()
      fireEvent.click(wocheButton!)
      
      expect(mockOnViewModeChange).toHaveBeenCalledWith('week')
    })

    it('applies active class to current view mode button', () => {
      const { container } = render(
        <DatePicker 
          {...defaultProps} 
          viewMode="day"
          showViewToggle={true}
          onViewModeChange={mockOnViewModeChange}
        />
      )
      
      const viewToggle = container.querySelector('.view-toggle')
      expect(viewToggle).toBeInTheDocument()
      
      const activeButton = viewToggle?.querySelector('.active')
      expect(activeButton?.textContent).toBe('Tag')
    })
  })

  describe('Navigation', () => {
    it('prev button goes to previous day in day view', () => {
      render(<DatePicker {...defaultProps} viewMode="day" />)
      
      const prevButton = screen.getByTitle('Vorheriger Tag')
      fireEvent.click(prevButton)
      
      expect(mockOnDateChange).toHaveBeenCalledTimes(1)
      const calledDate = mockOnDateChange.mock.calls[0][0]
      expect(calledDate.getDate()).toBe(14)
      expect(calledDate.getMonth()).toBe(0) // January
      expect(calledDate.getFullYear()).toBe(2026)
    })

    it('next button goes to next day in day view', () => {
      render(<DatePicker {...defaultProps} viewMode="day" />)
      
      const nextButton = screen.getByTitle('Nächster Tag')
      fireEvent.click(nextButton)
      
      expect(mockOnDateChange).toHaveBeenCalledTimes(1)
      const calledDate = mockOnDateChange.mock.calls[0][0]
      expect(calledDate.getDate()).toBe(16)
      expect(calledDate.getMonth()).toBe(0)
      expect(calledDate.getFullYear()).toBe(2026)
    })

    it('prev button goes to previous week in week view', () => {
      render(<DatePicker {...defaultProps} viewMode="week" />)
      
      const prevButton = screen.getByTitle('Vorherige Woche')
      fireEvent.click(prevButton)
      
      expect(mockOnDateChange).toHaveBeenCalledTimes(1)
      const calledDate = mockOnDateChange.mock.calls[0][0]
      expect(calledDate.getDate()).toBe(8) // 15 - 7 = 8
      expect(calledDate.getMonth()).toBe(0)
      expect(calledDate.getFullYear()).toBe(2026)
    })

    it('next button goes to next week in week view', () => {
      render(<DatePicker {...defaultProps} viewMode="week" />)
      
      const nextButton = screen.getByTitle('Nächste Woche')
      fireEvent.click(nextButton)
      
      expect(mockOnDateChange).toHaveBeenCalledTimes(1)
      const calledDate = mockOnDateChange.mock.calls[0][0]
      expect(calledDate.getDate()).toBe(22) // 15 + 7 = 22
      expect(calledDate.getMonth()).toBe(0)
      expect(calledDate.getFullYear()).toBe(2026)
    })

    it('navigates across month boundaries correctly', () => {
      const lastDayOfMonth = new Date(2026, 0, 1) // January 1
      render(<DatePicker selectedDate={lastDayOfMonth} onDateChange={mockOnDateChange} viewMode="day" />)
      
      const prevButton = screen.getByTitle('Vorheriger Tag')
      fireEvent.click(prevButton)
      
      const calledDate = mockOnDateChange.mock.calls[0][0]
      expect(calledDate.getDate()).toBe(31)
      expect(calledDate.getMonth()).toBe(11) // December
      expect(calledDate.getFullYear()).toBe(2025)
    })
  })

  describe('Today Button', () => {
    it('shows "Heute" button when not on current date in day view', () => {
      render(<DatePicker {...defaultProps} viewMode="day" />)
      
      // testDate is January 15, "today" is January 20
      expect(screen.getByRole('button', { name: /Heute/i })).toBeInTheDocument()
    })

    it('does not show "Heute" button when on current date in day view', () => {
      const today = new Date(2026, 0, 20) // Same as mocked system time
      render(<DatePicker selectedDate={today} onDateChange={mockOnDateChange} viewMode="day" />)
      
      expect(screen.queryByRole('button', { name: /^Heute$/i })).not.toBeInTheDocument()
    })

    it('shows "Aktuelle Woche" button when not in current week in week view', () => {
      render(<DatePicker {...defaultProps} viewMode="week" />)
      
      // testDate (Jan 15) is in KW 3, today (Jan 20) is in KW 4
      expect(screen.getByRole('button', { name: /Aktuelle Woche/i })).toBeInTheDocument()
    })

    it('does not show "Aktuelle Woche" button when in current week in week view', () => {
      const dateInCurrentWeek = new Date(2026, 0, 21) // Wednesday of current week (Jan 19-25)
      render(<DatePicker selectedDate={dateInCurrentWeek} onDateChange={mockOnDateChange} viewMode="week" />)
      
      expect(screen.queryByRole('button', { name: /Aktuelle Woche/i })).not.toBeInTheDocument()
    })

    it('navigates to today when clicking "Heute" button', () => {
      render(<DatePicker {...defaultProps} viewMode="day" />)
      
      const todayButton = screen.getByRole('button', { name: /Heute/i })
      fireEvent.click(todayButton)
      
      expect(mockOnDateChange).toHaveBeenCalledTimes(1)
      const calledDate = mockOnDateChange.mock.calls[0][0]
      expect(calledDate.getDate()).toBe(20)
      expect(calledDate.getMonth()).toBe(0)
      expect(calledDate.getFullYear()).toBe(2026)
    })

    it('navigates to today when clicking "Aktuelle Woche" button', () => {
      render(<DatePicker {...defaultProps} viewMode="week" />)
      
      const currentWeekButton = screen.getByRole('button', { name: /Aktuelle Woche/i })
      fireEvent.click(currentWeekButton)
      
      expect(mockOnDateChange).toHaveBeenCalledTimes(1)
      const calledDate = mockOnDateChange.mock.calls[0][0]
      expect(calledDate.getDate()).toBe(20)
    })
  })

  describe('Calendar Dropdown', () => {
    it('opens when clicking date button', () => {
      render(<DatePicker {...defaultProps} />)
      
      // Calendar should not be visible initially
      expect(screen.queryByTestId('touch-calendar')).not.toBeInTheDocument()
      
      // Click the date button
      const dateButton = screen.getByRole('button', { name: /Donnerstag/i })
      fireEvent.click(dateButton)
      
      // Calendar should now be visible
      expect(screen.getByTestId('touch-calendar')).toBeInTheDocument()
    })

    it('contains date input (mocked TouchCalendar)', () => {
      render(<DatePicker {...defaultProps} />)
      
      const dateButton = screen.getByRole('button', { name: /Donnerstag/i })
      fireEvent.click(dateButton)
      
      expect(screen.getByTestId('calendar-date-input')).toBeInTheDocument()
    })

    it('selecting date calls onDateChange', () => {
      render(<DatePicker {...defaultProps} />)
      
      const dateButton = screen.getByRole('button', { name: /Donnerstag/i })
      fireEvent.click(dateButton)
      
      const dateInput = screen.getByTestId('calendar-date-input')
      fireEvent.change(dateInput, { target: { value: '2026-02-14' } })
      
      expect(mockOnDateChange).toHaveBeenCalledTimes(1)
      const calledDate = mockOnDateChange.mock.calls[0][0]
      expect(calledDate.getFullYear()).toBe(2026)
      expect(calledDate.getMonth()).toBe(1) // February
      expect(calledDate.getDate()).toBe(14)
    })

    it('closes after date selection via TouchCalendar callback', () => {
      render(<DatePicker {...defaultProps} />)
      
      const dateButton = screen.getByRole('button', { name: /Donnerstag/i })
      fireEvent.click(dateButton)
      
      expect(screen.getByTestId('touch-calendar')).toBeInTheDocument()
      
      // Select a date (this triggers the onDateChange which also closes the calendar)
      const dateInput = screen.getByTestId('calendar-date-input')
      fireEvent.change(dateInput, { target: { value: '2026-02-14' } })
      
      // Calendar should be closed
      expect(screen.queryByTestId('touch-calendar')).not.toBeInTheDocument()
    })

    it('toggles calendar visibility on repeated clicks', () => {
      render(<DatePicker {...defaultProps} />)
      
      const dateButton = screen.getByRole('button', { name: /Donnerstag/i })
      
      // Open
      fireEvent.click(dateButton)
      expect(screen.getByTestId('touch-calendar')).toBeInTheDocument()
      
      // Close
      fireEvent.click(dateButton)
      expect(screen.queryByTestId('touch-calendar')).not.toBeInTheDocument()
    })

    it('closes calendar when clicking "Heute" button', () => {
      render(<DatePicker {...defaultProps} />)
      
      // Open calendar
      const dateButton = screen.getByRole('button', { name: /Donnerstag/i })
      fireEvent.click(dateButton)
      expect(screen.getByTestId('touch-calendar')).toBeInTheDocument()
      
      // Click "Heute" button
      const todayButton = screen.getByRole('button', { name: /Heute/i })
      fireEvent.click(todayButton)
      
      // Calendar should be closed
      expect(screen.queryByTestId('touch-calendar')).not.toBeInTheDocument()
    })
  })

  describe('Week Number Calculation', () => {
    it('correctly calculates ISO week 1 for January 1, 2026', () => {
      const jan1 = new Date(2026, 0, 1)
      render(<DatePicker selectedDate={jan1} onDateChange={mockOnDateChange} viewMode="week" />)
      
      expect(screen.getByText(/KW 1/)).toBeInTheDocument()
    })

    it('correctly calculates week 52/53 for end of year', () => {
      const dec31 = new Date(2026, 11, 31)
      render(<DatePicker selectedDate={dec31} onDateChange={mockOnDateChange} viewMode="week" />)
      
      // December 31, 2026 is in week 53
      expect(screen.getByText(/KW 53/)).toBeInTheDocument()
    })

    it('correctly calculates week number mid-year', () => {
      const july15 = new Date(2026, 6, 15)
      render(<DatePicker selectedDate={july15} onDateChange={mockOnDateChange} viewMode="week" />)
      
      // July 15, 2026 is in KW 29
      expect(screen.getByText(/KW 29/)).toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('shows weekday, day, month, year in German for day view', () => {
      render(<DatePicker {...defaultProps} viewMode="day" />)
      
      const dateText = screen.getByText(/Donnerstag, 15\. Januar 2026/i)
      expect(dateText).toBeInTheDocument()
    })

    it('formats Sunday correctly in German', () => {
      const sunday = new Date(2026, 0, 18) // January 18, 2026 is a Sunday
      render(<DatePicker selectedDate={sunday} onDateChange={mockOnDateChange} viewMode="day" />)
      
      expect(screen.getByText(/Sonntag/i)).toBeInTheDocument()
    })

    it('formats week display with correct date range format', () => {
      render(<DatePicker {...defaultProps} viewMode="week" />)
      
      // Should have format: "DD.MM.YYYY - DD.MM.YYYY (KW X)"
      const dateText = screen.getByText(/12\.01\.2026 - 18\.01\.2026 \(KW 3\)/)
      expect(dateText).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('navigation buttons have proper titles in day view', () => {
      render(<DatePicker {...defaultProps} viewMode="day" />)
      
      expect(screen.getByTitle('Vorheriger Tag')).toBeInTheDocument()
      expect(screen.getByTitle('Nächster Tag')).toBeInTheDocument()
    })

    it('navigation buttons have proper titles in week view', () => {
      render(<DatePicker {...defaultProps} viewMode="week" />)
      
      expect(screen.getByTitle('Vorherige Woche')).toBeInTheDocument()
      expect(screen.getByTitle('Nächste Woche')).toBeInTheDocument()
    })

    it('date button is clickable and has meaningful content', () => {
      render(<DatePicker {...defaultProps} viewMode="day" />)
      
      const dateButton = screen.getByRole('button', { name: /Donnerstag, 15\. Januar 2026/i })
      expect(dateButton).toBeInTheDocument()
      expect(dateButton).not.toBeDisabled()
    })

    it('all navigation buttons are keyboard accessible', () => {
      render(<DatePicker {...defaultProps} viewMode="day" />)
      
      const prevButton = screen.getByTitle('Vorheriger Tag')
      const nextButton = screen.getByTitle('Nächster Tag')
      
      // Should be focusable (button elements are by default)
      expect(prevButton.tagName).toBe('BUTTON')
      expect(nextButton.tagName).toBe('BUTTON')
    })
  })

  describe('Default Props', () => {
    it('defaults to day view when viewMode is not specified', () => {
      render(<DatePicker {...defaultProps} />)
      
      // Should show day format, not week format
      expect(screen.getByText(/Donnerstag/i)).toBeInTheDocument()
      expect(screen.queryByText(/KW/)).not.toBeInTheDocument()
    })

    it('does not show view toggle by default', () => {
      render(<DatePicker {...defaultProps} />)
      
      const viewToggle = document.querySelector('.view-toggle')
      expect(viewToggle).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles leap year date correctly', () => {
      const leapDay = new Date(2028, 1, 29) // February 29, 2028
      render(<DatePicker selectedDate={leapDay} onDateChange={mockOnDateChange} viewMode="day" />)
      
      expect(screen.getByText(/Dienstag/i)).toBeInTheDocument()
      expect(screen.getByText(/29/)).toBeInTheDocument()
      expect(screen.getByText(/Februar/i)).toBeInTheDocument()
    })

    it('handles year boundary navigation', () => {
      const jan1 = new Date(2026, 0, 1)
      render(<DatePicker selectedDate={jan1} onDateChange={mockOnDateChange} viewMode="day" />)
      
      const prevButton = screen.getByTitle('Vorheriger Tag')
      fireEvent.click(prevButton)
      
      const calledDate = mockOnDateChange.mock.calls[0][0]
      expect(calledDate.getFullYear()).toBe(2025)
      expect(calledDate.getMonth()).toBe(11) // December
      expect(calledDate.getDate()).toBe(31)
    })

    it('handles week boundary spanning two years', () => {
      const dec31 = new Date(2025, 11, 31) // December 31, 2025
      render(<DatePicker selectedDate={dec31} onDateChange={mockOnDateChange} viewMode="week" />)
      
      // Week containing Dec 31, 2025: Mon Dec 29, 2025 - Sun Jan 4, 2026
      expect(screen.getByText(/29\.12\.2025/)).toBeInTheDocument()
      expect(screen.getByText(/04\.01\.2026/)).toBeInTheDocument()
    })
  })
})
