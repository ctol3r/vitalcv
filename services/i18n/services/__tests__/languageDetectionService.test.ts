/**
 * Tests for LanguageDetectionService
 */

import { PrismaClient } from '@prisma/client';
import { LanguageDetectionService } from '../languageDetectionService';

// Mock Prisma client
const mockPrisma = {
  userLocaleSetting: {
    findUnique: jest.fn(),
  },
  translationLanguage: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('LanguageDetectionService', () => {
  let service: LanguageDetectionService;

  beforeEach(() => {
    service = new LanguageDetectionService(mockPrisma, 'en');
    jest.clearAllMocks();
  });

  describe('detectLanguage', () => {
    it('should prioritize UserLocaleSetting over header', async () => {
      const mockUserSetting = {
        userId: 'user1',
        language: {
          languageCode: 'es',
          name: 'Spanish',
          nativeName: 'Español',
        },
      };

      (mockPrisma.userLocaleSetting.findUnique as jest.Mock).mockResolvedValue(mockUserSetting);

      const result = await service.detectLanguage({
        userId: 'user1',
        acceptLanguageHeader: 'en-US,en;q=0.9',
      });

      expect(result.languageCode).toBe('es');
      expect(result.source).toBe('user_setting');
      expect(result.confidence).toBe('high');
    });

    it('should use Accept-Language header when user setting not available', async () => {
      (mockPrisma.userLocaleSetting.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.detectLanguage({
        acceptLanguageHeader: 'es-ES,es;q=0.9,en;q=0.8',
      });

      expect(result.languageCode).toBe('es-es');
      expect(result.source).toBe('header');
      expect(result.confidence).toBe('medium');
    });

    it('should parse Accept-Language header with quality values', async () => {
      (mockPrisma.userLocaleSetting.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.detectLanguage({
        acceptLanguageHeader: 'fr-FR,fr;q=0.9,en;q=0.5',
      });

      expect(result.languageCode).toBe('fr-fr');
      expect(result.source).toBe('header');
    });

    it('should fallback to default language when no sources available', async () => {
      (mockPrisma.userLocaleSetting.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.detectLanguage({});

      expect(result.languageCode).toBe('en');
      expect(result.source).toBe('default');
      expect(result.confidence).toBe('low');
    });

    it('should handle missing userId gracefully', async () => {
      const result = await service.detectLanguage({
        acceptLanguageHeader: 'de-DE,de;q=0.9',
      });

      expect(result.languageCode).toBe('de-de');
      expect(result.source).toBe('header');
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for enabled language', async () => {
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue({
        id: 'lang1',
        languageCode: 'en',
        enabled: true,
      });

      const result = await service.isLanguageSupported('en');
      expect(result).toBe(true);
    });

    it('should return false for disabled language', async () => {
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue({
        id: 'lang1',
        languageCode: 'en',
        enabled: false,
      });

      const result = await service.isLanguageSupported('en');
      expect(result).toBe(false);
    });

    it('should return false for non-existent language', async () => {
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.isLanguageSupported('xx');
      expect(result).toBe(false);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return list of enabled languages', async () => {
      const mockLanguages = [
        {
          languageCode: 'en',
          name: 'English',
          nativeName: 'English',
        },
        {
          languageCode: 'es',
          name: 'Spanish',
          nativeName: 'Español',
        },
      ];

      (mockPrisma.translationLanguage.findMany as jest.Mock).mockResolvedValue(mockLanguages);

      const result = await service.getSupportedLanguages();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: 'en',
        name: 'English',
        nativeName: 'English',
      });
    });

    it('should return empty array on error', async () => {
      (mockPrisma.translationLanguage.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.getSupportedLanguages();
      expect(result).toEqual([]);
    });
  });

  describe('getBrowserLanguage', () => {
    it('should return navigator.language when available', () => {
      // Mock navigator
      Object.defineProperty(global, 'navigator', {
        value: {
          language: 'fr-FR',
          languages: ['fr-FR', 'en-US'],
        },
        configurable: true,
      });

      const result = LanguageDetectionService.getBrowserLanguage();
      expect(result).toBe('fr-FR');
    });

    it('should fallback to navigator.languages[0]', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          languages: ['de-DE', 'en-US'],
        },
        configurable: true,
      });

      const result = LanguageDetectionService.getBrowserLanguage();
      expect(result).toBe('de-DE');
    });

    it('should return default when navigator not available', () => {
      Object.defineProperty(global, 'navigator', {
        value: undefined,
        configurable: true,
      });

      const result = LanguageDetectionService.getBrowserLanguage();
      expect(result).toBe('en');
    });
  });
});

