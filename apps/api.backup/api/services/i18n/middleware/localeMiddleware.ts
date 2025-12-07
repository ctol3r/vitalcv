/**
 * B252B-I18N-016: LocaleMiddleware
 *
 * Express middleware that:
 * - Reads user's locale from request
 * - Attaches locale info to request context
 * - Loads translation bundle
 */

import { NextFunction, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { LanguageDetectionService } from '../services/languageDetectionService';
import { TranslationService } from '../services/translationService';

export interface LocaleRequest extends Request {
  locale?: {
    languageCode: string;
    source: 'user_setting' | 'header' | 'browser' | 'default';
    confidence: 'high' | 'medium' | 'low';
  };
  translations?: Record<string, string>;
  user?: {
    id: string;
  };
}

/**
 * LocaleMiddleware
 *
 * Express middleware for locale detection and translation bundle loading
 */
export class LocaleMiddleware {
  private languageDetection: LanguageDetectionService;
  private translationService: TranslationService;

  constructor(
    private prisma: PrismaClient,
    defaultLanguageCode: string = 'en'
  ) {
    this.languageDetection = new LanguageDetectionService(prisma, defaultLanguageCode);
    this.translationService = new TranslationService(prisma, undefined, defaultLanguageCode);
  }

  /**
   * Middleware function
   */
  middleware = async (req: LocaleRequest, res: Response, next: NextFunction) => {
    try {
      // Get Accept-Language header
      const acceptLanguageHeader = req.headers['accept-language'] as string | undefined;

      // Get user ID from request (could be from JWT, session, etc.)
      const userId = (req as any).user?.id || req.headers['x-user-id'] as string | undefined;

      // Detect language
      const detectionResult = await this.languageDetection.detectLanguage({
        acceptLanguageHeader,
        userId,
      });

      // Attach locale to request
      req.locale = {
        languageCode: detectionResult.languageCode,
        source: detectionResult.source,
        confidence: detectionResult.confidence,
      };

      // Load translation bundle (optional - can be lazy-loaded)
      // For now, we'll load common translations
      req.translations = await this.loadTranslationBundle(detectionResult.languageCode);

      next();
    } catch (error) {
      console.error('LocaleMiddleware error:', error);
      // Continue with default locale on error
      req.locale = {
        languageCode: 'en',
        source: 'default',
        confidence: 'low',
      };
      req.translations = {};
      next();
    }
  };

  /**
   * Load translation bundle for a language
   * This can be optimized to load only needed translations
   */
  private async loadTranslationBundle(languageCode: string): Promise<Record<string, string>> {
    try {
      // Get common translation keys (you might want to define these)
      const commonKeys = [
        'common.loading',
        'common.error',
        'common.success',
        'common.cancel',
        'common.save',
        'common.delete',
        'common.edit',
        'common.close',
      ];

      // Load translations
      const translations: Record<string, string> = {};
      for (const key of commonKeys) {
        translations[key] = await this.translationService.getTranslation(key, languageCode);
      }

      return translations;
    } catch (error) {
      console.error('Error loading translation bundle:', error);
      return {};
    }
  }

  /**
   * Helper function to get translation from request
   */
  static getTranslation(req: LocaleRequest, key: string): string {
    // Try to get from loaded bundle first
    if (req.translations && req.translations[key]) {
      return req.translations[key];
    }

    // Fallback to key
    return key;
  }

  /**
   * Helper function to get locale from request
   */
  static getLocale(req: LocaleRequest): string {
    return req.locale?.languageCode || 'en';
  }
}

/**
 * Factory function to create locale middleware
 */
export function createLocaleMiddleware(
  prisma: PrismaClient,
  defaultLanguageCode: string = 'en'
) {
  const middleware = new LocaleMiddleware(prisma, defaultLanguageCode);
  return middleware.middleware;
}

