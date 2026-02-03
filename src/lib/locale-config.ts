/**
 * Locale Configuration Module
 * 
 * Centralized configuration for date, time, and currency formatting.
 * Default configuration uses German locale (de-DE) with DD.MM.YYYY date format.
 */

export interface LocaleConfig {
  locale: string;
  dateFormat: Intl.DateTimeFormatOptions;
  timeFormat: Intl.DateTimeFormatOptions;
  currencyCode: string;
  currencyFormat: Intl.NumberFormatOptions;
}

// Default German locale configuration
const DEFAULT_CONFIG: LocaleConfig = {
  locale: 'de-DE',
  dateFormat: {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  },
  timeFormat: {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  },
  currencyCode: 'EUR',
  currencyFormat: {
    style: 'currency',
    currency: 'EUR',
  },
};

// Current configuration (can be modified at runtime)
let currentConfig: LocaleConfig = { ...DEFAULT_CONFIG };

/**
 * Get the current locale configuration
 */
export function getLocaleConfig(): LocaleConfig {
  return { ...currentConfig };
}

/**
 * Set the locale configuration
 * @param config Partial config to merge with defaults
 */
export function setLocaleConfig(config: Partial<LocaleConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...config,
    dateFormat: {
      ...currentConfig.dateFormat,
      ...config.dateFormat,
    },
    timeFormat: {
      ...currentConfig.timeFormat,
      ...config.timeFormat,
    },
    currencyFormat: {
      ...currentConfig.currencyFormat,
      ...config.currencyFormat,
    },
  };
}

/**
 * Reset to default configuration
 */
export function resetLocaleConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
}

/**
 * Format a date string using the current locale configuration
 * @param dateString ISO date string or Date object
 * @returns Formatted date string (e.g., "15.01.2024" for German locale)
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString(currentConfig.locale, currentConfig.dateFormat);
}

/**
 * Format a time string using the current locale configuration
 * @param timeString Time string or Date object
 * @returns Formatted time string (e.g., "14:30" for German locale)
 */
export function formatTime(timeString: string | Date): string {
  const date = typeof timeString === 'string' ? new Date(`1970-01-01T${timeString}`) : timeString;
  return date.toLocaleTimeString(currentConfig.locale, currentConfig.timeFormat);
}

/**
 * Parse a UTC timestamp from the database and return a properly timezone-aware Date
 * Supabase returns timestamps that may or may not include timezone info.
 * This ensures consistent parsing.
 * @param timestamp ISO timestamp string from database
 * @returns Date object in local timezone
 */
export function parseTimestamp(timestamp: string | null): Date | null {
  if (!timestamp) return null;
  
  // If the timestamp doesn't have timezone info, treat it as UTC
  // Supabase typically returns timestamps with +00:00 or Z suffix
  let normalizedTimestamp = timestamp;
  
  // If no timezone indicator, append Z to treat as UTC
  if (!timestamp.endsWith('Z') && !timestamp.includes('+') && !timestamp.includes('-', 10)) {
    normalizedTimestamp = timestamp + 'Z';
  }
  
  return new Date(normalizedTimestamp);
}

/**
 * Format a database timestamp to local time
 * @param timestamp ISO timestamp from database
 * @returns Formatted time string in local timezone
 */
export function formatTimestamp(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const date = parseTimestamp(timestamp);
  if (!date) return null;
  return date.toLocaleTimeString(currentConfig.locale, currentConfig.timeFormat);
}

/**
 * Format a currency amount using the current locale configuration
 * @param amount Numeric amount
 * @returns Formatted currency string (e.g., "1.234,56 €" for German locale)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(currentConfig.locale, currentConfig.currencyFormat).format(amount);
}

/**
 * Format a date range
 * @param startDate Start date
 * @param endDate End date
 * @returns Formatted date range string
 */
export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Preset configurations for common locales
 */
export const LOCALE_PRESETS = {
  'de-DE': {
    locale: 'de-DE',
    dateFormat: { day: '2-digit', month: '2-digit', year: 'numeric' },
    timeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    currencyCode: 'EUR',
    currencyFormat: { style: 'currency', currency: 'EUR' },
  },
  'de-AT': {
    locale: 'de-AT',
    dateFormat: { day: '2-digit', month: '2-digit', year: 'numeric' },
    timeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    currencyCode: 'EUR',
    currencyFormat: { style: 'currency', currency: 'EUR' },
  },
  'de-CH': {
    locale: 'de-CH',
    dateFormat: { day: '2-digit', month: '2-digit', year: 'numeric' },
    timeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    currencyCode: 'CHF',
    currencyFormat: { style: 'currency', currency: 'CHF' },
  },
  'en-US': {
    locale: 'en-US',
    dateFormat: { month: '2-digit', day: '2-digit', year: 'numeric' },
    timeFormat: { hour: '2-digit', minute: '2-digit', hour12: true },
    currencyCode: 'USD',
    currencyFormat: { style: 'currency', currency: 'USD' },
  },
  'en-GB': {
    locale: 'en-GB',
    dateFormat: { day: '2-digit', month: '2-digit', year: 'numeric' },
    timeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    currencyCode: 'GBP',
    currencyFormat: { style: 'currency', currency: 'GBP' },
  },
} as const;

/**
 * Apply a preset locale configuration
 * @param preset Preset name
 */
export function applyLocalePreset(preset: keyof typeof LOCALE_PRESETS): void {
  setLocaleConfig(LOCALE_PRESETS[preset] as LocaleConfig);
}
