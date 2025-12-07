/**
 * B230A-INTL-003: Translation Resource Management
 *
 * Manages translation JSON files per locale; supports versioning,
 * fallback chains, and overrides; provides CLI for adding/updating translations.
 */

import fs from 'fs';
import path from 'path';
import { Locale, DEFAULT_LOCALE, FALLBACK_LOCALES, isValidLocale } from './i18nConfig';

/**
 * Translation namespace
 */
export type TranslationNamespace = 'common' | 'errors' | 'validation' | 'ui' | string;

/**
 * Translation resource structure
 */
export interface TranslationResource {
  [key: string]: string | TranslationResource;
}

/**
 * Translation file metadata
 */
export interface TranslationMetadata {
  locale: Locale;
  namespace: TranslationNamespace;
  version: string;
  lastModified: string;
  checksum?: string;
}

/**
 * Translation version info
 */
export interface TranslationVersion {
  version: string;
  timestamp: string;
  author?: string;
  changes?: string[];
}

/**
 * Get translations directory
 */
function getTranslationsDir(): string {
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

  // Create default directory if it doesn't exist
  const defaultDir = path.join(process.cwd(), 'locales');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

/**
 * Get translation file path
 */
function getTranslationFilePath(
  locale: Locale,
  namespace: TranslationNamespace
): string {
  const translationsDir = getTranslationsDir();
  const localeDir = path.join(translationsDir, locale);

  if (!fs.existsSync(localeDir)) {
    fs.mkdirSync(localeDir, { recursive: true });
  }

  return path.join(localeDir, `${namespace}.json`);
}

/**
 * Get metadata file path
 */
function getMetadataFilePath(
  locale: Locale,
  namespace: TranslationNamespace
): string {
  const translationsDir = getTranslationsDir();
  const localeDir = path.join(translationsDir, locale);
  return path.join(localeDir, `${namespace}.meta.json`);
}

/**
 * Load translation resource
 */
export function loadTranslationResource(
  locale: Locale,
  namespace: TranslationNamespace
): TranslationResource | null {
  try {
    const filePath = getTranslationFilePath(locale, namespace);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load translation resource: ${locale}/${namespace}`, error);
    return null;
  }
}

/**
 * Save translation resource
 */
export function saveTranslationResource(
  locale: Locale,
  namespace: TranslationNamespace,
  resource: TranslationResource,
  version?: string
): void {
  if (!isValidLocale(locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }

  const filePath = getTranslationFilePath(locale, namespace);
  const content = JSON.stringify(resource, null, 2);

  fs.writeFileSync(filePath, content, 'utf-8');

  // Save metadata
  const metadata: TranslationMetadata = {
    locale,
    namespace,
    version: version || '1.0.0',
    lastModified: new Date().toISOString(),
  };

  const metadataPath = getMetadataFilePath(locale, namespace);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Get translation with fallback chain
 */
export function getTranslationWithFallback(
  locale: Locale,
  namespace: TranslationNamespace,
  key: string
): string | null {
  const locales = [locale, ...FALLBACK_LOCALES];

  for (const loc of locales) {
    const resource = loadTranslationResource(loc, namespace);
    if (resource) {
      const value = getNestedValue(resource, key);
      if (value && typeof value === 'string') {
        return value;
      }
    }
  }

  return null;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) {
      current[key] = {};
    }
    return current[key];
  }, obj);
  target[lastKey] = value;
}

/**
 * Merge translation resources with override support
 */
export function mergeTranslationResources(
  base: TranslationResource,
  override: TranslationResource
): TranslationResource {
  const merged = { ...base };

  for (const key in override) {
    if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      merged[key] = mergeTranslationResources(
        (base[key] as TranslationResource) || {},
        override[key] as TranslationResource
      );
    } else {
      merged[key] = override[key];
    }
  }

  return merged;
}

/**
 * Add or update translation key
 */
export function updateTranslation(
  locale: Locale,
  namespace: TranslationNamespace,
  key: string,
  value: string,
  version?: string
): void {
  const resource = loadTranslationResource(locale, namespace) || {};
  setNestedValue(resource, key, value);
  saveTranslationResource(locale, namespace, resource, version);
}

/**
 * Delete translation key
 */
export function deleteTranslation(
  locale: Locale,
  namespace: TranslationNamespace,
  key: string
): void {
  const resource = loadTranslationResource(locale, namespace);
  if (!resource) {
    return;
  }

  const keys = key.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, k) => current?.[k], resource);

  if (target && typeof target === 'object') {
    delete target[lastKey];
    saveTranslationResource(locale, namespace, resource);
  }
}

/**
 * List all translation keys in a namespace
 */
export function listTranslationKeys(
  locale: Locale,
  namespace: TranslationNamespace
): string[] {
  const resource = loadTranslationResource(locale, namespace);
  if (!resource) {
    return [];
  }

  return flattenKeys(resource);
}

/**
 * Flatten nested object keys to dot notation
 */
function flattenKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      keys.push(...flattenKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Get translation metadata
 */
export function getTranslationMetadata(
  locale: Locale,
  namespace: TranslationNamespace
): TranslationMetadata | null {
  try {
    const metadataPath = getMetadataFilePath(locale, namespace);
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    const content = fs.readFileSync(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load metadata: ${locale}/${namespace}`, error);
    return null;
  }
}

/**
 * Validate translation resource structure
 */
export function validateTranslationResource(
  resource: TranslationResource
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  function validate(obj: any, path = ''): void {
    for (const key in obj) {
      const fullPath = path ? `${path}.${key}` : key;
      const value = obj[key];

      if (typeof value === 'object' && !Array.isArray(value)) {
        validate(value, fullPath);
      } else if (typeof value !== 'string') {
        errors.push(`Invalid value type at ${fullPath}: expected string, got ${typeof value}`);
      }
    }
  }

  validate(resource);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export translation resource to JSON
 */
export function exportTranslationResource(
  locale: Locale,
  namespace: TranslationNamespace
): string {
  const resource = loadTranslationResource(locale, namespace);
  if (!resource) {
    throw new Error(`Translation resource not found: ${locale}/${namespace}`);
  }

  return JSON.stringify(resource, null, 2);
}

/**
 * Import translation resource from JSON
 */
export function importTranslationResource(
  locale: Locale,
  namespace: TranslationNamespace,
  jsonContent: string,
  version?: string
): void {
  try {
    const resource = JSON.parse(jsonContent) as TranslationResource;
    const validation = validateTranslationResource(resource);

    if (!validation.valid) {
      throw new Error(`Invalid translation resource: ${validation.errors.join(', ')}`);
    }

    saveTranslationResource(locale, namespace, resource, version);
  } catch (error) {
    throw new Error(`Failed to import translation resource: ${error}`);
  }
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): Locale[] {
  const translationsDir = getTranslationsDir();
  if (!fs.existsSync(translationsDir)) {
    return [];
  }

  return fs.readdirSync(translationsDir)
    .filter(item => {
      const itemPath = path.join(translationsDir, item);
      return fs.statSync(itemPath).isDirectory() && isValidLocale(item);
    }) as Locale[];
}

/**
 * Get all namespaces for a locale
 */
export function getNamespacesForLocale(locale: Locale): TranslationNamespace[] {
  const translationsDir = getTranslationsDir();
  const localeDir = path.join(translationsDir, locale);

  if (!fs.existsSync(localeDir)) {
    return [];
  }

  return fs.readdirSync(localeDir)
    .filter(file => file.endsWith('.json') && !file.endsWith('.meta.json'))
    .map(file => file.replace('.json', '')) as TranslationNamespace[];
}

/**
 * Find missing translations by comparing with reference locale
 */
export function findMissingTranslations(
  locale: Locale,
  referenceLocale: Locale = DEFAULT_LOCALE
): Array<{ namespace: TranslationNamespace; key: string }> {
  const missing: Array<{ namespace: TranslationNamespace; key: string }> = [];
  const namespaces = getNamespacesForLocale(referenceLocale);

  for (const namespace of namespaces) {
    const referenceKeys = listTranslationKeys(referenceLocale, namespace);
    const localeKeys = listTranslationKeys(locale, namespace);
    const localeKeysSet = new Set(localeKeys);

    for (const key of referenceKeys) {
      if (!localeKeysSet.has(key)) {
        missing.push({ namespace, key });
      }
    }
  }

  return missing;
}

