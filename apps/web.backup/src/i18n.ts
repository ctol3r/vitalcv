/**
 * B230A-INTL-004: Multilingual UI Integration
 *
 * Integrates i18n in web apps; wraps all text in translation components;
 * ensures dynamic content (dates, currency) respects user locale.
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslation as useI18nextTranslation } from 'react-i18next';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import React from 'react';
// Note: These imports assume the services are accessible from the web app
// In a monorepo, you may need to adjust paths or use workspace references
// For now, we'll use relative paths - adjust based on your monorepo structure

// Type definitions
export type Locale = 'en-US' | 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE' | 'ja-JP' | 'zh-CN';

// Re-export locale helpers (simplified for client-side)
export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale?: Locale
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;
  const currentLocale = locale || 'en-US';
  return new Intl.DateTimeFormat(currentLocale, options).format(dateObj);
}

export function formatTime(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale?: Locale
): string {
  return formatDate(date, { hour: 'numeric', minute: '2-digit', ...options }, locale);
}

export function formatDateTime(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale?: Locale
): string {
  return formatDate(date, options, locale);
}

export function formatRelativeTime(
  date: Date | string | number,
  locale?: Locale
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;
  const currentLocale = locale || 'en-US';
  const rtf = new Intl.RelativeTimeFormat(currentLocale, { numeric: 'auto' });
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

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

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: Locale
): string {
  const currentLocale = locale || 'en-US';
  return new Intl.NumberFormat(currentLocale, options).format(value);
}

export function formatCurrency(
  amount: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
  locale?: Locale
): string {
  const currentLocale = locale || 'en-US';
  return new Intl.NumberFormat(currentLocale, {
    style: 'currency',
    currency,
    ...options,
  }).format(amount);
}

export function formatPercentage(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: Locale
): string {
  const currentLocale = locale || 'en-US';
  return new Intl.NumberFormat(currentLocale, {
    style: 'percent',
    ...options,
  }).format(value / 100);
}

export function formatPlural(
  count: number,
  forms: Record<string, string>,
  locale?: Locale
): string {
  const currentLocale = locale || 'en-US';
  const rules = new Intl.PluralRules(currentLocale);
  const form = rules.select(count);
  return forms[form] || forms.other || String(count);
}

export function getPluralForm(
  count: number,
  locale?: Locale
): string {
  const currentLocale = locale || 'en-US';
  const rules = new Intl.PluralRules(currentLocale);
  return rules.select(count);
}

// Currency conversion helpers (simplified client-side version)
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'CAD' | 'AUD' | 'CHF' | 'INR' | 'BRL';

const localeToCurrency: Record<Locale, CurrencyCode> = {
  'en-US': 'USD',
  'en-GB': 'GBP',
  'es-ES': 'EUR',
  'fr-FR': 'EUR',
  'de-DE': 'EUR',
  'ja-JP': 'JPY',
  'zh-CN': 'CNY',
};

export function getCurrencyForLocale(locale: Locale): CurrencyCode {
  return localeToCurrency[locale] || 'USD';
}

// Simplified currency conversion (client-side would typically call an API)
export async function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): Promise<number> {
  if (from === to) return amount;

  // In production, this would call your backend API
  // For now, return a placeholder
  try {
    const response = await fetch(`/api/currency/convert?from=${from}&to=${to}&amount=${amount}`);
    if (response.ok) {
      const data = await response.json();
      return data.converted;
    }
  } catch (error) {
    console.warn('Currency conversion failed, returning original amount', error);
  }

  return amount; // Fallback
}

export async function formatCurrencyAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  locale?: Locale
): Promise<string> {
  const converted = await convertCurrency(amount, from, to);
  const currentLocale = locale || 'en-US';
  return formatCurrency(converted, to, {}, currentLocale);
}

/**
 * Initialize i18n for client-side usage
 */
let i18nInitialized = false;

export async function initI18n(locale?: Locale): Promise<void> {
  if (i18nInitialized) {
    return;
  }

  await i18next
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      lng: locale,
      fallbackLng: ['en-US', 'en-GB'],
      supportedLngs: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'],
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
      ns: ['common', 'errors', 'validation', 'ui'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false, // React already escapes
      },
      returnNull: false,
      returnEmptyString: false,
      returnObjects: true,
      react: {
        useSuspense: false,
      },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'i18nextLng',
      },
      debug: process.env.NODE_ENV === 'development',
    });

  i18nInitialized = true;
}

/**
 * Hook to use translations
 */
export function useTranslation(namespace?: string) {
  const { t, i18n, ready } = useI18nextTranslation(namespace);

  // Ensure i18n is initialized
  useEffect(() => {
    if (!i18nInitialized) {
      initI18n();
    }
  }, [i18n]);

  return {
    t,
    i18n,
    ready,
    locale: (i18n.language as Locale) || 'en-US',
    changeLocale: async (locale: Locale) => {
      await i18n.changeLanguage(locale);
    },
  };
}

/**
 * Translation component props
 */
export interface TranslationProps {
  keyPath: string;
  namespace?: string;
  values?: Record<string, string | number>;
  components?: Record<string, React.ReactElement>;
  fallback?: string;
}

/**
 * Translation component
 */
export function Translation({
  keyPath,
  namespace,
  values,
  components,
  fallback,
}: TranslationProps) {
  const { t, ready } = useTranslation(namespace);

  if (!ready) {
    return <>{fallback || keyPath}</>;
  }

  const translation = t(keyPath, values || {});

  // Handle components interpolation (e.g., <strong> tags)
  if (components && typeof translation === 'string') {
    let result: React.ReactNode = translation;
    for (const [key, component] of Object.entries(components)) {
      const regex = new RegExp(`<${key}>(.*?)</${key}>`, 'g');
      result = (result as string).replace(regex, (match, content) => {
        return React.cloneElement(component, { key: Math.random() }, content);
      });
    }
    return <>{result}</>;
  }

  return <>{translation}</>;
}

/**
 * Hook for locale-aware date formatting
 */
export function useDateFormat() {
  const { locale } = useTranslation();

  return {
    formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      formatDate(date, options, locale),
    formatTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      formatTime(date, options, locale),
    formatDateTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      formatDateTime(date, options, locale),
    formatRelativeTime: (date: Date | string | number) =>
      formatRelativeTime(date, locale),
  };
}

/**
 * Hook for locale-aware number formatting
 */
export function useNumberFormat() {
  const { locale } = useTranslation();

  return {
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(value, options, locale),
    formatCurrency: (amount: number, currency: string, options?: Intl.NumberFormatOptions) =>
      formatCurrency(amount, currency, options, locale),
    formatPercentage: (value: number, options?: Intl.NumberFormatOptions) =>
      formatPercentage(value, options, locale),
    formatPlural: (count: number, forms: Record<string, string>) =>
      formatPlural(count, forms, locale),
    getPluralForm: (count: number) => getPluralForm(count, locale),
  };
}

/**
 * Hook for currency conversion
 */
export function useCurrencyConversion() {
  const { locale } = useTranslation();
  const [loading, setLoading] = useState(false);

  const currency = getCurrencyForLocale(locale);

  return {
    currency,
    loading,
    convert: async (amount: number, from: string, to?: string) => {
      setLoading(true);
      try {
        return await convertCurrency(amount, from as any, (to || currency) as any);
      } finally {
        setLoading(false);
      }
    },
    format: async (amount: number, from: string, to?: string) => {
      setLoading(true);
      try {
        return await formatCurrencyAmount(amount, from as any, (to || currency) as any, locale);
      } finally {
        setLoading(false);
      }
    },
  };
}

/**
 * Locale selector component props
 */
export interface LocaleSelectorProps {
  onChange?: (locale: Locale) => void;
  className?: string;
}

/**
 * Locale selector component
 */
export function LocaleSelector({ onChange, className }: LocaleSelectorProps) {
  const { locale, changeLocale, i18n } = useTranslation();
  const locales: Locale[] = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'];

  const handleChange = async (newLocale: Locale) => {
    await changeLocale(newLocale);
    onChange?.(newLocale);
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value as Locale)}
      className={className}
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {loc}
        </option>
      ))}
    </select>
  );
}

/**
 * Format currency with automatic conversion
 */
export async function formatCurrencyWithConversion(
  amount: number,
  sourceCurrency: string,
  targetLocale?: Locale
): Promise<string> {
  const locale = targetLocale || (i18next.language as Locale) || 'en-US';
  const targetCurrency = getCurrencyForLocale(locale);

  return formatCurrencyAmount(amount, sourceCurrency as any, targetCurrency, locale);
}

/**
 * Export i18n instance for direct access
 */
export { i18next };

