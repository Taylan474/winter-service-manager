import '@testing-library/jest-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Reset mocks before each test
beforeEach(() => {
  vi.resetModules()
})

// Create a chainable mock that can be used for Supabase queries
export const createChainableMock = () => {
  const mock: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'gt', 'lt', 
                   'gte', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
                   'range', 'filter', 'order', 'limit', 'offset', 'maybeSingle', 'single',
                   'csv', 'match', 'not', 'or', 'textSearch']
  
  methods.forEach(method => {
    mock[method] = vi.fn().mockReturnValue(mock)
  })
  
  // Default resolved value
  mock.then = vi.fn((resolve) => resolve({ data: null, error: null }))
  
  return mock
}

// Mock for Supabase (so tests don't use the real DB)
// CRITICAL: This ensures NO database calls are made during tests
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ 
        data: { session: null }, 
        error: null 
      }),
      getUser: vi.fn().mockResolvedValue({ 
        data: { user: null }, 
        error: null 
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ 
        data: { user: null, session: null }, 
        error: null 
      }),
      signUp: vi.fn().mockResolvedValue({ 
        data: { user: null, session: null }, 
        error: null 
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ 
        data: { user: null }, 
        error: null 
      }),
      onAuthStateChange: vi.fn((_callback) => {
        // Can be triggered in tests to simulate auth changes
        return {
          data: { 
            subscription: { 
              unsubscribe: vi.fn() 
            } 
          }
        }
      }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) => {
      const chainable = createChainableMock()
      // Track which table is being queried for debugging
      ;(chainable as Record<string, unknown>)._table = table
      return chainable
    }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ 
        unsubscribe: vi.fn() 
      }),
    })),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  }
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
(globalThis as Record<string, unknown>).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
(globalThis as Record<string, unknown>).IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock URL.createObjectURL for PDF tests
Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock-url') })
Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn() })

// Mock window.open for PDF opening
Object.defineProperty(window, 'open', { value: vi.fn() })