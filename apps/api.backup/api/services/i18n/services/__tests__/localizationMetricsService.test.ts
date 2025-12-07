/**
 * Tests for LocalizationMetricsService
 */

import { PrismaClient } from '@prisma/client';
import { LocalizationMetricsService } from '../../analytics/localizationMetricsService';

// Mock Prisma client
const mockPrisma = {
  translationLanguage: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  translationKeyB252A: {
    findMany: jest.fn(),
  },
  translationValue: {
    findMany: jest.fn(),
  },
  userLocaleSetting: {
    count: jest.fn(),
  },
} as unknown as PrismaClient;

describe('LocalizationMetricsService', () => {
  let service: LocalizationMetricsService;

  beforeEach(() => {
    service = new LocalizationMetricsService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('getLanguageMetrics', () => {
    it('should return metrics for all languages', async () => {
      const mockLanguages = [
        {
          id: 'lang1',
          languageCode: 'en',
          name: 'English',
          nativeName: 'English',
          enabled: true,
        },
        {
          id: 'lang2',
          languageCode: 'es',
          name: 'Spanish',
          nativeName: 'Español',
          enabled: true,
        },
      ];

      const mockKeys = [
        { id: 'key1', key: 'greeting', defaultMessage: 'Hello' },
        { id: 'key2', key: 'farewell', defaultMessage: 'Goodbye' },
      ];

      const mockTranslationValues = [
        {
          id: 'val1',
          languageId: 'lang1',
          status: 'APPROVED',
        },
        {
          id: 'val2',
          languageId: 'lang1',
          status: 'DRAFT',
        },
        {
          id: 'val3',
          languageId: 'lang2',
          status: 'APPROVED',
        },
      ];

      (mockPrisma.translationLanguage.findMany as jest.Mock).mockResolvedValue(mockLanguages);
      (mockPrisma.translationKeyB252A.findMany as jest.Mock).mockResolvedValue(mockKeys);
      (mockPrisma.translationValue.findMany as jest.Mock)
        .mockResolvedValueOnce(mockTranslationValues.filter((tv) => tv.languageId === 'lang1'))
        .mockResolvedValueOnce(mockTranslationValues.filter((tv) => tv.languageId === 'lang2'));

      const result = await service.getLanguageMetrics();

      expect(result).toHaveLength(2);
      expect(result[0].languageCode).toBe('en');
      expect(result[0].totalKeys).toBe(2);
      expect(result[0].translatedKeys).toBe(2);
      expect(result[0].approvedTranslations).toBe(1);
      expect(result[0].draftTranslations).toBe(1);
    });
  });

  describe('getKeyMetrics', () => {
    it('should return metrics for all translation keys', async () => {
      const mockKeys = [
        { id: 'key1', key: 'greeting', defaultMessage: 'Hello' },
      ];

      const mockLanguages = [
        {
          id: 'lang1',
          languageCode: 'en',
          enabled: true,
        },
        {
          id: 'lang2',
          languageCode: 'es',
          enabled: true,
        },
      ];

      const mockTranslationValues = [
        {
          id: 'val1',
          translationKeyId: 'key1',
          language: { languageCode: 'en' },
        },
      ];

      (mockPrisma.translationKeyB252A.findMany as jest.Mock).mockResolvedValue(mockKeys);
      (mockPrisma.translationLanguage.findMany as jest.Mock).mockResolvedValue(mockLanguages);
      (mockPrisma.translationValue.findMany as jest.Mock).mockResolvedValue(mockTranslationValues);

      const result = await service.getKeyMetrics();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('greeting');
      expect(result[0].translatedLanguages).toContain('en');
      expect(result[0].untranslatedLanguages).toContain('es');
      expect(result[0].completionPercentage).toBe(50);
    });
  });

  describe('getUntranslatedKeys', () => {
    it('should return untranslated keys', async () => {
      const mockKeys = [
        { id: 'key1', key: 'greeting', defaultMessage: 'Hello' },
        { id: 'key2', key: 'farewell', defaultMessage: 'Goodbye' },
      ];

      const mockLanguages = [
        {
          id: 'lang1',
          languageCode: 'en',
          enabled: true,
        },
        {
          id: 'lang2',
          languageCode: 'es',
          enabled: true,
        },
      ];

      const mockTranslationValues = [
        {
          id: 'val1',
          translationKeyId: 'key1',
          language: { languageCode: 'en' },
        },
      ];

      (mockPrisma.translationKeyB252A.findMany as jest.Mock).mockResolvedValue(mockKeys);
      (mockPrisma.translationLanguage.findMany as jest.Mock).mockResolvedValue(mockLanguages);
      (mockPrisma.translationValue.findMany as jest.Mock)
        .mockResolvedValueOnce(mockTranslationValues) // key1
        .mockResolvedValueOnce([]); // key2

      const result = await service.getUntranslatedKeys();

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe('greeting');
      expect(result[0].missingLanguages).toContain('es');
      expect(result[1].key).toBe('farewell');
      expect(result[1].missingLanguages).toContain('en');
      expect(result[1].missingLanguages).toContain('es');
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report', async () => {
      const mockLanguages = [
        {
          id: 'lang1',
          languageCode: 'en',
          name: 'English',
          enabled: true,
        },
      ];

      const mockKeys = [
        { id: 'key1', key: 'greeting', defaultMessage: 'Hello' },
      ];

      (mockPrisma.translationLanguage.findMany as jest.Mock)
        .mockResolvedValueOnce(mockLanguages) // getLanguageMetrics
        .mockResolvedValueOnce(mockLanguages) // getKeyMetrics
        .mockResolvedValueOnce(mockLanguages) // getUsageMetrics
        .mockResolvedValueOnce(mockLanguages); // getUntranslatedKeys

      (mockPrisma.translationKeyB252A.findMany as jest.Mock)
        .mockResolvedValueOnce(mockKeys) // getLanguageMetrics
        .mockResolvedValueOnce(mockKeys); // getUntranslatedKeys

      (mockPrisma.translationValue.findMany as jest.Mock)
        .mockResolvedValueOnce([]) // getLanguageMetrics
        .mockResolvedValueOnce([]) // getKeyMetrics
        .mockResolvedValueOnce([]); // getUntranslatedKeys

      (mockPrisma.userLocaleSetting.count as jest.Mock).mockResolvedValue(5);

      const result = await service.generateReport();

      expect(result.summary.totalLanguages).toBe(1);
      expect(result.summary.totalKeys).toBe(1);
      expect(result.languageMetrics).toHaveLength(1);
      expect(result.keyMetrics).toHaveLength(1);
      expect(result.usageMetrics).toHaveLength(1);
    });
  });
});

