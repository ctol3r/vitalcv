/**
 * Tests for LanguagePackImportExportService
 */

import { PrismaClient, TranslationValueStatus } from '@prisma/client';
import { LanguagePackImportExportService } from '../languagePackImportExportService';

// Mock Prisma client
const mockPrisma = {
  translationLanguage: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  translationValue: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  translationKeyB252A: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  languagePack: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
} as unknown as PrismaClient;

describe('LanguagePackImportExportService', () => {
  let service: LanguagePackImportExportService;

  beforeEach(() => {
    service = new LanguagePackImportExportService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('exportToJSON', () => {
    it('should export language pack to JSON', async () => {
      const mockLanguage = {
        id: 'lang1',
        languageCode: 'en',
        name: 'English',
        nativeName: 'English',
      };

      const mockTranslationValues = [
        {
          id: 'val1',
          value: 'Hello',
          status: TranslationValueStatus.APPROVED,
          translationKey: {
            id: 'key1',
            key: 'greeting',
            defaultMessage: 'Hello',
          },
        },
        {
          id: 'val2',
          value: 'Goodbye',
          status: TranslationValueStatus.APPROVED,
          translationKey: {
            id: 'key2',
            key: 'farewell',
            defaultMessage: 'Goodbye',
          },
        },
      ];

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationValue.findMany as jest.Mock).mockResolvedValue(mockTranslationValues);

      const result = await service.exportToJSON('en', '1.0.0');

      expect(result.languageCode).toBe('en');
      expect(result.version).toBe('1.0.0');
      expect(result.translations).toHaveLength(2);
      expect(result.translations[0]).toEqual({
        key: 'greeting',
        value: 'Hello',
        status: TranslationValueStatus.APPROVED,
      });
    });

    it('should throw error for unknown language', async () => {
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.exportToJSON('xx')).rejects.toThrow('Language not found: xx');
    });
  });

  describe('exportToCSV', () => {
    it('should export language pack to CSV', async () => {
      const mockLanguage = {
        id: 'lang1',
        languageCode: 'en',
        name: 'English',
        nativeName: 'English',
      };

      const mockTranslationValues = [
        {
          id: 'val1',
          value: 'Hello',
          status: TranslationValueStatus.APPROVED,
          translationKey: {
            id: 'key1',
            key: 'greeting',
            defaultMessage: 'Hello',
          },
        },
      ];

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationValue.findMany as jest.Mock).mockResolvedValue(mockTranslationValues);

      const result = await service.exportToCSV('en');

      expect(result).toContain('key');
      expect(result).toContain('value');
      expect(result).toContain('status');
      expect(result).toContain('greeting');
      expect(result).toContain('Hello');
    });
  });

  describe('importFromJSON', () => {
    it('should import language pack from JSON', async () => {
      const mockLanguage = {
        id: 'lang1',
        languageCode: 'es',
        name: 'Spanish',
        nativeName: 'Español',
      };

      const mockKey = {
        id: 'key1',
        key: 'greeting',
        defaultMessage: 'Hello',
      };

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationValue.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.translationValue.create as jest.Mock).mockResolvedValue({
        id: 'val1',
        value: 'Hola',
        status: TranslationValueStatus.DRAFT,
      });
      (mockPrisma.languagePack.create as jest.Mock).mockResolvedValue({});

      const importData = {
        languageCode: 'es',
        translations: [
          {
            key: 'greeting',
            value: 'Hola',
            status: TranslationValueStatus.DRAFT,
          },
        ],
      };

      const result = await service.importFromJSON(importData);

      expect(result.valuesCreated).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should create translation key if it does not exist', async () => {
      const mockLanguage = {
        id: 'lang1',
        languageCode: 'es',
        name: 'Spanish',
        nativeName: 'Español',
      };

      const mockNewKey = {
        id: 'key1',
        key: 'greeting',
        defaultMessage: 'Hola',
      };

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.translationKeyB252A.create as jest.Mock).mockResolvedValue(mockNewKey);
      (mockPrisma.translationValue.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.translationValue.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.languagePack.create as jest.Mock).mockResolvedValue({});

      const importData = {
        languageCode: 'es',
        translations: [
          {
            key: 'greeting',
            value: 'Hola',
          },
        ],
      };

      const result = await service.importFromJSON(importData);

      expect(result.keysCreated).toBe(1);
      expect(result.valuesCreated).toBe(1);
    });

    it('should update existing translation value', async () => {
      const mockLanguage = {
        id: 'lang1',
        languageCode: 'es',
        name: 'Spanish',
        nativeName: 'Español',
      };

      const mockKey = {
        id: 'key1',
        key: 'greeting',
        defaultMessage: 'Hello',
      };

      const mockExistingValue = {
        id: 'val1',
        value: 'Hola',
        status: TranslationValueStatus.DRAFT,
      };

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationValue.findUnique as jest.Mock).mockResolvedValue(mockExistingValue);
      (mockPrisma.translationValue.update as jest.Mock).mockResolvedValue({
        ...mockExistingValue,
        value: 'Hola!',
      });
      (mockPrisma.languagePack.create as jest.Mock).mockResolvedValue({});

      const importData = {
        languageCode: 'es',
        translations: [
          {
            key: 'greeting',
            value: 'Hola!',
            status: TranslationValueStatus.APPROVED,
          },
        ],
      };

      const result = await service.importFromJSON(importData);

      expect(result.valuesUpdated).toBe(1);
      expect(mockPrisma.translationValue.update).toHaveBeenCalled();
    });
  });

  describe('importFromCSV', () => {
    it('should import language pack from CSV', async () => {
      const csvContent = `key,value,status
greeting,Hola,DRAFT
farewell,Adiós,APPROVED`;

      const mockLanguage = {
        id: 'lang1',
        languageCode: 'es',
        name: 'Spanish',
        nativeName: 'Español',
      };

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.translationKeyB252A.create as jest.Mock).mockResolvedValue({
        id: 'key1',
        key: 'greeting',
        defaultMessage: 'Hola',
      });
      (mockPrisma.translationValue.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.translationValue.create as jest.Mock).mockResolvedValue({});
      (mockPrisma.languagePack.create as jest.Mock).mockResolvedValue({});

      const result = await service.importFromCSV(csvContent, 'es');

      expect(result.valuesCreated).toBe(2);
    });
  });
});

