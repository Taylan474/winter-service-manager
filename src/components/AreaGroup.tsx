import { useState } from "react";
import StreetRow from "./StreetRow";
import StreetManager from "./StreetManager";
import "../styles/areagroup.css";

type UserRole = "admin" | "mitarbeiter" | "gast" | null;

type AreaGroupProps = {
  area: any;
  streets: any[];
  cityId: string;
  onStreetAdded?: () => void;
  role: UserRole;
  selectedDate: Date;
};


// Component to display areas with streets
export default function AreaGroup({
  area,
  streets,
  cityId,
  onStreetAdded,
  role,
  selectedDate,
}: AreaGroupProps) {
  const [open, setOpen] = useState(false);
  const [showStreetManager, setShowStreetManager] = useState(false);

  // Toggle area open/close
  return (
    <div className="area-group">
      <div className="area-header" onClick={() => setOpen((o) => !o)}>
        <div className="area-title">
          <svg
            className={`chevron ${open ? "open" : ""}`}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <h3>{area.name}</h3>
        </div>
        <span className="street-count">{streets.length} Straße(n)</span>
      </div>

      {open && (
        <div className="area-content">
          {streets.length === 0 ? (
            <div className="empty-area-state">
              <svg
                className="empty-icon"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 21h18" />
                <path d="M9 8h1" />
                <path d="M9 12h1" />
                <path d="M9 16h1" />
                <path d="M14 8h1" />
                <path d="M14 12h1" />
                <path d="M14 16h1" />
                <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
              </svg>
              <p className="empty-message">Keine Straßen in diesem Gebiet</p>
              {role === "admin" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowStreetManager(true);
                  }}
                  className="add-first-street-btn"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Straßen verwalten
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="area-actions">
                {/* Only admin can manage streets */}
                {role === "admin" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowStreetManager(true);
                    }}
                    className="manage-streets-btn"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Straßen verwalten
                  </button>
                )}
              </div>
              <div className="streets-list">
                {streets.map((street) => (
                  <StreetRow 
                    key={street.id} 
                    street={street} 
                    role={role}
                    selectedDate={selectedDate}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {showStreetManager && (
        <StreetManager
          streets={streets}
          areaId={area.id}
          cityId={cityId}
          onClose={() => setShowStreetManager(false)}
          onRefresh={() => {
            onStreetAdded?.();
          }}
        />
      )}
    </div>
  );
}