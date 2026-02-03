import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatDate,
  formatTime,
  formatCurrency,
  formatDateRange,
  setLocaleConfig,
  resetLocaleConfig,
  getLocaleConfig,
  applyLocalePreset,
  LOCALE_PRESETS,
} from '../locale-config';

describe('locale-config', () => {
  beforeEach(() => {
    // Reset to default German configuration before each test
    resetLocaleConfig();
  });

  describe('formatDate', () => {
    it('should format date in German format (DD.MM.YYYY) by default', () => {
      const result = formatDate('2024-01-15');
      expect(result).toBe('15.01.2024');
    });

    it('should format date correctly for end of year', () => {
      const result = formatDate('2024-12-31');
      expect(result).toBe('31.12.2024');
    });

    it('should handle Date objects', () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      const result = formatDate(date);
      expect(result).toBe('15.01.2024');
    });

    it('should format single-digit days and months with leading zeros', () => {
      const result = formatDate('2024-01-05');
      expect(result).toBe('05.01.2024');
    });

    it('should use US format when configured', () => {
      applyLocalePreset('en-US');
      const result = formatDate('2024-01-15');
      expect(result).toBe('01/15/2024');
    });

    it('should use UK format when configured', () => {
      applyLocalePreset('en-GB');
      const result = formatDate('2024-01-15');
      expect(result).toBe('15/01/2024');
    });
  });

  describe('formatTime', () => {
    it('should format time in 24-hour format by default', () => {
      const result = formatTime('14:30:00');
      expect(result).toBe('14:30');
    });

    it('should format morning time correctly', () => {
      const result = formatTime('08:05:00');
      expect(result).toBe('08:05');
    });

    it('should format midnight correctly', () => {
      const result = formatTime('00:00:00');
      expect(result).toBe('00:00');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency in German Euro format by default', () => {
      const result = formatCurrency(1234.56);
      // German format uses comma as decimal separator
      expect(result).toMatch(/1[.\s]?234,56\s*€/);
    });

    it('should format negative amounts', () => {
      const result = formatCurrency(-100.50);
      expect(result).toMatch(/-?100,50\s*€/);
    });

    it('should format zero', () => {
      const result = formatCurrency(0);
      expect(result).toMatch(/0,00\s*€/);
    });

    it('should format large numbers with thousand separators', () => {
      const result = formatCurrency(1234567.89);
      expect(result).toMatch(/1[.\s]?234[.\s]?567,89\s*€/);
    });

    it('should format USD when configured', () => {
      applyLocalePreset('en-US');
      const result = formatCurrency(1234.56);
      expect(result).toBe('$1,234.56');
    });

    it('should format CHF for Swiss locale', () => {
      applyLocalePreset('de-CH');
      const result = formatCurrency(1234.56);
      expect(result).toMatch(/CHF/);
    });
  });

  describe('formatDateRange', () => {
    it('should format date range correctly', () => {
      const result = formatDateRange('2024-01-01', '2024-01-31');
      expect(result).toBe('01.01.2024 - 31.01.2024');
    });

    it('should handle same start and end date', () => {
      const result = formatDateRange('2024-06-15', '2024-06-15');
      expect(result).toBe('15.06.2024 - 15.06.2024');
    });
  });

  describe('configuration management', () => {
    it('should return default German configuration', () => {
      const config = getLocaleConfig();
      expect(config.locale).toBe('de-DE');
      expect(config.currencyCode).toBe('EUR');
    });

    it('should allow partial configuration updates', () => {
      setLocaleConfig({ locale: 'de-AT' });
      const config = getLocaleConfig();
      expect(config.locale).toBe('de-AT');
      expect(config.currencyCode).toBe('EUR'); // Should retain default
    });

    it('should reset to defaults', () => {
      setLocaleConfig({ locale: 'en-US', currencyCode: 'USD' });
      resetLocaleConfig();
      const config = getLocaleConfig();
      expect(config.locale).toBe('de-DE');
      expect(config.currencyCode).toBe('EUR');
    });
  });

  describe('locale presets', () => {
    it('should have all expected presets', () => {
      expect(LOCALE_PRESETS).toHaveProperty('de-DE');
      expect(LOCALE_PRESETS).toHaveProperty('de-AT');
      expect(LOCALE_PRESETS).toHaveProperty('de-CH');
      expect(LOCALE_PRESETS).toHaveProperty('en-US');
      expect(LOCALE_PRESETS).toHaveProperty('en-GB');
    });

    it('should apply Austrian preset correctly', () => {
      applyLocalePreset('de-AT');
      const config = getLocaleConfig();
      expect(config.locale).toBe('de-AT');
      expect(config.currencyCode).toBe('EUR');
    });

    it('should apply Swiss preset correctly', () => {
      applyLocalePreset('de-CH');
      const config = getLocaleConfig();
      expect(config.locale).toBe('de-CH');
      expect(config.currencyCode).toBe('CHF');
    });
  });
});
