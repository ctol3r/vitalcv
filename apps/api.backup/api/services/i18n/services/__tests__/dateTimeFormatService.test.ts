/**
 * Tests for DateTimeFormatService
 */

import { PrismaClient } from '@prisma/client';
import { DateTimeFormatService } from '../dateTimeFormatService';

// Mock Prisma client
const mockPrisma = {
  timezone: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  translationLanguage: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('DateTimeFormatService', () => {
  let service: DateTimeFormatService;

  beforeEach(() => {
    service = new DateTimeFormatService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('formatDateTime', () => {
    it('should format date and time for en-US locale', async () => {
      const mockTimezone = {
        id: 'tz1',
        name: 'America/New_York',
        offsetMinutes: -300, // UTC-5
        observesDST: true,
        region: 'America',
      };

      (mockPrisma.timezone.findUnique as jest.Mock).mockResolvedValue(mockTimezone);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const date = new Date('2024-01-15T14:30:00Z');
      const result = await service.formatDateTime(date, 'en-US');

      expect(result.formatted).toBeTruthy();
      expect(result.timezone).toBe('America/New_York');
      expect(result.offsetMinutes).toBe(-300);
    });

    it('should format date only', async () => {
      const mockTimezone = {
        id: 'tz1',
        name: 'UTC',
        offsetMinutes: 0,
        observesDST: false,
        region: 'UTC',
      };

      (mockPrisma.timezone.findUnique as jest.Mock).mockResolvedValue(mockTimezone);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const date = new Date('2024-01-15T14:30:00Z');
      const result = await service.formatDate(date, 'en-US');

      expect(result).toBeTruthy();
      expect(result).toContain('01');
      expect(result).toContain('15');
    });

    it('should format time only', async () => {
      const mockTimezone = {
        id: 'tz1',
        name: 'UTC',
        offsetMinutes: 0,
        observesDST: false,
        region: 'UTC',
      };

      (mockPrisma.timezone.findUnique as jest.Mock).mockResolvedValue(mockTimezone);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const date = new Date('2024-01-15T14:30:00Z');
      const result = await service.formatTime(date, 'en-US');

      expect(result).toBeTruthy();
    });

    it('should format relative dates', async () => {
      const mockTimezone = {
        id: 'tz1',
        name: 'UTC',
        offsetMinutes: 0,
        observesDST: false,
        region: 'UTC',
      };

      (mockPrisma.timezone.findUnique as jest.Mock).mockResolvedValue(mockTimezone);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = await service.formatDateTime(yesterday, 'en-US', { relative: true });

      expect(result.formatted).toContain('yesterday');
    });

    it('should handle different locales', async () => {
      const mockTimezone = {
        id: 'tz1',
        name: 'UTC',
        offsetMinutes: 0,
        observesDST: false,
        region: 'UTC',
      };

      (mockPrisma.timezone.findUnique as jest.Mock).mockResolvedValue(mockTimezone);
      (mockPrisma.translationLanguage.findUnique as jest.Mock).mockResolvedValue(null);

      const date = new Date('2024-01-15T14:30:00Z');
      const result = await service.formatDateTime(date, 'es-ES');

      expect(result.formatted).toBeTruthy();
    });
  });

  describe('getSupportedTimezones', () => {
    it('should return list of all timezones', async () => {
      const mockTimezones = [
        {
          name: 'America/New_York',
          offsetMinutes: -300,
          region: 'America',
        },
        {
          name: 'Europe/London',
          offsetMinutes: 0,
          region: 'Europe',
        },
      ];

      (mockPrisma.timezone.findMany as jest.Mock).mockResolvedValue(mockTimezones);

      const result = await service.getSupportedTimezones();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'America/New_York',
        offsetMinutes: -300,
        region: 'America',
      });
    });
  });
});

