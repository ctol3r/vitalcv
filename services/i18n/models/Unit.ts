/**
 * B252A-I18N-007: Unit model
 *
 * Defines measurement units: id, name (e.g., 'meter'), symbol (e.g., 'm'),
 * category (length/weight/etc.), conversionFactor (relative to base unit),
 * createdAt, updatedAt
 * Includes migration and tests
 */

import { PrismaClient, Unit as PrismaUnit, UnitCategory } from '@prisma/client';

export interface UnitInput {
  name: string; // e.g., 'meter'
  symbol: string; // e.g., 'm'
  category: UnitCategory;
  conversionFactor: number; // Relative to base unit
}

export interface UnitOutput {
  id: string;
  name: string;
  symbol: string;
  category: UnitCategory;
  conversionFactor: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UnitService
 *
 * Manages measurement units
 */
export class UnitService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new unit
   */
  async createUnit(input: UnitInput): Promise<UnitOutput> {
    const unit = await this.prisma.unit.create({
      data: {
        name: input.name,
        symbol: input.symbol,
        category: input.category,
        conversionFactor: input.conversionFactor,
      },
    });

    return this.mapToOutput(unit);
  }

  /**
   * Get a unit by ID
   */
  async getUnitById(id: string): Promise<UnitOutput | null> {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
    });

    return unit ? this.mapToOutput(unit) : null;
  }

  /**
   * Get a unit by name and symbol
   */
  async getUnitByNameAndSymbol(
    name: string,
    symbol: string
  ): Promise<UnitOutput | null> {
    const unit = await this.prisma.unit.findUnique({
      where: {
        name_symbol: {
          name,
          symbol,
        },
      },
    });

    return unit ? this.mapToOutput(unit) : null;
  }

  /**
   * Update a unit
   */
  async updateUnit(
    id: string,
    input: Partial<UnitInput>
  ): Promise<UnitOutput> {
    const unit = await this.prisma.unit.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.symbol && { symbol: input.symbol }),
        ...(input.category && { category: input.category }),
        ...(input.conversionFactor !== undefined && { conversionFactor: input.conversionFactor }),
      },
    });

    return this.mapToOutput(unit);
  }

  /**
   * Delete a unit
   */
  async deleteUnit(id: string): Promise<boolean> {
    try {
      await this.prisma.unit.delete({
        where: { id },
      });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all units with pagination
   */
  async listUnits(
    skip: number = 0,
    take: number = 100
  ): Promise<UnitOutput[]> {
    const units = await this.prisma.unit.findMany({
      skip,
      take,
      orderBy: { name: 'asc' },
    });

    return units.map((u) => this.mapToOutput(u));
  }

  /**
   * List units by category
   */
  async listUnitsByCategory(category: UnitCategory): Promise<UnitOutput[]> {
    const units = await this.prisma.unit.findMany({
      where: { category },
      orderBy: { name: 'asc' },
    });

    return units.map((u) => this.mapToOutput(u));
  }

  /**
   * Get or create a unit (upsert by name and symbol)
   */
  async getOrCreateUnit(input: UnitInput): Promise<UnitOutput> {
    const unit = await this.prisma.unit.upsert({
      where: {
        name_symbol: {
          name: input.name,
          symbol: input.symbol,
        },
      },
      create: {
        name: input.name,
        symbol: input.symbol,
        category: input.category,
        conversionFactor: input.conversionFactor,
      },
      update: {
        category: input.category,
        conversionFactor: input.conversionFactor,
      },
    });

    return this.mapToOutput(unit);
  }

  private mapToOutput(unit: PrismaUnit): UnitOutput {
    return {
      id: unit.id,
      name: unit.name,
      symbol: unit.symbol,
      category: unit.category,
      conversionFactor: unit.conversionFactor,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }
}

