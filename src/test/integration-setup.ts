/**
 * Integration test configuration for Supabase Local
 * 
 * This enables testing with REAL RLS policies and database constraints
 * without touching production data.
 * 
 * Prerequisites:
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Start local Supabase: npm run supabase:start
 * 3. Run integration tests: npm run test:integration
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

// Local Supabase URLs (default ports)
const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const LOCAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const LOCAL_SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Test user credentials
export const TEST_USERS = {
  admin: {
    email: 'admin@test.local',
    password: 'Admin123!',
    role: 'admin',
  },
  mitarbeiter: {
    email: 'worker@test.local',
    password: 'Worker123!',
    role: 'mitarbeiter',
  },
  gast: {
    email: 'guest@test.local',
    password: 'Guest123!',
    role: 'gast',
  },
};

// Client instances
let supabaseAnon: SupabaseClient | null = null;
let supabaseService: SupabaseClient | null = null;

/**
 * Get anonymous Supabase client (for unauthenticated tests)
 */
export function getAnonClient(): SupabaseClient {
  if (!supabaseAnon) {
    supabaseAnon = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAnon;
}

/**
 * Get service role client (bypasses RLS for setup/cleanup)
 */
export function getServiceClient(): SupabaseClient {
  if (!supabaseService) {
    supabaseService = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseService;
}

/**
 * Create authenticated client for a specific user
 */
export async function getAuthenticatedClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to authenticate ${email}: ${error.message}`);
  }

  return client;
}

/**
 * Setup test users in local Supabase
 * Run once before integration tests
 */
export async function setupTestUsers(): Promise<void> {
  const service = getServiceClient();

  for (const [role, userData] of Object.entries(TEST_USERS)) {
    // Create auth user
    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
    });

    if (authError && !authError.message.includes('already')) {
      console.error(`Failed to create ${role} user:`, authError.message);
      continue;
    }

    const userId = authData?.user?.id;
    if (!userId) {
      // User might already exist, try to get their ID
      const { data: existingUser } = await service.auth.admin.listUsers();
      const found = existingUser?.users.find(u => u.email === userData.email);
      if (!found) continue;
      
      // Update users table
      await service.from('users').upsert({
        id: found.id,
        email: userData.email,
        name: `Test ${role}`,
        role: userData.role,
        password_changed: true,
      });
    } else {
      // Create users table entry
      await service.from('users').upsert({
        id: userId,
        email: userData.email,
        name: `Test ${role}`,
        role: userData.role,
        password_changed: true,
      });
    }
  }
}

/**
 * Cleanup test data (run after tests)
 */
export async function cleanupTestData(): Promise<void> {
  const service = getServiceClient();

  // Delete in reverse dependency order
  const tables = [
    'invoice_items',
    'invoices',
    'snapshots',
    'reports',
    'work_logs',
    'daily_street_status',
    'streets',
    'areas',
    'cities',
    'user_permissions',
    'customers',
    'pricing',
    'invoice_templates',
  ];

  for (const table of tables) {
    await service.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
}

/**
 * Check if local Supabase is running
 */
export async function isLocalSupabaseRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        apikey: LOCAL_SUPABASE_ANON_KEY,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for local Supabase to be ready
 */
export async function waitForSupabase(timeoutMs = 30000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await isLocalSupabaseRunning()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Local Supabase did not start within timeout');
}

// Export types
export type { User, SupabaseClient };
