// RBAC Permission System Types and Configuration

// Available permissions in the system
export type Permission =
  // Cities
  | 'cities:view'
  | 'cities:create'
  | 'cities:edit'
  | 'cities:delete'
  // Areas
  | 'areas:view'
  | 'areas:create'
  | 'areas:edit'
  | 'areas:delete'
  // Streets
  | 'streets:view'
  | 'streets:create'
  | 'streets:edit'
  | 'streets:delete'
  // Street Status
  | 'status:view'
  | 'status:update'
  // Users
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  | 'users:change_role'
  // Work Logs
  | 'worklogs:view_own'
  | 'worklogs:view_all'
  | 'worklogs:create'
  | 'worklogs:edit_own'
  | 'worklogs:delete_own'
  | 'worklogs:delete_all'
  // Reports & Invoices
  | 'reports:view'
  | 'reports:generate'
  | 'invoices:view'
  | 'invoices:create'
  | 'invoices:edit'
  | 'invoices:delete'
  // Billing & Settings
  | 'billing:view'
  | 'billing:manage'
  | 'templates:view'
  | 'templates:manage'
  // Archive
  | 'archive:view'
  | 'archive:restore';

// User roles
export type UserRole = 'admin' | 'mitarbeiter' | 'gast';

// Default permissions for each role
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Full access to everything
    'cities:view', 'cities:create', 'cities:edit', 'cities:delete',
    'areas:view', 'areas:create', 'areas:edit', 'areas:delete',
    'streets:view', 'streets:create', 'streets:edit', 'streets:delete',
    'status:view', 'status:update',
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:change_role',
    'worklogs:view_own', 'worklogs:view_all', 'worklogs:create', 'worklogs:edit_own', 'worklogs:delete_own', 'worklogs:delete_all',
    'reports:view', 'reports:generate',
    'invoices:view', 'invoices:create', 'invoices:edit', 'invoices:delete',
    'billing:view', 'billing:manage',
    'templates:view', 'templates:manage',
    'archive:view', 'archive:restore',
  ],
  mitarbeiter: [
    // Can view cities, areas, streets
    'cities:view',
    'areas:view',
    'streets:view',
    // Can update street status
    'status:view', 'status:update',
    // Can view users (for assignment)
    'users:view',
    // Own work logs only
    'worklogs:view_own', 'worklogs:create', 'worklogs:edit_own', 'worklogs:delete_own',
    // Can view reports
    'reports:view', 'reports:generate',
  ],
  gast: [
    // View only - very limited
    'cities:view',
    'areas:view',
    'streets:view',
    'status:view',
  ],
};

// Permission descriptions for UI
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'cities:view': 'Städte anzeigen',
  'cities:create': 'Städte erstellen',
  'cities:edit': 'Städte bearbeiten',
  'cities:delete': 'Städte löschen',
  'areas:view': 'Gebiete anzeigen',
  'areas:create': 'Gebiete erstellen',
  'areas:edit': 'Gebiete bearbeiten',
  'areas:delete': 'Gebiete löschen',
  'streets:view': 'Straßen anzeigen',
  'streets:create': 'Straßen erstellen',
  'streets:edit': 'Straßen bearbeiten',
  'streets:delete': 'Straßen löschen',
  'status:view': 'Straßen-Status anzeigen',
  'status:update': 'Straßen-Status ändern',
  'users:view': 'Benutzer anzeigen',
  'users:create': 'Benutzer erstellen',
  'users:edit': 'Benutzer bearbeiten',
  'users:delete': 'Benutzer löschen',
  'users:change_role': 'Benutzerrollen ändern',
  'worklogs:view_own': 'Eigene Arbeitsstunden anzeigen',
  'worklogs:view_all': 'Alle Arbeitsstunden anzeigen',
  'worklogs:create': 'Arbeitsstunden eintragen',
  'worklogs:edit_own': 'Eigene Arbeitsstunden bearbeiten',
  'worklogs:delete_own': 'Eigene Arbeitsstunden löschen',
  'worklogs:delete_all': 'Alle Arbeitsstunden löschen',
  'reports:view': 'Berichte anzeigen',
  'reports:generate': 'Berichte generieren',
  'invoices:view': 'Rechnungen anzeigen',
  'invoices:create': 'Rechnungen erstellen',
  'invoices:edit': 'Rechnungen bearbeiten',
  'invoices:delete': 'Rechnungen löschen',
  'billing:view': 'Preise anzeigen',
  'billing:manage': 'Preise verwalten',
  'templates:view': 'Vorlagen anzeigen',
  'templates:manage': 'Vorlagen verwalten',
  'archive:view': 'Archiv anzeigen',
  'archive:restore': 'Aus Archiv wiederherstellen',
};

// Permission categories for UI grouping
export const PERMISSION_CATEGORIES = {
  cities: ['cities:view', 'cities:create', 'cities:edit', 'cities:delete'] as Permission[],
  areas: ['areas:view', 'areas:create', 'areas:edit', 'areas:delete'] as Permission[],
  streets: ['streets:view', 'streets:create', 'streets:edit', 'streets:delete'] as Permission[],
  status: ['status:view', 'status:update'] as Permission[],
  users: ['users:view', 'users:create', 'users:edit', 'users:delete', 'users:change_role'] as Permission[],
  worklogs: ['worklogs:view_own', 'worklogs:view_all', 'worklogs:create', 'worklogs:edit_own', 'worklogs:delete_own', 'worklogs:delete_all'] as Permission[],
  reports: ['reports:view', 'reports:generate'] as Permission[],
  invoices: ['invoices:view', 'invoices:create', 'invoices:edit', 'invoices:delete'] as Permission[],
  billing: ['billing:view', 'billing:manage'] as Permission[],
  templates: ['templates:view', 'templates:manage'] as Permission[],
  archive: ['archive:view', 'archive:restore'] as Permission[],
};

export const CATEGORY_LABELS: Record<string, string> = {
  cities: 'Städte',
  areas: 'Gebiete',
  streets: 'Straßen',
  status: 'Straßen-Status',
  users: 'Benutzer',
  worklogs: 'Arbeitsstunden',
  reports: 'Berichte',
  invoices: 'Rechnungen',
  billing: 'Preise & Abrechnung',
  templates: 'Vorlagen',
  archive: 'Archiv',
};

// Helper function to get all permissions
export function getAllPermissions(): Permission[] {
  return Object.values(PERMISSION_CATEGORIES).flat();
}

// Helper function to get permissions by category
export function getPermissionsByCategory(category: keyof typeof PERMISSION_CATEGORIES): Permission[] {
  return PERMISSION_CATEGORIES[category] || [];
}
