/**
 * Tests for LocaleMiddleware
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { LocaleMiddleware, LocaleRequest } from '../../middleware/localeMiddleware';

// Mock Prisma client
const mockPrisma = {
  userLocaleSetting: {
    findUnique: jest.fn(),
  },
  translationLanguage: {
    findUnique: jest.fn(),
  },
  translationKeyB252A: {
    findUnique: jest.fn(),
  },
  translationValue: {
    findFirst: jest.fn(),
  },
} as unknown as PrismaClient;

describe('LocaleMiddleware', () => {
  let middleware: LocaleMiddleware;
  let mockRequest: Partial<LocaleRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new LocaleMiddleware(mockPrisma, 'en');
    mockRequest = {
      headers: {},
    };
    mockResponse = {};
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  it('should detect locale from Accept-Language header', async () => {
    mockRequest.headers = {
      'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
    };

    (mockPrisma.userLocaleSetting.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(null);

    await middleware.middleware(mockRequest as LocaleRequest, mockResponse as Response, mockNext);

    expect(mockRequest.locale).toBeDefined();
    expect(mockRequest.locale?.languageCode).toBeTruthy();
    expect(mockRequest.translations).toBeDefined();
    expect(mockNext).toHaveBeenCalled();
  });

  it('should prioritize user locale setting over header', async () => {
    const mockUserSetting = {
      userId: 'user1',
      language: {
        languageCode: 'fr',
        name: 'French',
        nativeName: 'Français',
      },
    };

    mockRequest.headers = {
      'accept-language': 'es-ES,es;q=0.9',
    };
    (mockRequest as any).user = { id: 'user1' };

    (mockPrisma.userLocaleSetting.findUnique as jest.Mock).mockResolvedValue(mockUserSetting);
    (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(null);

    await middleware.middleware(mockRequest as LocaleRequest, mockResponse as Response, mockNext);

    expect(mockRequest.locale?.languageCode).toBe('fr');
    expect(mockRequest.locale?.source).toBe('user_setting');
  });

  it('should fallback to default locale on error', async () => {
    mockRequest.headers = {};

    (mockPrisma.userLocaleSetting.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

    await middleware.middleware(mockRequest as LocaleRequest, mockResponse as Response, mockNext);

    expect(mockRequest.locale?.languageCode).toBe('en');
    expect(mockRequest.locale?.source).toBe('default');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use x-user-id header when user not in request', async () => {
    const mockUserSetting = {
      userId: 'user1',
      language: {
        languageCode: 'de',
        name: 'German',
        nativeName: 'Deutsch',
      },
    };

    mockRequest.headers = {
      'x-user-id': 'user1',
    };

    (mockPrisma.userLocaleSetting.findUnique as jest.Mock).mockResolvedValue(mockUserSetting);
    (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.translationKeyB252A.findUnique as jest.Mock).mockResolvedValue(null);

    await middleware.middleware(mockRequest as LocaleRequest, mockResponse as Response, mockNext);

    expect(mockRequest.locale?.languageCode).toBe('de');
  });
});

describe('LocaleMiddleware static helpers', () => {
  it('should get translation from request', () => {
    const mockRequest: Partial<LocaleRequest> = {
      translations: {
        'common.loading': 'Loading...',
        'common.error': 'Error',
      },
    };

    expect(LocaleMiddleware.getTranslation(mockRequest as LocaleRequest, 'common.loading')).toBe(
      'Loading...'
    );
    expect(LocaleMiddleware.getTranslation(mockRequest as LocaleRequest, 'common.unknown')).toBe(
      'common.unknown'
    );
  });

  it('should get locale from request', () => {
    const mockRequest: Partial<LocaleRequest> = {
      locale: {
        languageCode: 'es',
        source: 'header',
        confidence: 'medium',
      },
    };

    expect(LocaleMiddleware.getLocale(mockRequest as LocaleRequest)).toBe('es');
  });

  it('should fallback to en when locale not set', () => {
    const mockRequest: Partial<LocaleRequest> = {};

    expect(LocaleMiddleware.getLocale(mockRequest as LocaleRequest)).toBe('en');
  });
});

