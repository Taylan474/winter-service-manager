import { useState } from "react";

interface TouchTimePickerProps {
  value: string; // "HH:MM" format
  onChange: (time: string) => void;
  label?: string;
}

// Touch-friendly time picker for workers with dirty hands
// Uses big buttons to select hour and minute - no typing required
export default function TouchTimePicker({ value, onChange, label }: TouchTimePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number>(() => {
    if (value) {
      const [h] = value.split(":");
      return parseInt(h, 10) || 6;
    }
    return 6; // Default to 6:00
  });
  const [selectedMinute, setSelectedMinute] = useState<number>(() => {
    if (value) {
      const [, m] = value.split(":");
      return parseInt(m, 10) || 0;
    }
    return 0;
  });
  const [step, setStep] = useState<"hour" | "minute">("hour");

  // Hours 01-21 only (work hours: 1am to 9pm)
  const HOURS = Array.from({ length: 21 }, (_, i) => i + 1);
  const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const formatHour = (h: number) => h.toString().padStart(2, "0");
  const formatMinute = (m: number) => m.toString().padStart(2, "0");

  const handleOpen = () => {
    // Parse current value or use defaults
    if (value) {
      const [h, m] = value.split(":");
      setSelectedHour(parseInt(h, 10) || 6);
      setSelectedMinute(parseInt(m, 10) || 0);
    }
    setStep("hour");
    setShowPicker(true);
  };

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
    setStep("minute");
  };

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
    const timeString = `${formatHour(selectedHour)}:${formatMinute(minute)}`;
    onChange(timeString);
    setShowPicker(false);
  };

  // Auto-save with :00 if user closes modal after selecting hour
  const handleClose = () => {
    if (step === "minute") {
      // User selected an hour but didn't pick a minute - default to :00
      const timeString = `${formatHour(selectedHour)}:00`;
      onChange(timeString);
    }
    setShowPicker(false);
  };

  const displayValue = value || "--:--";

  return (
    <div className="touch-time-picker">
      <button 
        type="button" 
        className="time-display-btn"
        onClick={handleOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="time-value">{displayValue}</span>
      </button>

      {showPicker && (
        <div className="time-picker-overlay" onClick={handleClose}>
          <div className="time-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="time-picker-header">
              <h3>{label || "Zeit wählen"}</h3>
              <div className="time-preview">
                <span 
                  className={`preview-hour ${step === "hour" ? "active" : ""}`}
                  onClick={() => setStep("hour")}
                >
                  {formatHour(selectedHour)}
                </span>
                <span className="preview-separator">:</span>
                <span 
                  className={`preview-minute ${step === "minute" ? "active" : ""}`}
                  onClick={() => setStep("minute")}
                >
                  {formatMinute(selectedMinute)}
                </span>
              </div>
              <button 
                className="close-picker-btn" 
                onClick={handleClose}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="time-picker-body">
              {step === "hour" ? (
                <>
                  <p className="step-label">Stunde wählen:</p>
                  <div className="hour-grid">
                    {HOURS.map((hour) => (
                      <button
                        key={hour}
                        type="button"
                        className={`time-btn ${selectedHour === hour ? "selected" : ""}`}
                        onClick={() => handleHourSelect(hour)}
                      >
                        {formatHour(hour)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="step-label">Minute wählen (oder einfach schließen für :00):</p>
                  <div className="minute-grid">
                    {MINUTES.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        className={`time-btn ${selectedMinute === minute ? "selected" : ""}`}
                        onClick={() => handleMinuteSelect(minute)}
                      >
                        {formatMinute(minute)}
                      </button>
                    ))}
                  </div>
                  <button 
                    type="button" 
                    className="back-btn"
                    onClick={() => setStep("hour")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Zurück zur Stunde
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .touch-time-picker {
          position: relative;
        }

        .time-display-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.9rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          color: #fff;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .time-display-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: #646cff;
        }

        .time-display-btn svg {
          color: #646cff;
          flex-shrink: 0;
        }

        .time-value {
          font-family: monospace;
          font-size: 1.2rem;
        }

        .time-picker-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 1rem;
          animation: fadeIn 0.15s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .time-picker-modal {
          background: linear-gradient(135deg, #1a1a1a 0%, #242424 100%);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          padding: 1.5rem;
          width: 100%;
          max-width: 340px;
          max-height: 85vh;
          overflow-x: hidden;
          overflow-y: auto;
          animation: slideUp 0.2s ease-out;
        }

        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }

        .time-picker-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .time-picker-header h3 {
          margin: 0;
          font-size: 1rem;
          color: #888;
          font-weight: 500;
        }

        .time-preview {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-family: monospace;
          font-size: 2rem;
          font-weight: 700;
        }

        .preview-hour,
        .preview-minute {
          padding: 0.25rem 0.5rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .preview-hour:hover,
        .preview-minute:hover {
          background: rgba(100, 108, 255, 0.1);
        }

        .preview-hour.active,
        .preview-minute.active {
          background: #646cff;
          color: #fff;
        }

        .preview-separator {
          color: #646cff;
        }

        .close-picker-btn {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .close-picker-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .step-label {
          margin: 0 0 0.75rem 0;
          color: #888;
          font-size: 0.9rem;
        }

        .hour-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }

        .minute-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .time-btn {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          font-weight: 600;
          font-family: monospace;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s;
          min-height: 48px;
          min-width: 48px;
        }

        .time-btn:hover {
          background: rgba(100, 108, 255, 0.2);
          border-color: rgba(100, 108, 255, 0.5);
          transform: scale(1.05);
        }

        .time-btn:active {
          transform: scale(0.95);
        }

        .time-btn.selected {
          background: #646cff;
          border-color: #646cff;
          color: #fff;
          box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
        }

        .back-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          margin-top: 1rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #888;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        /* Make even bigger on touch devices */
        @media (pointer: coarse) {
          .time-btn {
            min-height: 56px;
            font-size: 1.2rem;
          }

          .hour-grid {
            grid-template-columns: repeat(4, 1fr);
          }

          .minute-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 400px) {
          .time-picker-modal {
            padding: 1rem;
          }

          .hour-grid {
            grid-template-columns: repeat(4, 1fr);
          }

          .time-btn {
            min-height: 52px;
          }
        }
      `}</style>
    </div>
  );
}
