/**
 * B230A-INTL-002: Locale Helpers
 *
 * Provides helpers for date/time formatting, number/currency formatting,
 * pluralization; supports time zones via user preference or org settings.
 */

import { Locale, DEFAULT_LOCALE, getCurrentLocale } from './i18nConfig';

/**
 * Timezone configuration
 */
export interface TimezoneConfig {
  /**
   * IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')
   */
  timezone: string;

  /**
   * User preference or org setting
   */
  source: 'user' | 'org' | 'system';
}

/**
 * Formatting options
 */
export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  timezone?: string;
}

export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  currency?: string;
}

/**
 * Plural rules for different locales
 */
export type PluralRule = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * Get timezone from user preference or org settings
 */
export async function getTimezone(
  userId?: string,
  orgId?: string
): Promise<string> {
  // TODO: Implement database lookup for user/org timezone preferences
  // For now, return system timezone
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format date/time according to locale and timezone
 */
export function formatDateTime(
  date: Date | string | number,
  options: DateFormatOptions = {},
  locale?: Locale
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const currentLocale = locale || getCurrentLocale();
  const timezone = options.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    ...options,
  };

  return new Intl.DateTimeFormat(currentLocale, formatOptions).format(dateObj);
}

/**
 * Format date only
 */
export function formatDate(
  date: Date | string | number,
  options: Omit<DateFormatOptions, 'hour' | 'minute' | 'second'> = {},
  locale?: Locale
): string {
  return formatDateTime(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }, locale);
}

/**
 * Format time only
 */
export function formatTime(
  date: Date | string | number,
  options: Omit<DateFormatOptions, 'year' | 'month' | 'day'> = {},
  locale?: Locale
): string {
  return formatDateTime(date, {
    hour: 'numeric',
    minute: '2-digit',
    second: options.second ? '2-digit' : undefined,
    ...options,
  }, locale);
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale?: Locale
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const currentLocale = locale || getCurrentLocale();
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(currentLocale, { numeric: 'auto' });

  if (diffDays > 0) {
    return rtf.format(diffMs > 0 ? diffDays : -diffDays, 'day');
  } else if (diffHours > 0) {
    return rtf.format(diffMs > 0 ? diffHours : -diffHours, 'hour');
  } else if (diffMinutes > 0) {
    return rtf.format(diffMs > 0 ? diffMinutes : -diffMinutes, 'minute');
  } else {
    return rtf.format(diffMs > 0 ? diffSeconds : -diffSeconds, 'second');
  }
}

/**
 * Format number according to locale
 */
export function formatNumber(
  value: number,
  options: NumberFormatOptions = {},
  locale?: Locale
): string {
  const currentLocale = locale || getCurrentLocale();
  return new Intl.NumberFormat(currentLocale, options).format(value);
}

/**
 * Format currency according to locale
 */
export function formatCurrency(
  amount: number,
  currency: string,
  options: Omit<NumberFormatOptions, 'currency'> = {},
  locale?: Locale
): string {
  const currentLocale = locale || getCurrentLocale();
  return new Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency,
    ...options,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(
  value: number,
  options: Omit<NumberFormatOptions, 'style'> = {},
  locale?: Locale
): string {
  const currentLocale = locale || getCurrentLocale();
  return new Intl.NumberFormat(currentLocale, {
    style: 'percent',
    ...options,
  }).format(value / 100);
}

/**
 * Get plural form for a locale
 */
export function getPluralForm(
  count: number,
  locale?: Locale
): PluralRule {
  const currentLocale = locale || getCurrentLocale();
  const rules = new Intl.PluralRules(currentLocale);
  return rules.select(count) as PluralRule;
}

/**
 * Format pluralized string
 */
export function formatPlural(
  count: number,
  forms: Record<PluralRule, string> | { one: string; other: string },
  locale?: Locale
): string {
  const form = getPluralForm(count, locale);

  // Handle simple { one, other } format
  if ('one' in forms && 'other' in forms && Object.keys(forms).length === 2) {
    return count === 1 ? forms.one : forms.other;
  }

  // Handle full plural rules
  return forms[form] || forms.other || String(count);
}

/**
 * Parse number from localized string
 */
export function parseNumber(
  value: string,
  locale?: Locale
): number | null {
  const currentLocale = locale || getCurrentLocale();

  // Remove locale-specific formatting
  const parts = new Intl.NumberFormat(currentLocale).formatToParts(1234.56);
  const groupSeparator = parts.find(p => p.type === 'group')?.value || ',';
  const decimalSeparator = parts.find(p => p.type === 'decimal')?.value || '.';

  let cleaned = value
    .replace(new RegExp(`\\${groupSeparator}`, 'g'), '')
    .replace(decimalSeparator, '.');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Format file size
 */
export function formatFileSize(
  bytes: number,
  locale?: Locale
): string {
  const currentLocale = locale || getCurrentLocale();
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${formatNumber(size, { maximumFractionDigits: 2 }, currentLocale)} ${units[unitIndex]}`;
}

/**
 * Format duration
 */
export function formatDuration(
  seconds: number,
  locale?: Locale
): string {
  const currentLocale = locale || getCurrentLocale();
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
}

/**
 * Get locale-specific date/time format pattern
 */
export function getDateTimeFormatPattern(
  locale?: Locale,
  options?: DateFormatOptions
): string {
  const currentLocale = locale || getCurrentLocale();
  const formatter = new Intl.DateTimeFormat(currentLocale, options);
  const parts = formatter.formatToParts(new Date());

  // Build pattern string (simplified)
  return parts.map(p => {
    switch (p.type) {
      case 'year': return 'YYYY';
      case 'month': return 'MM';
      case 'day': return 'DD';
      case 'hour': return 'HH';
      case 'minute': return 'mm';
      case 'second': return 'ss';
      default: return p.value;
    }
  }).join('');
}

/**
 * Get locale-specific number format pattern
 */
export function getNumberFormatPattern(
  locale?: Locale,
  options?: NumberFormatOptions
): string {
  const currentLocale = locale || getCurrentLocale();
  const formatter = new Intl.NumberFormat(currentLocale, options);
  const parts = formatter.formatToParts(1234.56);

  // Build pattern string (simplified)
  return parts.map(p => {
    switch (p.type) {
      case 'group': return ',';
      case 'decimal': return '.';
      case 'integer': return '#';
      case 'fraction': return '0';
      default: return p.value;
    }
  }).join('');
}

