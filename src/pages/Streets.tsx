import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchCitiesWithCache, fetchAreasAndStreetsWithCache, invalidateCityDataCaches } from "../lib/data-cache";
import { FEATURE_FLAGS } from "../lib/company-config";
import AreaGroup from "../components/AreaGroup";
import AreaManager from "../components/AreaManager";
import DatePicker from "../components/DatePicker";
import Footer from "../components/Footer"; 
import TeamCompletionModal from "../components/TeamCompletionModal";
import BatchStartModal from "../components/BatchStartModal";
import "../styles/streets.css";

type UserRole = "admin" | "mitarbeiter" | "gast" | null;

type StreetsProps = {
  role: UserRole;
  user: any;
  onLogout: () => Promise<void>;
};

import type { Street } from "../types/street";

type FilterType = "all" | "private" | "bg" | "offen" | "erledigt" | "meine_erledigt";

// Streets page for a selected city. Displays areas, DatePicker calendar, filter options for Private/BG and area management.
export default function Streets({ role, user }: StreetsProps) {
  const { citySlug } = useParams<{ citySlug: string }>();
  const navigate = useNavigate();
  const [city, setCity] = useState<any | null>(null);
  const [streets, setStreets] = useState<Street[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAreaManager, setShowAreaManager] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [streetStatuses, setStreetStatuses] = useState<Map<string, { status: string; assignedUsers: string[] }>>(new Map());
  const [streetOrder, setStreetOrder] = useState<Map<string, number>>(new Map());
  
  // Multi-select mode state
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedStreetIds, setSelectedStreetIds] = useState<Set<string>>(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAction, setBatchAction] = useState<"erledigt" | "auf_dem_weg" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setCurrentUserId(data.user.id);
    };
    getCurrentUser();
  }, []);

  // Helper to normalize strings for search (removes hyphens, special chars)
  const normalizeForSearch = (str: string) => {
    return str.toLowerCase().replace(/[-_.,;:'"´`]/g, " ").replace(/\s+/g, " ").trim();
  };

  // Load personal street order from localStorage
  const loadStreetOrder = useCallback(() => {
    if (!user?.id || !city?.id) return;
    const key = `streetOrder_${user.id}_${city.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStreetOrder(new Map(Object.entries(parsed).map(([k, v]) => [k, v as number])));
      } catch {
        // Ignore invalid data
      }
    }
  }, [user?.id, city?.id]);

  // Save personal street order to localStorage
  const saveStreetOrder = useCallback((order: Map<string, number>) => {
    if (!user?.id || !city?.id) return;
    const key = `streetOrder_${user.id}_${city.id}`;
    const obj: Record<string, number> = {};
    order.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(key, JSON.stringify(obj));
  }, [user?.id, city?.id]);

  // Move a street up or down in the personal order
  const moveStreet = useCallback((streetId: string, direction: "up" | "down", areaStreets: any[]) => {
    const currentOrder = new Map(streetOrder);
    
    // Find current positions
    const sortedStreets = [...areaStreets].sort((a, b) => {
      const orderA = currentOrder.get(a.id) ?? 999999;
      const orderB = currentOrder.get(b.id) ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'de');
    });
    
    const idx = sortedStreets.findIndex(s => s.id === streetId);
    if (idx === -1) return;
    
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sortedStreets.length) return;
    
    // Swap positions
    const currentStreet = sortedStreets[idx];
    const targetStreet = sortedStreets[targetIdx];
    
    // Assign new order values
    sortedStreets.forEach((s, i) => {
      if (s.id === currentStreet.id) {
        currentOrder.set(s.id, targetIdx);
      } else if (s.id === targetStreet.id) {
        currentOrder.set(s.id, idx);
      } else {
        currentOrder.set(s.id, i);
      }
    });
    
    setStreetOrder(currentOrder);
    saveStreetOrder(currentOrder);
  }, [streetOrder, saveStreetOrder]);

  // Load city by name (slug) from URL - uses cache
  const fetchCity = useCallback(async () => {
    if (!citySlug) return;
    
    // Decode slug (trim to handle any whitespace/newlines)
    const decodedSlug = decodeURIComponent(citySlug).trim().toLowerCase();
    
    // First try to get from cache
    const cities = await fetchCitiesWithCache();
    const foundCity = cities.find(c => 
      c.name.trim().toLowerCase() === decodedSlug ||
      c.name.trim().toLowerCase().startsWith(decodedSlug)
    );
    
    if (!foundCity) {
      console.error("City not found in cache");
      navigate("/");
      return;
    }
    
    setCity(foundCity);
    setIsLoading(false);
  }, [citySlug, navigate]);

  // Load streets and areas for this city - uses cache
  const fetchStreetsAndAreas = useCallback(async (forceRefresh = false) => {
    if (!city?.id) return;
    
    const { areas: areasData, streets: streetsData } = await fetchAreasAndStreetsWithCache(city.id, forceRefresh);
    // Sort areas alphabetically by name
    const sortedAreas = [...areasData].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    setAreas(sortedAreas);
    setStreets(streetsData);
  }, [city?.id]);

  // Load status for all streets for the selected day
  const fetchStreetStatuses = useCallback(async () => {
    if (!city?.id) return;
    
    const dateString = selectedDate.toISOString().split("T")[0];
    
    const { data, error } = await supabase
      .from("daily_street_status")
      .select("street_id, status, assigned_users")
      .eq("date", dateString);
    
    if (!error && data) {
      const statusMap = new Map<string, { status: string; assignedUsers: string[] }>();
      data.forEach(item => {
        statusMap.set(item.street_id, {
          status: item.status,
          assignedUsers: item.assigned_users || [],
        });
      });
      setStreetStatuses(statusMap);
    }
  }, [city?.id, selectedDate]);

  // Refresh with cache invalidation
  const refreshData = useCallback(async () => {
    if (city?.id) {
      invalidateCityDataCaches(city.id);
      await fetchStreetsAndAreas(true);
    }
  }, [city?.id, fetchStreetsAndAreas]);

  // Multi-select functions
  const toggleStreetSelection = useCallback((streetId: string) => {
    setSelectedStreetIds(prev => {
      const next = new Set(prev);
      if (next.has(streetId)) {
        next.delete(streetId);
      } else {
        next.add(streetId);
      }
      return next;
    });
  }, []);

  const selectAllInArea = useCallback((streetIds: string[]) => {
    setSelectedStreetIds(prev => {
      const next = new Set(prev);
      streetIds.forEach(id => next.add(id));
      return next;
    });
  }, []);

  const deselectAllInArea = useCallback((streetIds: string[]) => {
    setSelectedStreetIds(prev => {
      const next = new Set(prev);
      streetIds.forEach(id => next.delete(id));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedStreetIds(new Set());
    setMultiSelectMode(false);
  }, []);

  const toggleMultiSelectMode = useCallback(() => {
    if (multiSelectMode) {
      // Exiting multi-select mode - clear selection
      setSelectedStreetIds(new Set());
    }
    setMultiSelectMode(prev => !prev);
  }, [multiSelectMode]);

  // Handle batch status change
  const handleBatchStatusChange = useCallback(async (action: "erledigt" | "auf_dem_weg" | "offen") => {
    if (selectedStreetIds.size === 0) return;
    
    if (action === "offen") {
      // Reset to offen - no modal needed, just update directly
      const dateString = selectedDate.toISOString().split("T")[0];
      const now = new Date().toISOString();
      
      for (const streetId of selectedStreetIds) {
        // Update status
        await supabase
          .from("daily_street_status")
          .upsert({
            street_id: streetId,
            date: dateString,
            status: "offen",
            started_at: null,
            finished_at: null,
            assigned_users: [],
            changed_by: currentUserId,
            updated_at: now,
          }, { onConflict: "street_id,date" });
        
        // Delete work logs for this street/date
        await supabase
          .from("work_logs")
          .delete()
          .eq("street_id", streetId)
          .eq("date", dateString);
      }
      
      clearSelection();
      fetchStreetStatuses();
    } else if (currentUserId) {
      // Show modal for erledigt and auf_dem_weg (team selection)
      setBatchAction(action);
      setShowBatchModal(true);
    }
  }, [selectedStreetIds, currentUserId, selectedDate, clearSelection, fetchStreetStatuses]);

  // Handle batch completion from modal
  const handleBatchCompletion = useCallback(async (streetTimes: Map<string, { startTime: string; endTime: string }>) => {
    const dateString = selectedDate.toISOString().split("T")[0];
    
    // Update each street's status
    for (const [streetId, times] of streetTimes) {
      const startTimestamp = new Date(`${dateString}T${times.startTime}:00`).toISOString();
      const endTimestamp = new Date(`${dateString}T${times.endTime}:00`).toISOString();
      
      await supabase
        .from("daily_street_status")
        .upsert({
          street_id: streetId,
          date: dateString,
          status: "erledigt",
          started_at: startTimestamp,
          finished_at: endTimestamp,
          changed_by: currentUserId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "street_id,date" });
    }
    
    setShowBatchModal(false);
    setBatchAction(null);
    clearSelection();
    fetchStreetStatuses();
  }, [selectedDate, currentUserId, clearSelection, fetchStreetStatuses]);

  // Get selected streets data for modal (including assigned users from current status)
  const selectedStreetsData = Array.from(selectedStreetIds).map(id => {
    const street = streets.find(s => s.id === id);
    const statusData = streetStatuses.get(id);
    return street ? { 
      id: street.id, 
      name: street.name,
      assignedUsers: statusData?.assignedUsers || []
    } : null;
  }).filter(Boolean) as { id: string; name: string; assignedUsers: string[] }[];

  // Get all unique assigned users from selected streets (for pre-selection in completion modal)
  const preSelectedUsers = Array.from(new Set(
    selectedStreetsData.flatMap(s => s.assignedUsers)
  ));

  // Load city on mount
  useEffect(() => {
    fetchCity();
  }, [fetchCity]);

  // Load streets and areas when city is known
  useEffect(() => {
    if (city) {
      fetchStreetsAndAreas();
      loadStreetOrder();
    }
  }, [city?.id, fetchStreetsAndAreas, loadStreetOrder]);

  // Load status when date or city changes
  useEffect(() => {
    if (city) {
      fetchStreetStatuses();
    }
  }, [city?.id, selectedDate, fetchStreetStatuses]);

  // Listen for real-time area changes
  useEffect(() => {
    if (!city?.id) return;
    
    const channel = supabase
      .channel(`areas-changes-${city.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "areas" },
        () => {
          refreshData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [city?.id, refreshData]);

  // Listen for real-time street changes
  useEffect(() => {
    if (!city?.id) return;
    
    const channel = supabase
      .channel(`streets-changes-${city.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "streets" },
        () => {
          refreshData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [city?.id, refreshData]);

  // Listen for real-time status changes
  useEffect(() => {
    if (!city?.id) return;
    
    const channel = supabase
      .channel(`status-changes-${city.id}-${selectedDate.toISOString().split("T")[0]}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_street_status" },
        () => {
          fetchStreetStatuses();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel).catch(console.error);
    };
  }, [city?.id, selectedDate, fetchStreetStatuses]);
// Filter streets by filter type and search query
  
  const filterStreets = (areaStreets: any[]) => {
    let filtered = areaStreets;
    
    // Apply search filter first (with flexible matching ignoring hyphens/special chars)
    if (searchQuery.trim()) {
      const normalizedQuery = normalizeForSearch(searchQuery);
      filtered = filtered.filter((s) => {
        const normalizedName = normalizeForSearch(s.name);
        // Match if normalized name contains normalized query OR exact match
        return normalizedName.includes(normalizedQuery) || 
               s.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      });
    }
    
    if (filter === "bg") filtered = filtered.filter((s) => s.isBG === true);
    else if (filter === "private") filtered = filtered.filter((s) => s.isBG === false);
    else if (filter === "offen") {
      filtered = filtered.filter((s) => {
        const statusData = streetStatuses.get(s.id);
        const status = statusData?.status;
        // If no status exists or status is "offen" or "auf_dem_weg", show it
        return !status || status === "offen" || status === "auf_dem_weg";
      });
    }
    else if (filter === "erledigt") {
      filtered = filtered.filter((s) => {
        const statusData = streetStatuses.get(s.id);
        return statusData?.status === "erledigt";
      });
    }
    else if (filter === "meine_erledigt") {
      filtered = filtered.filter((s) => {
        const statusData = streetStatuses.get(s.id);
        // Show if status is erledigt AND current user is in assigned_users
        return statusData?.status === "erledigt" && 
               user?.id && 
               statusData.assignedUsers.includes(user.id);
      });
    }
    
    // Sort by personal order (if set), then alphabetically by name
    return filtered.sort((a, b) => {
      const orderA = streetOrder.get(a.id) ?? 999999;
      const orderB = streetOrder.get(b.id) ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'de');
    });
  };

  // Loading state while city is being loaded
  if (isLoading || !city) {
    return (
      <div className="streets-wrapper">
        <div className="streets-container">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '50vh',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div className="spinner" style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3498db',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ color: '#666' }}>Lade Stadt...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="streets-wrapper">
      <div className="streets-container">
        <div className="streets-header">
          <button onClick={() => navigate('/')} className="back-btn">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Zurück
          </button>
          <h2>{city.name}</h2>
        </div>

        <DatePicker 
          selectedDate={selectedDate} 
          onDateChange={setSelectedDate} 
        />

        {/* Search Bar */}
        <div className="street-search">
          <div className="search-input-wrapper">
            <svg
              className="search-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Straße suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery("")}
                type="button"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="streets-controls">
          <div className="filter-group">
            <label>Filter:</label>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === "all" ? "active" : ""}`}
                onClick={() => setFilter("all")}
              >
                Alle
              </button>
              <button
                className={`filter-btn ${filter === "offen" ? "active" : ""}`}
                onClick={() => setFilter("offen")}
              >
                Offen
              </button>
              <button
                className={`filter-btn ${filter === "erledigt" ? "active" : ""}`}
                onClick={() => setFilter("erledigt")}
              >
                Erledigt
              </button>
              <button
                className={`filter-btn ${filter === "meine_erledigt" ? "active" : ""}`}
                onClick={() => setFilter("meine_erledigt")}
              >
                Meine
              </button>
              {FEATURE_FLAGS.enableBGFilter && (
                <>
                  <button
                    className={`filter-btn ${filter === "bg" ? "active" : ""}`}
                    onClick={() => setFilter("bg")}
                  >
                    Nur BG
                  </button>
                  <button
                    className={`filter-btn ${filter === "private" ? "active" : ""}`}
                    onClick={() => setFilter("private")}
                  >
                    Nur Privat
                  </button>
                </>
              )}
            </div>
          </div>

          {role === "admin" && (
            <button onClick={() => setShowAreaManager(true)} className="manage-areas-btn">
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
              Gebiete verwalten
            </button>
          )}

          {/* Multi-select toggle button */}
          {role !== "gast" && (
            <button 
              onClick={toggleMultiSelectMode} 
              className={`multi-select-toggle-btn ${multiSelectMode ? 'active' : ''}`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {multiSelectMode ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </>
                )}
              </svg>
              {multiSelectMode ? 'Abbrechen' : 'Mehrere wählen'}
            </button>
          )}
        </div>

        <div className="areas-list">
          {areas.length === 0 ? (
            <div className="no-data-wrapper">
              <p className="no-data">Keine Gebiete vorhanden.</p>
              {role === "admin" && (
                <button
                  onClick={() => setShowAreaManager(true)}
                  className="add-first-area-btn"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Erstes Gebiet hinzufügen
                </button>
              )}
            </div>
          ) : (
            areas.map((areaObj) => {
              const areaStreets = streets.filter(
                (street) => street.area?.id === areaObj.id
              );
              const filteredStreets = filterStreets(areaStreets);

              // Hide areas with no matching streets when filtering or searching
              if (filteredStreets.length === 0 && (filter !== "all" || searchQuery.trim())) {
                return null;
              }

              return (
                <AreaGroup
                  key={areaObj.id}
                  area={areaObj}
                  streets={filteredStreets}
                  allAreaStreets={areaStreets}
                  cityId={city.id}
                  onStreetAdded={refreshData}
                  onMoveStreet={moveStreet}
                  role={role}
                  selectedDate={selectedDate}
                  multiSelectMode={multiSelectMode}
                  selectedStreetIds={selectedStreetIds}
                  onToggleStreetSelection={toggleStreetSelection}
                  onSelectAllInArea={selectAllInArea}
                  onDeselectAllInArea={deselectAllInArea}
                />
              );
            })
          )}
        </div>

        {showAreaManager && (
          <AreaManager
            areas={areas}
            cityId={city.id}
            onClose={() => setShowAreaManager(false)}
            onRefresh={refreshData}
          />
        )}

        {/* Floating action bar for multi-select */}
        {multiSelectMode && selectedStreetIds.size > 0 && (
          <div className="multi-select-action-bar">
            <div className="action-bar-info">
              <span className="selected-count">{selectedStreetIds.size} ausgewählt</span>
              <button className="clear-selection-btn" onClick={clearSelection}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="action-bar-buttons">
              <button 
                className="action-btn offen"
                onClick={() => handleBatchStatusChange("offen")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Offen
              </button>
              <button 
                className="action-btn auf-dem-weg"
                onClick={() => handleBatchStatusChange("auf_dem_weg")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 3h15v13H1z" />
                  <path d="M16 8h3l3 3v5h-6V8z" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
                Auf dem Weg
              </button>
              <button 
                className="action-btn erledigt"
                onClick={() => handleBatchStatusChange("erledigt")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Erledigt
              </button>
            </div>
          </div>
        )}

        {/* Batch completion modal (erledigt) */}
        {showBatchModal && batchAction === "erledigt" && currentUserId && selectedStreetsData.length > 0 && (
          <TeamCompletionModal
            streets={selectedStreetsData}
            date={selectedDate.toISOString().split("T")[0]}
            currentUserId={currentUserId}
            preSelectedUsers={preSelectedUsers}
            onClose={() => {
              setShowBatchModal(false);
              setBatchAction(null);
            }}
            onSuccess={handleBatchCompletion}
          />
        )}

        {/* Batch start modal (auf_dem_weg) */}
        {showBatchModal && batchAction === "auf_dem_weg" && currentUserId && selectedStreetsData.length > 0 && (
          <BatchStartModal
            streets={selectedStreetsData}
            date={selectedDate.toISOString().split("T")[0]}
            currentUserId={currentUserId}
            onClose={() => {
              setShowBatchModal(false);
              setBatchAction(null);
            }}
            onSuccess={() => {
              setShowBatchModal(false);
              setBatchAction(null);
              clearSelection();
              fetchStreetStatuses();
            }}
          />
        )}
      </div>
      <Footer /> 
    </div>
  );
}