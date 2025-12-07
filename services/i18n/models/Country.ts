/**
 * B252A-I18N-005: Country model
 *
 * Defines countries: id, isoCode (ISO 3166-1 alpha-2), name, nativeName,
 * currencyCode, primaryLanguageCode, region (continent), createdAt, updatedAt
 * Includes migration and tests
 */

import { PrismaClient, Country as PrismaCountry } from '@prisma/client';

export interface CountryInput {
  isoCode: string; // ISO 3166-1 alpha-2
  name: string; // English name
  nativeName: string; // Native name
  currencyCode: string; // ISO 4217 currency code
  primaryLanguageCode: string; // Primary language code
  region: string; // Continent/region
}

export interface CountryOutput {
  id: string;
  isoCode: string;
  name: string;
  nativeName: string;
  currencyCode: string;
  primaryLanguageCode: string;
  region: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CountryService
 *
 * Manages country data
 */
export class CountryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new country
   */
  async createCountry(input: CountryInput): Promise<CountryOutput> {
    const country = await this.prisma.country.create({
      data: {
        isoCode: input.isoCode,
        name: input.name,
        nativeName: input.nativeName,
        currencyCode: input.currencyCode,
        primaryLanguageCode: input.primaryLanguageCode,
        region: input.region,
      },
    });

    return this.mapToOutput(country);
  }

  /**
   * Get a country by ID
   */
  async getCountryById(id: string): Promise<CountryOutput | null> {
    const country = await this.prisma.country.findUnique({
      where: { id },
    });

    return country ? this.mapToOutput(country) : null;
  }

  /**
   * Get a country by ISO code
   */
  async getCountryByIsoCode(isoCode: string): Promise<CountryOutput | null> {
    const country = await this.prisma.country.findUnique({
      where: { isoCode },
    });

    return country ? this.mapToOutput(country) : null;
  }

  /**
   * Update a country
   */
  async updateCountry(
    id: string,
    input: Partial<CountryInput>
  ): Promise<CountryOutput> {
    const country = await this.prisma.country.update({
      where: { id },
      data: {
        ...(input.isoCode && { isoCode: input.isoCode }),
        ...(input.name && { name: input.name }),
        ...(input.nativeName && { nativeName: input.nativeName }),
        ...(input.currencyCode && { currencyCode: input.currencyCode }),
        ...(input.primaryLanguageCode && { primaryLanguageCode: input.primaryLanguageCode }),
        ...(input.region && { region: input.region }),
      },
    });

    return this.mapToOutput(country);
  }

  /**
   * Delete a country
   */
  async deleteCountry(id: string): Promise<boolean> {
    try {
      await this.prisma.country.delete({
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
   * List all countries with pagination
   */
  async listCountries(
    skip: number = 0,
    take: number = 100
  ): Promise<CountryOutput[]> {
    const countries = await this.prisma.country.findMany({
      skip,
      take,
      orderBy: { isoCode: 'asc' },
    });

    return countries.map((c) => this.mapToOutput(c));
  }

  /**
   * List countries by region
   */
  async listCountriesByRegion(region: string): Promise<CountryOutput[]> {
    const countries = await this.prisma.country.findMany({
      where: { region },
      orderBy: { isoCode: 'asc' },
    });

    return countries.map((c) => this.mapToOutput(c));
  }

  /**
   * List countries by currency code
   */
  async listCountriesByCurrency(currencyCode: string): Promise<CountryOutput[]> {
    const countries = await this.prisma.country.findMany({
      where: { currencyCode },
      orderBy: { isoCode: 'asc' },
    });

    return countries.map((c) => this.mapToOutput(c));
  }

  /**
   * Get or create a country (upsert by ISO code)
   */
  async getOrCreateCountry(input: CountryInput): Promise<CountryOutput> {
    const country = await this.prisma.country.upsert({
      where: { isoCode: input.isoCode },
      create: {
        isoCode: input.isoCode,
        name: input.name,
        nativeName: input.nativeName,
        currencyCode: input.currencyCode,
        primaryLanguageCode: input.primaryLanguageCode,
        region: input.region,
      },
      update: {
        name: input.name,
        nativeName: input.nativeName,
        currencyCode: input.currencyCode,
        primaryLanguageCode: input.primaryLanguageCode,
        region: input.region,
      },
    });

    return this.mapToOutput(country);
  }

  private mapToOutput(country: PrismaCountry): CountryOutput {
    return {
      id: country.id,
      isoCode: country.isoCode,
      name: country.name,
      nativeName: country.nativeName,
      currencyCode: country.currencyCode,
      primaryLanguageCode: country.primaryLanguageCode,
      region: country.region,
      createdAt: country.createdAt,
      updatedAt: country.updatedAt,
    };
  }
}

