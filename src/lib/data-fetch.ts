import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './supabase';

/**
 * Hook that ensures data fetching happens after auth session is ready.
 * This fixes the issue where data doesn't load on initial visit on Vercel
 * because the session restoration isn't complete when components mount.
 */
export function useAuthenticatedFetch<T>(
  fetchFn: () => Promise<T | null>,
  dependencies: any[] = []
): { data: T | null; loading: boolean; error: Error | null; refetch: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const hasCheckedAuth = useRef(false);

  // Wait for auth to be ready - with timeout to prevent infinite waiting
  useEffect(() => {
    if (hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;
    
    let mounted = true;

    const checkAuth = async () => {
      // Set a maximum timeout of 2 seconds to wait for auth
      const timeoutId = setTimeout(() => {
        if (mounted && !authReady) {
          console.warn('Auth check timed out, proceeding anyway');
          setAuthReady(true);
        }
      }, 2000);

      try {
        await supabase.auth.getSession();
        
        if (mounted) {
          clearTimeout(timeoutId);
          setAuthReady(true);
        }
      } catch (err) {
        if (mounted) {
          clearTimeout(timeoutId);
          setAuthReady(true);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!authReady) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [authReady, fetchFn]);

  // Fetch when auth is ready
  useEffect(() => {
    if (authReady) {
      refetch();
    }
  }, [authReady, ...dependencies]);

  return { data, loading, error, refetch };
}

/**
 * Hook to get the current user with proper session handling
 */
export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const getUser = async () => {
      // Initial session check
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setUser(session?.user || null);
        setLoading(false);
      }
    };

    getUser();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (mounted) {
          setUser(session?.user || null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

/**
 * Simple retry wrapper for any async function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error');
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError!;
}
