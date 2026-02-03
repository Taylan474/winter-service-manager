import { useState } from "react";
import TouchCalendar from "./TouchCalendar";
import "../styles/datepicker.css";

type ViewMode = "day" | "week";

type DatePickerProps = {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  viewMode?: ViewMode; 
  onViewModeChange?: (mode: ViewMode) => void; 
  showViewToggle?: boolean; 
};

// Calendar component for streets and employee work hours
// Updated to use TouchCalendar for better usability with dirty hands
export default function DatePicker({ 
  selectedDate, 
  onDateChange,
  viewMode = "day",
  onViewModeChange,
  showViewToggle = false
}: DatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  // Calculate week number from a date
  const getWeekNumber = (date: Date): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  // Calculate start and end date of the current week
  const getWeekBounds = (date: Date): { monday: Date; sunday: Date } => {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { monday, sunday };
  };

  // Format date for calendar display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
// Format week with date range and week number
  
  const formatWeekDisplay = (date: Date): string => {
    const { monday, sunday } = getWeekBounds(date);
    const weekNum = getWeekNumber(date);
    
    const mondayStr = monday.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    
    const sundayStr = sunday.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    
    return `${mondayStr} - ${sundayStr} (KW ${weekNum})`;
  };
// Check if the given date is today
  
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentWeek = (date: Date): boolean => {
    const today = new Date();
    const { monday: currentMonday, sunday: currentSunday } = getWeekBounds(today);
    const { monday: selectedMonday, sunday: selectedSunday } = getWeekBounds(date);
    
    return (
      selectedMonday.toDateString() === currentMonday.toDateString() &&
      selectedSunday.toDateString() === currentSunday.toDateString()
    );
  };

  const goToPrevious = () => {
    const newDate = new Date(selectedDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    onDateChange(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(selectedDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
    setShowCalendar(false);
  };

  return (
    <div className="datepicker-container">
      {/* Optional: View Toggle */}
      {showViewToggle && onViewModeChange && (
        <div className="view-toggle">
          <button
            className={viewMode === "day" ? "active" : ""}
            onClick={() => onViewModeChange("day")}
          >
            Tag
          </button>
          <button
            className={viewMode === "week" ? "active" : ""}
            onClick={() => onViewModeChange("week")}
          >
            Woche
          </button>
        </div>
      )}

      {/* Navigation */}
      <button 
        className="date-nav-btn" 
        onClick={goToPrevious} 
        title={viewMode === "day" ? "Vorheriger Tag" : "Vorherige Woche"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="date-display">
        <button className="current-date-btn" onClick={() => setShowCalendar(!showCalendar)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="date-text">
            {viewMode === "day" ? formatDate(selectedDate) : formatWeekDisplay(selectedDate)}
          </span>
        </button>

        {viewMode === "day" ? (
          !isToday(selectedDate) && (
            <button className="today-btn" onClick={goToToday}>
              Heute
            </button>
          )
        ) : (
          !isCurrentWeek(selectedDate) && (
            <button className="today-btn" onClick={goToToday}>
              Aktuelle Woche
            </button>
          )
        )}

        {showCalendar && (
          <TouchCalendar
            selectedDate={selectedDate}
            onDateChange={(date) => {
              onDateChange(date);
              setShowCalendar(false);
            }}
            onClose={() => setShowCalendar(false)}
            maxDate={new Date(2100, 11, 31)} // Allow future dates for planning
          />
        )}
      </div>

      <button 
        className="date-nav-btn" 
        onClick={goToNext} 
        title={viewMode === "day" ? "Nächster Tag" : "Nächste Woche"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}