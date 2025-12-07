/**
 * B241B-I18N-015: MultilingualContentAPI
 *
 * API endpoints to fetch content in desired locale:
 * - Accepts key and locale
 * - Returns translated text and fallback if missing
 * - Supports batch requests
 * - Enforces auth
 */

export interface ContentRequest {
  key: string;
  locale: string;
  params?: Record<string, string | number>;
}

export interface BatchContentRequest {
  keys: string[];
  locale: string;
  params?: Record<string, Record<string, string | number>>; // key -> params
}

export interface ContentResponse {
  key: string;
  locale: string;
  text: string;
  fallbackUsed: boolean;
  sourceLocale?: string;
}

export interface BatchContentResponse {
  contents: ContentResponse[];
  locale: string;
}

export interface AuthContext {
  userId?: string;
  orgId?: string;
  roles?: string[];
  permissions?: string[];
}

export interface TranslationStore {
  getTranslation(key: string, locale: string): Promise<string | null>;
  getTranslations(keys: string[], locale: string): Promise<Record<string, string>>;
  getAvailableLocales(): Promise<string[]>;
  getFallbackLocale(): string;
}

/**
 * Multilingual content API
 * Provides endpoints for fetching translated content
 */
export class MultilingualContentAPI {
  private translationStore: TranslationStore;
  private defaultLocale: string = 'en-US';
  private fallbackLocale: string = 'en-US';

  constructor(translationStore: TranslationStore, options?: { defaultLocale?: string; fallbackLocale?: string }) {
    this.translationStore = translationStore;
    if (options?.defaultLocale) {
      this.defaultLocale = options.defaultLocale;
    }
    if (options?.fallbackLocale) {
      this.fallbackLocale = options.fallbackLocale;
    }
  }

  /**
   * Get content for a single key
   */
  async getContent(
    request: ContentRequest,
    auth?: AuthContext
  ): Promise<ContentResponse> {
    // Auth check (in a real implementation, this would validate tokens, permissions, etc.)
    if (auth && !this.hasPermission(auth, 'i18n:read')) {
      throw new Error('Unauthorized: Missing i18n:read permission');
    }

    const { key, locale, params } = request;

    // Try requested locale first
    let text = await this.translationStore.getTranslation(key, locale);
    let fallbackUsed = false;
    let sourceLocale = locale;

    // Fallback to default locale if not found
    if (!text && locale !== this.fallbackLocale) {
      text = await this.translationStore.getTranslation(key, this.fallbackLocale);
      if (text) {
        fallbackUsed = true;
        sourceLocale = this.fallbackLocale;
      }
    }

    // Final fallback to key itself
    if (!text) {
      text = key;
      fallbackUsed = true;
      sourceLocale = this.fallbackLocale;
    }

    // Interpolate parameters if provided
    if (params && text) {
      text = this.interpolateParams(text, params);
    }

    return {
      key,
      locale,
      text,
      fallbackUsed,
      sourceLocale: fallbackUsed ? sourceLocale : undefined,
    };
  }

  /**
   * Get content for multiple keys in batch
   */
  async getBatchContent(
    request: BatchContentRequest,
    auth?: AuthContext
  ): Promise<BatchContentResponse> {
    // Auth check
    if (auth && !this.hasPermission(auth, 'i18n:read')) {
      throw new Error('Unauthorized: Missing i18n:read permission');
    }

    const { keys, locale, params } = request;

    // Get all translations at once
    const translations = await this.translationStore.getTranslations(keys, locale);
    const fallbackTranslations = locale !== this.fallbackLocale
      ? await this.translationStore.getTranslations(keys, this.fallbackLocale)
      : {};

    const contents: ContentResponse[] = [];

    for (const key of keys) {
      let text = translations[key];
      let fallbackUsed = false;
      let sourceLocale = locale;

      // Fallback to default locale if not found
      if (!text && locale !== this.fallbackLocale) {
        text = fallbackTranslations[key];
        if (text) {
          fallbackUsed = true;
          sourceLocale = this.fallbackLocale;
        }
      }

      // Final fallback to key itself
      if (!text) {
        text = key;
        fallbackUsed = true;
        sourceLocale = this.fallbackLocale;
      }

      // Interpolate parameters if provided
      const keyParams = params?.[key];
      if (keyParams && text) {
        text = this.interpolateParams(text, keyParams);
      }

      contents.push({
        key,
        locale,
        text,
        fallbackUsed,
        sourceLocale: fallbackUsed ? sourceLocale : undefined,
      });
    }

    return {
      contents,
      locale,
    };
  }

  /**
   * Interpolate parameters in translation string
   * Supports {variable} and {variable, format} patterns
   */
  private interpolateParams(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{(\w+)(?:,\s*([^}]+))?\}/g, (match, key, format) => {
      const value = params[key];
      if (value === undefined || value === null) {
        return match; // Keep original placeholder if value not found
      }

      // Apply format if specified
      if (format) {
        // Basic format support (can be extended)
        switch (format.trim()) {
          case 'uppercase':
            return String(value).toUpperCase();
          case 'lowercase':
            return String(value).toLowerCase();
          case 'capitalize':
            return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
          default:
            return String(value);
        }
      }

      return String(value);
    });
  }

  /**
   * Check if user has required permission
   */
  private hasPermission(auth: AuthContext, permission: string): boolean {
    // In a real implementation, this would check roles and permissions
    if (auth.permissions?.includes(permission)) {
      return true;
    }

    // Check for admin role
    if (auth.roles?.includes('admin') || auth.roles?.includes('superadmin')) {
      return true;
    }

    return false;
  }

  /**
   * Get available locales
   */
  async getAvailableLocales(auth?: AuthContext): Promise<string[]> {
    if (auth && !this.hasPermission(auth, 'i18n:read')) {
      throw new Error('Unauthorized: Missing i18n:read permission');
    }

    return this.translationStore.getAvailableLocales();
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; locales: number }> {
    const locales = await this.translationStore.getAvailableLocales();
    return {
      status: 'ok',
      locales: locales.length,
    };
  }
}

