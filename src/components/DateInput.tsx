import { useState } from "react";
import TouchCalendar from "./TouchCalendar";
import "../styles/date-input.css";

interface DateInputProps {
  value: string | undefined; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  allowFuture?: boolean;
  disabled?: boolean;
}

// Modern date input that opens TouchCalendar instead of native date picker
export default function DateInput({ 
  value, 
  onChange, 
  placeholder = "Datum wählen",
  allowFuture = true,
  disabled = false
}: DateInputProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  // Parse string to Date
  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Format Date to string
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Display format for the button
  const getDisplayValue = (): string => {
    if (!value) return placeholder;
    const date = parseDate(value);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const handleDateChange = (date: Date) => {
    onChange(formatDate(date));
    setShowCalendar(false);
  };

  return (
    <div className="date-input-container">
      <button
        type="button"
        className={`date-input-button ${!value ? 'placeholder' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setShowCalendar(true)}
        disabled={disabled}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{getDisplayValue()}</span>
      </button>

      {showCalendar && (
        <TouchCalendar
          selectedDate={parseDate(value || '')}
          onDateChange={handleDateChange}
          onClose={() => setShowCalendar(false)}
          maxDate={allowFuture ? new Date(2100, 11, 31) : new Date()}
        />
      )}
    </div>
  );
}
