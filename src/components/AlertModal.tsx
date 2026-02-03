import "../styles/confirm-modal.css";

type AlertType = "error" | "warning" | "success" | "info";

type AlertModalProps = {
  title: string;
  message: string;
  type?: AlertType;
  buttonText?: string;
  onClose: () => void;
};

// Reusable alert modal to replace browser alert() calls
export default function AlertModal({
  title,
  message,
  type = "warning",
  buttonText = "OK",
  onClose,
}: AlertModalProps) {
  const getIcon = () => {
    switch (type) {
      case "error":
        return (
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="icon-danger"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      case "success":
        return (
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="icon-success"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="16 10 11 15 8 12" />
          </svg>
        );
      case "info":
        return (
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="icon-info"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
      default: // warning
        return (
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="icon-warning"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
    }
  };

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-header">
          {getIcon()}
          <h2>{title}</h2>
        </div>

        <div className="confirm-message">
          <p style={{ whiteSpace: 'pre-line' }}>{message}</p>
        </div>

        <div className="confirm-actions" style={{ justifyContent: 'center' }}>
          <button
            className={type === "error" ? "confirm-button danger" : "confirm-button"}
            onClick={onClose}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
