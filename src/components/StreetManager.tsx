import { useState } from "react";
import { supabase } from "../lib/supabase";
import { FEATURE_FLAGS } from "../lib/company-config";
import ConfirmModal from "./ConfirmModal";
import AlertModal from "./AlertModal";
import "../styles/manager.css";

type Street = {
  id: string;
  name: string;
  isBG: boolean;
};

type StreetManagerProps = {
  streets: Street[];
  areaId: string;
  cityId: string;
  onClose: () => void;
  onRefresh: () => void;
};

// Component to manage streets (add, edit, delete)
export default function StreetManager({
  streets,
  areaId,
  cityId,
  onClose,
  onRefresh,
}: StreetManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsBG, setEditIsBG] = useState(false);
  const [newStreetName, setNewStreetName] = useState("");
  const [newIsBG, setNewIsBG] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Street | null>(null);
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type?: "error" | "warning" }>({ show: false, title: "", message: "" });

  // Prepare street for editing
  const startEdit = (street: Street) => {
    setEditingId(street.id);
    setEditName(street.name);
    setEditIsBG(street.isBG);
  };

  // Cancel edit mode
  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditIsBG(false);
  };

  // Update street in the database
  const saveEdit = async (streetId: string) => {
    if (!editName.trim()) {
      setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte einen Namen eingeben.", type: "warning" });
      return;
    }

    const exists = streets.some(
      (s) => s.id !== streetId && s.name.toLowerCase() === editName.trim().toLowerCase()
    );
    if (exists) {
      setAlertModal({ show: true, title: "Name existiert bereits", message: "Eine Straße mit diesem Namen existiert bereits in diesem Gebiet!", type: "warning" });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("streets")
      .update({ name: editName.trim(), isBG: editIsBG })
      .eq("id", streetId);

    setLoading(false);

    if (error) {
      console.error("Fehler beim Aktualisieren:", error);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Aktualisieren der Straße.", type: "error" });
      return;
    }

    setEditingId(null);
    setEditName("");
    setEditIsBG(false);
    onRefresh();
  };

  const deleteStreet = async (street: Street) => {
    setLoading(true);
    const { error } = await supabase.from("streets").delete().eq("id", street.id);
    setLoading(false);

    if (error) {
      console.error("Fehler beim Löschen:", error);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Löschen der Straße: " + error.message, type: "error" });
      return;
    }

    setConfirmDelete(null);
    onRefresh();
  };

  const addStreet = async () => {
    if (!newStreetName.trim()) {
      setAlertModal({ show: true, title: "Fehlende Eingabe", message: "Bitte einen Namen eingeben.", type: "warning" });
      return;
    }

    const exists = streets.some(
      (s) => s.name.toLowerCase() === newStreetName.trim().toLowerCase()
    );
    if (exists) {
      setAlertModal({ show: true, title: "Name existiert bereits", message: "Eine Straße mit diesem Namen existiert bereits in diesem Gebiet!", type: "warning" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("streets").insert({
      name: newStreetName.trim(),
      isBG: newIsBG,
      area_id: areaId,
      city_id: cityId,
    });

    setLoading(false);

    if (error) {
      console.error("Fehler beim Erstellen:", error);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Erstellen der Straße.", type: "error" });
      return;
    }

    setNewStreetName("");
    setNewIsBG(false);
    onRefresh();
  };

  return (
    <div className="manager-overlay" onClick={onClose}>
      <div className="manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manager-header">
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18" />
              <path d="M9 8h1" />
              <path d="M9 12h1" />
              <path d="M9 16h1" />
              <path d="M14 8h1" />
              <path d="M14 12h1" />
              <path d="M14 16h1" />
              <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
            </svg>
            Straßen verwalten
          </h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="manager-content">
          {streets.length === 0 ? (
            <p className="no-items">Keine Straßen vorhanden.</p>
          ) : (
            <div className="items-list">
              {streets.map((street) => (
                <div key={street.id} className="item-row">
                  {editingId === street.id ? (
                    <>
                      <div className="edit-street-wrapper">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="edit-input"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(street.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                        {FEATURE_FLAGS.enableBGFilter && (
                          <label className="edit-bg-checkbox">
                            <input type="checkbox" checked={editIsBG} onChange={(e) => setEditIsBG(e.target.checked)} />
                            <span>BG</span>
                          </label>
                        )}
                      </div>
                      <div className="item-actions">
                        <button className="save-btn" onClick={() => saveEdit(street.id)} disabled={loading}>
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
                      <div className="street-info-row">
                        <span className="item-name">{street.name}</span>
                        {FEATURE_FLAGS.enableBGFilter && street.isBG && <span className="bg-badge-small">BG</span>}
                      </div>
                      <div className="item-actions">
                        <button className="edit-btn" onClick={() => startEdit(street)} title="Bearbeiten">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="delete-btn" onClick={() => setConfirmDelete(street)} disabled={loading} title="Löschen">
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
            <h3>Neue Straße hinzufügen</h3>
            <div className="add-new-form">
              <input
                type="text"
                placeholder="Straßen-Name"
                value={newStreetName}
                onChange={(e) => setNewStreetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addStreet()}
                className="add-input"
              />
              {FEATURE_FLAGS.enableBGFilter && (
                <label className="add-bg-checkbox">
                  <input type="checkbox" checked={newIsBG} onChange={(e) => setNewIsBG(e.target.checked)} />
                  <span>BG</span>
                </label>
              )}
              <button className="add-btn" onClick={addStreet} disabled={loading || !newStreetName.trim()}>
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
          title="Straße löschen?"
          message={`Möchtest du die Straße "${confirmDelete.name}" wirklich löschen?\n\nAlle Status-Daten dieser Straße werden ebenfalls gelöscht!`}
          confirmText="Löschen"
          cancelText="Abbrechen"
          onConfirm={() => deleteStreet(confirmDelete)}
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