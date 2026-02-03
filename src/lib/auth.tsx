import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from './supabase';
import { type Permission, type UserRole, DEFAULT_ROLE_PERMISSIONS } from './permissions';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password_changed: boolean;
  custom_permissions?: Permission[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsPasswordChange: boolean;
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  markPasswordChanged: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Calculate permissions based on role and custom permissions
  const calculatePermissions = (userData: User): Permission[] => {
    const rolePermissions = DEFAULT_ROLE_PERMISSIONS[userData.role] || [];
    const customPermissions = userData.custom_permissions || [];
    
    // Merge and deduplicate
    const allPermissions = new Set([...rolePermissions, ...customPermissions]);
    return Array.from(allPermissions);
  };

  // Fetch user data from database
  const fetchUserData = async (authUserId: string): Promise<User | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, password_changed, custom_permissions')
      .eq('id', authUserId)
      .single();

    if (error || !data) {
      console.error('Error fetching user data:', error);
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as UserRole,
      password_changed: data.password_changed ?? true,
      custom_permissions: data.custom_permissions || [],
    };
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const userData = await fetchUserData(session.user.id);
        if (userData) {
          setUser(userData);
          setPermissions(calculatePermissions(userData));
        }
      }
      
      setIsLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await fetchUserData(session.user.id);
          if (userData) {
            setUser(userData);
            setPermissions(calculatePermissions(userData));
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setPermissions([]);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'Ungültige Anmeldedaten. Bitte überprüfe Email und Passwort.' };
      }
      return { error: error.message };
    }

    return { error: null };
  };

  // Logout function
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPermissions([]);
  };

  // Refresh user data
  const refreshUser = async () => {
    if (!user) return;
    
    const userData = await fetchUserData(user.id);
    if (userData) {
      setUser(userData);
      setPermissions(calculatePermissions(userData));
    }
  };

  // Mark password as changed
  const markPasswordChanged = () => {
    if (user) {
      setUser({ ...user, password_changed: true });
    }
  };

  // Permission check functions
  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: Permission[]): boolean => {
    return perms.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (perms: Permission[]): boolean => {
    return perms.every(p => permissions.includes(p));
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    needsPasswordChange: user ? !user.password_changed : false,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    login,
    logout,
    refreshUser,
    markPasswordChanged,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for permission checks with automatic re-render
export function usePermission(permission: Permission): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

// Hook to check multiple permissions
export function usePermissions(permissions: Permission[]): {
  hasAll: boolean;
  hasAny: boolean;
  checks: Record<Permission, boolean>;
} {
  const { hasPermission } = useAuth();
  
  const checks = permissions.reduce((acc, p) => {
    acc[p] = hasPermission(p);
    return acc;
  }, {} as Record<Permission, boolean>);

  return {
    hasAll: Object.values(checks).every(Boolean),
    hasAny: Object.values(checks).some(Boolean),
    checks,
  };
}
