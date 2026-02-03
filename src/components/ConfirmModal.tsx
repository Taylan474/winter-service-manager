import "../styles/confirm-modal.css";

type ConfirmModalProps = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};


// Modal component to confirm various actions
export default function ConfirmModal({
  title,
  message,
  confirmText = "Bestätigen",
  cancelText = "Abbrechen",
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmModalProps) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={danger ? "icon-danger" : "icon-warning"}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2>{title}</h2>
        </div>

        <div className="confirm-message">
          <p>{message}</p>
        </div>

        <div className="confirm-actions">
          <button className="cancel-button" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={danger ? "confirm-button danger" : "confirm-button"}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}