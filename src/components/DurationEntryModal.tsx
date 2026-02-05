import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import "../styles/duration-entry-modal.css";

interface DurationEntryModalProps {
  streetName: string;
  streetId: string;
  date: string; // YYYY-MM-DD format
  assignedUsers: string[]; // All users assigned to this street
  onClose: () => void;
  onSuccess: (startTime: string, endTime: string) => void;
}

// Modal for entering work duration after marking a street as completed
// Creates work log entries for ALL assigned users
export default function DurationEntryModal({
  streetName,
  streetId,
  date,
  assignedUsers,
  onClose,
  onSuccess,
}: DurationEntryModalProps) {
  const [duration, setDuration] = useState<number>(30);
  const [durationInput, setDurationInput] = useState<string>("30");
  const [customStartTime, setCustomStartTime] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const presetDurations = [15, 20, 30, 45, 60, 90];

  // Handle preset button click
  const handlePresetClick = (preset: number) => {
    setDuration(preset);
    setDurationInput(String(preset));
  };

  // Handle custom input change - allow empty during editing
  const handleInputChange = (value: string) => {
    setDurationInput(value);
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setDuration(num);
    }
  };

  // Handle input blur - ensure valid value
  const handleInputBlur = () => {
    const num = parseInt(durationInput, 10);
    if (isNaN(num) || num <= 0) {
      setDuration(30);
      setDurationInput("30");
    } else {
      setDuration(num);
      setDurationInput(String(num));
    }
  };

  // Get current user on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setCurrentUserId(data.user.id);
    };
    getCurrentUser();
  }, []);

  // Round time to nearest interval (e.g., 07:41 -> 07:40 for 5-min intervals)
  const roundToNearestInterval = (hours: number, minutes: number, interval: number): { hours: number; minutes: number } => {
    const totalMinutes = hours * 60 + minutes;
    const roundedMinutes = Math.round(totalMinutes / interval) * interval;
    return {
      hours: Math.floor(roundedMinutes / 60) % 24,
      minutes: roundedMinutes % 60,
    };
  };

  // Calculate clean start and end times based on duration
  // Uses 5-minute intervals for more precise times while keeping them "clean"
  const calculateCleanTimes = (durationMinutes: number): { startTime: string; endTime: string } => {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // Round end time to nearest 5 minutes
    const endRounded = roundToNearestInterval(currentHours, currentMinutes, 5);

    // Calculate raw start time
    let startTotalMinutes = (endRounded.hours * 60 + endRounded.minutes) - durationMinutes;
    
    // Handle overnight case
    if (startTotalMinutes < 0) {
      startTotalMinutes += 24 * 60;
    }

    // Round start time to nearest 5 minutes
    const startRounded = roundToNearestInterval(
      Math.floor(startTotalMinutes / 60),
      startTotalMinutes % 60,
      5
    );

    // Format times as HH:MM
    const formatTime = (h: number, m: number) =>
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

    return {
      startTime: formatTime(startRounded.hours, startRounded.minutes),
      endTime: formatTime(endRounded.hours, endRounded.minutes),
    };
  };

  // Calculate end time from custom start time + duration
  const calculateEndTimeFromStart = (start: string, durationMinutes: number): string => {
    const [startH, startM] = start.split(":").map(Number);
    let endTotalMinutes = startH * 60 + startM + durationMinutes;
    
    // Handle overflow past midnight
    if (endTotalMinutes >= 24 * 60) {
      endTotalMinutes -= 24 * 60;
    }

    const endH = Math.floor(endTotalMinutes / 60);
    const endM = endTotalMinutes % 60;
    
    return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
  };

  // Get the actual times to use (custom or calculated)
  const getActualTimes = (): { startTime: string; endTime: string } => {
    if (customStartTime) {
      return {
        startTime: customStartTime,
        endTime: calculateEndTimeFromStart(customStartTime, duration),
      };
    }
    return calculateCleanTimes(duration);
  };

  const handleSubmit = async () => {
    if (!currentUserId) {
      setError("Benutzer nicht angemeldet");
      return;
    }

    if (duration <= 0) {
      setError("Bitte geben Sie eine gültige Dauer ein");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { startTime, endTime } = getActualTimes();

    try {
      // Ensure current user is included in the list
      const usersToLog = assignedUsers.includes(currentUserId) 
        ? assignedUsers 
        : [currentUserId, ...assignedUsers];

      // Try to create work logs for all assigned users using RPC function
      const { error: rpcError } = await supabase.rpc('create_team_work_logs', {
        p_street_id: streetId,
        p_date: date,
        p_start_time: startTime,
        p_end_time: endTime,
        p_user_ids: usersToLog,
        p_notes: `Auto-erstellt für ${streetName}`,
      });

      if (rpcError) {
        // RPC function might not exist yet - fall back to inserting just for current user
        console.warn("RPC failed, falling back to single insert:", rpcError.message);
        
        const { error: insertError } = await supabase
          .from("work_logs")
          .insert({
            user_id: currentUserId,
            street_id: streetId,
            date: date,
            start_time: startTime,
            end_time: endTime,
            notes: `Auto-erstellt für ${streetName}`,
          });

        if (insertError) {
          console.error("Error inserting work log:", insertError);
          setError(`Fehler: ${insertError.message || insertError.code || "Unbekannter Fehler"}`);
          setIsSubmitting(false);
          return;
        }
      }

      onSuccess(startTime, endTime);
      onClose();
    } catch (err) {
      console.error("Error creating work log:", err);
      setError("Ein Fehler ist aufgetreten");
      setIsSubmitting(false);
    }
  };

  const { endTime } = getActualTimes();
  const defaultStartTime = calculateCleanTimes(duration).startTime;
  const displayStartTime = customStartTime || defaultStartTime;

  return (
    <div className="duration-modal-overlay" onClick={onClose}>
      <div className="duration-modal" onClick={(e) => e.stopPropagation()}>
        <div className="duration-modal-header">
          <h3>Arbeitszeit eintragen</h3>
          <button className="close-btn" onClick={onClose} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="duration-modal-body">
          <p className="street-info">
            <strong>{streetName}</strong> wurde als erledigt markiert.
          </p>

          <p className="info-text">
            Wie lange hat die Bearbeitung gedauert?
          </p>

          <div className="duration-presets">
            {presetDurations.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`preset-btn ${duration === preset ? "active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePresetClick(preset);
                }}
              >
                {preset} min
              </button>
            ))}
          </div>

          <div className="custom-duration">
            <label>Oder eigene Dauer:</label>
            <div className="duration-input-wrapper">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={durationInput}
                onChange={(e) => handleInputChange(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={handleInputBlur}
                onFocus={(e) => e.target.select()}
              />
              <span>Minuten</span>
            </div>
          </div>

          <div className="time-preview">
            <div className="preview-row editable">
              <span className="preview-label">Startzeit:</span>
              <input
                type="time"
                className="time-input"
                value={displayStartTime}
                onChange={(e) => setCustomStartTime(e.target.value)}
              />
              {customStartTime && (
                <button
                  type="button"
                  className="reset-time-btn"
                  onClick={() => setCustomStartTime("")}
                  title="Auf jetzt zurücksetzen"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              )}
            </div>
            <div className="preview-row">
              <span className="preview-label">Endzeit:</span>
              <span className="preview-value">{endTime}</span>
            </div>
          </div>

          {error && <p className="error-message">{error}</p>}
        </div>

        <div className="duration-modal-footer">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Überspringen
          </button>
          <button
            type="button"
            className="submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || !currentUserId}
          >
            {isSubmitting ? "Speichern..." : "Arbeitszeit speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
