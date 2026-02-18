import { useState } from "react";
import StreetRow from "./StreetRow";
import StreetManager from "./StreetManager";
import "../styles/areagroup.css";

type UserRole = "admin" | "mitarbeiter" | "gast" | null;

interface Street {
  id: string;
  name: string;
  [key: string]: any;
}

type AreaGroupProps = {
  area: any;
  streets: Street[];
  allAreaStreets: Street[];
  cityId: string;
  onStreetAdded?: () => void;
  onMoveStreet?: (streetId: string, direction: "up" | "down", areaStreets: any[]) => void;
  role: UserRole;
  selectedDate: Date;
  // Multi-select props
  multiSelectMode?: boolean;
  selectedStreetIds?: Set<string>;
  onToggleStreetSelection?: (streetId: string) => void;
  onSelectAllInArea?: (streetIds: string[]) => void;
  onDeselectAllInArea?: (streetIds: string[]) => void;
};


// Component to display areas with streets
export default function AreaGroup({
  area,
  streets,
  allAreaStreets,
  cityId,
  onStreetAdded,
  onMoveStreet,
  role,
  selectedDate,
  multiSelectMode = false,
  selectedStreetIds = new Set(),
  onToggleStreetSelection,
  onSelectAllInArea,
  onDeselectAllInArea,
}: AreaGroupProps) {
  const [open, setOpen] = useState(false);
  const [showStreetManager, setShowStreetManager] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  // Check if all streets in this area are selected
  const allSelected = streets.length > 0 && streets.every(s => selectedStreetIds.has(s.id));
  const someSelected = streets.some(s => selectedStreetIds.has(s.id));

  // Handle area checkbox click
  const handleAreaCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allSelected) {
      onDeselectAllInArea?.(streets.map(s => s.id));
    } else {
      onSelectAllInArea?.(streets.map(s => s.id));
    }
  };

  // Handle street row click in multi-select mode
  const handleStreetClick = (streetId: string) => {
    if (multiSelectMode) {
      onToggleStreetSelection?.(streetId);
    }
  };

  // Toggle area open/close
  return (
    <div className={`area-group ${multiSelectMode ? 'multi-select-mode' : ''}`}>
      <div className="area-header" onClick={() => setOpen((o) => !o)}>
        {/* Area selection checkbox in multi-select mode */}
        {multiSelectMode && (
          <div 
            className={`area-checkbox ${allSelected ? 'checked' : someSelected ? 'partial' : ''}`}
            onClick={handleAreaCheckboxClick}
          >
            {allSelected ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : someSelected ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            ) : null}
          </div>
        )}
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
        <span className="street-count">
          {multiSelectMode && someSelected && (
            <span className="selected-count">{streets.filter(s => selectedStreetIds.has(s.id)).length}/</span>
          )}
          {streets.length} Straße(n)
        </span>
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
                {/* Reorder button for all users */}
                {streets.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReorderMode(!reorderMode);
                    }}
                    className={`reorder-mode-btn ${reorderMode ? 'active' : ''}`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                      <polyline points="7 3 10 6 7 9" />
                      <polyline points="17 15 14 18 17 21" />
                    </svg>
                    {reorderMode ? 'Fertig' : 'Reihenfolge'}
                  </button>
                )}
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
                {streets.map((street, index) => (
                  <div 
                    key={street.id} 
                    className={`street-row-wrapper ${multiSelectMode ? 'selectable' : ''} ${selectedStreetIds.has(street.id) ? 'selected' : ''}`}
                    onClick={() => handleStreetClick(street.id)}
                  >
                    {multiSelectMode && (
                      <div className={`street-checkbox ${selectedStreetIds.has(street.id) ? 'checked' : ''}`}>
                        {selectedStreetIds.has(street.id) && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    )}
                    <StreetRow 
                      street={street} 
                      role={role}
                      selectedDate={selectedDate}
                      reorderMode={reorderMode && !multiSelectMode}
                      position={index + 1}
                      canMoveUp={index > 0}
                      canMoveDown={index < streets.length - 1}
                      onMoveUp={() => onMoveStreet?.(street.id, "up", allAreaStreets)}
                      onMoveDown={() => onMoveStreet?.(street.id, "down", allAreaStreets)}
                      disabled={multiSelectMode}
                    />
                  </div>
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