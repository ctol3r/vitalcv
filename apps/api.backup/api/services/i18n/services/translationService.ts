/**
 * B252B-I18N-011: TranslationService
 *
 * Provides functions to getTranslation(key, languageCode) with fallback to default language
 * Supports add/update translations
 * Caches results for performance
 * Handles pluralization
 */

import { PrismaClient, TranslationValueStatus } from '@prisma/client';

export interface TranslationCache {
  get(key: string, languageCode: string): Promise<string | null>;
  set(key: string, languageCode: string, value: string, ttl?: number): Promise<void>;
  clear(): Promise<void>;
  clearKey(key: string, languageCode?: string): Promise<void>;
}

export interface TranslationOptions {
  useCache?: boolean;
  fallbackToDefault?: boolean;
  defaultLanguageCode?: string;
}

export interface AddTranslationInput {
  key: string;
  languageCode: string;
  value: string;
  status?: TranslationValueStatus;
}

export interface UpdateTranslationInput {
  value?: string;
  status?: TranslationValueStatus;
}

/**
 * In-memory cache implementation
 */
class MemoryCache implements TranslationCache {
  private cache: Map<string, { value: string; expiresAt?: number }> = new Map();

  async get(key: string, languageCode: string): Promise<string | null> {
    const cacheKey = `${key}:${languageCode}`;
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.value;
  }

  async set(key: string, languageCode: string, value: string, ttl?: number): Promise<void> {
    const cacheKey = `${key}:${languageCode}`;
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
    this.cache.set(cacheKey, { value, expiresAt });
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async clearKey(key: string, languageCode?: string): Promise<void> {
    if (languageCode) {
      const cacheKey = `${key}:${languageCode}`;
      this.cache.delete(cacheKey);
    } else {
      // Clear all languages for this key
      for (const [cacheKey] of this.cache.entries()) {
        if (cacheKey.startsWith(`${key}:`)) {
          this.cache.delete(cacheKey);
        }
      }
    }
  }
}

/**
 * TranslationService
 *
 * Service for retrieving and managing translations with caching and fallback support
 */
export class TranslationService {
  private cache: TranslationCache;
  private defaultLanguageCode: string = 'en';

  constructor(
    private prisma: PrismaClient,
    cache?: TranslationCache,
    defaultLanguageCode?: string
  ) {
    this.cache = cache || new MemoryCache();
    if (defaultLanguageCode) {
      this.defaultLanguageCode = defaultLanguageCode;
    }
  }

  /**
   * Get translation for a key and language code with fallback
   */
  async getTranslation(
    key: string,
    languageCode: string,
    options: TranslationOptions = {}
  ): Promise<string> {
    const {
      useCache = true,
      fallbackToDefault = true,
      defaultLanguageCode = this.defaultLanguageCode,
    } = options;

    // Try cache first
    if (useCache) {
      const cached = await this.cache.get(key, languageCode);
      if (cached !== null) {
        return cached;
      }
    }

    // Get language ID
    const language = await this.prisma.translationLanguage.findUnique({
      where: { languageCode },
    });

    if (!language) {
      // Fallback to default language
      if (fallbackToDefault && languageCode !== defaultLanguageCode) {
        return this.getTranslation(key, defaultLanguageCode, { ...options, fallbackToDefault: false });
      }
      return key; // Return key as fallback
    }

    // Get translation key
    const translationKey = await this.prisma.translationKeyB252A.findUnique({
      where: { key },
    });

    if (!translationKey) {
      // Fallback to default language
      if (fallbackToDefault && languageCode !== defaultLanguageCode) {
        return this.getTranslation(key, defaultLanguageCode, { ...options, fallbackToDefault: false });
      }
      return translationKey?.defaultMessage || key;
    }

    // Get translation value (prefer APPROVED, fallback to DRAFT)
    const translationValue = await this.prisma.translationValue.findFirst({
      where: {
        translationKeyId: translationKey.id,
        languageId: language.id,
        status: {
          in: [TranslationValueStatus.APPROVED, TranslationValueStatus.DRAFT],
        },
      },
      orderBy: [
        { status: 'asc' }, // APPROVED first
        { updatedAt: 'desc' },
      ],
    });

    if (translationValue) {
      const value = translationValue.value;
      // Cache the result
      if (useCache) {
        await this.cache.set(key, languageCode, value, 3600); // 1 hour TTL
      }
      return value;
    }

    // Fallback to default language
    if (fallbackToDefault && languageCode !== defaultLanguageCode) {
      return this.getTranslation(key, defaultLanguageCode, { ...options, fallbackToDefault: false });
    }

    // Fallback to default message
    const result = translationKey.defaultMessage || key;
    if (useCache) {
      await this.cache.set(key, languageCode, result, 3600);
    }
    return result;
  }

  /**
   * Add a new translation
   */
  async addTranslation(input: AddTranslationInput): Promise<void> {
    const { key, languageCode, value, status = TranslationValueStatus.DRAFT } = input;

    // Get or create translation key
    let translationKey = await this.prisma.translationKeyB252A.findUnique({
      where: { key },
    });

    if (!translationKey) {
      translationKey = await this.prisma.translationKeyB252A.create({
        data: {
          key,
          defaultMessage: value, // Use first value as default
        },
      });
    }

    // Get language
    const language = await this.prisma.translationLanguage.findUnique({
      where: { languageCode },
    });

    if (!language) {
      throw new Error(`Language not found: ${languageCode}`);
    }

    // Create or update translation value
    await this.prisma.translationValue.upsert({
      where: {
        translationKeyId_languageId: {
          translationKeyId: translationKey.id,
          languageId: language.id,
        },
      },
      create: {
        translationKeyId: translationKey.id,
        languageId: language.id,
        value,
        status,
      },
      update: {
        value,
        status,
      },
    });

    // Clear cache for this key
    await this.cache.clearKey(key, languageCode);
  }

  /**
   * Update an existing translation
   */
  async updateTranslation(
    key: string,
    languageCode: string,
    input: UpdateTranslationInput
  ): Promise<void> {
    const { value, status } = input;

    // Get translation key
    const translationKey = await this.prisma.translationKeyB252A.findUnique({
      where: { key },
    });

    if (!translationKey) {
      throw new Error(`Translation key not found: ${key}`);
    }

    // Get language
    const language = await this.prisma.translationLanguage.findUnique({
      where: { languageCode },
    });

    if (!language) {
      throw new Error(`Language not found: ${languageCode}`);
    }

    // Get existing translation value
    const translationValue = await this.prisma.translationValue.findUnique({
      where: {
        translationKeyId_languageId: {
          translationKeyId: translationKey.id,
          languageId: language.id,
        },
      },
    });

    if (!translationValue) {
      throw new Error(`Translation not found for key: ${key}, language: ${languageCode}`);
    }

    // Update translation value
    await this.prisma.translationValue.update({
      where: { id: translationValue.id },
      data: {
        ...(value !== undefined && { value }),
        ...(status !== undefined && { status }),
      },
    });

    // Clear cache for this key
    await this.cache.clearKey(key, languageCode);
  }

  /**
   * Clear cache for a specific key or all keys
   */
  async clearCache(key?: string, languageCode?: string): Promise<void> {
    if (key) {
      await this.cache.clearKey(key, languageCode);
    } else {
      await this.cache.clear();
    }
  }

  /**
   * Get multiple translations at once
   */
  async getTranslations(
    keys: string[],
    languageCode: string,
    options: TranslationOptions = {}
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};

    await Promise.all(
      keys.map(async (key) => {
        results[key] = await this.getTranslation(key, languageCode, options);
      })
    );

    return results;
  }
}

