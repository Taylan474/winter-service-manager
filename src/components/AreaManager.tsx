import { useState } from "react";
import { supabase } from "../lib/supabase";
import ConfirmModal from "./ConfirmModal";
import AlertModal from "./AlertModal";
import "../styles/manager.css";

type Area = {
  id: string;
  name: string;
  city_id: string;
};

type AreaManagerProps = {
  areas: Area[];
  cityId: string;
  onClose: () => void;
  onRefresh: () => void;
};

// Manages areas (add, edit, delete)
export default function AreaManager({ areas, cityId, onClose, onRefresh }: AreaManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Area | null>(null);
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type?: "error" | "warning" }>({ show: false, title: "", message: "" });

  // Prepare area for editing
  const startEdit = (area: Area) => {
    setEditingId(area.id);
    setEditName(area.name);
  };

  // Cancel edit mode
  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  // Update area in database
  const saveEdit = async (areaId: string) => {
    if (!editName.trim()) {
      setAlertModal({ show: true, title: "Eingabe erforderlich", message: "Bitte einen Namen eingeben.", type: "warning" });
      return;
    }

    const exists = areas.some(
      (a) => a.id !== areaId && a.name.toLowerCase() === editName.trim().toLowerCase()
    );
    if (exists) {
      setAlertModal({ show: true, title: "Duplikat", message: "Ein Gebiet mit diesem Namen existiert bereits!", type: "warning" });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("areas")
      .update({ name: editName.trim() })
      .eq("id", areaId);

    setLoading(false);

    if (error) {
      console.error("Fehler beim Aktualisieren:", error);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Aktualisieren des Gebiets.", type: "error" });
      return;
    }

    setEditingId(null);
    setEditName("");
    onRefresh();
  };

  // Delete area from database
  const deleteArea = async (area: Area) => {
    setLoading(true);
    const { error } = await supabase.from("areas").delete().eq("id", area.id);
    setLoading(false);

    if (error) {
      console.error("Fehler beim Löschen:", error);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Löschen des Gebiets: " + error.message, type: "error" });
      return;
    }

    setConfirmDelete(null);
    onRefresh();
  };
// Add new area
  
  const addArea = async () => {
    if (!newAreaName.trim()) {
      setAlertModal({ show: true, title: "Eingabe erforderlich", message: "Bitte einen Namen eingeben.", type: "warning" });
      return;
    }

    const exists = areas.some(
      (a) => a.name.toLowerCase() === newAreaName.trim().toLowerCase()
    );
    if (exists) {
      setAlertModal({ show: true, title: "Duplikat", message: "Ein Gebiet mit diesem Namen existiert bereits!", type: "warning" });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("areas")
      .insert({ name: newAreaName.trim(), city_id: cityId });

    setLoading(false);

    if (error) {
      console.error("Fehler beim Erstellen:", error);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Erstellen des Gebiets.", type: "error" });
      return;
    }

    setNewAreaName("");
    onRefresh();
  };

  return (
    <div className="manager-overlay" onClick={onClose}>
      <div className="manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manager-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Gebiete verwalten
          </h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="manager-content">
          {areas.length === 0 ? (
            <p className="no-items">Keine Gebiete vorhanden.</p>
          ) : (
            <div className="items-list">
              {areas.map((area) => (
                <div key={area.id} className="item-row">
                  {editingId === area.id ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="edit-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(area.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <div className="item-actions">
                        <button className="save-btn" onClick={() => saveEdit(area.id)} disabled={loading}>
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
                      <span className="item-name">{area.name}</span>
                      <div className="item-actions">
                        <button className="edit-btn" onClick={() => startEdit(area)} title="Bearbeiten">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="delete-btn" onClick={() => setConfirmDelete(area)} disabled={loading} title="Löschen">
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
            <h3>Neues Gebiet hinzufügen</h3>
            <div className="add-new-form">
              <input
                type="text"
                placeholder="Gebiets-Name"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addArea()}
                className="add-input"
              />
              <button className="add-btn" onClick={addArea} disabled={loading || !newAreaName.trim()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Gebiet löschen?"
          message={`Möchtest du das Gebiet "${confirmDelete.name}" wirklich löschen?\n\nAlle Straßen und Status-Daten in diesem Gebiet werden ebenfalls gelöscht!`}
          confirmText="Löschen"
          cancelText="Abbrechen"
          onConfirm={() => deleteArea(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
          danger={true}
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
    </div>
  );
}