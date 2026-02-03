import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { formatTimestamp } from "../lib/locale-config";
import { FEATURE_FLAGS } from "../lib/company-config";
import AlertModal from "./AlertModal";
import DurationEntryModal from "./DurationEntryModal";
import "../styles/streetrow.css";

type StreetStatus = "offen" | "auf_dem_weg" | "erledigt";
type UserRole = "admin" | "mitarbeiter" | "gast" | null;

interface StatusEntry {
  id: string;
  round_number: number;
  status: StreetStatus;
  started_at: string | null;
  finished_at: string | null;
  assigned_users: string[];
}

interface StreetRowProps {
  street: {
    id: string;
    name: string;
    isBG?: boolean;
  };
  role: UserRole;
  selectedDate: Date;
}

// Component to display individual streets in the list and change their status
// Supports multiple rounds per day (when it snows multiple times)
export default function StreetRow({ street, role, selectedDate }: StreetRowProps) {
  const [status, setStatus] = useState<StreetStatus | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [statusHistory, setStatusHistory] = useState<StatusEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [alertModal, setAlertModal] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const [showDurationModal, setShowDurationModal] = useState(false);

  const dateString = selectedDate.toISOString().split("T")[0];

  // Derive user names from IDs using useMemo - no flickering!
  const assignedUserNames = useMemo(() => {
    return assignedUsers
      .map(id => users.find(u => u.id === id)?.name)
      .filter(Boolean) as string[];
  }, [assignedUsers, users]);

  // Load current user on component mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setCurrentUserId(data.user.id);
    };
    getCurrentUser();
  }, []);

  // Load all available users
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from("users").select("id, name");
      setUsers(data ?? []);
    };
    fetchUsers();
  }, []);

  // Load status for this street for the selected day
  useEffect(() => {
    const fetchStatus = async () => {
      const { data } = await supabase
        .from("daily_street_status")
        .select("*")
        .eq("street_id", street.id)
        .eq("date", dateString)
        .single();

      if (!data) {
        const { data: inserted } = await supabase
          .from("daily_street_status")
          .insert({
            street_id: street.id,
            date: dateString,
            status: "offen",
            assigned_users: [],
            current_round: 1,
            total_rounds: 1,
          })
          .select("*")
          .single();

        if (inserted) {
          setStatus(inserted.status as StreetStatus);
          setAssignedUsers(inserted.assigned_users ?? []);
          setStartedAt(inserted.started_at);
          setFinishedAt(inserted.finished_at);
          setCurrentRound(inserted.current_round ?? 1);
        }
        return;
      }

      setStatus(data.status as StreetStatus);
      setAssignedUsers(data.assigned_users ?? []);
      setStartedAt(data.started_at);
      setFinishedAt(data.finished_at);
      setCurrentRound(data.current_round ?? 1);
    };

    const fetchHistory = async () => {
      const { data } = await supabase
        .from("street_status_entries")
        .select("*")
        .eq("street_id", street.id)
        .eq("date", dateString)
        .order("round_number", { ascending: true });

      if (data) {
        setStatusHistory(data as StatusEntry[]);
      }
    };

    fetchStatus();
    fetchHistory();
  }, [street.id, dateString]);

  // Listen for realtime updates for this street (when others change)
  useEffect(() => {
    // Create a unique channel name for this street/date combination
    const channelName = `street-status-${street.id}-${dateString}`;
    
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: '' },
        },
      })
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "daily_street_status",
          filter: `street_id=eq.${street.id}`
        },
        async (payload: any) => {
          console.log("[Realtime] daily_street_status change:", payload.eventType, payload);
          
          // Handle different event types
          if (payload.eventType === 'DELETE') {
            // Reset to default state on delete
            setStatus("offen");
            setAssignedUsers([]);
            setStartedAt(null);
            setFinishedAt(null);
            setCurrentRound(1);
            return;
          }
          
          const updated = payload.new;
          if (!updated || updated.date !== dateString) return;
          
          // Apply the update from realtime payload
          setStatus(updated.status as StreetStatus);
          setAssignedUsers(updated.assigned_users ?? []);
          setStartedAt(updated.started_at);
          setFinishedAt(updated.finished_at);
          setCurrentRound(updated.current_round ?? 1);
        }
      )
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "street_status_entries",
          filter: `street_id=eq.${street.id}`
        },
        async (payload: any) => {
          console.log("[Realtime] street_status_entries change:", payload.eventType, payload);
          const updated = payload.new;
          if (!updated || updated.date !== dateString) return;
          
          // Refetch history to get complete list
          const { data } = await supabase
            .from("street_status_entries")
            .select("*")
            .eq("street_id", street.id)
            .eq("date", dateString)
            .order("round_number", { ascending: true });

          if (data) {
            setStatusHistory(data as StatusEntry[]);
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error(`[Realtime] Channel ${channelName} error:`, err);
        } else {
          console.log(`[Realtime] Channel ${channelName} status:`, status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [street.id, dateString, users]);
// Save street status in the database
  
  const saveStreetStatus = async (
    newStatus: StreetStatus,
    newAssignedUsers: string[]
  ) => {
    if (!newStatus || !currentUserId) return;

    const now = new Date().toISOString();
    const updateData: any = {
      street_id: street.id,
      date: dateString,
      status: newStatus,
      assigned_users: newAssignedUsers,
      changed_by: currentUserId,
      updated_at: now,
      current_round: currentRound,
    };

    let newStartedAt = startedAt;
    let newFinishedAt = finishedAt;

    if (newStatus === "auf_dem_weg" && status === "offen") {
      updateData.started_at = now;
      newStartedAt = now;
      setStartedAt(now);
    }
    
    if (newStatus === "erledigt") {
      if (status === "offen") {
        updateData.started_at = now;
        newStartedAt = now;
        setStartedAt(now);
        
        if (!newAssignedUsers.includes(currentUserId)) {
          updateData.assigned_users = [...newAssignedUsers, currentUserId];
          setAssignedUsers(updateData.assigned_users);
        }
      }
      
      updateData.finished_at = now;
      newFinishedAt = now;
      setFinishedAt(now);
    }
    
    if (newStatus === "offen") {
      updateData.started_at = null;
      updateData.finished_at = null;
      updateData.assigned_users = [];
      newStartedAt = null;
      newFinishedAt = null;
      setStartedAt(null);
      setFinishedAt(null);
      setAssignedUsers([]);
    }

    // Update main status table
    await supabase
      .from("daily_street_status")
      .upsert(updateData, { onConflict: "street_id,date" });

    // Also update/create the current round entry
    const entryData: any = {
      street_id: street.id,
      date: dateString,
      round_number: currentRound,
      status: newStatus,
      assigned_users: updateData.assigned_users ?? newAssignedUsers,
      changed_by: currentUserId,
      updated_at: now,
    };

    if (newStartedAt) entryData.started_at = newStartedAt;
    if (newFinishedAt) entryData.finished_at = newFinishedAt;

    await supabase
      .from("street_status_entries")
      .upsert(entryData, { onConflict: "street_id,date,round_number" });
  };

  // Start new round (when it snows again)
  const startNewRound = async () => {
    if (role === "gast" || !currentUserId) {
      setAlertModal({ show: true, message: "Sie haben keine Berechtigung dazu." });
      return;
    }

    const now = new Date().toISOString();
    const newRoundNumber = currentRound + 1;

    // Insert new entry for this round
    await supabase
      .from("street_status_entries")
      .insert({
        street_id: street.id,
        date: dateString,
        round_number: newRoundNumber,
        status: "offen",
        changed_by: currentUserId,
      });

    // Update daily status
    await supabase
      .from("daily_street_status")
      .update({
        status: "offen",
        current_round: newRoundNumber,
        total_rounds: newRoundNumber,
        started_at: null,
        finished_at: null,
        assigned_users: [],
        changed_by: currentUserId,
        updated_at: now,
      })
      .eq("street_id", street.id)
      .eq("date", dateString);

    // Update local state
    setCurrentRound(newRoundNumber);
    setStatus("offen");
    setStartedAt(null);
    setFinishedAt(null);
    setAssignedUsers([]);
  };

  const updateStatus = (newStatus: StreetStatus) => {
    if (role === "gast") {
      setAlertModal({ show: true, message: "Sie haben keine Berechtigung, den Status zu ändern." });
      return;
    }

    setStatus(newStatus);
    saveStreetStatus(newStatus, assignedUsers);

    // Show duration modal when marking as completed
    if (newStatus === "erledigt") {
      setShowDurationModal(true);
    }
  };

  const toggleUser = (userId: string) => {
    if (role === "gast") {
      setAlertModal({ show: true, message: "Sie haben keine Berechtigung, Mitarbeiter zuzuweisen." });
      return;
    }

    const newAssignedUsers = assignedUsers.includes(userId)
      ? assignedUsers.filter((id) => id !== userId)
      : [...assignedUsers, userId];

    setAssignedUsers(newAssignedUsers);

    if (status !== null) {
      saveStreetStatus(status, newAssignedUsers);
    }
  };

  // Use the locale-config formatTimestamp for proper timezone handling
  const getFormattedTime = (timestamp: string | null) => {
    return formatTimestamp(timestamp);
  };

  const calculateDuration = () => {
    if (!startedAt || !finishedAt) return null;
    // Use parseTimestamp for proper timezone handling (import it if needed)
    const start = new Date(startedAt.endsWith('Z') || startedAt.includes('+') ? startedAt : startedAt + 'Z');
    const end = new Date(finishedAt.endsWith('Z') || finishedAt.includes('+') ? finishedAt : finishedAt + 'Z');
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}min`;
  };

  const getStatusIcon = (status: StreetStatus) => {
    switch (status) {
      case "offen":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
      case "auf_dem_weg":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 3h15v13H1z" />
            <path d="M16 8h3l3 3v5h-6V8z" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        );
      case "erledigt":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
    }
  };

  return (
    <div className="street-row">
      <div className="street-info">
        <div className="street-name-container">
          <strong className="street-name">{street.name}</strong>
          {FEATURE_FLAGS.enableBGFilter && street.isBG && <span className="bg-badge">BG</span>}
          {currentRound > 1 && (
            <span className="round-badge">Runde {currentRound}</span>
          )}
        </div>

        {status === null ? (
          <span className="loading">Lädt...</span>
        ) : (
          <div className="status-controls">
            <div className="status-select-wrapper">
              <select
                value={status}
                onChange={(e) => updateStatus(e.target.value as StreetStatus)}
                className={`status-select status-${status} ${role === "gast" ? "disabled" : ""}`}
                disabled={role === "gast"}
              >
                <option value="offen">Offen</option>
                <option value="auf_dem_weg">Auf dem Weg</option>
                <option value="erledigt">Erledigt</option>
              </select>
              <div className="status-icon">{getStatusIcon(status)}</div>
            </div>
            
            {/* Button for new round when status is done */}
            {status === "erledigt" && role !== "gast" && (
              <button 
                className="new-round-btn"
                onClick={startNewRound}
                title="Neue Runde starten (z.B. wenn es nochmal schneit)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Neue Runde
              </button>
            )}
          </div>
        )}
      </div>

      {/* Time display */}
      {(startedAt || finishedAt || assignedUserNames.length > 0) && (
        <div className="time-tracking-info">
          {startedAt && (
            <span className="time-badge">
              🕐 Start: {getFormattedTime(startedAt)}
            </span>
          )}
          {finishedAt && (
            <span className="time-badge">
              ✅ Fertig: {getFormattedTime(finishedAt)}
            </span>
          )}
          {startedAt && finishedAt && (
            <span className="time-badge duration">
              ⏱️ Dauer: {calculateDuration()}
            </span>
          )}
          {assignedUserNames.length > 0 && (
            <span className="time-badge user-badge">
              👤 {assignedUserNames.join(", ")}
            </span>
          )}
        </div>
      )}

      {/* History toggle - show if there are completed rounds */}
      {statusHistory.filter(e => e.status === "erledigt").length > 0 && (
        <button 
          className="history-toggle-btn"
          onClick={() => setShowHistory(!showHistory)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          {statusHistory.filter(e => e.status === "erledigt").length} abgeschlossene Runde(n)
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ transform: showHistory ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* History list */}
      {showHistory && statusHistory.length > 0 && (
        <div className="status-history">
          {statusHistory
            .filter(entry => entry.status === "erledigt")
            .map((entry) => {
              const entryUserNames = entry.assigned_users
                .map(id => users.find(u => u.id === id)?.name)
                .filter(Boolean);
              
              return (
                <div key={entry.id} className="history-entry">
                  <span className="history-round">Runde {entry.round_number}</span>
                  <span className="history-time">
                    {formatTimestamp(entry.started_at)} - {formatTimestamp(entry.finished_at)}
                  </span>
                  {entryUserNames.length > 0 && (
                    <span className="history-users">
                      👤 {entryUserNames.join(", ")}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {status === "auf_dem_weg" && (
        <div className="users-assignment">
          <div className="users-header">
            <h5>Mitarbeiter zuweisen:</h5>
            <span className="assigned-count">
              {assignedUsers.length} von {users.length} ausgewählt
            </span>
          </div>
          <div className="users-list">
            {users.map((user) => (
              <label key={user.id} className={`user-checkbox ${role === "gast" ? "disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={assignedUsers.includes(user.id)}
                  onChange={() => toggleUser(user.id)}
                  disabled={role === "gast"}
                />
                <span className="user-name">{user.name}</span>
                {assignedUsers.includes(user.id) && (
                  <svg className="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {alertModal.show && (
        <AlertModal
          title="Keine Berechtigung"
          message={alertModal.message}
          type="warning"
          onClose={() => setAlertModal({ show: false, message: "" })}
        />
      )}

      {showDurationModal && (
        <DurationEntryModal
          streetName={street.name}
          streetId={street.id}
          date={dateString}
          onClose={() => setShowDurationModal(false)}
          onSuccess={async (startTimeStr, endTimeStr) => {
            setShowDurationModal(false);
            
            // Update street status with the clean times from the work log
            // Convert HH:MM to full timestamp using the selected date
            const startTimestamp = new Date(`${dateString}T${startTimeStr}:00`).toISOString();
            const endTimestamp = new Date(`${dateString}T${endTimeStr}:00`).toISOString();
            
            // Update local state immediately
            setStartedAt(startTimestamp);
            setFinishedAt(endTimestamp);
            
            // Update database
            await supabase
              .from("daily_street_status")
              .update({
                started_at: startTimestamp,
                finished_at: endTimestamp,
              })
              .eq("street_id", street.id)
              .eq("date", dateString);
            
            await supabase
              .from("street_status_entries")
              .update({
                started_at: startTimestamp,
                finished_at: endTimestamp,
              })
              .eq("street_id", street.id)
              .eq("date", dateString)
              .eq("round_number", currentRound);
          }}
        />
      )}
    </div>
  );
}