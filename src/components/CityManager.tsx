import { useState } from "react";
import { supabase } from "../lib/supabase";
import ConfirmModal from "./ConfirmModal";
import AlertModal from "./AlertModal";
import "../styles/manager.css";

type City = {
  id: string;
  name: string;
};

type CityManagerProps = {
  cities: City[];
  onClose: () => void;
  onRefresh: () => void;
};


// Component to manage cities (add, edit, delete)
export default function CityManager({ cities, onClose, onRefresh }: CityManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newCityName, setNewCityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<City | null>(null);
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type?: "error" | "warning" }>({ show: false, title: "", message: "" });

  // Prepare city for editing
  const startEdit = (city: City) => {
    setEditingId(city.id);
    setEditName(city.name);
  };

  // Cancel edit mode
  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  // Update city in the database
  const saveEdit = async (cityId: string) => {
    if (!editName.trim()) {
      setAlertModal({ show: true, title: "Eingabe erforderlich", message: "Bitte einen Namen eingeben.", type: "warning" });
      return;
    }

    const exists = cities.some(
      (c) => c.id !== cityId && c.name.toLowerCase() === editName.trim().toLowerCase()
    );
    if (exists) {
      setAlertModal({ show: true, title: "Duplikat", message: "Eine Stadt mit diesem Namen existiert bereits!", type: "warning" });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("cities")
      .update({ name: editName.trim() })
      .eq("id", cityId);

    setLoading(false);

    if (error) {
      console.error("Fehler beim Aktualisieren:", error);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Aktualisieren der Stadt.", type: "error" });
      return;
    }

    setEditingId(null);
    setEditName("");
    onRefresh();
  };

  // Delete city from the database
  const deleteCity = async (city: City) => {
    setLoading(true);
    const { data, error } = await supabase.from("cities").delete().eq("id", city.id).select();
    setLoading(false);

    console.log("Delete Response:", { data, error });

    if (error) {
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Löschen der Stadt: " + error.message, type: "error" });
      return;
    }
    setConfirmDelete(null);
    onRefresh();
  };

  // Add new city
  const addCity = async () => {
    if (!newCityName.trim()) {
      setAlertModal({ show: true, title: "Eingabe erforderlich", message: "Bitte einen Namen eingeben.", type: "warning" });
      return;
    }

  
    const exists = cities.some(
      (c) => c.name.toLowerCase() === newCityName.trim().toLowerCase()
    );
    if (exists) {
      setAlertModal({ show: true, title: "Duplikat", message: "Eine Stadt mit diesem Namen existiert bereits!", type: "warning" });
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("cities")
      .insert({ name: newCityName.trim() });

    setLoading(false);

    if (error) {
      console.error("Fehler beim Erstellen:", error);
      setAlertModal({ show: true, title: "Fehler", message: "Fehler beim Erstellen der Stadt.", type: "error" });
      return;
    }

    setNewCityName("");
    onRefresh();
  };

  return (
    <div className="manager-overlay" onClick={onClose}>
      <div className="manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manager-header">
          <h2>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
            Städte verwalten
          </h2>
          <button className="close-btn" onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="manager-content">
          {cities.length === 0 ? (
            <p className="no-items">Keine Städte vorhanden.</p>
          ) : (
            <div className="items-list">
              {cities.map((city) => (
                <div key={city.id} className="item-row">
                  {editingId === city.id ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="edit-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(city.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <div className="item-actions">
                        <button
                          className="save-btn"
                          onClick={() => saveEdit(city.id)}
                          disabled={loading}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button className="cancel-btn" onClick={cancelEdit}>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="item-name">{city.name}</span>
                      <div className="item-actions">
                        <button
                          className="edit-btn"
                          onClick={() => startEdit(city)}
                          title="Bearbeiten"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => setConfirmDelete(city)}
                          disabled={loading}
                          title="Löschen"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
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
            <h3>Neue Stadt hinzufügen</h3>
            <div className="add-new-form">
              <input
                type="text"
                placeholder="Stadt-Name"
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCity();
                }}
                className="add-input"
              />
              <button
                className="add-btn"
                onClick={addCity}
                disabled={loading || !newCityName.trim()}
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
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Stadt löschen?"
          message={`Möchtest du die Stadt "${confirmDelete.name}" wirklich löschen?\n\nAlle Gebiete, Straßen und Status-Daten dieser Stadt werden ebenfalls gelöscht!`}
          confirmText="Löschen"
          cancelText="Abbrechen"
          onConfirm={() => deleteCity(confirmDelete)}
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