/**
 * Tests for UnitConversionService
 */

import { PrismaClient, UnitCategory } from '@prisma/client';
import { UnitConversionService } from '../unitConversionService';

// Mock Prisma client
const mockPrisma = {
  unit: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('UnitConversionService', () => {
  let service: UnitConversionService;

  beforeEach(() => {
    service = new UnitConversionService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('convert', () => {
    it('should convert length units (meters to feet)', async () => {
      const meterUnit = {
        id: 'unit1',
        name: 'meter',
        symbol: 'm',
        category: UnitCategory.LENGTH,
        conversionFactor: 1, // Base unit
      };

      const footUnit = {
        id: 'unit2',
        name: 'foot',
        symbol: 'ft',
        category: UnitCategory.LENGTH,
        conversionFactor: 0.3048, // 1 foot = 0.3048 meters
      };

      (mockPrisma.unit.findFirst as jest.Mock)
        .mockResolvedValueOnce(meterUnit)
        .mockResolvedValueOnce(footUnit);

      const result = await service.convert(10, 'meter', 'foot');

      expect(result.value).toBeCloseTo(32.8084, 2); // 10 meters ≈ 32.8084 feet
      expect(result.fromUnit).toBe('m');
      expect(result.toUnit).toBe('ft');
      expect(result.category).toBe(UnitCategory.LENGTH);
    });

    it('should convert weight units (kilograms to pounds)', async () => {
      const kgUnit = {
        id: 'unit3',
        name: 'kilogram',
        symbol: 'kg',
        category: UnitCategory.WEIGHT,
        conversionFactor: 1, // Base unit
      };

      const lbUnit = {
        id: 'unit4',
        name: 'pound',
        symbol: 'lb',
        category: UnitCategory.WEIGHT,
        conversionFactor: 0.453592, // 1 pound = 0.453592 kg
      };

      (mockPrisma.unit.findFirst as jest.Mock)
        .mockResolvedValueOnce(kgUnit)
        .mockResolvedValueOnce(lbUnit);

      const result = await service.convert(5, 'kilogram', 'pound');

      expect(result.value).toBeCloseTo(11.0231, 2); // 5 kg ≈ 11.0231 lbs
      expect(result.category).toBe(UnitCategory.WEIGHT);
    });

    it('should throw error for invalid value', async () => {
      await expect(service.convert(NaN, 'meter', 'foot')).rejects.toThrow(
        'Invalid value: must be a finite number'
      );

      await expect(service.convert(Infinity, 'meter', 'foot')).rejects.toThrow(
        'Invalid value: must be a finite number'
      );
    });

    it('should throw error for unknown unit', async () => {
      (mockPrisma.unit.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.convert(10, 'unknown', 'meter')).rejects.toThrow(
        'Unit not found: unknown'
      );
    });

    it('should throw error for different categories', async () => {
      const meterUnit = {
        id: 'unit1',
        name: 'meter',
        symbol: 'm',
        category: UnitCategory.LENGTH,
        conversionFactor: 1,
      };

      const kgUnit = {
        id: 'unit3',
        name: 'kilogram',
        symbol: 'kg',
        category: UnitCategory.WEIGHT,
        conversionFactor: 1,
      };

      (mockPrisma.unit.findFirst as jest.Mock)
        .mockResolvedValueOnce(meterUnit)
        .mockResolvedValueOnce(kgUnit);

      await expect(service.convert(10, 'meter', 'kilogram')).rejects.toThrow(
        'Cannot convert between different categories'
      );
    });
  });

  describe('getUnitsByCategory', () => {
    it('should return all units in a category', async () => {
      const mockUnits = [
        {
          id: 'unit1',
          name: 'meter',
          symbol: 'm',
          category: UnitCategory.LENGTH,
          conversionFactor: 1,
        },
        {
          id: 'unit2',
          name: 'foot',
          symbol: 'ft',
          category: UnitCategory.LENGTH,
          conversionFactor: 0.3048,
        },
      ];

      (mockPrisma.unit.findMany as jest.Mock).mockResolvedValue(mockUnits);

      const result = await service.getUnitsByCategory(UnitCategory.LENGTH);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('meter');
    });
  });

  describe('canConvert', () => {
    it('should return true for same category units', async () => {
      const meterUnit = {
        id: 'unit1',
        name: 'meter',
        symbol: 'm',
        category: UnitCategory.LENGTH,
        conversionFactor: 1,
      };

      const footUnit = {
        id: 'unit2',
        name: 'foot',
        symbol: 'ft',
        category: UnitCategory.LENGTH,
        conversionFactor: 0.3048,
      };

      (mockPrisma.unit.findFirst as jest.Mock)
        .mockResolvedValueOnce(meterUnit)
        .mockResolvedValueOnce(footUnit);

      const result = await service.canConvert('meter', 'foot');
      expect(result).toBe(true);
    });

    it('should return false for different category units', async () => {
      const meterUnit = {
        id: 'unit1',
        name: 'meter',
        symbol: 'm',
        category: UnitCategory.LENGTH,
        conversionFactor: 1,
      };

      const kgUnit = {
        id: 'unit3',
        name: 'kilogram',
        symbol: 'kg',
        category: UnitCategory.WEIGHT,
        conversionFactor: 1,
      };

      (mockPrisma.unit.findFirst as jest.Mock)
        .mockResolvedValueOnce(meterUnit)
        .mockResolvedValueOnce(kgUnit);

      const result = await service.canConvert('meter', 'kilogram');
      expect(result).toBe(false);
    });
  });

  describe('getConversionFactor', () => {
    it('should return conversion factor between units', async () => {
      const meterUnit = {
        id: 'unit1',
        name: 'meter',
        symbol: 'm',
        category: UnitCategory.LENGTH,
        conversionFactor: 1,
      };

      const footUnit = {
        id: 'unit2',
        name: 'foot',
        symbol: 'ft',
        category: UnitCategory.LENGTH,
        conversionFactor: 0.3048,
      };

      (mockPrisma.unit.findFirst as jest.Mock)
        .mockResolvedValueOnce(meterUnit)
        .mockResolvedValueOnce(footUnit);

      const factor = await service.getConversionFactor('meter', 'foot');
      expect(factor).toBeCloseTo(3.28084, 2); // 1 meter = 3.28084 feet
    });
  });
});

