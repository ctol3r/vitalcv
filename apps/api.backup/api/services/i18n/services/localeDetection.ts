/**
 * B241A-I18N-004: LocaleDetection & FallbackService
 *
 * Determines user locale based on browser settings, user profile, or geo-IP
 * Implements fallback logic if translation missing
 * Supports override per session
 */

export interface LocaleDetectionOptions {
  browserLocale?: string; // Accept-Language header
  userProfileLocale?: string; // From user profile
  geoIPCountry?: string; // From geo-IP lookup
  sessionOverride?: string; // Manual override
  defaultLocale?: string; // System default
}

export interface LocaleInfo {
  locale: string; // Full locale (e.g., "en-US")
  language: string; // Language code (e.g., "en")
  region?: string; // Region code (e.g., "US")
  fallbackChain: string[]; // Ordered list of fallback locales
}

/**
 * LocaleDetectionService
 *
 * Detects and manages user locale with fallback support
 */
export class LocaleDetectionService {
  private defaultLocale: string = 'en-US';
  private supportedLocales: Set<string> = new Set(['en-US', 'es-ES', 'fr-FR', 'de-DE']);

  constructor(options?: { defaultLocale?: string; supportedLocales?: string[] }) {
    if (options?.defaultLocale) {
      this.defaultLocale = options.defaultLocale;
    }
    if (options?.supportedLocales) {
      this.supportedLocales = new Set(options.supportedLocales);
    }
  }

  /**
   * Detect locale from various sources
   */
  detectLocale(options: LocaleDetectionOptions): LocaleInfo {
    // Priority: session override > user profile > browser > geo-IP > default

    let detectedLocale: string | null = null;

    if (options.sessionOverride) {
      detectedLocale = this.normalizeLocale(options.sessionOverride);
    } else if (options.userProfileLocale) {
      detectedLocale = this.normalizeLocale(options.userProfileLocale);
    } else if (options.browserLocale) {
      detectedLocale = this.parseAcceptLanguage(options.browserLocale);
    } else if (options.geoIPCountry) {
      detectedLocale = this.localeFromCountryCode(options.geoIPCountry);
    }

    // Fallback to default
    if (!detectedLocale || !this.supportedLocales.has(detectedLocale)) {
      detectedLocale = options.defaultLocale || this.defaultLocale;
    }

    // Ensure it's supported
    if (!this.supportedLocales.has(detectedLocale)) {
      detectedLocale = this.defaultLocale;
    }

    const localeInfo = this.parseLocale(detectedLocale);
    localeInfo.fallbackChain = this.buildFallbackChain(detectedLocale);

    return localeInfo;
  }

  /**
   * Parse Accept-Language header
   */
  private parseAcceptLanguage(acceptLanguage: string): string | null {
    // Parse "en-US,en;q=0.9,es;q=0.8" format
    const parts = acceptLanguage.split(',').map((p) => p.trim());

    for (const part of parts) {
      const [locale, _q] = part.split(';');
      const normalized = this.normalizeLocale(locale.trim());

      if (normalized && this.supportedLocales.has(normalized)) {
        return normalized;
      }
    }

    return null;
  }

  /**
   * Get locale from country code (geo-IP)
   */
  private localeFromCountryCode(countryCode: string): string | null {
    // Map common country codes to locales
    const countryToLocale: Record<string, string> = {
      US: 'en-US',
      GB: 'en-GB',
      ES: 'es-ES',
      FR: 'fr-FR',
      DE: 'de-DE',
      IT: 'it-IT',
      PT: 'pt-PT',
      NL: 'nl-NL',
      PL: 'pl-PL',
      RU: 'ru-RU',
      CN: 'zh-CN',
      JP: 'ja-JP',
      KR: 'ko-KR',
    };

    const locale = countryToLocale[countryCode.toUpperCase()];
    return locale && this.supportedLocales.has(locale) ? locale : null;
  }

  /**
   * Normalize locale string
   */
  private normalizeLocale(locale: string): string | null {
    if (!locale) return null;

    // Handle formats like "en", "en-US", "en_US"
    const normalized = locale.replace('_', '-').toLowerCase();
    const parts = normalized.split('-');

    if (parts.length === 1) {
      // Just language code, try to find a supported locale
      for (const supported of this.supportedLocales) {
        if (supported.toLowerCase().startsWith(parts[0] + '-')) {
          return supported;
        }
      }
      return null;
    }

    // Format as "en-US"
    return `${parts[0]}-${parts[1].toUpperCase()}`;
  }

  /**
   * Parse locale into components
   */
  private parseLocale(locale: string): LocaleInfo {
    const parts = locale.split('-');
    return {
      locale,
      language: parts[0],
      region: parts[1],
      fallbackChain: [],
    };
  }

  /**
   * Build fallback chain for a locale
   */
  private buildFallbackChain(locale: string): string[] {
    const chain: string[] = [locale];
    const parts = locale.split('-');

    // Add language-only fallback (e.g., "en-US" -> "en")
    if (parts.length > 1) {
      const langOnly = parts[0];
      // Check if we have a supported locale for this language
      for (const supported of this.supportedLocales) {
        if (supported.toLowerCase().startsWith(langOnly + '-')) {
          if (!chain.includes(supported)) {
            chain.push(supported);
          }
          break;
        }
      }
    }

    // Add default locale as final fallback
    if (!chain.includes(this.defaultLocale)) {
      chain.push(this.defaultLocale);
    }

    return chain;
  }

  /**
   * Get fallback chain for a locale
   */
  getFallbackChain(locale: string): string[] {
    return this.buildFallbackChain(locale);
  }

  /**
   * Check if locale is supported
   */
  isSupported(locale: string): boolean {
    return this.supportedLocales.has(locale);
  }

  /**
   * Add supported locale
   */
  addSupportedLocale(locale: string): void {
    this.supportedLocales.add(locale);
  }

  /**
   * Remove supported locale
   */
  removeSupportedLocale(locale: string): void {
    this.supportedLocales.delete(locale);
  }
}

/**
 * FallbackService
 *
 * Provides fallback logic for missing translations
 */
export class FallbackService {
  constructor(
    private localeDetection: LocaleDetectionService,
    private getTranslation: (context: string, locale: string) => Promise<string | null>
  ) {}

  /**
   * Get translation with fallback
   */
  async getTranslationWithFallback(
    context: string,
    locale: string
  ): Promise<string> {
    const fallbackChain = this.localeDetection.getFallbackChain(locale);

    for (const fallbackLocale of fallbackChain) {
      const translation = await this.getTranslation(context, fallbackLocale);
      if (translation) {
        return translation;
      }
    }

    // Ultimate fallback: return context or empty string
    return context;
  }

  /**
   * Get translation with fallback chain
   */
  async getTranslationWithChain(
    context: string,
    locale: string
  ): Promise<{ translation: string; usedLocale: string; fallbackChain: string[] }> {
    const fallbackChain = this.localeDetection.getFallbackChain(locale);

    for (const fallbackLocale of fallbackChain) {
      const translation = await this.getTranslation(context, fallbackLocale);
      if (translation) {
        return {
          translation,
          usedLocale: fallbackLocale,
          fallbackChain,
        };
      }
    }

    return {
      translation: context,
      usedLocale: 'none',
      fallbackChain,
    };
  }
}

