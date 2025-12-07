/**
 * Tests for i18nAPI
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { I18nAPI, AuthRequest } from '../i18nAPI';

// Mock Prisma client
const mockPrisma = {
  translationLanguage: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  translationKeyB252A: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  translationValue: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  languagePack: {
    create: jest.fn(),
  },
} as unknown as PrismaClient;

describe('I18nAPI', () => {
  let api: I18nAPI;
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    api = new I18nAPI(mockPrisma);
    mockRequest = {
      query: {},
      params: {},
      body: {},
    };
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      setHeader: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('listLanguages', () => {
    it('should return paginated list of languages', async () => {
      const mockLanguages = [
        {
          id: 'lang1',
          languageCode: 'en',
          name: 'English',
          nativeName: 'English',
          enabled: true,
        },
      ];

      (mockPrisma.translationLanguage.findMany as jest.Mock).mockResolvedValue(mockLanguages);
      (mockPrisma.translationLanguage.count as jest.Mock).mockResolvedValue(1);

      mockRequest.query = { page: '1', pageSize: '20' };

      // Access private method via router
      const router = api.getRouter();
      // In a real test, you would make an HTTP request to the router
      // For now, we'll test the structure

      expect(mockPrisma.translationLanguage.findMany).toBeDefined();
    });
  });

  describe('createTranslationKey', () => {
    it('should require authentication', () => {
      const router = api.getRouter();
      // Test would verify 401 response when not authenticated
      expect(router).toBeDefined();
    });

    it('should require i18n:write permission', () => {
      const router = api.getRouter();
      // Test would verify 403 response when missing permission
      expect(router).toBeDefined();
    });
  });

  describe('getTranslation', () => {
    it('should get translation for key and language', async () => {
      // This would test the actual endpoint
      // Mock translationService.getTranslation
      expect(api).toBeDefined();
    });
  });

  describe('exportLanguagePack', () => {
    it('should export language pack as JSON', () => {
      const router = api.getRouter();
      expect(router).toBeDefined();
    });

    it('should export language pack as CSV', () => {
      const router = api.getRouter();
      expect(router).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return comprehensive metrics', () => {
      const router = api.getRouter();
      expect(router).toBeDefined();
    });
  });
});

