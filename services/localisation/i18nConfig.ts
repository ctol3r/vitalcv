/**
 * B230A-INTL-001: i18n Infrastructure
 *
 * Sets up a central i18n library (i18next) for server and client.
 * Defines locale detection strategy and loads translation resources dynamically.
 */

import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { initReactI18next } from 'react-i18next';
import path from 'path';
import fs from 'fs';

/**
 * Supported locales
 */
export type Locale = 'en-US' | 'en-GB' | 'es-ES' | 'fr-FR' | 'de-DE' | 'ja-JP' | 'zh-CN';

/**
 * Default locale
 */
export const DEFAULT_LOCALE: Locale = 'en-US';

/**
 * Fallback locale chain
 */
export const FALLBACK_LOCALES: Locale[] = ['en-US', 'en-GB'];

/**
 * Locale detection strategies
 */
export interface LocaleDetectionOptions {
  /**
   * Check user preference from database/session
   */
  checkUserPreference?: () => Promise<Locale | null>;

  /**
   * Check organization settings
   */
  checkOrgSettings?: (orgId?: string) => Promise<Locale | null>;

  /**
   * Check Accept-Language header
   */
  checkAcceptLanguage?: (acceptLanguage?: string) => Locale | null;

  /**
   * Check cookie/localStorage
   */
  checkStorage?: () => Locale | null;

  /**
   * Fallback to browser/system locale
   */
  checkSystemLocale?: () => Locale | null;
}

/**
 * Detect locale using multiple strategies
 */
export async function detectLocale(options: LocaleDetectionOptions = {}): Promise<Locale> {
  // Strategy 1: User preference (highest priority)
  if (options.checkUserPreference) {
    const userLocale = await options.checkUserPreference();
    if (userLocale && isValidLocale(userLocale)) {
      return userLocale;
    }
  }

  // Strategy 2: Organization settings
  if (options.checkOrgSettings) {
    const orgLocale = await options.checkOrgSettings();
    if (orgLocale && isValidLocale(orgLocale)) {
      return orgLocale;
    }
  }

  // Strategy 3: Accept-Language header
  if (options.checkAcceptLanguage) {
    const headerLocale = options.checkAcceptLanguage();
    if (headerLocale && isValidLocale(headerLocale)) {
      return headerLocale;
    }
  }

  // Strategy 4: Storage (cookie/localStorage)
  if (options.checkStorage) {
    const storageLocale = options.checkStorage();
    if (storageLocale && isValidLocale(storageLocale)) {
      return storageLocale;
    }
  }

  // Strategy 5: System locale
  if (options.checkSystemLocale) {
    const systemLocale = options.checkSystemLocale();
    if (systemLocale && isValidLocale(systemLocale)) {
      return systemLocale;
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Parse Accept-Language header
 */
export function parseAcceptLanguage(acceptLanguage?: string): Locale | null {
  if (!acceptLanguage) return null;

  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [locale, q = '1'] = lang.trim().split(';q=');
      return { locale: locale.trim(), quality: parseFloat(q) };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { locale } of languages) {
    // Try exact match
    if (isValidLocale(locale as Locale)) {
      return locale as Locale;
    }

    // Try language code match (e.g., 'en' -> 'en-US')
    const langCode = locale.split('-')[0];
    const matchedLocale = findLocaleByLanguage(langCode);
    if (matchedLocale) {
      return matchedLocale;
    }
  }

  return null;
}

/**
 * Find locale by language code
 */
function findLocaleByLanguage(langCode: string): Locale | null {
  const langMap: Record<string, Locale> = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    ja: 'ja-JP',
    zh: 'zh-CN',
  };
  return langMap[langCode.toLowerCase()] || null;
}

/**
 * Validate locale
 */
export function isValidLocale(locale: string): locale is Locale {
  const validLocales: Locale[] = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'];
  return validLocales.includes(locale as Locale);
}

/**
 * Get translation resources directory
 */
function getTranslationsDir(): string {
  // Check multiple possible locations
  const possiblePaths = [
    path.join(process.cwd(), 'locales'),
    path.join(process.cwd(), 'services', 'localisation', 'locales'),
    path.join(__dirname, 'locales'),
  ];

  for (const dir of possiblePaths) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  // Default fallback
  return path.join(process.cwd(), 'locales');
}

/**
 * Initialize i18next for server-side usage
 */
export async function initServerI18n(locale: Locale = DEFAULT_LOCALE): Promise<typeof i18next> {
  const translationsDir = getTranslationsDir();

  await i18next
    .use(Backend)
    .init({
      lng: locale,
      fallbackLng: FALLBACK_LOCALES,
      supportedLngs: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'],
      backend: {
        loadPath: path.join(translationsDir, '{{lng}}', '{{ns}}.json'),
        addPath: path.join(translationsDir, '{{lng}}', '{{ns}}.missing.json'),
      },
      ns: ['common', 'errors', 'validation', 'ui'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false, // React already escapes
      },
      returnNull: false,
      returnEmptyString: false,
      returnObjects: true,
      debug: process.env.NODE_ENV === 'development',
    });

  return i18next;
}

/**
 * Initialize i18next for client-side usage (React)
 */
export async function initClientI18n(
  locale: Locale = DEFAULT_LOCALE,
  resources?: Record<string, any>
): Promise<typeof i18next> {
  await i18next
    .use(initReactI18next)
    .use(Backend)
    .init({
      lng: locale,
      fallbackLng: FALLBACK_LOCALES,
      supportedLngs: ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'],
      resources: resources || {},
      ns: ['common', 'errors', 'validation', 'ui'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false, // React already escapes
      },
      returnNull: false,
      returnEmptyString: false,
      returnObjects: true,
      react: {
        useSuspense: false, // Disable suspense for SSR compatibility
      },
      debug: process.env.NODE_ENV === 'development',
    });

  return i18next;
}

/**
 * Change locale dynamically
 */
export async function changeLocale(locale: Locale): Promise<void> {
  if (!isValidLocale(locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }
  await i18next.changeLanguage(locale);
}

/**
 * Get current locale
 */
export function getCurrentLocale(): Locale {
  return (i18next.language as Locale) || DEFAULT_LOCALE;
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): Locale[] {
  return ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'];
}

/**
 * Load translation resources dynamically
 */
export async function loadTranslationResources(
  locale: Locale,
  namespace?: string
): Promise<Record<string, any>> {
  const translationsDir = getTranslationsDir();
  const namespaces = namespace ? [namespace] : ['common', 'errors', 'validation', 'ui'];
  const resources: Record<string, any> = {};

  for (const ns of namespaces) {
    const filePath = path.join(translationsDir, locale, `${ns}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        resources[ns] = JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Failed to load translation file: ${filePath}`, error);
    }
  }

  return resources;
}

/**
 * Export i18next instance
 */
export { i18next };

