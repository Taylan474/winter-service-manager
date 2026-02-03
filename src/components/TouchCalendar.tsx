import { useState } from "react";
import "../styles/touch-calendar.css";

interface TouchCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onClose: () => void;
  maxDate?: Date;
}

// Touch-friendly calendar for workers with dirty hands
// Large buttons, no typing required
export default function TouchCalendar({ 
  selectedDate, 
  onDateChange, 
  onClose,
  maxDate = new Date()
}: TouchCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const MONTHS = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    // Convert Sunday = 0 to Monday = 0 format
    return day === 0 ? 6 : day - 1;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  const isFutureDate = (date: Date) => {
    const max = new Date(maxDate);
    max.setHours(23, 59, 59, 999);
    const check = new Date(date);
    check.setHours(0, 0, 0, 0);
    return check > max;
  };

  const goToPrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    const nextMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    if (nextMonth <= maxDate) {
      setViewDate(nextMonth);
    }
  };

  const selectDate = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (!isFutureDate(newDate)) {
      onDateChange(newDate);
      onClose();
    }
  };

  const selectToday = () => {
    onDateChange(new Date());
    onClose();
  };

  const renderDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days: React.ReactNode[] = [];
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isSelected = isSameDay(date, selectedDate);
      const isTodayDate = isToday(date);
      const isFuture = isFutureDate(date);
      
      days.push(
        <button
          key={day}
          className={`calendar-day ${isSelected ? "selected" : ""} ${isTodayDate ? "today" : ""} ${isFuture ? "disabled" : ""}`}
          onClick={() => selectDate(day)}
          disabled={isFuture}
          type="button"
        >
          {day}
        </button>
      );
    }
    
    return days;
  };

  const canGoNext = () => {
    const nextMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    return nextMonth <= maxDate;
  };

  return (
    <div className="touch-calendar-overlay" onClick={onClose}>
      <div className="touch-calendar" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-header">
          <button 
            className="month-nav-btn" 
            onClick={goToPrevMonth}
            type="button"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          
          <div className="month-year">
            <span className="month-name">{MONTHS[viewDate.getMonth()]}</span>
            <span className="year">{viewDate.getFullYear()}</span>
          </div>
          
          <button 
            className="month-nav-btn" 
            onClick={goToNextMonth}
            disabled={!canGoNext()}
            type="button"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        <div className="calendar-weekdays">
          {DAYS.map((day) => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {renderDays()}
        </div>

        <div className="calendar-actions">
          <button className="today-action-btn" onClick={selectToday} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Heute
          </button>
          <button className="close-action-btn" onClick={onClose} type="button">
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
