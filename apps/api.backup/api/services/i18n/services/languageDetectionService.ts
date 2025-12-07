/**
 * B252B-I18N-012: LanguageDetectionService
 *
 * Determines user's preferred language based on:
 * - HTTP headers (Accept-Language)
 * - Browser settings
 * - UserLocaleSetting from database
 * Returns languageCode
 * Includes tests for priority logic
 */

import { PrismaClient } from '@prisma/client';

export interface LanguageDetectionOptions {
  acceptLanguageHeader?: string;
  userId?: string;
  defaultLanguageCode?: string;
}

export interface LanguageDetectionResult {
  languageCode: string;
  source: 'user_setting' | 'header' | 'browser' | 'default';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * LanguageDetectionService
 *
 * Service for detecting user's preferred language with priority logic
 */
export class LanguageDetectionService {
  private defaultLanguageCode: string = 'en';

  constructor(
    private prisma: PrismaClient,
    defaultLanguageCode?: string
  ) {
    if (defaultLanguageCode) {
      this.defaultLanguageCode = defaultLanguageCode;
    }
  }

  /**
   * Detect user's preferred language
   * Priority: UserLocaleSetting > Accept-Language header > default
   */
  async detectLanguage(options: LanguageDetectionOptions): Promise<LanguageDetectionResult> {
    const { acceptLanguageHeader, userId, defaultLanguageCode = this.defaultLanguageCode } = options;

    // Priority 1: UserLocaleSetting (highest priority)
    if (userId) {
      const userSetting = await this.getUserLocaleSetting(userId);
      if (userSetting?.language?.languageCode) {
        return {
          languageCode: userSetting.language.languageCode,
          source: 'user_setting',
          confidence: 'high',
        };
      }
    }

    // Priority 2: Accept-Language header
    if (acceptLanguageHeader) {
      const headerLanguage = this.parseAcceptLanguageHeader(acceptLanguageHeader);
      if (headerLanguage) {
        return {
          languageCode: headerLanguage,
          source: 'header',
          confidence: 'medium',
        };
      }
    }

    // Priority 3: Default language
    return {
      languageCode: defaultLanguageCode,
      source: 'default',
      confidence: 'low',
    };
  }

  /**
   * Get user's locale setting from database
   */
  private async getUserLocaleSetting(userId: string) {
    try {
      const setting = await this.prisma.userLocaleSetting.findUnique({
        where: { userId },
        include: {
          language: true,
        },
      });

      return setting;
    } catch (error) {
      console.error('Error fetching user locale setting:', error);
      return null;
    }
  }

  /**
   * Parse Accept-Language header
   * Format: "en-US,en;q=0.9,es;q=0.8"
   */
  private parseAcceptLanguageHeader(acceptLanguage: string): string | null {
    if (!acceptLanguage) {
      return null;
    }

    // Parse quality values and sort by priority
    const languages: Array<{ code: string; quality: number }> = [];

    const parts = acceptLanguage.split(',').map((p) => p.trim());

    for (const part of parts) {
      const [lang, qPart] = part.split(';');
      const code = lang.trim();
      let quality = 1.0;

      if (qPart) {
        const qMatch = qPart.match(/q=([\d.]+)/);
        if (qMatch) {
          quality = parseFloat(qMatch[1]);
        }
      }

      languages.push({ code, quality });
    }

    // Sort by quality (highest first)
    languages.sort((a, b) => b.quality - a.quality);

    // Return the highest quality language code
    if (languages.length > 0) {
      const normalized = this.normalizeLanguageCode(languages[0].code);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  /**
   * Normalize language code
   * Converts formats like "en", "en-US", "en_US" to "en-US"
   */
  private normalizeLanguageCode(code: string): string | null {
    if (!code) {
      return null;
    }

    // Replace underscore with dash
    const normalized = code.replace('_', '-').trim();

    // Split into parts
    const parts = normalized.split('-');

    if (parts.length === 0) {
      return null;
    }

    // Format: language-REGION (e.g., en-US)
    if (parts.length === 1) {
      // Just language code, return as-is or add default region
      return parts[0].toLowerCase();
    }

    // Format with region
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  }

  /**
   * Get language code from browser navigator (client-side)
   * This is a utility method for client-side detection
   */
  static getBrowserLanguage(): string {
    if (typeof navigator === 'undefined') {
      return 'en';
    }

    // Try navigator.language first
    if (navigator.language) {
      return navigator.language;
    }

    // Fallback to navigator.languages[0]
    if (navigator.languages && navigator.languages.length > 0) {
      return navigator.languages[0];
    }

    return 'en';
  }

  /**
   * Validate if language code is supported
   */
  async isLanguageSupported(languageCode: string): Promise<boolean> {
    try {
      const language = await this.prisma.translationLanguage.findUnique({
        where: { languageCode },
      });

      return language !== null && language.enabled === true;
    } catch (error) {
      console.error('Error checking language support:', error);
      return false;
    }
  }

  /**
   * Get all supported languages
   */
  async getSupportedLanguages(): Promise<Array<{ code: string; name: string; nativeName: string }>> {
    try {
      const languages = await this.prisma.translationLanguage.findMany({
        where: { enabled: true },
        select: {
          languageCode: true,
          name: true,
          nativeName: true,
        },
        orderBy: { name: 'asc' },
      });

      return languages.map((lang) => ({
        code: lang.languageCode,
        name: lang.name,
        nativeName: lang.nativeName,
      }));
    } catch (error) {
      console.error('Error fetching supported languages:', error);
      return [];
    }
  }
}

