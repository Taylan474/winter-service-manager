import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import ConfirmModal from "./ConfirmModal";
import AlertModal from "./AlertModal";
import PasswordModal from "./PasswordModal";
import "../styles/manager.css";

type User = {
  id: string;
  email: string;
  role: "admin" | "mitarbeiter" | "gast";
  name: string;
};

type UsersManagerProps = {
  onClose: () => void;
  onRefresh: () => void;
};

// Key for localStorage to store password data
const PASSWORD_DATA_KEY = 'winterdienst_new_user_data';

// UserManager component to manage employees (add, edit, delete)
export default function UsersManager({ onClose, onRefresh }: UsersManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "mitarbeiter" | "gast">("mitarbeiter");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "mitarbeiter" | "gast">("mitarbeiter");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type?: "error" | "warning" | "success" | "info" }>({ 
    show: false, 
    title: "", 
    message: "" 
  });

  // On mount, check if password data exists in localStorage (after auth state change)
  useEffect(() => {
    const savedData = localStorage.getItem(PASSWORD_DATA_KEY);
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setPasswordData(data);
        setShowPasswordModal(true);
        localStorage.removeItem(PASSWORD_DATA_KEY);
      } catch (e) {
        localStorage.removeItem(PASSWORD_DATA_KEY);
      }
    }
  }, []);

  // Load all users from the database
  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("name", { ascending: true });
    
    if (!error && data) {
      setUsers(data);
    }
  };

  // Load users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Prepare user for editing
  const startEdit = (user: User) => {
    setEditingId(user.id);
    setEditName(user.name);
    setEditRole(user.role);
  };

  // Cancel edit mode
  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditRole("mitarbeiter");
  };

  // Update user in the database
  const saveEdit = async (userId: string) => {
    if (!editName.trim()) {
      setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte einen Namen eingeben.", type: "warning" });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("users")
      .update({ 
        name: editName.trim(),
        role: editRole 
      })
      .eq("id", userId);

    setLoading(false);

    if (error) {
      console.error("Fehler beim Aktualisieren:", error);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Aktualisieren des Mitarbeiters.", type: "error" });
      return;
    }

    setEditingId(null);
    setEditName("");
    setEditRole("mitarbeiter");
    fetchUsers();
    onRefresh();
  };

  // Delete user from the database
  const deleteUser = async (user: User) => {
    setLoading(true);
    
    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", user.id);
    
    if (deleteError) {
      console.error("Fehler beim Löschen:", deleteError);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Löschen des Mitarbeiters.", type: "error" });
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
    
    setLoading(false);

    if (authError) {
      console.warn("Auth-User konnte nicht gelöscht werden:", authError);
      setAlertModal({ show: true, title: "Hinweis", message: "Mitarbeiter aus Datenbank gelöscht, aber Auth-Account muss manuell im Supabase Dashboard gelöscht werden.", type: "info" });
    }

    setConfirmDelete(null);
    fetchUsers();
    onRefresh();
  };

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const addUser = async () => {
  if (!newUserName.trim()) {
    setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte einen Namen eingeben.", type: "warning" });
    return;
  }

  if (!newUserEmail.trim()) {
    setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte eine E-Mail eingeben.", type: "warning" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newUserEmail.trim())) {
    setAlertModal({ show: true, title: "Ungültige E-Mail", message: "Bitte eine gültige E-Mail-Adresse eingeben.", type: "warning" });
    return;
  }

  const exists = users.some(
    (u) => u.email.toLowerCase() === newUserEmail.trim().toLowerCase()
  );
  if (exists) {
    setAlertModal({ show: true, title: "E-Mail existiert bereits", message: "Ein Mitarbeiter mit dieser E-Mail existiert bereits!", type: "warning" });
    return;
  }

  setLoading(true);

  try {
    const tempPassword = generateTempPassword();
    const savedName = newUserName.trim();
    const savedEmail = newUserEmail.trim();
    
    // IMPORTANT: Store password data in localStorage BEFORE signUp is called
    // This way it survives auth state changes that re-render the component
    const userDataForModal = {
      name: savedName,
      email: savedEmail,
      password: tempPassword,
    };
    localStorage.setItem(PASSWORD_DATA_KEY, JSON.stringify(userDataForModal));

    // Save admin session for later restoration
    const { data: { session: adminSession } } = await supabase.auth.getSession();
    
    // Create new user - this can trigger auth state change!
    // IMPORTANT: Set password_changed: false in user_metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: savedEmail,
      password: tempPassword,
      options: {
        emailRedirectTo: undefined,
        data: {
          name: savedName,
          password_changed: false  // Wird beim ersten Passwort-Wechsel auf true gesetzt
        }
      }
    });

    if (authError) {
      localStorage.removeItem(PASSWORD_DATA_KEY);
      setLoading(false);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Erstellen des Login-Accounts:\n" + authError.message, type: "error" });
      return;
    }

    if (!authData.user) {
      localStorage.removeItem(PASSWORD_DATA_KEY);
      setLoading(false);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler: Kein User wurde erstellt", type: "error" });
      return;
    }

    // Wait briefly for DB sync
    await new Promise(resolve => setTimeout(resolve, 300));

    // Insert user into our users table
    const { error: dbError } = await supabase
      .from("users")
      .insert({ 
        id: authData.user.id,
        name: savedName,
        email: savedEmail,
        role: newUserRole,
        password_changed: false
      });

    if (dbError) {
      localStorage.removeItem(PASSWORD_DATA_KEY);
      setLoading(false);
      setAlertModal({ show: true, title: "Fehler", message: "Login-Account wurde erstellt, aber Fehler beim Speichern der User-Daten:\n" + dbError.message, type: "error" });
      return;
    }

    // Restore admin session
    if (adminSession) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });
      // Wait for session to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Reset form
    setNewUserName("");
    setNewUserEmail("");
    setNewUserRole("mitarbeiter");
    
    setLoading(false);

    // Show password modal (get data from localStorage in case component was re-rendered)
    const storedData = localStorage.getItem(PASSWORD_DATA_KEY);
    if (storedData) {
      try {
        const data = JSON.parse(storedData);
        setPasswordData(data);
        setShowPasswordModal(true);
        localStorage.removeItem(PASSWORD_DATA_KEY);
      } catch (e) {
        // Fallback: display directly
        setPasswordData(userDataForModal);
        setShowPasswordModal(true);
        localStorage.removeItem(PASSWORD_DATA_KEY);
      }
    } else {
      // Data was already processed by useEffect
      setPasswordData(userDataForModal);
      setShowPasswordModal(true);
    }

    // Update user list
    fetchUsers();
    onRefresh();

  } catch (err) {
    localStorage.removeItem(PASSWORD_DATA_KEY);
    setLoading(false);
    setAlertModal({ show: true, title: "Fehler", message: "Ein unerwarteter Fehler ist aufgetreten:\n" + err, type: "error" });
  }
};

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "#ff5555";
      case "mitarbeiter": return "#646cff";
      case "gast": return "#888";
      default: return "#888";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Admin";
      case "mitarbeiter": return "Mitarbeiter";
      case "gast": return "Gast";
      default: return role;
    }
  };

  useEffect(() => {
    return () => {
    };
  }, []);

  return (
    <>
      <div className="manager-overlay" onClick={onClose}>
        <div className="manager-modal" onClick={(e) => e.stopPropagation()}>
          <div className="manager-header">
            <h2>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Mitarbeiter verwalten
            </h2>
            <button className="close-btn" onClick={onClose}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="manager-content">
            {users.length === 0 ? (
              <p className="no-items">Keine Mitarbeiter vorhanden.</p>
            ) : (
              <div className="items-list">
                {users.map((user) => (
                  <div key={user.id} className="item-row">
                    {editingId === user.id ? (
                      <>
                        <div className="edit-user-wrapper">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="edit-input"
                            placeholder="Name"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(user.id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <select value={editRole} onChange={(e) => setEditRole(e.target.value as any)} className="edit-role-select">
                            <option value="admin">Admin</option>
                            <option value="mitarbeiter">Mitarbeiter</option>
                            <option value="gast">Gast</option>
                          </select>
                        </div>
                        <div className="item-actions">
                          <button className="save-btn" onClick={() => saveEdit(user.id)} disabled={loading}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          <button className="cancel-btn" onClick={cancelEdit}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="user-info-row">
                          <div className="user-info">
                            <span className="item-name">{user.name}</span>
                            <span className="user-email">{user.email}</span>
                          </div>
                          <span className="role-badge" style={{ backgroundColor: getRoleBadgeColor(user.role) }}>
                            {getRoleLabel(user.role)}
                          </span>
                        </div>
                        <div className="item-actions">
                          <button className="edit-btn" onClick={() => startEdit(user)} title="Bearbeiten">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button className="delete-btn" onClick={() => setConfirmDelete(user)} disabled={loading} title="Löschen">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="add-new-section">
              <h3>Neuen Mitarbeiter hinzufügen</h3>
              <div className="add-user-form">
                <div className="add-user-inputs">
                  <input type="text" placeholder="Name" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUser()} className="add-input" />
                  <input type="email" placeholder="E-Mail" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUser()} className="add-input" />
                  <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)} className="add-role-select">
                    <option value="admin">Admin</option>
                    <option value="mitarbeiter">Mitarbeiter</option>
                    <option value="gast">Gast</option>
                  </select>
                </div>
                <button className="add-btn" onClick={addUser} disabled={loading || !newUserName.trim() || !newUserEmail.trim()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Hinzufügen
                </button>
              </div>
              <p style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: '#999', textAlign: 'center' }}>
                ℹ️ Ein temporäres Passwort wird automatisch generiert und in der Erfolgsmeldung angezeigt.
              </p>
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Mitarbeiter löschen?"
          message={`Möchtest du den Mitarbeiter "${confirmDelete.name}" (${confirmDelete.email}) wirklich löschen?\n\nDies löscht auch den Login-Account!`}
          confirmText="Löschen"
          cancelText="Abbrechen"
          onConfirm={() => deleteUser(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
          danger={true}
        />
      )}

      {/* Password Modal - displayed here to survive auth state changes */}
      {showPasswordModal && passwordData && (
        <PasswordModal
          userName={passwordData.name}
          userEmail={passwordData.email}
          tempPassword={passwordData.password}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordData(null);
          }}
        />
      )}

      {alertModal.show && (
        <AlertModal
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
          onClose={() => setAlertModal({ show: false, title: "", message: "" })}
        />
      )}
    </>
  );
}