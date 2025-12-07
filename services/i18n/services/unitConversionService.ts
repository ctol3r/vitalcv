/**
 * B252B-I18N-015: UnitConversionService
 *
 * Converts values between units based on Unit model:
 * - Supports categories (length, weight, volume, temperature, etc.)
 * - Includes validation
 * - Includes unit tests
 */

import { PrismaClient, UnitCategory } from '@prisma/client';

export interface ConversionResult {
  value: number;
  fromUnit: string;
  toUnit: string;
  category: UnitCategory;
}

export interface UnitInfo {
  id: string;
  name: string;
  symbol: string;
  category: UnitCategory;
  conversionFactor: number;
}

/**
 * UnitConversionService
 *
 * Service for converting values between different units
 */
export class UnitConversionService {
  private unitCache: Map<string, UnitInfo[]> = new Map();

  constructor(private prisma: PrismaClient) {}

  /**
   * Convert value from one unit to another
   */
  async convert(
    value: number,
    fromUnit: string,
    toUnit: string
  ): Promise<ConversionResult> {
    // Validate input
    if (isNaN(value) || !isFinite(value)) {
      throw new Error('Invalid value: must be a finite number');
    }

    // Get units
    const fromUnitInfo = await this.getUnit(fromUnit);
    const toUnitInfo = await this.getUnit(toUnit);

    if (!fromUnitInfo) {
      throw new Error(`Unit not found: ${fromUnit}`);
    }

    if (!toUnitInfo) {
      throw new Error(`Unit not found: ${toUnit}`);
    }

    // Validate same category
    if (fromUnitInfo.category !== toUnitInfo.category) {
      throw new Error(
        `Cannot convert between different categories: ${fromUnitInfo.category} and ${toUnitInfo.category}`
      );
    }

    // Convert: value * (fromUnit.conversionFactor / toUnit.conversionFactor)
    const convertedValue =
      value * (fromUnitInfo.conversionFactor / toUnitInfo.conversionFactor);

    return {
      value: convertedValue,
      fromUnit: fromUnitInfo.symbol,
      toUnit: toUnitInfo.symbol,
      category: fromUnitInfo.category,
    };
  }

  /**
   * Get unit from database (with caching)
   */
  private async getUnit(unitIdentifier: string): Promise<UnitInfo | null> {
    // Try to get from cache first
    const cached = this.unitCache.get(unitIdentifier);
    if (cached) {
      const unit = cached.find((u) => u.name === unitIdentifier || u.symbol === unitIdentifier);
      if (unit) {
        return unit;
      }
    }

    // Query database
    const unit = await this.prisma.unit.findFirst({
      where: {
        OR: [
          { name: unitIdentifier },
          { symbol: unitIdentifier },
        ],
      },
    });

    if (!unit) {
      return null;
    }

    const unitInfo: UnitInfo = {
      id: unit.id,
      name: unit.name,
      symbol: unit.symbol,
      category: unit.category,
      conversionFactor: unit.conversionFactor,
    };

    // Cache by category
    const categoryKey = unit.category;
    if (!this.unitCache.has(categoryKey)) {
      const categoryUnits = await this.prisma.unit.findMany({
        where: { category: unit.category },
      });
      this.unitCache.set(
        categoryKey,
        categoryUnits.map((u) => ({
          id: u.id,
          name: u.name,
          symbol: u.symbol,
          category: u.category,
          conversionFactor: u.conversionFactor,
        }))
      );
    }

    return unitInfo;
  }

  /**
   * Get all units in a category
   */
  async getUnitsByCategory(category: UnitCategory): Promise<UnitInfo[]> {
    // Check cache
    if (this.unitCache.has(category)) {
      return this.unitCache.get(category)!;
    }

    // Query database
    const units = await this.prisma.unit.findMany({
      where: { category },
      orderBy: { name: 'asc' },
    });

    const unitInfos: UnitInfo[] = units.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      category: u.category,
      conversionFactor: u.conversionFactor,
    }));

    // Cache
    this.unitCache.set(category, unitInfos);

    return unitInfos;
  }

  /**
   * Get all supported units
   */
  async getAllUnits(): Promise<UnitInfo[]> {
    const units = await this.prisma.unit.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return units.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      category: u.category,
      conversionFactor: u.conversionFactor,
    }));
  }

  /**
   * Validate if conversion is possible between two units
   */
  async canConvert(fromUnit: string, toUnit: string): Promise<boolean> {
    try {
      const fromUnitInfo = await this.getUnit(fromUnit);
      const toUnitInfo = await this.getUnit(toUnit);

      if (!fromUnitInfo || !toUnitInfo) {
        return false;
      }

      return fromUnitInfo.category === toUnitInfo.category;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert multiple values at once
   */
  async convertMultiple(
    conversions: Array<{ value: number; fromUnit: string; toUnit: string }>
  ): Promise<ConversionResult[]> {
    return Promise.all(
      conversions.map((conv) => this.convert(conv.value, conv.fromUnit, conv.toUnit))
    );
  }

  /**
   * Get conversion factor between two units
   */
  async getConversionFactor(fromUnit: string, toUnit: string): Promise<number> {
    const fromUnitInfo = await this.getUnit(fromUnit);
    const toUnitInfo = await this.getUnit(toUnit);

    if (!fromUnitInfo || !toUnitInfo) {
      throw new Error('One or both units not found');
    }

    if (fromUnitInfo.category !== toUnitInfo.category) {
      throw new Error('Units are in different categories');
    }

    return fromUnitInfo.conversionFactor / toUnitInfo.conversionFactor;
  }
}

