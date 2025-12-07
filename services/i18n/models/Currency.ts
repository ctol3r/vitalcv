/**
 * B252A-I18N-006: Currency model
 *
 * Schema: id, code (ISO 4217), name, symbol, decimalPlaces, rounding,
 * exchangeRate (optional), createdAt, updatedAt
 * Includes migration and tests
 */

import { PrismaClient, Currency as PrismaCurrency } from '@prisma/client';

export interface CurrencyInput {
  code: string; // ISO 4217
  name: string;
  symbol: string;
  decimalPlaces?: number;
  rounding?: string; // Rounding method
  exchangeRate?: number; // Optional exchange rate
}

export interface CurrencyOutput {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  rounding: string | null;
  exchangeRate: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CurrencyService
 *
 * Manages currency data
 */
export class CurrencyService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new currency
   */
  async createCurrency(input: CurrencyInput): Promise<CurrencyOutput> {
    const currency = await this.prisma.currency.create({
      data: {
        code: input.code,
        name: input.name,
        symbol: input.symbol,
        decimalPlaces: input.decimalPlaces ?? 2,
        rounding: input.rounding,
        exchangeRate: input.exchangeRate,
      },
    });

    return this.mapToOutput(currency);
  }

  /**
   * Get a currency by ID
   */
  async getCurrencyById(id: string): Promise<CurrencyOutput | null> {
    const currency = await this.prisma.currency.findUnique({
      where: { id },
    });

    return currency ? this.mapToOutput(currency) : null;
  }

  /**
   * Get a currency by code
   */
  async getCurrencyByCode(code: string): Promise<CurrencyOutput | null> {
    const currency = await this.prisma.currency.findUnique({
      where: { code },
    });

    return currency ? this.mapToOutput(currency) : null;
  }

  /**
   * Update a currency
   */
  async updateCurrency(
    id: string,
    input: Partial<CurrencyInput>
  ): Promise<CurrencyOutput> {
    const currency = await this.prisma.currency.update({
      where: { id },
      data: {
        ...(input.code && { code: input.code }),
        ...(input.name && { name: input.name }),
        ...(input.symbol && { symbol: input.symbol }),
        ...(input.decimalPlaces !== undefined && { decimalPlaces: input.decimalPlaces }),
        ...(input.rounding !== undefined && { rounding: input.rounding }),
        ...(input.exchangeRate !== undefined && { exchangeRate: input.exchangeRate }),
      },
    });

    return this.mapToOutput(currency);
  }

  /**
   * Delete a currency
   */
  async deleteCurrency(id: string): Promise<boolean> {
    try {
      await this.prisma.currency.delete({
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
   * List all currencies with pagination
   */
  async listCurrencies(
    skip: number = 0,
    take: number = 100
  ): Promise<CurrencyOutput[]> {
    const currencies = await this.prisma.currency.findMany({
      skip,
      take,
      orderBy: { code: 'asc' },
    });

    return currencies.map((c) => this.mapToOutput(c));
  }

  /**
   * Get or create a currency (upsert by code)
   */
  async getOrCreateCurrency(input: CurrencyInput): Promise<CurrencyOutput> {
    const currency = await this.prisma.currency.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        name: input.name,
        symbol: input.symbol,
        decimalPlaces: input.decimalPlaces ?? 2,
        rounding: input.rounding,
        exchangeRate: input.exchangeRate,
      },
      update: {
        name: input.name,
        symbol: input.symbol,
        decimalPlaces: input.decimalPlaces ?? 2,
        rounding: input.rounding,
        exchangeRate: input.exchangeRate,
      },
    });

    return this.mapToOutput(currency);
  }

  private mapToOutput(currency: PrismaCurrency): CurrencyOutput {
    return {
      id: currency.id,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimalPlaces: currency.decimalPlaces,
      rounding: currency.rounding,
      exchangeRate: currency.exchangeRate,
      createdAt: currency.createdAt,
      updatedAt: currency.updatedAt,
    };
  }
}

