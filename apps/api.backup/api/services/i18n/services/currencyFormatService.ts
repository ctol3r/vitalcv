/**
 * B252B-I18N-013: CurrencyFormatService
 *
 * Formats currency values according to user's locale:
 * - Uses Currency model from database
 * - Respects decimalPlaces
 * - Handles symbol position
 * - Supports ISO currency codes
 */

import { PrismaClient } from '@prisma/client';

export interface CurrencyFormatOptions {
  showSymbol?: boolean;
  useGrouping?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface FormattedCurrency {
  formatted: string;
  symbol: string;
  decimalPlaces: number;
  symbolPosition: 'before' | 'after';
}

/**
 * CurrencyFormatService
 *
 * Service for formatting currency values according to locale and currency settings
 */
export class CurrencyFormatService {
  private currencyCache: Map<string, any> = new Map();

  constructor(private prisma: PrismaClient) {}

  /**
   * Format currency value according to locale
   */
  async formatCurrency(
    amount: number,
    currencyCode: string,
    languageCode?: string,
    options: CurrencyFormatOptions = {}
  ): Promise<FormattedCurrency> {
    const {
      showSymbol = true,
      useGrouping = true,
      minimumFractionDigits,
      maximumFractionDigits,
    } = options;

    // Get currency from database
    const currency = await this.getCurrency(currencyCode);
    if (!currency) {
      throw new Error(`Currency not found: ${currencyCode}`);
    }

    // Get user locale settings if languageCode provided
    let userSettings = null;
    if (languageCode) {
      userSettings = await this.getUserLocaleSettings(languageCode);
    }

    // Determine decimal places
    const decimalPlaces =
      maximumFractionDigits !== undefined
        ? maximumFractionDigits
        : minimumFractionDigits !== undefined
        ? minimumFractionDigits
        : currency.decimalPlaces;

    // Format number part
    const formattedNumber = this.formatNumber(amount, decimalPlaces, useGrouping, userSettings);

    // Determine symbol position (default: before for most currencies)
    const symbolPosition = this.getSymbolPosition(currencyCode, userSettings);

    // Build formatted string
    let formatted: string;
    if (showSymbol) {
      if (symbolPosition === 'before') {
        formatted = `${currency.symbol}${formattedNumber}`;
      } else {
        formatted = `${formattedNumber} ${currency.symbol}`;
      }
    } else {
      formatted = formattedNumber;
    }

    return {
      formatted,
      symbol: currency.symbol,
      decimalPlaces,
      symbolPosition,
    };
  }

  /**
   * Get currency from database (with caching)
   */
  private async getCurrency(currencyCode: string) {
    const cacheKey = `currency:${currencyCode}`;

    if (this.currencyCache.has(cacheKey)) {
      return this.currencyCache.get(cacheKey);
    }

    const currency = await this.prisma.currency.findUnique({
      where: { code: currencyCode.toUpperCase() },
    });

    if (currency) {
      // Cache for 1 hour
      this.currencyCache.set(cacheKey, currency);
      setTimeout(() => this.currencyCache.delete(cacheKey), 3600000);
    }

    return currency;
  }

  /**
   * Get user locale settings by language code
   */
  private async getUserLocaleSettings(languageCode: string) {
    try {
      const language = await this.prisma.translationLanguage.findUnique({
        where: { languageCode },
        include: {
          userLocaleSettings: {
            include: {
              country: true,
            },
            take: 1,
          },
        },
      });

      return language?.userLocaleSettings?.[0] || null;
    } catch (error) {
      console.error('Error fetching user locale settings:', error);
      return null;
    }
  }

  /**
   * Format number with decimal places and grouping
   */
  private formatNumber(
    amount: number,
    decimalPlaces: number,
    useGrouping: boolean,
    userSettings: any
  ): string {
    // Round to decimal places
    const rounded = this.roundToDecimalPlaces(amount, decimalPlaces);

    // Split into integer and decimal parts
    const parts = rounded.toString().split('.');
    let integerPart = parts[0];
    let decimalPart = parts[1] || '';

    // Apply grouping (thousands separators)
    if (useGrouping) {
      integerPart = this.applyGrouping(integerPart, userSettings);
    }

    // Format decimal part
    if (decimalPlaces > 0) {
      decimalPart = decimalPart.padEnd(decimalPlaces, '0').slice(0, decimalPlaces);
      const decimalSeparator = this.getDecimalSeparator(userSettings);
      return `${integerPart}${decimalSeparator}${decimalPart}`;
    } else {
      return integerPart;
    }
  }

  /**
   * Apply thousands grouping
   */
  private applyGrouping(number: string, userSettings: any): string {
    const isNegative = number.startsWith('-');
    const digits = isNegative ? number.slice(1) : number;
    const separator = this.getThousandsSeparator(userSettings);

    let grouped = '';
    let count = 0;

    for (let i = digits.length - 1; i >= 0; i--) {
      if (count > 0 && count % 3 === 0) {
        grouped = separator + grouped;
      }
      grouped = digits[i] + grouped;
      count++;
    }

    return isNegative ? '-' + grouped : grouped;
  }

  /**
   * Get thousands separator based on locale
   */
  private getThousandsSeparator(userSettings: any): string {
    // Default based on common patterns
    if (userSettings?.numberFormat) {
      // Could parse numberFormat if it contains separator info
      return ',';
    }
    return ','; // Default to comma
  }

  /**
   * Get decimal separator based on locale
   */
  private getDecimalSeparator(userSettings: any): string {
    // Default based on common patterns
    if (userSettings?.numberFormat) {
      // Could parse numberFormat if it contains separator info
      return '.';
    }
    return '.'; // Default to dot
  }

  /**
   * Get symbol position for currency
   */
  private getSymbolPosition(currencyCode: string, userSettings: any): 'before' | 'after' {
    // Most currencies use 'before', but some (like EUR in some locales) use 'after'
    // This could be enhanced with locale-specific rules
    const afterSymbolCurrencies = ['EUR']; // Could be expanded

    if (afterSymbolCurrencies.includes(currencyCode.toUpperCase())) {
      return 'after';
    }

    return 'before';
  }

  /**
   * Round to specified decimal places
   */
  private roundToDecimalPlaces(value: number, decimalPlaces: number): number {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(value * factor) / factor;
  }

  /**
   * Parse formatted currency string back to number
   */
  async parseCurrency(formattedAmount: string, currencyCode: string): Promise<number> {
    const currency = await this.getCurrency(currencyCode);
    if (!currency) {
      throw new Error(`Currency not found: ${currencyCode}`);
    }

    // Remove currency symbol
    let cleaned = formattedAmount.replace(currency.symbol, '').trim();

    // Remove thousands separators
    cleaned = cleaned.replace(/,/g, '');

    // Parse as float
    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      throw new Error(`Failed to parse currency: ${formattedAmount}`);
    }

    return parsed;
  }

  /**
   * Get all supported currencies
   */
  async getSupportedCurrencies(): Promise<Array<{ code: string; name: string; symbol: string }>> {
    const currencies = await this.prisma.currency.findMany({
      select: {
        code: true,
        name: true,
        symbol: true,
      },
      orderBy: { code: 'asc' },
    });

    return currencies;
  }
}

