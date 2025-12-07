/**
 * B241B-I18N-016: LocaleSwitchService
 *
 * Handles runtime locale switching:
 * - Updates session preferences
 * - Refreshes UI translations
 * - Stores choice in cookies
 * - Triggers currency and date format adjustments
 */

export interface LocalePreferences {
  locale: string;
  currency?: string;
  dateFormat?: string;
  timeFormat?: '12h' | '24h';
  numberFormat?: string;
}

export interface SessionStore {
  getLocale(): Promise<string | null>;
  setLocale(locale: string): Promise<void>;
  getPreferences(): Promise<LocalePreferences | null>;
  setPreferences(prefs: LocalePreferences): Promise<void>;
}

export interface CookieStore {
  get(name: string): string | null;
  set(name: string, value: string, options?: { expires?: Date; path?: string }): void;
  remove(name: string): void;
}

export type LocaleChangeCallback = (locale: string, preferences: LocalePreferences) => void | Promise<void>;

/**
 * Locale switch service
 * Manages runtime locale switching and preferences
 */
export class LocaleSwitchService {
  private sessionStore: SessionStore;
  private cookieStore: CookieStore;
  private defaultLocale: string = 'en-US';
  private availableLocales: string[] = ['en-US'];
  private changeCallbacks: LocaleChangeCallback[] = [];

  constructor(
    sessionStore: SessionStore,
    cookieStore: CookieStore,
    options?: {
      defaultLocale?: string;
      availableLocales?: string[];
    }
  ) {
    this.sessionStore = sessionStore;
    this.cookieStore = cookieStore;
    if (options?.defaultLocale) {
      this.defaultLocale = options.defaultLocale;
    }
    if (options?.availableLocales) {
      this.availableLocales = options.availableLocales;
    }
  }

  /**
   * Get current locale
   */
  async getCurrentLocale(): Promise<string> {
    // Try session store first
    const sessionLocale = await this.sessionStore.getLocale();
    if (sessionLocale && this.isValidLocale(sessionLocale)) {
      return sessionLocale;
    }

    // Try cookie
    const cookieLocale = this.cookieStore.get('locale');
    if (cookieLocale && this.isValidLocale(cookieLocale)) {
      // Sync to session
      await this.sessionStore.setLocale(cookieLocale);
      return cookieLocale;
    }

    // Try browser language
    if (typeof navigator !== 'undefined') {
      const browserLocale = this.normalizeLocale(navigator.language);
      if (browserLocale && this.isValidLocale(browserLocale)) {
        await this.setLocale(browserLocale, { persist: true });
        return browserLocale;
      }
    }

    return this.defaultLocale;
  }

  /**
   * Set locale and update all related preferences
   */
  async setLocale(
    locale: string,
    options?: {
      persist?: boolean;
      updateCurrency?: boolean;
      updateDateFormat?: boolean;
      triggerCallbacks?: boolean;
    }
  ): Promise<void> {
    if (!this.isValidLocale(locale)) {
      throw new Error(`Invalid locale: ${locale}. Available locales: ${this.availableLocales.join(', ')}`);
    }

    const opts = {
      persist: true,
      updateCurrency: true,
      updateDateFormat: true,
      triggerCallbacks: true,
      ...options,
    };

    // Update session
    await this.sessionStore.setLocale(locale);

    // Update cookie if requested
    if (opts.persist) {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1); // 1 year expiry
      this.cookieStore.set('locale', locale, { expires, path: '/' });
    }

    // Get or create preferences
    let preferences = await this.sessionStore.getPreferences();
    if (!preferences) {
      preferences = this.getDefaultPreferences(locale);
    } else {
      preferences.locale = locale;
    }

    // Update currency if requested
    if (opts.updateCurrency) {
      preferences.currency = this.getCurrencyForLocale(locale);
    }

    // Update date format if requested
    if (opts.updateDateFormat) {
      preferences.dateFormat = this.getDateFormatForLocale(locale);
      preferences.timeFormat = this.getTimeFormatForLocale(locale);
    }

    // Save preferences
    await this.sessionStore.setPreferences(preferences);

    // Trigger callbacks
    if (opts.triggerCallbacks) {
      await this.notifyCallbacks(locale, preferences);
    }
  }

  /**
   * Get current preferences
   */
  async getPreferences(): Promise<LocalePreferences> {
    const preferences = await this.sessionStore.getPreferences();
    if (preferences) {
      return preferences;
    }

    const locale = await this.getCurrentLocale();
    return this.getDefaultPreferences(locale);
  }

  /**
   * Update preferences
   */
  async updatePreferences(updates: Partial<LocalePreferences>): Promise<void> {
    const current = await this.getPreferences();
    const updated = { ...current, ...updates };

    // Validate locale if changed
    if (updates.locale && !this.isValidLocale(updates.locale)) {
      throw new Error(`Invalid locale: ${updates.locale}`);
    }

    await this.sessionStore.setPreferences(updated);

    // If locale changed, trigger locale switch
    if (updates.locale && updates.locale !== current.locale) {
      await this.setLocale(updates.locale, {
        persist: true,
        updateCurrency: !updates.currency, // Only auto-update if currency not explicitly set
        updateDateFormat: !updates.dateFormat, // Only auto-update if date format not explicitly set
      });
    } else {
      // Just notify callbacks for preference changes
      await this.notifyCallbacks(updated.locale, updated);
    }
  }

  /**
   * Register a callback for locale changes
   */
  onLocaleChange(callback: LocaleChangeCallback): () => void {
    this.changeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.changeCallbacks.indexOf(callback);
      if (index > -1) {
        this.changeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get available locales
   */
  getAvailableLocales(): string[] {
    return [...this.availableLocales];
  }

  /**
   * Check if locale is valid
   */
  private isValidLocale(locale: string): boolean {
    return this.availableLocales.includes(locale);
  }

  /**
   * Normalize locale code (e.g., 'en' -> 'en-US', 'en-US' -> 'en-US')
   */
  private normalizeLocale(locale: string): string | null {
    // Try exact match first
    if (this.availableLocales.includes(locale)) {
      return locale;
    }

    // Try language code match (e.g., 'en' matches 'en-US')
    const languageCode = locale.split('-')[0];
    const match = this.availableLocales.find((l) => l.startsWith(languageCode + '-'));
    return match || null;
  }

  /**
   * Get default preferences for a locale
   */
  private getDefaultPreferences(locale: string): LocalePreferences {
    return {
      locale,
      currency: this.getCurrencyForLocale(locale),
      dateFormat: this.getDateFormatForLocale(locale),
      timeFormat: this.getTimeFormatForLocale(locale),
      numberFormat: locale,
    };
  }

  /**
   * Get currency code for locale
   */
  private getCurrencyForLocale(locale: string): string {
    // Map locales to currencies
    const localeCurrencyMap: Record<string, string> = {
      'en-US': 'USD',
      'en-GB': 'GBP',
      'es-ES': 'EUR',
      'es-MX': 'MXN',
      'fr-FR': 'EUR',
      'de-DE': 'EUR',
      'ja-JP': 'JPY',
      'zh-CN': 'CNY',
      'pt-BR': 'BRL',
    };

    return localeCurrencyMap[locale] || 'USD';
  }

  /**
   * Get date format for locale
   */
  private getDateFormatForLocale(locale: string): string {
    // Map locales to date formats
    const localeDateFormatMap: Record<string, string> = {
      'en-US': 'MM/DD/YYYY',
      'en-GB': 'DD/MM/YYYY',
      'es-ES': 'DD/MM/YYYY',
      'es-MX': 'DD/MM/YYYY',
      'fr-FR': 'DD/MM/YYYY',
      'de-DE': 'DD.MM.YYYY',
      'ja-JP': 'YYYY/MM/DD',
      'zh-CN': 'YYYY/MM/DD',
      'pt-BR': 'DD/MM/YYYY',
    };

    return localeDateFormatMap[locale] || 'MM/DD/YYYY';
  }

  /**
   * Get time format for locale
   */
  private getTimeFormatForLocale(locale: string): '12h' | '24h' {
    // Locales that typically use 12-hour format
    const twelveHourLocales = ['en-US', 'en-CA', 'en-AU', 'en-NZ', 'es-MX', 'pt-BR'];

    return twelveHourLocales.includes(locale) ? '12h' : '24h';
  }

  /**
   * Notify all registered callbacks
   */
  private async notifyCallbacks(locale: string, preferences: LocalePreferences): Promise<void> {
    for (const callback of this.changeCallbacks) {
      try {
        await callback(locale, preferences);
      } catch (error) {
        console.error('Error in locale change callback:', error);
      }
    }
  }
}

