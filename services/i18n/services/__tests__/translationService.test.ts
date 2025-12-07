/**
 * Tests for TranslationService
 */

import { PrismaClient, TranslationValueStatus } from '@prisma/client';
import { TranslationService, MemoryCache } from '../translationService';

// Mock Prisma client
const mockPrisma = {
  translationLanguage: {
    findUnique: jest.fn(),
  },
  translationKeyB252A: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  translationValue: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('TranslationService', () => {
  let service: TranslationService;
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache();
    service = new TranslationService(mockPrisma, cache, 'en');
    jest.clearAllMocks();
  });

  describe('getTranslation', () => {
    it('should return translation from cache if available', async () => {
      await cache.set('test.key', 'en', 'Cached value');
      const result = await service.getTranslation('test.key', 'en');
      expect(result).toBe('Cached value');
      expect(mockPrisma.translationLanguage.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch translation from database and cache it', async () => {
      const mockLanguage = { id: 'lang1', languageCode: 'en' };
      const mockKey = { id: 'key1', key: 'test.key', defaultMessage: 'Default message' };
      const mockValue = {
        id: 'val1',
        value: 'Translated value',
        status: TranslationValueStatus.APPROVED,
      };

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationValue.findFirst as jest.Mock).mockResolvedValue(mockValue);

      const result = await service.getTranslation('test.key', 'en');

      expect(result).toBe('Translated value');
      expect(mockPrisma.translationLanguage.findUnique).toHaveBeenCalledWith({
        where: { languageCode: 'en' },
      });
      expect(mockPrisma.translationKeyB252A.findUnique).toHaveBeenCalledWith({
        where: { key: 'test.key' },
      });

      // Check cache
      const cached = await cache.get('test.key', 'en');
      expect(cached).toBe('Translated value');
    });

    it('should fallback to default language if translation not found', async () => {
      const mockEnLanguage = { id: 'lang1', languageCode: 'en' };
      const mockEsLanguage = { id: 'lang2', languageCode: 'es' };
      const mockKey = { id: 'key1', key: 'test.key', defaultMessage: 'Default message' };

      (mockPrisma.translationLanguage.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockEsLanguage) // es not found
        .mockResolvedValueOnce(mockEnLanguage); // en found
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationValue.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // es not found
        .mockResolvedValueOnce({ id: 'val1', value: 'English value', status: TranslationValueStatus.APPROVED }); // en found

      const result = await service.getTranslation('test.key', 'es');

      expect(result).toBe('English value');
    });

    it('should fallback to default message if no translation found', async () => {
      const mockLanguage = { id: 'lang1', languageCode: 'en' };
      const mockKey = { id: 'key1', key: 'test.key', defaultMessage: 'Default message' };

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationValue.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getTranslation('test.key', 'en');

      expect(result).toBe('Default message');
    });

    it('should return key if translation key not found', async () => {
      const mockLanguage = { id: 'lang1', languageCode: 'en' };

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getTranslation('test.key', 'en');

      expect(result).toBe('test.key');
    });
  });

  describe('addTranslation', () => {
    it('should create new translation key and value', async () => {
      const mockLanguage = { id: 'lang1', languageCode: 'en' };
      const mockKey = { id: 'key1', key: 'test.key', defaultMessage: 'Default' };
      const mockValue = { id: 'val1', value: 'New value', status: TranslationValueStatus.DRAFT };

      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.translationKeyB252A.create as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationValue.upsert as jest.Mock).mockResolvedValue(mockValue);

      await service.addTranslation({
        key: 'test.key',
        languageCode: 'en',
        value: 'New value',
      });

      expect(mockPrisma.translationKeyB252A.create).toHaveBeenCalledWith({
        data: {
          key: 'test.key',
          defaultMessage: 'New value',
        },
      });
      expect(mockPrisma.translationValue.upsert).toHaveBeenCalled();
    });

    it('should update existing translation value', async () => {
      const mockLanguage = { id: 'lang1', languageCode: 'en' };
      const mockKey = { id: 'key1', key: 'test.key', defaultMessage: 'Default' };
      const mockValue = { id: 'val1', value: 'Updated value', status: TranslationValueStatus.APPROVED };

      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationValue.upsert as jest.Mock).mockResolvedValue(mockValue);

      await service.addTranslation({
        key: 'test.key',
        languageCode: 'en',
        value: 'Updated value',
        status: TranslationValueStatus.APPROVED,
      });

      expect(mockPrisma.translationValue.upsert).toHaveBeenCalled();
    });
  });

  describe('updateTranslation', () => {
    it('should update translation value', async () => {
      const mockLanguage = { id: 'lang1', languageCode: 'en' };
      const mockKey = { id: 'key1', key: 'test.key', defaultMessage: 'Default' };
      const mockValue = { id: 'val1', value: 'Old value', status: TranslationValueStatus.DRAFT };

      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationValue.findUnique as jest.Mock).mockResolvedValue(mockValue);
      (mockPrisma.translationValue.update as jest.Mock).mockResolvedValue({
        ...mockValue,
        value: 'New value',
      });

      await service.updateTranslation('test.key', 'en', {
        value: 'New value',
        status: TranslationValueStatus.APPROVED,
      });

      expect(mockPrisma.translationValue.update).toHaveBeenCalledWith({
        where: { id: 'val1' },
        data: {
          value: 'New value',
          status: TranslationValueStatus.APPROVED,
        },
      });
    });

    it('should throw error if translation key not found', async () => {
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateTranslation('test.key', 'en', { value: 'New value' })
      ).rejects.toThrow('Translation key not found: test.key');
    });

    it('should throw error if translation value not found', async () => {
      const mockLanguage = { id: 'lang1', languageCode: 'en' };
      const mockKey = { id: 'key1', key: 'test.key', defaultMessage: 'Default' };

      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationValue.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateTranslation('test.key', 'en', { value: 'New value' })
      ).rejects.toThrow('Translation not found for key: test.key, language: en');
    });
  });

  describe('getTranslations', () => {
    it('should get multiple translations', async () => {
      const mockLanguage = { id: 'lang1', languageCode: 'en' };
      const mockKey = { id: 'key1', key: 'test.key', defaultMessage: 'Default' };
      const mockValue = {
        id: 'val1',
        value: 'Translated value',
        status: TranslationValueStatus.APPROVED,
      };

      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(mockLanguage);
      (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(mockKey);
      (mockPrisma.translationValue.findFirst as jest.Mock).mockResolvedValue(mockValue);

      const results = await service.getTranslations(['test.key', 'test.key2'], 'en');

      expect(results).toHaveProperty('test.key');
      expect(results).toHaveProperty('test.key2');
    });
  });
});

