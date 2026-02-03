// Company branding configuration
// These values are loaded from environment variables (set in Vercel dashboard)
// Fallback values are used when env vars are not set (e.g., in development or public GitHub)

export const COMPANY_CONFIG = {
  name: import.meta.env.VITE_COMPANY_NAME || 'Your Company',
  shortName: import.meta.env.VITE_COMPANY_SHORT_NAME || 'YC',
  subtitle: import.meta.env.VITE_COMPANY_SUBTITLE || 'Winter Service',
  footerText: import.meta.env.VITE_COMPANY_FOOTER || 'Winter Service - Work Hours Report',
  serviceName: import.meta.env.VITE_SERVICE_NAME || 'Winterdienst',
};

// Feature flags - control visibility of business-specific features
export const FEATURE_FLAGS = {
  // When true, shows BG (Berufsgenossenschaft) filter and badges
  // Set VITE_ENABLE_BG_FILTER=true in Vercel to enable
  enableBGFilter: import.meta.env.VITE_ENABLE_BG_FILTER === 'true',
};
