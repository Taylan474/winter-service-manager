import { supabase } from './supabase';

/**
 * Simple in-memory cache for frequently accessed data
 * Reduces redundant database calls and speeds up UI
 */

// Helper: fetch with timeout and retry
async function fetchWithTimeout<T>(
  fetchFn: () => Promise<T>,
  timeoutMs: number = 3000,
  retries: number = 2
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        fetchFn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        ),
      ]);
      return result;
    } catch (error) {
      console.warn(`Fetch attempt ${attempt} failed:`, error);
      if (attempt === retries) throw error;
      // Wait 200ms before retry
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error('All retries failed');
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number;
}

class DataCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T, expiresIn: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn,
    });
  }
  
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  clear(): void {
    this.cache.clear();
  }
}

export const dataCache = new DataCache();

// Cache keys
const CACHE_KEYS = {
  CITIES: 'cities',
  USER_ROLE: (userId: string) => `user_role_${userId}`,
  AREAS: (cityId: string) => `areas_${cityId}`,
  STREETS: (cityId: string) => `streets_${cityId}`,
  // Billing-related cache keys
  CUSTOMERS: 'billing_customers',
  PRICING: 'billing_pricing',
  TEMPLATES: 'billing_templates',
  INVOICES: 'billing_invoices',
  REPORTS: 'billing_reports',
} as const;

/**
 * Fetch all cities with caching
 */
export async function fetchCitiesWithCache(forceRefresh = false): Promise<any[]> {
  if (!forceRefresh) {
    const cached = dataCache.get<any[]>(CACHE_KEYS.CITIES);
    if (cached) return cached;
  }
  
  const { data, error } = await supabase
    .from('cities')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching cities:', error);
    return [];
  }
  
  // Cache for 60 seconds
  dataCache.set(CACHE_KEYS.CITIES, data ?? [], 60000);
  return data ?? [];
}

/**
 * Fetch user role with caching - includes timeout and retry logic
 */
export async function fetchUserRoleWithCache(userId: string, forceRefresh = false): Promise<{ role: string; name: string } | null> {
  const cacheKey = CACHE_KEYS.USER_ROLE(userId);
  
  if (!forceRefresh) {
    const cached = dataCache.get<{ role: string; name: string }>(cacheKey);
    if (cached) return cached;
  }
  
  try {
    const result = await fetchWithTimeout(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('role, name')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    }, 3000, 2); // 3s timeout, 2 retries
    
    if (result) {
      // Cache for 5 minutes (role changes are rare)
      dataCache.set(cacheKey, result, 300000);
      return result;
    }
  } catch (error) {
    console.error('Error fetching user role after retries:', error);
  }
  
  return null;
}

/**
 * Fetch areas for a city with caching
 */
export async function fetchAreasWithCache(cityId: string, forceRefresh = false): Promise<any[]> {
  const cacheKey = CACHE_KEYS.AREAS(cityId);
  
  if (!forceRefresh) {
    const cached = dataCache.get<any[]>(cacheKey);
    if (cached) return cached;
  }
  
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('city_id', cityId);
  
  if (error) {
    console.error('Error fetching areas:', error);
    return [];
  }
  
  // Cache for 30 seconds
  dataCache.set(cacheKey, data ?? [], 30000);
  return data ?? [];
}

/**
 * Fetch streets for a city with caching
 */
export async function fetchStreetsWithCache(cityId: string, forceRefresh = false): Promise<any[]> {
  const cacheKey = CACHE_KEYS.STREETS(cityId);
  
  if (!forceRefresh) {
    const cached = dataCache.get<any[]>(cacheKey);
    if (cached) return cached;
  }
  
  const { data, error } = await supabase
    .from('streets')
    .select(`
      id,
      name,
      isBG,
      area:areas(id, name)
    `)
    .eq('city_id', cityId);
  
  if (error) {
    console.error('Error fetching streets:', error);
    return [];
  }
  
  // Cache for 30 seconds
  dataCache.set(cacheKey, data ?? [], 30000);
  return data ?? [];
}

/**
 * Fetch areas and streets in parallel with caching
 */
export async function fetchAreasAndStreetsWithCache(cityId: string, forceRefresh = false): Promise<{ areas: any[]; streets: any[] }> {
  const [areas, streets] = await Promise.all([
    fetchAreasWithCache(cityId, forceRefresh),
    fetchStreetsWithCache(cityId, forceRefresh),
  ]);
  
  return { areas, streets };
}

/**
 * Invalidate city-related caches (call after mutations)
 */
export function invalidateCityCaches(): void {
  dataCache.invalidate(CACHE_KEYS.CITIES);
}

/**
 * Invalidate area/street caches for a city (call after mutations)
 */
export function invalidateCityDataCaches(cityId: string): void {
  dataCache.invalidate(CACHE_KEYS.AREAS(cityId));
  dataCache.invalidate(CACHE_KEYS.STREETS(cityId));
}

/**
 * Invalidate user cache (call after role changes)
 */
export function invalidateUserCache(userId: string): void {
  dataCache.invalidate(CACHE_KEYS.USER_ROLE(userId));
}

// ============= BILLING DATA CACHING =============

/**
 * Fetch customers with caching
 */
export async function fetchCustomersWithCache(forceRefresh = false, activeOnly = false): Promise<any[]> {
  const cacheKey = activeOnly ? `${CACHE_KEYS.CUSTOMERS}_active` : CACHE_KEYS.CUSTOMERS;
  
  if (!forceRefresh) {
    const cached = dataCache.get<any[]>(cacheKey);
    if (cached) return cached;
  }
  
  try {
    let query = supabase
      .from('customers')
      .select('*')
      .order('name');
    
    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
    
    // Cache for 60 seconds
    dataCache.set(cacheKey, data ?? [], 60000);
    return data ?? [];
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
}

/**
 * Fetch pricing with caching
 */
export async function fetchPricingWithCache(forceRefresh = false): Promise<any[]> {
  if (!forceRefresh) {
    const cached = dataCache.get<any[]>(CACHE_KEYS.PRICING);
    if (cached) return cached;
  }
  
  try {
    const { data, error } = await supabase
      .from('pricing')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching pricing:', error);
      return [];
    }
    
    // Cache for 60 seconds
    dataCache.set(CACHE_KEYS.PRICING, data ?? [], 60000);
    return data ?? [];
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return [];
  }
}

/**
 * Fetch invoice templates with caching
 */
export async function fetchTemplatesWithCache(forceRefresh = false): Promise<any[]> {
  if (!forceRefresh) {
    const cached = dataCache.get<any[]>(CACHE_KEYS.TEMPLATES);
    if (cached) return cached;
  }
  
  try {
    const { data, error } = await supabase
      .from('invoice_templates')
      .select('*')
      .order('is_default', { ascending: false });
    
    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
    
    // Cache for 60 seconds
    dataCache.set(CACHE_KEYS.TEMPLATES, data ?? [], 60000);
    return data ?? [];
  } catch (error) {
    console.error('Error fetching templates:', error);
    return [];
  }
}

/**
 * Pre-fetch all billing data in parallel (call when entering billing page)
 */
export async function prefetchBillingData(forceRefresh = false): Promise<void> {
  await Promise.all([
    fetchCustomersWithCache(forceRefresh, true),
    fetchCustomersWithCache(forceRefresh, false),
    fetchTemplatesWithCache(forceRefresh),
    fetchPricingWithCache(forceRefresh),
  ]);
}

/**
 * Invalidate all billing caches (call after mutations)
 */
export function invalidateBillingCaches(): void {
  dataCache.invalidate(CACHE_KEYS.CUSTOMERS);
  dataCache.invalidate(`${CACHE_KEYS.CUSTOMERS}_active`);
  dataCache.invalidate(CACHE_KEYS.PRICING);
  dataCache.invalidate(CACHE_KEYS.TEMPLATES);
  dataCache.invalidate(CACHE_KEYS.INVOICES);
  dataCache.invalidate(CACHE_KEYS.REPORTS);
}

/**
 * Invalidate specific billing cache
 */
export function invalidateCustomersCache(): void {
  dataCache.invalidate(CACHE_KEYS.CUSTOMERS);
  dataCache.invalidate(`${CACHE_KEYS.CUSTOMERS}_active`);
}

export function invalidatePricingCache(): void {
  dataCache.invalidate(CACHE_KEYS.PRICING);
}

export function invalidateTemplatesCache(): void {
  dataCache.invalidate(CACHE_KEYS.TEMPLATES);
}
