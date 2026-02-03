import { useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/force-password-change.css";

type ForcePasswordChangeProps = {
  user: any;
  onPasswordChanged: () => void;
  onLogout: () => Promise<void>;
};

// Modal component to force password change on first login
export default function ForcePasswordChange({
  user: _user,
  onPasswordChanged,
  onLogout,
}: ForcePasswordChangeProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Validate password strength
  const validatePassword = (password: string): { valid: boolean; message: string } => {
    if (password.length < 8) {
      return { valid: false, message: "Passwort muss mindestens 8 Zeichen lang sein." };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: "Passwort muss mindestens einen Großbuchstaben enthalten." };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: "Passwort muss mindestens einen Kleinbuchstaben enthalten." };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: "Passwort muss mindestens eine Zahl enthalten." };
    }
    return { valid: true, message: "" };
  };

  // Calculate password strength indicator
  const getPasswordStrength = (password: string): { level: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { level: 1, label: "Schwach", color: "#ef4444" };
    if (score <= 4) return { level: 2, label: "Mittel", color: "#f59e0b" };
    return { level: 3, label: "Stark", color: "#22c55e" };
  };

  const handleChangePassword = async () => {
    setMessage(null);

    if (!newPassword.trim()) {
      setMessage({ type: "error", text: "Bitte neues Passwort eingeben." });
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setMessage({ type: "error", text: validation.message });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwörter stimmen nicht überein." });
      return;
    }

    setLoading(true);

    try {
      // Save new password AND password_changed flag in one updateUser call
      // The flag is stored in user_metadata - no RLS issues!
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { password_changed: true }
      });

      if (updateError) {
        setLoading(false);
        setMessage({ type: "error", text: "Fehler beim Ändern des Passworts: " + updateError.message });
        return;
      }

      // Success! Call callback to notify parent
      setMessage({ type: "success", text: "Passwort erfolgreich geändert!" });
      setLoading(false);
      
      // Call callback after short delay so success message is briefly visible
      setTimeout(() => {
        onPasswordChanged();
      }, 500);
    } catch (err) {
      setLoading(false);
      setMessage({ type: "error", text: "Ein unerwarteter Fehler ist aufgetreten." });
    }
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="force-password-overlay">
      <div className="force-password-modal">
        <div className="force-password-header">
          <svg
            className="lock-icon"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h2>Passwort ändern erforderlich</h2>
          <p className="force-password-subtitle">
            Du verwendest ein temporäres Passwort. Bitte ändere dein Passwort um fortzufahren.
          </p>
        </div>

        <div className="force-password-content">
          <div className="password-requirements">
            <h4>Passwort-Anforderungen:</h4>
            <ul>
              <li className={newPassword.length >= 8 ? "valid" : ""}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {newPassword.length >= 8 ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <circle cx="12" cy="12" r="10" />
                  )}
                </svg>
                Mindestens 8 Zeichen
              </li>
              <li className={/[A-Z]/.test(newPassword) ? "valid" : ""}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {/[A-Z]/.test(newPassword) ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <circle cx="12" cy="12" r="10" />
                  )}
                </svg>
                Mindestens ein Großbuchstabe
              </li>
              <li className={/[a-z]/.test(newPassword) ? "valid" : ""}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {/[a-z]/.test(newPassword) ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <circle cx="12" cy="12" r="10" />
                  )}
                </svg>
                Mindestens ein Kleinbuchstabe
              </li>
              <li className={/[0-9]/.test(newPassword) ? "valid" : ""}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {/[0-9]/.test(newPassword) ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <circle cx="12" cy="12" r="10" />
                  )}
                </svg>
                Mindestens eine Zahl
              </li>
            </ul>
          </div>

          <div className="input-group">
            <label htmlFor="new-password">Neues Passwort</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowNewPassword(!showNewPassword)}
                title={showNewPassword ? "Passwort verstecken" : "Passwort anzeigen"}
              >
                {showNewPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {newPassword && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div
                    className="strength-fill"
                    style={{
                      width: `${(strength.level / 3) * 100}%`,
                      backgroundColor: strength.color,
                    }}
                  />
                </div>
                <span className="strength-label" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="confirm-password">Passwort bestätigen</label>
            <div className="input-wrapper">
              <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title={showConfirmPassword ? "Passwort verstecken" : "Passwort anzeigen"}
              >
                {showConfirmPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <span className="password-mismatch">Passwörter stimmen nicht überein</span>
            )}
            {confirmPassword && newPassword === confirmPassword && confirmPassword.length > 0 && (
              <span className="password-match">Passwörter stimmen überein</span>
            )}
          </div>

          {message && (
            <div className={`message ${message.type}`}>
              {message.type === "success" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
              {message.text}
            </div>
          )}

          <button
            className="change-password-btn"
            onClick={handleChangePassword}
            disabled={loading || !newPassword || !confirmPassword}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Ändere Passwort...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                Passwort ändern
              </>
            )}
          </button>

          <button className="logout-link" onClick={onLogout}>
            Oder abmelden
          </button>
        </div>
      </div>
    </div>
  );
}
