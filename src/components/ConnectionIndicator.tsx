import { useEffect, useState } from "react";
import type { ConnectionStatus } from "../lib/supabase";
import { monitorConnection } from "../lib/supabase";

// Shows a banner when connection to backend is lost
export default function ConnectionIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [showBanner, setShowBanner] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  useEffect(() => {
    const cleanup = monitorConnection(setStatus);
    return cleanup;
  }, []);

  useEffect(() => {
    if (status === 'disconnected') {
      // Only show if not recently dismissed
      if (!dismissedAt || Date.now() - dismissedAt > 30000) {
        setShowBanner(true);
      }
    } else if (status === 'connected') {
      setShowBanner(false);
    }
  }, [status, dismissedAt]);

  const dismiss = () => {
    setShowBanner(false);
    setDismissedAt(Date.now());
  };

  const refresh = () => {
    window.location.reload();
  };

  if (!showBanner) return null;

  return (
    <div className="connection-banner">
      <div className="connection-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>
          Verbindung verloren. Änderungen werden möglicherweise nicht synchronisiert.
        </span>
        <button onClick={refresh} className="refresh-btn">
          Aktualisieren
        </button>
        <button onClick={dismiss} className="dismiss-btn" title="Schließen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <style>{`
        .connection-banner {
          position: fixed;
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          max-width: 90%;
          width: max-content;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .connection-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: linear-gradient(135deg, #ff5555 0%, #ff3333 100%);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(255, 85, 85, 0.4);
          color: white;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .connection-content svg {
          flex-shrink: 0;
        }

        .refresh-btn {
          padding: 0.4rem 0.8rem;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          color: white;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .refresh-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .dismiss-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 0.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .dismiss-btn:hover {
          color: white;
        }

        @media (max-width: 480px) {
          .connection-banner {
            bottom: 0.5rem;
            left: 0.5rem;
            right: 0.5rem;
            transform: none;
            max-width: none;
            width: auto;
          }

          .connection-content {
            flex-wrap: wrap;
            justify-content: center;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}
