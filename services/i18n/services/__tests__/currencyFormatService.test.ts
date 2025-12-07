/**
 * Tests for CurrencyFormatService
 */

import { PrismaClient } from '@prisma/client';
import { CurrencyFormatService } from '../currencyFormatService';

// Mock Prisma client
const mockPrisma = {
  currency: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  translationLanguage: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('CurrencyFormatService', () => {
  let service: CurrencyFormatService;

  beforeEach(() => {
    service = new CurrencyFormatService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('formatCurrency', () => {
    it('should format USD currency correctly', async () => {
      const mockCurrency = {
        id: 'curr1',
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
      };

      (mockPrisma.currency.findUnique as jest.Mock).mockResolvedValue(mockCurrency);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.formatCurrency(1234.56, 'USD');

      expect(result.formatted).toContain('$');
      expect(result.formatted).toContain('1234');
      expect(result.symbol).toBe('$');
      expect(result.decimalPlaces).toBe(2);
      expect(result.symbolPosition).toBe('before');
    });

    it('should format EUR currency correctly', async () => {
      const mockCurrency = {
        id: 'curr2',
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        decimalPlaces: 2,
      };

      (mockPrisma.currency.findUnique as jest.Mock).mockResolvedValue(mockCurrency);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.formatCurrency(1234.56, 'EUR');

      expect(result.formatted).toContain('€');
      expect(result.symbol).toBe('€');
    });

    it('should respect custom decimal places', async () => {
      const mockCurrency = {
        id: 'curr1',
        code: 'JPY',
        name: 'Japanese Yen',
        symbol: '¥',
        decimalPlaces: 0,
      };

      (mockPrisma.currency.findUnique as jest.Mock).mockResolvedValue(mockCurrency);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.formatCurrency(1234.56, 'JPY', undefined, {
        maximumFractionDigits: 0,
      });

      expect(result.decimalPlaces).toBe(0);
      expect(result.formatted).not.toContain('.');
    });

    it('should apply thousands grouping', async () => {
      const mockCurrency = {
        id: 'curr1',
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
      };

      (mockPrisma.currency.findUnique as jest.Mock).mockResolvedValue(mockCurrency);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.formatCurrency(1234567.89, 'USD', undefined, {
        useGrouping: true,
      });

      expect(result.formatted).toContain(',');
    });

    it('should throw error for unknown currency', async () => {
      (mockPrisma.currency.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.formatCurrency(100, 'XXX')).rejects.toThrow(
        'Currency not found: XXX'
      );
    });
  });

  describe('parseCurrency', () => {
    it('should parse formatted currency string', async () => {
      const mockCurrency = {
        id: 'curr1',
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
      };

      (mockPrisma.currency.findUnique as jest.Mock).mockResolvedValue(mockCurrency);

      const result = await service.parseCurrency('$1,234.56', 'USD');

      expect(result).toBe(1234.56);
    });

    it('should handle currency without symbol', async () => {
      const mockCurrency = {
        id: 'curr1',
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimalPlaces: 2,
      };

      (mockPrisma.currency.findUnique as jest.Mock).mockResolvedValue(mockCurrency);

      const result = await service.parseCurrency('1,234.56', 'USD');

      expect(result).toBe(1234.56);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return list of all currencies', async () => {
      const mockCurrencies = [
        { code: 'USD', name: 'US Dollar', symbol: '$' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
      ];

      (mockPrisma.currency.findMany as jest.Mock).mockResolvedValue(mockCurrencies);

      const result = await service.getSupportedCurrencies();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
      });
    });
  });
});

