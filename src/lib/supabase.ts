import {createClient, SupabaseClient} from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Prevent multiple client instances during HMR (Hot Module Replacement)
declare global {
  // eslint-disable-next-line no-var
  var __supabase: SupabaseClient | undefined;
}

function getSupabaseClient(): SupabaseClient {
  if (globalThis.__supabase) {
    return globalThis.__supabase;
  }
  
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Use localStorage for session persistence
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // Disable navigator lock to avoid HMR conflicts
      storageKey: 'winterdienst-auth',
      flowType: 'implicit',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      // Enable heartbeat to detect stale connections
      heartbeatIntervalMs: 15000,
      // Reconnect on disconnect
      reconnectAfterMs: (tries: number) => Math.min(tries * 100, 3000),
    },
    global: {
      headers: {
        'x-client-info': 'winterdienst-tracker',
      },
    },
  });
  
  globalThis.__supabase = client;
  return client;
}

export const supabase = getSupabaseClient();

// Connection status monitoring
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export function monitorConnection(onStatusChange: (status: ConnectionStatus) => void): () => void {
  let isConnected = false;
  
  // Create a heartbeat channel
  const heartbeatChannel = supabase
    .channel('connection-monitor')
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isConnected = true;
        onStatusChange('connected');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        isConnected = false;
        onStatusChange('disconnected');
      } else {
        onStatusChange('connecting');
      }
    });
  
  // Also monitor online/offline events
  const handleOnline = () => {
    if (!isConnected) {
      onStatusChange('connecting');
      // Force reconnect
      supabase.removeChannel(heartbeatChannel);
      monitorConnection(onStatusChange);
    }
  };
  
  const handleOffline = () => {
    onStatusChange('disconnected');
  };
  
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }
  
  return () => {
    supabase.removeChannel(heartbeatChannel);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  };
}