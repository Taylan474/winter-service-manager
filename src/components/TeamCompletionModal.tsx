import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import "../styles/team-completion-modal.css";

interface Street {
  id: string;
  name: string;
  isBG?: boolean;
  [key: string]: any;
}

interface TeamCompletionModalProps {
  streets: Street[]; // Can be one or multiple streets
  date: string; // YYYY-MM-DD format
  currentUserId: string;
  preSelectedUsers?: string[]; // Users already assigned (from auf_dem_weg)
  onClose: () => void;
  onSuccess: (streetTimes: Map<string, { startTime: string; endTime: string }>) => void;
}

interface LastWorkInfo {
  endTime: string; // HH:MM format
  timestamp: Date;
}

// Modal for completing streets with coworker selection and smart time tracking
// Features:
// 1. Select coworkers to share the work log with
// 2. Smart time calculation based on last completed street
// 3. Supports multiple streets at once
export default function TeamCompletionModal({
  streets,
  date,
  currentUserId,
  preSelectedUsers = [],
  onClose,
  onSuccess,
}: TeamCompletionModalProps) {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  // Initialize with pre-selected users (from auf_dem_weg) or just current user
  const [selectedUsers, setSelectedUsers] = useState<string[]>(() => {
    if (preSelectedUsers.length > 0) {
      // Ensure current user is always included
      const usersSet = new Set(preSelectedUsers);
      usersSet.add(currentUserId);
      return Array.from(usersSet);
    }
    return [currentUserId];
  });
  const [duration, setDuration] = useState<number>(20);
  const [durationInput, setDurationInput] = useState<string>("20");
  const [customStartTime, setCustomStartTime] = useState<string>("");
  const [useSmartTiming, setUseSmartTiming] = useState(true);
  const [lastWorkInfo, setLastWorkInfo] = useState<LastWorkInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const presetDurations = streets.length > 1 
    ? [5, 10, 15, 20, 30, 45] // Shorter options for multiple streets (quick salt throwing)
    : [15, 20, 30, 45, 60, 90]; // Normal options for single street

  // Automatically select shorter duration for multiple streets
  useEffect(() => {
    if (streets.length > 1) {
      setDuration(10);
      setDurationInput("10");
    }
  }, [streets.length]);

  // Load users
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      const { data } = await supabase.from("users").select("id, name").order("name");
      setUsers(data ?? []);
      setIsLoadingUsers(false);
    };
    fetchUsers();
  }, []);

  // Load last work entry for smart timing
  useEffect(() => {
    const fetchLastWork = async () => {
      // Get the most recent work log entry for this user today
      const { data: workLogs } = await supabase
        .from("work_logs")
        .select("end_time, updated_at")
        .eq("user_id", currentUserId)
        .eq("date", date)
        .order("end_time", { ascending: false })
        .limit(1);

      // Also check daily_street_status for any recent completions
      const { data: streetStatus } = await supabase
        .from("daily_street_status")
        .select("finished_at")
        .eq("date", date)
        .eq("status", "erledigt")
        .contains("assigned_users", [currentUserId])
        .order("finished_at", { ascending: false })
        .limit(1);

      let latestEndTime: LastWorkInfo | null = null;

      // Check work_logs
      if (workLogs && workLogs.length > 0 && workLogs[0].end_time) {
        const endTimeStr = workLogs[0].end_time; // "HH:MM:SS" format
        const [h, m] = endTimeStr.split(":").map(Number);
        const timestamp = new Date(`${date}T${endTimeStr}`);
        latestEndTime = {
          endTime: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
          timestamp,
        };
      }

      // Check street_status
      if (streetStatus && streetStatus.length > 0 && streetStatus[0].finished_at) {
        const finishedAt = new Date(streetStatus[0].finished_at);
        const statusEndTime: LastWorkInfo = {
          endTime: `${finishedAt.getHours().toString().padStart(2, "0")}:${finishedAt.getMinutes().toString().padStart(2, "0")}`,
          timestamp: finishedAt,
        };
        
        // Use the more recent one
        if (!latestEndTime || finishedAt > latestEndTime.timestamp) {
          latestEndTime = statusEndTime;
        }
      }

      setLastWorkInfo(latestEndTime);
    };

    fetchLastWork();
  }, [currentUserId, date]);

  // Handle preset button click
  const handlePresetClick = (preset: number) => {
    setDuration(preset);
    setDurationInput(String(preset));
  };

  // Handle custom input change
  const handleInputChange = (value: string) => {
    setDurationInput(value);
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setDuration(num);
    }
  };

  // Handle input blur
  const handleInputBlur = () => {
    const num = parseInt(durationInput, 10);
    if (isNaN(num) || num <= 0) {
      setDuration(20);
      setDurationInput("20");
    } else {
      setDuration(num);
      setDurationInput(String(num));
    }
  };

  // Toggle user selection
  const toggleUser = (userId: string) => {
    if (userId === currentUserId) return; // Can't deselect yourself
    
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Select all / deselect all
  const selectAllUsers = () => {
    setSelectedUsers(users.map(u => u.id));
  };

  const selectOnlyMe = () => {
    setSelectedUsers([currentUserId]);
  };

  // Round time to nearest 5 minutes
  const roundToNearestInterval = (hours: number, minutes: number, interval: number): { hours: number; minutes: number } => {
    const totalMinutes = hours * 60 + minutes;
    const roundedMinutes = Math.round(totalMinutes / interval) * interval;
    return {
      hours: Math.floor(roundedMinutes / 60) % 24,
      minutes: roundedMinutes % 60,
    };
  };

  // Calculate smart start time based on last work entry
  const calculateSmartStartTime = (): string => {
    if (!useSmartTiming || !lastWorkInfo) {
      return "";
    }

    const now = new Date();
    const lastEndTime = lastWorkInfo.timestamp;
    const timeSinceLastEntry = (now.getTime() - lastEndTime.getTime()) / 60000; // in minutes

    // If more than 30 minutes since last entry, don't auto-continue
    // This handles the case where user took a break or is catching up
    if (timeSinceLastEntry > 30) {
      return "";
    }

    // Continue from last end time
    return lastWorkInfo.endTime;
  };

  // Calculate times for a street
  const calculateStreetTimes = (
    streetIndex: number,
    baseStartTime: string,
    perStreetDuration: number
  ): { startTime: string; endTime: string } => {
    const formatTime = (h: number, m: number) =>
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

    // Parse base start time
    const [startH, startM] = baseStartTime.split(":").map(Number);
    
    // Calculate this street's start time (offset by previous streets)
    let streetStartMinutes = startH * 60 + startM + (streetIndex * perStreetDuration);
    if (streetStartMinutes >= 24 * 60) streetStartMinutes -= 24 * 60;
    
    const streetStartH = Math.floor(streetStartMinutes / 60);
    const streetStartM = streetStartMinutes % 60;
    
    // Calculate end time
    let streetEndMinutes = streetStartMinutes + perStreetDuration;
    if (streetEndMinutes >= 24 * 60) streetEndMinutes -= 24 * 60;
    
    const streetEndH = Math.floor(streetEndMinutes / 60);
    const streetEndM = streetEndMinutes % 60;

    return {
      startTime: formatTime(streetStartH, streetStartM),
      endTime: formatTime(streetEndH, streetEndM),
    };
  };

  // Get the effective start time for all calculations
  const getEffectiveStartTime = (): string => {
    // If user set a custom time, use that
    if (customStartTime) {
      return customStartTime;
    }

    // Try smart timing (continue from last entry)
    const smartStart = calculateSmartStartTime();
    if (smartStart) {
      return smartStart;
    }

    // Fall back to current time minus total duration
    const now = new Date();
    const totalDuration = streets.length * duration;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let startMinutes = currentMinutes - totalDuration;
    if (startMinutes < 0) startMinutes += 24 * 60;

    const rounded = roundToNearestInterval(
      Math.floor(startMinutes / 60),
      startMinutes % 60,
      5
    );

    return `${rounded.hours.toString().padStart(2, "0")}:${rounded.minutes.toString().padStart(2, "0")}`;
  };

  // Calculate all street times
  const allStreetTimes = useMemo(() => {
    const baseStartTime = getEffectiveStartTime();
    const times = new Map<string, { startTime: string; endTime: string }>();
    
    streets.forEach((street, index) => {
      times.set(street.id, calculateStreetTimes(index, baseStartTime, duration));
    });
    
    return times;
  }, [streets, duration, customStartTime, lastWorkInfo, useSmartTiming]);

  // Get display info
  const displayStartTime = customStartTime || getEffectiveStartTime();
  const lastStreetTimes = allStreetTimes.get(streets[streets.length - 1]?.id);
  const displayEndTime = lastStreetTimes?.endTime || "";

  // Check if we're using smart continuation
  const isUsingSmartContinuation = !customStartTime && useSmartTiming && lastWorkInfo && calculateSmartStartTime() !== "";

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      // Create work logs for all selected users and all streets
      for (const street of streets) {
        const times = allStreetTimes.get(street.id);
        if (!times) continue;

        // Use RPC to create logs for all users
        const { error: rpcError } = await supabase.rpc('create_team_work_logs', {
          p_street_id: street.id,
          p_date: date,
          p_start_time: times.startTime,
          p_end_time: times.endTime,
          p_user_ids: selectedUsers,
          p_notes: `Auto-erstellt für ${street.name}`,
        });

        if (rpcError) {
          console.warn("RPC failed, falling back to single insert:", rpcError.message);
          
          // Fallback: insert for current user only
          await supabase
            .from("work_logs")
            .insert({
              user_id: currentUserId,
              street_id: street.id,
              date: date,
              start_time: times.startTime,
              end_time: times.endTime,
              notes: `Auto-erstellt für ${street.name}`,
            });
        }
      }

      onSuccess(allStreetTimes);
    } catch (err) {
      console.error("Error creating work logs:", err);
      setError("Ein Fehler ist aufgetreten");
      setIsSubmitting(false);
    }
  };

  const otherSelectedUsers = selectedUsers.filter(id => id !== currentUserId);

  return (
    <div className="team-modal-overlay" onClick={onClose}>
      <div className="team-modal" onClick={(e) => e.stopPropagation()}>
        <div className="team-modal-header">
          <h3>
            {streets.length > 1 
              ? `${streets.length} Straßen erledigt` 
              : "Straße erledigt"
            }
          </h3>
          <button className="close-btn" onClick={onClose} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="team-modal-body">
          {/* Streets list */}
          {streets.length > 0 && (
            <div className="streets-summary">
              <div className="streets-list-preview">
                {streets.slice(0, 3).map(s => (
                  <span key={s.id} className="street-tag">{s.name}</span>
                ))}
                {streets.length > 3 && (
                  <span className="street-tag more">+{streets.length - 3} weitere</span>
                )}
              </div>
            </div>
          )}

          {/* Coworker selection */}
          <div className="section">
            <div className="section-header">
              <h4>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Wer hat mitgearbeitet?
              </h4>
              <div className="quick-actions">
                <button 
                  type="button" 
                  className="quick-action-btn"
                  onClick={selectOnlyMe}
                >
                  Nur ich
                </button>
                <button 
                  type="button" 
                  className="quick-action-btn"
                  onClick={selectAllUsers}
                >
                  Alle
                </button>
              </div>
            </div>

            {isLoadingUsers ? (
              <div className="loading-users">Lade Mitarbeiter...</div>
            ) : (
              <div className="users-grid">
                {users.map((user) => (
                  <label 
                    key={user.id} 
                    className={`user-chip ${selectedUsers.includes(user.id) ? "selected" : ""} ${user.id === currentUserId ? "current-user" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      disabled={user.id === currentUserId}
                    />
                    <span className="user-name">
                      {user.name}
                      {user.id === currentUserId && " (Du)"}
                    </span>
                    {selectedUsers.includes(user.id) && (
                      <svg className="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Duration selection */}
          <div className="section">
            <h4>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Dauer {streets.length > 1 ? "pro Straße" : ""}
            </h4>

            <div className="duration-presets">
              {presetDurations.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`preset-btn ${duration === preset ? "active" : ""}`}
                  onClick={() => handlePresetClick(preset)}
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
          </div>

          {/* Smart timing info */}
          {isUsingSmartContinuation && (
            <div className="smart-timing-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="m4.93 4.93 2.83 2.83" />
                <path d="m16.24 16.24 2.83 2.83" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
                <path d="m4.93 19.07 2.83-2.83" />
                <path d="m16.24 7.76 2.83-2.83" />
              </svg>
              <span>
                Zeit wird automatisch ab {lastWorkInfo?.endTime} Uhr fortgesetzt
              </span>
              <button 
                type="button" 
                className="disable-smart-btn"
                onClick={() => setUseSmartTiming(false)}
              >
                Deaktivieren
              </button>
            </div>
          )}

          {/* Time preview */}
          <div className="time-preview">
            <div className="preview-row editable">
              <span className="preview-label">
                {streets.length > 1 ? "Erste Straße beginnt:" : "Startzeit:"}
              </span>
              <input
                type="time"
                className="time-input"
                value={displayStartTime}
                onChange={(e) => {
                  setCustomStartTime(e.target.value);
                  setUseSmartTiming(false);
                }}
              />
              {(customStartTime || !useSmartTiming) && lastWorkInfo && (
                <button
                  type="button"
                  className="reset-time-btn"
                  onClick={() => {
                    setCustomStartTime("");
                    setUseSmartTiming(true);
                  }}
                  title="Automatisch berechnen"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              )}
            </div>
            <div className="preview-row">
              <span className="preview-label">
                {streets.length > 1 ? "Letzte Straße endet:" : "Endzeit:"}
              </span>
              <span className="preview-value">{displayEndTime}</span>
            </div>
            {streets.length > 1 && (
              <div className="preview-row total">
                <span className="preview-label">Gesamtdauer:</span>
                <span className="preview-value">{streets.length * duration} min</span>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="summary-info">
            {otherSelectedUsers.length > 0 ? (
              <p>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Arbeitszeit wird für <strong>{selectedUsers.length} Mitarbeiter</strong> eingetragen
              </p>
            ) : (
              <p>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Arbeitszeit wird nur für dich eingetragen
              </p>
            )}
          </div>

          {error && <p className="error-message">{error}</p>}
        </div>

        <div className="team-modal-footer">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Überspringen
          </button>
          <button
            type="button"
            className="submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
