import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { fetchUserRoleWithCache, dataCache } from "./lib/data-cache";
import Login from "./pages/Login";
import Cities from "./pages/Cities";
import Streets from "./pages/Streets";
import Billing from "./pages/Billing";
import WorkHours from "./pages/WorkHours";
import ForcePasswordChange from "./components/ForcePasswordChange";
import ConnectionIndicator from "./components/ConnectionIndicator";

type UserRole = "admin" | "mitarbeiter" | "gast" | null;

// Main App component that manages authentication and renders either the Login page or Cities page.
function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [userName, setUserName] = useState<string>("");
  const [passwordChanged, setPasswordChanged] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user role from DB - with cache and timeout
  const fetchUserRole = async (userId: string): Promise<void> => {
    try {
      // fetchUserRoleWithCache already has timeout/retry, but add overall timeout as safety
      const timeoutPromise = new Promise<null>((resolve) => 
        setTimeout(() => resolve(null), 5000)
      );
      
      const dataPromise = fetchUserRoleWithCache(userId);
      const userData = await Promise.race([dataPromise, timeoutPromise]);

      if (userData) {
        setRole(userData.role as UserRole);
        setUserName(userData.name || "");
      } else {
        // Fallback for new users or timeout
        console.warn('Using fallback role due to timeout or missing data');
        setRole("mitarbeiter");
      }
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      setRole("mitarbeiter"); // Safe fallback
    }
  };

  // Read password_changed from user_metadata (more reliable than DB)
  const checkPasswordChanged = (authUser: any): boolean => {
    // Check user_metadata (set at signUp)
    const metadata = authUser?.user_metadata;
    if (metadata && typeof metadata.password_changed === 'boolean') {
      return metadata.password_changed;
    }
    // Fallback: Existing users without metadata -> password was already changed
    return true;
  };

  // Listen for authentication on load and changes
  useEffect(() => {
    // Load session on component mount - optimized logic with robust timeout handling
    const getSession = async () => {
      setIsLoading(true);
      
      try {
        // Try to load the session - wait max 3s
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), 3000)
        );
        
        const sessionPromise = supabase.auth.getSession().then(({ data }) => data?.session);
        
        const session = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (session) {
          setUser(session.user);
          setPasswordChanged(checkPasswordChanged(session.user));
          // fetchUserRole has its own timeout, won't block forever
          await fetchUserRole(session.user.id);
        }
      } catch (error) {
        console.error('Session loading error:', error);
      } finally {
        // Guarantee loading state ends
        setIsLoading(false);
      }
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Ignore auth changes when a user is being created
        // (detectable by localStorage flag)
        const isCreatingUser = localStorage.getItem('winterdienst_new_user_data');
        if (isCreatingUser && event === 'SIGNED_IN') {
          console.log('Ignoring auth change during user creation');
          return;
        }
        
        // On USER_UPDATED: User object has changed (e.g. after password change)
        // -> We need to read the new state
        if (event === 'USER_UPDATED' && session?.user) {
          setUser(session.user);
          setPasswordChanged(checkPasswordChanged(session.user));
          return;
        }
        
        if (session?.user) {
          setUser(session.user);
          setPasswordChanged(checkPasswordChanged(session.user));
          await fetchUserRole(session.user.id);
        } else {
          setUser(null);
          setRole(null);
          setPasswordChanged(null);
        }
        // Ensure loading is off after auth state changes
        setIsLoading(false);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Log out user and reset state
  const handleLogout = async () => {
    try {
      // Reset state first for immediate UI change
      setUser(null);
      setRole(null);
      setPasswordChanged(null);
      setIsLoading(false);
      
      // Clear cache on logout
      dataCache.clear();
      
      // Then sign out from Supabase
      await supabase.auth.signOut();
      
      // Clean up localStorage
      localStorage.removeItem('winterdienst_new_user_data');
    } catch (error) {
      console.error('Logout error:', error);
      // Reset state anyway
      setUser(null);
      setRole(null);
      setPasswordChanged(null);
    }
  };

  // Callback when password was successfully changed
  const handlePasswordChanged = () => {
    setPasswordChanged(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#1a1a1a',
        color: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{
            width: '40px',
            height: '40px',
            margin: '0 auto 1rem',
            border: '4px solid #333',
            borderTop: '4px solid #646cff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p>Lade...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> show login page
  if (!user) {
    return <Login />;
  }

  // Logged in but password not changed yet -> force password change
  if (passwordChanged === false) {
    return (
      <ForcePasswordChange
        user={user}
        onPasswordChanged={handlePasswordChanged}
        onLogout={handleLogout}
      />
    );
  }

  // Logged in and password was changed -> show main application
  return (
    <>
      <ConnectionIndicator />
      <Routes>
        <Route path="/" element={<Cities role={role} user={user} onLogout={handleLogout} />} />
        <Route path="/city/:citySlug" element={<Streets role={role} user={user} onLogout={handleLogout} />} />
        <Route path="/billing" element={<Billing role={role} userId={user.id} />} />
        <Route path="/meine-stunden" element={<WorkHours userId={user.id} userName={userName || user.email} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
