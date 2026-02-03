import "../styles/success-modal.css";

type SuccessModalProps = {
  title: string;
  message: string;
  onClose: () => void;
};


// SuccessModal um eine Erfolgsmeldung anzuzeigen. Wird bei der Registrierung eines neuen Users benutzt.
export default function SuccessModal({ title, message, onClose }: SuccessModalProps) {
  return (
    <div className="success-overlay" onClick={onClose}>
      <div className="success-modal" onClick={(e) => e.stopPropagation()}>
        <div className="success-header">
          <svg
            className="success-checkmark"
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
          <h2>{title}</h2>
        </div>

        <div className="success-body">
          <p>{message}</p>
        </div>

        <div className="success-footer">
          <button className="success-btn" onClick={onClose}>
            Verstanden
          </button>
        </div>
      </div>
    </div>
  );
}