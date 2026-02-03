import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { 
  type Permission, 
  type UserRole, 
  DEFAULT_ROLE_PERMISSIONS, 
  PERMISSION_CATEGORIES,
  getAllPermissions,
  getPermissionsByCategory,
} from '../../lib/permissions'
import { AuthProvider, useAuth, usePermission } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

// Test component to access auth context
function TestAuthConsumer() {
  const { user, isLoading, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth()
  
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user ? user.email : 'no-user'}</span>
      <span data-testid="view-streets">{hasPermission('streets:view') ? 'yes' : 'no'}</span>
      <span data-testid="any-admin">{hasAnyPermission(['users:create', 'users:change_role']) ? 'yes' : 'no'}</span>
      <span data-testid="all-streets">{hasAllPermissions(['streets:view', 'streets:edit']) ? 'yes' : 'no'}</span>
    </div>
  )
}

// Test component for usePermission hook
function TestPermissionConsumer({ permission }: { permission: Permission }) {
  const hasPermission = usePermission(permission)
  return <span data-testid="has-permission">{hasPermission ? 'yes' : 'no'}</span>
}

describe('Permissions System', () => {
  describe('DEFAULT_ROLE_PERMISSIONS', () => {
    it('should define permissions for admin role', () => {
      const adminPerms = DEFAULT_ROLE_PERMISSIONS.admin
      expect(adminPerms).toBeDefined()
      expect(adminPerms.length).toBeGreaterThan(0)
      // Admin should have user management
      expect(adminPerms).toContain('users:create')
      expect(adminPerms).toContain('users:change_role')
    })

    it('should define permissions for mitarbeiter role', () => {
      const mitarbeiterPerms = DEFAULT_ROLE_PERMISSIONS.mitarbeiter
      expect(mitarbeiterPerms).toBeDefined()
      // Mitarbeiter should have view access
      expect(mitarbeiterPerms).toContain('cities:view')
      expect(mitarbeiterPerms).toContain('streets:view')
      expect(mitarbeiterPerms).toContain('status:update')
    })

    it('should define permissions for gast role', () => {
      const gastPerms = DEFAULT_ROLE_PERMISSIONS.gast
      expect(gastPerms).toBeDefined()
      // Gast should only have view permissions
      expect(gastPerms).toContain('streets:view')
      expect(gastPerms).toContain('cities:view')
      // Gast should NOT have edit permissions
      expect(gastPerms).not.toContain('streets:edit')
      expect(gastPerms).not.toContain('users:create')
    })

    it('admin should have all permissions that mitarbeiter has', () => {
      const adminPerms = new Set(DEFAULT_ROLE_PERMISSIONS.admin)
      const mitarbeiterPerms = DEFAULT_ROLE_PERMISSIONS.mitarbeiter
      
      mitarbeiterPerms.forEach(perm => {
        expect(adminPerms.has(perm)).toBe(true)
      })
    })

    it('mitarbeiter should have all permissions that gast has', () => {
      const mitarbeiterPerms = new Set(DEFAULT_ROLE_PERMISSIONS.mitarbeiter)
      const gastPerms = DEFAULT_ROLE_PERMISSIONS.gast
      
      gastPerms.forEach(perm => {
        expect(mitarbeiterPerms.has(perm)).toBe(true)
      })
    })
  })

  describe('PERMISSION_CATEGORIES', () => {
    it('should categorize all permissions', () => {
      const allCategorized = Object.values(PERMISSION_CATEGORIES).flat()
      const uniquePerms = [...new Set(allCategorized)]
      
      // No duplicates across categories
      expect(allCategorized.length).toBe(uniquePerms.length)
    })

    it('should have expected categories', () => {
      expect(PERMISSION_CATEGORIES).toHaveProperty('streets')
      expect(PERMISSION_CATEGORIES).toHaveProperty('cities')
      expect(PERMISSION_CATEGORIES).toHaveProperty('users')
      expect(PERMISSION_CATEGORIES).toHaveProperty('billing')
    })
  })

  describe('getAllPermissions', () => {
    it('should return all unique permissions', () => {
      const allPerms = getAllPermissions()
      expect(allPerms.length).toBeGreaterThan(0)
      // Check no duplicates
      expect(allPerms.length).toBe(new Set(allPerms).size)
    })
  })

  describe('getPermissionsByCategory', () => {
    it('should return permissions for a specific category', () => {
      const streetPerms = getPermissionsByCategory('streets')
      expect(streetPerms).toContain('streets:view')
      expect(streetPerms).toContain('streets:edit')
    })

    it('should return empty array for unknown category', () => {
      const unknownPerms = getPermissionsByCategory('nonexistent' as keyof typeof PERMISSION_CATEGORIES)
      expect(unknownPerms).toEqual([])
    })
  })
})

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render children', () => {
    render(
      <AuthProvider>
        <div data-testid="child">Child Content</div>
      </AuthProvider>
    )
    
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('should show loading state initially', () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    )
    
    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
  })

  it('should show no user when not authenticated', async () => {
    // Mock no session
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    })
    
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
  })
})

describe('usePermission hook', () => {
  it('should return false when no user is authenticated', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null,
    })

    render(
      <AuthProvider>
        <TestPermissionConsumer permission="streets:view" />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-permission')).toHaveTextContent('no')
    })
  })
})

describe('Role Hierarchy', () => {
  const roles: UserRole[] = ['admin', 'mitarbeiter', 'gast']
  
  it('should have admin with most permissions', () => {
    const permCounts = roles.map(role => ({
      role,
      count: DEFAULT_ROLE_PERMISSIONS[role].length
    }))
    
    const adminCount = permCounts.find(p => p.role === 'admin')!.count
    const otherCounts = permCounts.filter(p => p.role !== 'admin').map(p => p.count)
    
    otherCounts.forEach(count => {
      expect(adminCount).toBeGreaterThanOrEqual(count)
    })
  })

  it('should have gast with fewest permissions', () => {
    const permCounts = roles.map(role => ({
      role,
      count: DEFAULT_ROLE_PERMISSIONS[role].length
    }))
    
    const gastCount = permCounts.find(p => p.role === 'gast')!.count
    const otherCounts = permCounts.filter(p => p.role !== 'gast').map(p => p.count)
    
    otherCounts.forEach(count => {
      expect(gastCount).toBeLessThanOrEqual(count)
    })
  })
})
