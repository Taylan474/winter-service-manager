import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchCitiesWithCache, fetchUserRoleWithCache, invalidateCityCaches } from "../lib/data-cache";
import CityManager from "../components/CityManager";
import UsersManager from "../components/UsersManager";
import ProfileModal from "../components/ProfileModal";
import SuccessModal from "../components/SuccessModal";
import Footer from "../components/Footer";
import "../styles/cities.css";

type UserRole = "admin" | "mitarbeiter" | "gast" | null;

type CitiesProps = {
  role: UserRole;
  user: any;
  onLogout: () => Promise<void>;
};


// Main page with all cities and header elements.
// View changes based on user role (Admin, Worker, Guest).
export default function Cities({ role: parentRole, user, onLogout }: CitiesProps) {
  const navigate = useNavigate();
  const [cities, setCities] = useState<any[]>([]);
  const [showManager, setShowManager] = useState(false);
  const [showUsersManager, setShowUsersManager] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [role, setRole] = useState<UserRole>(parentRole);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

  // Load all cities from database - uses cache for faster loading
  const fetchCities = useCallback(async (forceRefresh = false) => {
    try {
      const data = await fetchCitiesWithCache(forceRefresh);
      setCities(data);
    } catch (err) {
      console.error('Error loading cities:', err);
    }
  }, []);

  // Load current user role - uses cache for faster loading
  const fetchUserRole = useCallback(async (skipLoading = false) => {
    if (!user?.id) {
      setIsLoadingRole(false);
      return;
    }
    
    if (!skipLoading) {
      setIsLoadingRole(true);
    }
    
    try {
      const userData = await fetchUserRoleWithCache(user.id);
      
      if (userData) {
        setRole(userData.role as UserRole);
      } else {
        // Fallback to parentRole
        setRole(parentRole || "mitarbeiter");
      }
    } catch (err) {
      console.error('Error loading role:', err);
      setRole(parentRole || "mitarbeiter");
    }
    
    if (!skipLoading) {
      setIsLoadingRole(false);
    }
  }, [user?.id, parentRole]);

  // Refresh cities and invalidate cache (for CityManager)
  const refreshCities = useCallback(async () => {
    invalidateCityCaches();
    await fetchCities(true);
  }, [fetchCities]);

  useEffect(() => {
    // Load data in parallel - no delay needed thanks to cache
    const loadData = async () => {
      await Promise.all([fetchCities(), fetchUserRole(false)]);
    };
    
    loadData();

    const shouldShowWelcome = localStorage.getItem('showWelcomeModal');
    
    if (shouldShowWelcome === 'true') {
      setShowWelcomeModal(true);
      localStorage.removeItem('showWelcomeModal');
    }
  }, [user?.id, fetchCities, fetchUserRole]);

  // React to changes in parentRole (e.g. when Admin changes the role)
  useEffect(() => {
    if (parentRole !== role && !isLoadingRole) {
      setRole(parentRole);
    }
  }, [parentRole]);

  // Listen for real-time city updates
  useEffect(() => {
    const channel = supabase
      .channel("cities-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cities" },
        () => {
          refreshCities();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshCities]);

  // Listen for real-time user role updates (when Admin changes role)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("user-role-changes")
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "users",
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new && 'role' in payload.new) {
            setRole(payload.new.role as UserRole);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleCloseWelcomeModal = () => {
    setShowWelcomeModal(false);
  };

  return (
    <div className="cities-page">
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <SuccessModal
          title="Registrierung erfolgreich!"
          message="Willkommen! Dein Account wurde erfolgreich erstellt. Du bist momentan als Gast angemeldet. Bitte kontaktiere einen Administrator, um deine Berechtigung zu erhöhen."
          onClose={handleCloseWelcomeModal}
        />
      )}

      <div className="cities-container">
        {/* Loading state while role is loading */}
        {isLoadingRole ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100vh',
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
            <p style={{ color: '#666' }}>Lade Berechtigungen...</p>
          </div>
        ) : (
          <>
            <div className="cities-header">
              <div className="header-left">
                <div className="header-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 21h18" />
                    <path d="M9 8h1" />
                    <path d="M9 12h1" />
                    <path d="M9 16h1" />
                    <path d="M14 8h1" />
                    <path d="M14 12h1" />
                    <path d="M14 16h1" />
                    <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                  </svg>
                </div>
                <div className="header-text">
                  <h1>Winterdienst</h1>
                  <p className="header-subtitle">Städte & Straßenverwaltung</p>
                </div>
              </div>

              <div className="header-right">
                <div className="action-buttons">
                  {/* My Hours - Visible for Admin & Worker */}
                  {role !== "gast" && (
                    <button 
                      onClick={() => navigate('/meine-stunden')} 
                      className="header-btn work-hours-btn"
                      title="Meine Arbeitsstunden"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Meine Stunden</span>
                    </button>
                  )}

                  <button 
                    onClick={() => setShowProfileModal(true)} 
                    className="header-btn profile-btn"
                    title="Profil & Einstellungen"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Profil</span>
                  </button>

                  {role === "admin" && (
                    <div className="admin-buttons">
                      <button onClick={() => setShowUsersManager(true)} className="header-btn manage-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>Mitarbeiter</span>
                      </button>
                      <button onClick={() => setShowManager(true)} className="header-btn manage-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Städte</span>
                      </button>
                      <button onClick={() => navigate('/billing')} className="header-btn manage-btn billing-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                          <line x1="1" y1="10" x2="23" y2="10" />
                        </svg>
                        <span>Abrechnung</span>
                      </button>
                    </div>
                  )}
                </div>

                <button onClick={onLogout} className="header-btn logout-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {/* Guest restriction */}
            {role === "gast" ? (
              <div className="guest-restriction">
                <div className="guest-restriction-content">
                  <svg className="guest-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <h2>Eingeschränkter Zugriff</h2>
                  <p>Sie sind als Gast angemeldet und haben keinen Zugriff auf die Winterdienst-Verwaltung.</p>
                  <p>Bitte wenden Sie sich an einen Administrator, um Ihre Berechtigung auf "Mitarbeiter" zu erhöhen.</p>
                  
                  {/* Guests see cities but cannot click them */}
                  <div className="guest-cities-preview">
                    <h3>Verfügbare Städte:</h3>
                    <div className="guest-cities-list">
                      {cities.map((city) => (
                        <div key={city.id} className="guest-city-item">
                          {city.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="cities-grid">
                {cities.length === 0 ? (
                  <div className="no-data-wrapper">
                    <p className="no-data">Keine Städte gefunden.</p>
                    {role === "admin" && (
                      <button onClick={() => setShowManager(true)} className="add-first-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Erste Stadt hinzufügen
                      </button>
                    )}
                  </div>
                ) : (
                  cities.map((city) => (
                    <div key={city.id} className="city-card" onClick={() => navigate(`/city/${encodeURIComponent(city.name.trim().toLowerCase())}`)}>
                      <svg className="city-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 21h18" />
                        <path d="M9 8h1" />
                        <path d="M9 12h1" />
                        <path d="M9 16h1" />
                        <path d="M14 8h1" />
                        <path d="M14 12h1" />
                        <path d="M14 16h1" />
                        <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
                      </svg>
                      <h3>{city.name.trim()}</h3>
                    </div>
                  ))
                )}
              </div>
            )}

            {showManager && (
              <CityManager cities={cities} onClose={() => setShowManager(false)} onRefresh={refreshCities} />
            )}

            {showProfileModal && (
              <ProfileModal user={user} onClose={() => setShowProfileModal(false)} />
            )}
          </>
        )}
      </div>

      {/* UsersManager - outside Loading conditional so it stays visible */}
      {showUsersManager && createPortal(
        <UsersManager 
          onClose={() => setShowUsersManager(false)} 
          onRefresh={refreshCities}
        />,
        document.body
      )}

      <Footer />
    </div>
  );
}