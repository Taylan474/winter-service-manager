import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import "../styles/team-completion-modal.css";

interface Street {
  id: string;
  name: string;
  isBG?: boolean;
  [key: string]: any;
}

interface BatchStartModalProps {
  streets: Street[];
  date: string; // YYYY-MM-DD format
  currentUserId: string;
  onClose: () => void;
  onSuccess: (selectedUsers: string[]) => void;
}

// Modal for starting work on multiple streets at once
// Allows selecting coworkers who are working together on all selected streets
export default function BatchStartModal({
  streets,
  date,
  currentUserId,
  onClose,
  onSuccess,
}: BatchStartModalProps) {
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([currentUserId]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

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

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      
      // Update status for all streets
      for (const street of streets) {
        await supabase
          .from("daily_street_status")
          .upsert({
            street_id: street.id,
            date: date,
            status: "auf_dem_weg",
            started_at: now,
            assigned_users: selectedUsers,
            changed_by: currentUserId,
            updated_at: now,
          }, { onConflict: "street_id,date" });

        // Also update street_status_entries
        await supabase
          .from("street_status_entries")
          .upsert({
            street_id: street.id,
            date: date,
            round_number: 1,
            status: "auf_dem_weg",
            started_at: now,
            assigned_users: selectedUsers,
            changed_by: currentUserId,
            updated_at: now,
          }, { onConflict: "street_id,date,round_number" });
      }

      onSuccess(selectedUsers);
    } catch (err) {
      console.error("Error updating streets:", err);
      setIsSubmitting(false);
    }
  };

  const otherSelectedUsers = selectedUsers.filter(id => id !== currentUserId);

  return (
    <div className="team-modal-overlay" onClick={onClose}>
      <div className="team-modal" onClick={(e) => e.stopPropagation()}>
        <div className="team-modal-header batch-start">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 3h15v13H1z" />
              <path d="M16 8h3l3 3v5h-6V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            {streets.length} Straßen starten
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
          <div className="streets-summary">
            <div className="streets-list-preview">
              {streets.slice(0, 4).map(s => (
                <span key={s.id} className="street-tag start">{s.name}</span>
              ))}
              {streets.length > 4 && (
                <span className="street-tag more">+{streets.length - 4} weitere</span>
              )}
            </div>
          </div>

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
                Wer ist dabei?
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

          {/* Summary */}
          <div className="summary-info start-summary">
            {otherSelectedUsers.length > 0 ? (
              <p>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <strong>{selectedUsers.length} Mitarbeiter</strong> starten {streets.length} Straßen
              </p>
            ) : (
              <p>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Du startest {streets.length} Straßen alleine
              </p>
            )}
          </div>
        </div>

        <div className="team-modal-footer">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="submit-btn start-btn"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Starten..."
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 3h15v13H1z" />
                  <path d="M16 8h3l3 3v5h-6V8z" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                Auf dem Weg!
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
