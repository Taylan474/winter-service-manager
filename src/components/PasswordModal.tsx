import { useState } from "react";
import "../styles/password-modal.css";

type PasswordModalProps = {
  userName: string;
  userEmail: string;
  tempPassword: string;
  onClose: () => void;
};

// Password Modal, welches Daten von neu angelegten Mitarbeitern anzeigt. Aber nur Mitarbeiter die vom Admin erstellt wurden.
export default function PasswordModal({
  userName,
  userEmail,
  tempPassword,
  onClose,
}: PasswordModalProps) {
    
  const [copied, setCopied] = useState(false);

  // Nur das Passwort in Zwischenablage kopieren
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Fehler beim Kopieren:", err);
    }
  };

  // Alle Login-Daten formatiert in Zwischenablage kopieren
  const copyAllData = async () => {
    const text = `Winterdienst - Login Daten

Name: ${userName}
E-Mail: ${userEmail}
Passwort: ${tempPassword}

Bitte ändere das Passwort nach dem ersten Login.`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Fehler beim Kopieren:", err);
    }
  };

  return (
    <div className="password-overlay" onClick={onClose}>
      <div className="password-modal" onClick={(e) => e.stopPropagation()}>
        <div className="password-header">
          <svg
            className="success-icon"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <h2>Mitarbeiter erfolgreich erstellt!</h2>
          <p className="success-subtitle">
            Bitte teile diese Login-Daten dem Mitarbeiter mit
          </p>
        </div>

        <div className="password-content">
          <div className="info-group">
            <label>Name</label>
            <div className="info-value">{userName}</div>
          </div>

          <div className="info-group">
            <label>E-Mail</label>
            <div className="info-value">{userEmail}</div>
          </div>

          <div className="info-group password-group">
            <label>Temporäres Passwort</label>
            <div className="password-box">
              <code className="password-value">{tempPassword}</code>
              <button
                className="copy-password-btn"
                onClick={copyToClipboard}
                title="Passwort kopieren"
              >
                {copied ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="warning-box">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>
              Der Mitarbeiter sollte das Passwort nach dem ersten Login ändern.
            </p>
          </div>
        </div>

        <div className="password-actions">
          <button className="copy-all-btn" onClick={copyAllData}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Alle Daten kopieren
          </button>
          <button className="close-password-btn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}