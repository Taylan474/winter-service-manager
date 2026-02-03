import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabase } from '../supabase'

// Mock the supabase module
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// We need to import after mocking, and use dynamic imports for cache reset
let dataCache: typeof import('../data-cache').dataCache
let fetchCitiesWithCache: typeof import('../data-cache').fetchCitiesWithCache
let fetchUserRoleWithCache: typeof import('../data-cache').fetchUserRoleWithCache
let fetchAreasWithCache: typeof import('../data-cache').fetchAreasWithCache
let fetchStreetsWithCache: typeof import('../data-cache').fetchStreetsWithCache
let fetchAreasAndStreetsWithCache: typeof import('../data-cache').fetchAreasAndStreetsWithCache
let invalidateCityCaches: typeof import('../data-cache').invalidateCityCaches
let invalidateCityDataCaches: typeof import('../data-cache').invalidateCityDataCaches
let invalidateUserCache: typeof import('../data-cache').invalidateUserCache

// Helper to reload the module to get fresh cache
async function reloadModule() {
  vi.resetModules()
  const module = await import('../data-cache')
  dataCache = module.dataCache
  fetchCitiesWithCache = module.fetchCitiesWithCache
  fetchUserRoleWithCache = module.fetchUserRoleWithCache
  fetchAreasWithCache = module.fetchAreasWithCache
  fetchStreetsWithCache = module.fetchStreetsWithCache
  fetchAreasAndStreetsWithCache = module.fetchAreasAndStreetsWithCache
  invalidateCityCaches = module.invalidateCityCaches
  invalidateCityDataCaches = module.invalidateCityDataCaches
  invalidateUserCache = module.invalidateUserCache
}

describe('data-cache', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await reloadModule()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('DataCache class', () => {
    describe('get and set', () => {
      it('should return null for non-existent key', () => {
        const result = dataCache.get('non-existent')
        expect(result).toBeNull()
      })

      it('should store and retrieve data', () => {
        const testData = { foo: 'bar', count: 42 }
        dataCache.set('test-key', testData)
        
        const result = dataCache.get('test-key')
        expect(result).toEqual(testData)
      })

      it('should store different data types', () => {
        dataCache.set('string', 'hello')
        dataCache.set('number', 123)
        dataCache.set('array', [1, 2, 3])
        dataCache.set('object', { nested: { value: true } })
        
        expect(dataCache.get('string')).toBe('hello')
        expect(dataCache.get('number')).toBe(123)
        expect(dataCache.get('array')).toEqual([1, 2, 3])
        expect(dataCache.get('object')).toEqual({ nested: { value: true } })
      })

      it('should overwrite existing data with same key', () => {
        dataCache.set('key', 'first')
        dataCache.set('key', 'second')
        
        expect(dataCache.get('key')).toBe('second')
      })
    })

    describe('cache expiration', () => {
      it('should return data before expiration', () => {
        vi.useFakeTimers()
        
        dataCache.set('expires-soon', 'data', 5000)
        
        // Advance time but not past expiration
        vi.advanceTimersByTime(4999)
        
        expect(dataCache.get('expires-soon')).toBe('data')
      })

      it('should return null after expiration', () => {
        vi.useFakeTimers()
        
        dataCache.set('expires-soon', 'data', 5000)
        
        // Advance time past expiration
        vi.advanceTimersByTime(5001)
        
        expect(dataCache.get('expires-soon')).toBeNull()
      })

      it('should use default expiration of 30000ms', () => {
        vi.useFakeTimers()
        
        dataCache.set('default-expiry', 'data')
        
        // Should exist at 29.9 seconds
        vi.advanceTimersByTime(29900)
        expect(dataCache.get('default-expiry')).toBe('data')
        
        // Should be expired at 30.1 seconds
        vi.advanceTimersByTime(200)
        expect(dataCache.get('default-expiry')).toBeNull()
      })

      it('should remove expired entry from cache on get', () => {
        vi.useFakeTimers()
        
        dataCache.set('to-remove', 'data', 1000)
        
        vi.advanceTimersByTime(1001)
        
        // First get should return null and remove entry
        expect(dataCache.get('to-remove')).toBeNull()
        
        // Verify it's gone by checking again (should still be null)
        expect(dataCache.get('to-remove')).toBeNull()
      })
    })

    describe('invalidate', () => {
      it('should remove specific key from cache', () => {
        dataCache.set('key1', 'value1')
        dataCache.set('key2', 'value2')
        
        dataCache.invalidate('key1')
        
        expect(dataCache.get('key1')).toBeNull()
        expect(dataCache.get('key2')).toBe('value2')
      })

      it('should not throw when invalidating non-existent key', () => {
        expect(() => dataCache.invalidate('non-existent')).not.toThrow()
      })
    })

    describe('invalidatePattern', () => {
      it('should remove all keys matching pattern', () => {
        dataCache.set('user_role_123', { role: 'admin' })
        dataCache.set('user_role_456', { role: 'user' })
        dataCache.set('cities', ['City A'])
        dataCache.set('areas_789', ['Area 1'])
        
        dataCache.invalidatePattern('user_role')
        
        expect(dataCache.get('user_role_123')).toBeNull()
        expect(dataCache.get('user_role_456')).toBeNull()
        expect(dataCache.get('cities')).toEqual(['City A'])
        expect(dataCache.get('areas_789')).toEqual(['Area 1'])
      })

      it('should not remove keys that don\'t match pattern', () => {
        dataCache.set('areas_123', 'area data')
        dataCache.set('streets_123', 'street data')
        
        dataCache.invalidatePattern('areas')
        
        expect(dataCache.get('areas_123')).toBeNull()
        expect(dataCache.get('streets_123')).toBe('street data')
      })

      it('should handle no matching keys gracefully', () => {
        dataCache.set('key1', 'value1')
        
        expect(() => dataCache.invalidatePattern('nonexistent')).not.toThrow()
        expect(dataCache.get('key1')).toBe('value1')
      })
    })

    describe('clear', () => {
      it('should remove all entries from cache', () => {
        dataCache.set('key1', 'value1')
        dataCache.set('key2', 'value2')
        dataCache.set('key3', 'value3')
        
        dataCache.clear()
        
        expect(dataCache.get('key1')).toBeNull()
        expect(dataCache.get('key2')).toBeNull()
        expect(dataCache.get('key3')).toBeNull()
      })

      it('should not throw when clearing empty cache', () => {
        expect(() => dataCache.clear()).not.toThrow()
      })
    })
  })

  describe('fetchWithTimeout (tested via fetchUserRoleWithCache)', () => {
    it('should complete within timeout', async () => {
      vi.useFakeTimers()
      
      const mockData = { role: 'admin', name: 'Admin User' }
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockData,
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const resultPromise = fetchUserRoleWithCache('user-123')
      
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result).toEqual(mockData)
    })

    it('should timeout after specified milliseconds', async () => {
      vi.useFakeTimers()
      
      // Create a promise that never resolves
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue(new Promise(() => {})),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const resultPromise = fetchUserRoleWithCache('user-123')
      
      // Advance past timeout (3000ms) and retry delay (200ms) for all retries
      await vi.advanceTimersByTimeAsync(3000 + 200 + 3000)
      
      const result = await resultPromise

      expect(result).toBeNull()
    })

    it('should retry on failure', async () => {
      vi.useFakeTimers()
      
      const mockData = { role: 'user', name: 'Test User' }
      const mockSingle = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: mockData, error: null })

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const resultPromise = fetchUserRoleWithCache('user-123')
      
      // Run all timers to complete the retries
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result).toEqual(mockData)
      expect(mockSingle).toHaveBeenCalledTimes(2)
    })

    it('should fail after all retries exhausted', async () => {
      vi.useFakeTimers()
      
      const mockSingle = vi.fn().mockRejectedValue(new Error('Persistent error'))

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const resultPromise = fetchUserRoleWithCache('user-123')
      
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result).toBeNull()
      expect(mockSingle).toHaveBeenCalledTimes(2) // 2 retries configured
    })
  })

  describe('fetchUserRoleWithCache', () => {
    it('should return cached data on cache hit', async () => {
      const cachedData = { role: 'admin', name: 'Cached Admin' }
      dataCache.set('user_role_user-123', cachedData)

      const result = await fetchUserRoleWithCache('user-123')

      expect(result).toEqual(cachedData)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('should fetch from database on cache miss', async () => {
      const mockData = { role: 'user', name: 'New User' }
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockData,
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchUserRoleWithCache('user-456')

      expect(result).toEqual(mockData)
      expect(supabase.from).toHaveBeenCalledWith('users')
    })

    it('should cache result after fetch', async () => {
      const mockData = { role: 'editor', name: 'Editor User' }
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockData,
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      await fetchUserRoleWithCache('user-789')
      
      // Clear mock to verify cache is used
      vi.mocked(supabase.from).mockClear()
      
      const secondResult = await fetchUserRoleWithCache('user-789')

      expect(secondResult).toEqual(mockData)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('should force refresh when forceRefresh is true', async () => {
      const cachedData = { role: 'old-role', name: 'Old Name' }
      const newData = { role: 'new-role', name: 'New Name' }
      
      dataCache.set('user_role_user-123', cachedData)
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: newData,
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchUserRoleWithCache('user-123', true)

      expect(result).toEqual(newData)
      expect(supabase.from).toHaveBeenCalled()
    })

    it('should return null on database error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchUserRoleWithCache('user-error')

      expect(result).toBeNull()
    })

    it('should cache user role for 5 minutes (300000ms)', async () => {
      vi.useFakeTimers()
      
      const mockData = { role: 'admin', name: 'Admin' }
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockData,
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      await fetchUserRoleWithCache('user-123')
      vi.mocked(supabase.from).mockClear()

      // Should still be cached at 4 minutes 59 seconds
      vi.advanceTimersByTime(299000)
      const beforeExpiry = await fetchUserRoleWithCache('user-123')
      expect(beforeExpiry).toEqual(mockData)
      expect(supabase.from).not.toHaveBeenCalled()

      // Should be expired at 5 minutes 1 second
      vi.advanceTimersByTime(2000)
      
      // Re-mock for the new fetch
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockData,
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      await fetchUserRoleWithCache('user-123')
      expect(supabase.from).toHaveBeenCalled()
    })
  })

  describe('fetchCitiesWithCache', () => {
    it('should fetch cities from database', async () => {
      const mockCities = [
        { id: '1', name: 'City A' },
        { id: '2', name: 'City B' },
      ]
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockCities,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchCitiesWithCache()

      expect(result).toEqual(mockCities)
      expect(supabase.from).toHaveBeenCalledWith('cities')
    })

    it('should return cached cities on subsequent calls', async () => {
      const mockCities = [{ id: '1', name: 'City A' }]
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockCities,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      await fetchCitiesWithCache()
      vi.mocked(supabase.from).mockClear()
      
      const secondResult = await fetchCitiesWithCache()

      expect(secondResult).toEqual(mockCities)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('should force refresh when requested', async () => {
      const mockCities = [{ id: '1', name: 'City A' }]
      
      dataCache.set('cities', [{ id: 'old', name: 'Old City' }])
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockCities,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchCitiesWithCache(true)

      expect(result).toEqual(mockCities)
      expect(supabase.from).toHaveBeenCalled()
    })

    it('should return empty array on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Error' },
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchCitiesWithCache()

      expect(result).toEqual([])
    })

    it('should cache cities for 60 seconds', async () => {
      vi.useFakeTimers()
      
      const mockCities = [{ id: '1', name: 'City A' }]
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockCities,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      await fetchCitiesWithCache()
      vi.mocked(supabase.from).mockClear()

      // Should still be cached at 59 seconds
      vi.advanceTimersByTime(59000)
      await fetchCitiesWithCache()
      expect(supabase.from).not.toHaveBeenCalled()

      // Should be expired at 61 seconds
      vi.advanceTimersByTime(2000)
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockCities,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      await fetchCitiesWithCache()
      expect(supabase.from).toHaveBeenCalled()
    })
  })

  describe('fetchAreasWithCache', () => {
    it('should fetch areas for a city', async () => {
      const mockAreas = [
        { id: 'a1', name: 'Area 1', city_id: 'city-1' },
        { id: 'a2', name: 'Area 2', city_id: 'city-1' },
      ]
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockAreas,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchAreasWithCache('city-1')

      expect(result).toEqual(mockAreas)
      expect(supabase.from).toHaveBeenCalledWith('areas')
    })

    it('should cache areas per city', async () => {
      const areasCity1 = [{ id: 'a1', name: 'Area 1' }]
      const areasCity2 = [{ id: 'a2', name: 'Area 2' }]
      
      dataCache.set('areas_city-1', areasCity1)
      dataCache.set('areas_city-2', areasCity2)

      const result1 = await fetchAreasWithCache('city-1')
      const result2 = await fetchAreasWithCache('city-2')

      expect(result1).toEqual(areasCity1)
      expect(result2).toEqual(areasCity2)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('should return empty array on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Error' },
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchAreasWithCache('city-error')

      expect(result).toEqual([])
    })

    it('should cache areas for 30 seconds', async () => {
      vi.useFakeTimers()
      
      const mockAreas = [{ id: 'a1', name: 'Area 1' }]
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockAreas,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      await fetchAreasWithCache('city-1')
      vi.mocked(supabase.from).mockClear()

      vi.advanceTimersByTime(29000)
      await fetchAreasWithCache('city-1')
      expect(supabase.from).not.toHaveBeenCalled()

      vi.advanceTimersByTime(2000)
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockAreas,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      await fetchAreasWithCache('city-1')
      expect(supabase.from).toHaveBeenCalled()
    })
  })

  describe('fetchStreetsWithCache', () => {
    it('should fetch streets with area relation', async () => {
      const mockStreets = [
        { id: 's1', name: 'Street 1', isBG: false, area: { id: 'a1', name: 'Area 1' } },
        { id: 's2', name: 'Street 2', isBG: true, area: null },
      ]
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mockStreets,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchStreetsWithCache('city-1')

      expect(result).toEqual(mockStreets)
      expect(supabase.from).toHaveBeenCalledWith('streets')
    })

    it('should cache streets per city', async () => {
      const streetsCity1 = [{ id: 's1', name: 'Street 1' }]
      
      dataCache.set('streets_city-1', streetsCity1)

      const result = await fetchStreetsWithCache('city-1')

      expect(result).toEqual(streetsCity1)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('should return empty array on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Error' },
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchStreetsWithCache('city-error')

      expect(result).toEqual([])
    })

    it('should force refresh when requested', async () => {
      const oldStreets = [{ id: 's-old', name: 'Old Street' }]
      const newStreets = [{ id: 's-new', name: 'New Street' }]
      
      dataCache.set('streets_city-1', oldStreets)
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: newStreets,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchStreetsWithCache('city-1', true)

      expect(result).toEqual(newStreets)
      expect(supabase.from).toHaveBeenCalled()
    })
  })

  describe('fetchAreasAndStreetsWithCache', () => {
    it('should fetch areas and streets in parallel', async () => {
      const mockAreas = [{ id: 'a1', name: 'Area 1' }]
      const mockStreets = [{ id: 's1', name: 'Street 1' }]
      
      dataCache.set('areas_city-1', mockAreas)
      dataCache.set('streets_city-1', mockStreets)

      const result = await fetchAreasAndStreetsWithCache('city-1')

      expect(result).toEqual({
        areas: mockAreas,
        streets: mockStreets,
      })
    })

    it('should force refresh both when requested', async () => {
      const mockAreas = [{ id: 'a1', name: 'Area 1' }]
      const mockStreets = [{ id: 's1', name: 'Street 1' }]
      
      dataCache.set('areas_city-1', [{ id: 'old', name: 'Old' }])
      dataCache.set('streets_city-1', [{ id: 'old', name: 'Old' }])
      
      let callCount = 0
      vi.mocked(supabase.from).mockImplementation((table) => {
        callCount++
        if (table === 'areas') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockAreas,
                error: null,
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>
        } else {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockStreets,
                error: null,
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>
        }
      })

      const result = await fetchAreasAndStreetsWithCache('city-1', true)

      expect(result).toEqual({
        areas: mockAreas,
        streets: mockStreets,
      })
      expect(callCount).toBe(2)
    })
  })

  describe('invalidateCityCaches', () => {
    it('should invalidate cities cache', async () => {
      dataCache.set('cities', [{ id: '1', name: 'City A' }])
      
      invalidateCityCaches()
      
      expect(dataCache.get('cities')).toBeNull()
    })

    it('should not affect other caches', () => {
      dataCache.set('cities', [{ id: '1', name: 'City A' }])
      dataCache.set('areas_city-1', [{ id: 'a1', name: 'Area 1' }])
      dataCache.set('user_role_user-1', { role: 'admin' })
      
      invalidateCityCaches()
      
      expect(dataCache.get('cities')).toBeNull()
      expect(dataCache.get('areas_city-1')).toEqual([{ id: 'a1', name: 'Area 1' }])
      expect(dataCache.get('user_role_user-1')).toEqual({ role: 'admin' })
    })
  })

  describe('invalidateCityDataCaches', () => {
    it('should invalidate both areas and streets caches for a city', () => {
      dataCache.set('areas_city-1', [{ id: 'a1', name: 'Area 1' }])
      dataCache.set('streets_city-1', [{ id: 's1', name: 'Street 1' }])
      dataCache.set('areas_city-2', [{ id: 'a2', name: 'Area 2' }])
      dataCache.set('streets_city-2', [{ id: 's2', name: 'Street 2' }])
      
      invalidateCityDataCaches('city-1')
      
      expect(dataCache.get('areas_city-1')).toBeNull()
      expect(dataCache.get('streets_city-1')).toBeNull()
      expect(dataCache.get('areas_city-2')).toEqual([{ id: 'a2', name: 'Area 2' }])
      expect(dataCache.get('streets_city-2')).toEqual([{ id: 's2', name: 'Street 2' }])
    })

    it('should not affect cities cache', () => {
      dataCache.set('cities', [{ id: '1', name: 'City A' }])
      dataCache.set('areas_city-1', [{ id: 'a1' }])
      dataCache.set('streets_city-1', [{ id: 's1' }])
      
      invalidateCityDataCaches('city-1')
      
      expect(dataCache.get('cities')).toEqual([{ id: '1', name: 'City A' }])
    })
  })

  describe('invalidateUserCache', () => {
    it('should invalidate user role cache', () => {
      dataCache.set('user_role_user-123', { role: 'admin', name: 'Admin' })
      dataCache.set('user_role_user-456', { role: 'user', name: 'User' })
      
      invalidateUserCache('user-123')
      
      expect(dataCache.get('user_role_user-123')).toBeNull()
      expect(dataCache.get('user_role_user-456')).toEqual({ role: 'user', name: 'User' })
    })

    it('should not affect other caches', () => {
      dataCache.set('user_role_user-123', { role: 'admin' })
      dataCache.set('cities', [{ id: '1', name: 'City A' }])
      
      invalidateUserCache('user-123')
      
      expect(dataCache.get('user_role_user-123')).toBeNull()
      expect(dataCache.get('cities')).toEqual([{ id: '1', name: 'City A' }])
    })
  })

  describe('edge cases', () => {
    it('should handle null data from database', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchCitiesWithCache()

      expect(result).toEqual([])
    })

    it('should handle empty array from database', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      const result = await fetchCitiesWithCache()

      expect(result).toEqual([])
    })

    it('should handle concurrent requests for same resource', async () => {
      const mockCities = [{ id: '1', name: 'City A' }]
      let fetchCount = 0
      
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockImplementation(() => {
            fetchCount++
            return Promise.resolve({
              data: mockCities,
              error: null,
            })
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>)

      // Make two concurrent requests
      const [result1, result2] = await Promise.all([
        fetchCitiesWithCache(),
        fetchCitiesWithCache(),
      ])

      expect(result1).toEqual(mockCities)
      expect(result2).toEqual(mockCities)
      // Both should fetch since cache isn't populated yet when both start
      expect(fetchCount).toBe(2)
    })

    it('should handle special characters in cache keys', () => {
      const data = { test: 'value' }
      const specialKey = 'user_role_uuid-with-dashes-and-123'
      
      dataCache.set(specialKey, data)
      
      expect(dataCache.get(specialKey)).toEqual(data)
    })
  })
})
