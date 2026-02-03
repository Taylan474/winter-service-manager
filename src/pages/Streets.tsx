import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchCitiesWithCache, fetchAreasAndStreetsWithCache, invalidateCityDataCaches } from "../lib/data-cache";
import { FEATURE_FLAGS } from "../lib/company-config";
import AreaGroup from "../components/AreaGroup";
import AreaManager from "../components/AreaManager";
import DatePicker from "../components/DatePicker";
import Footer from "../components/Footer"; 
import "../styles/streets.css";

type UserRole = "admin" | "mitarbeiter" | "gast" | null;

type StreetsProps = {
  role: UserRole;
  user: any;
  onLogout: () => Promise<void>;
};

type FilterType = "all" | "private" | "bg" | "offen" | "erledigt" | "meine_erledigt";

// Streets page for a selected city. Displays areas, DatePicker calendar, filter options for Private/BG and area management.
export default function Streets({ role, user }: StreetsProps) {
  const { citySlug } = useParams<{ citySlug: string }>();
  const navigate = useNavigate();
  const [city, setCity] = useState<any | null>(null);
  const [streets, setStreets] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAreaManager, setShowAreaManager] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [streetStatuses, setStreetStatuses] = useState<Map<string, { status: string; assignedUsers: string[] }>>(new Map());

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

  // Load city on mount
  useEffect(() => {
    fetchCity();
  }, [fetchCity]);

  // Load streets and areas when city is known
  useEffect(() => {
    if (city) {
      fetchStreetsAndAreas();
    }
  }, [city?.id, fetchStreetsAndAreas]);

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
// Filter streets by filter type
  
  const filterStreets = (areaStreets: any[]) => {
    let filtered = areaStreets;
    
    if (filter === "bg") filtered = areaStreets.filter((s) => s.isBG === true);
    else if (filter === "private") filtered = areaStreets.filter((s) => s.isBG === false);
    else if (filter === "offen") {
      filtered = areaStreets.filter((s) => {
        const statusData = streetStatuses.get(s.id);
        const status = statusData?.status;
        // If no status exists or status is "offen" or "auf_dem_weg", show it
        return !status || status === "offen" || status === "auf_dem_weg";
      });
    }
    else if (filter === "erledigt") {
      filtered = areaStreets.filter((s) => {
        const statusData = streetStatuses.get(s.id);
        return statusData?.status === "erledigt";
      });
    }
    else if (filter === "meine_erledigt") {
      filtered = areaStreets.filter((s) => {
        const statusData = streetStatuses.get(s.id);
        // Show if status is erledigt AND current user is in assigned_users
        return statusData?.status === "erledigt" && 
               user?.id && 
               statusData.assignedUsers.includes(user.id);
      });
    }
    
    // Sort alphabetically by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name, 'de'));
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

              if (filteredStreets.length === 0 && filter !== "all") {
                return null;
              }

              return (
                <AreaGroup
                  key={areaObj.id}
                  area={areaObj}
                  streets={filteredStreets}
                  cityId={city.id}
                  onStreetAdded={refreshData}
                  role={role}
                  selectedDate={selectedDate}
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
      </div>
      <Footer /> 
    </div>
  );
}