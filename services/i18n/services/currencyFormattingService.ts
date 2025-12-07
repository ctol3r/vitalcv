/**
 * B241B-I18N-017: CurrencyFormattingService
 *
 * Formats currency amounts per locale:
 * - Correct symbols
 * - Decimal separators
 * - Grouping
 * - Respects currency conversion engine results
 * - Configurable for major currencies
 */

export interface CurrencyFormat {
  symbol: string;
  symbolPosition: 'before' | 'after';
  decimalSeparator: string;
  thousandsSeparator: string;
  decimalPlaces: number;
  spaceBetweenSymbol: boolean;
}

export interface CurrencyFormatOptions {
  showSymbol?: boolean;
  decimalPlaces?: number;
  useGrouping?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  convertedAmount: number;
}

/**
 * Currency formatting service
 * Formats currency amounts according to locale-specific conventions
 */
export class CurrencyFormattingService {
  private currencyFormats: Record<string, CurrencyFormat> = {
    USD: {
      symbol: '$',
      symbolPosition: 'before',
      decimalSeparator: '.',
      thousandsSeparator: ',',
      decimalPlaces: 2,
      spaceBetweenSymbol: false,
    },
    EUR: {
      symbol: '€',
      symbolPosition: 'after',
      decimalSeparator: ',',
      thousandsSeparator: '.',
      decimalPlaces: 2,
      spaceBetweenSymbol: true,
    },
    GBP: {
      symbol: '£',
      symbolPosition: 'before',
      decimalSeparator: '.',
      thousandsSeparator: ',',
      decimalPlaces: 2,
      spaceBetweenSymbol: false,
    },
    JPY: {
      symbol: '¥',
      symbolPosition: 'before',
      decimalSeparator: '.',
      thousandsSeparator: ',',
      decimalPlaces: 0,
      spaceBetweenSymbol: false,
    },
    CNY: {
      symbol: '¥',
      symbolPosition: 'before',
      decimalSeparator: '.',
      thousandsSeparator: ',',
      decimalPlaces: 2,
      spaceBetweenSymbol: false,
    },
    MXN: {
      symbol: '$',
      symbolPosition: 'before',
      decimalSeparator: '.',
      thousandsSeparator: ',',
      decimalPlaces: 2,
      spaceBetweenSymbol: false,
    },
    BRL: {
      symbol: 'R$',
      symbolPosition: 'before',
      decimalSeparator: ',',
      thousandsSeparator: '.',
      decimalPlaces: 2,
      spaceBetweenSymbol: true,
    },
    CAD: {
      symbol: '$',
      symbolPosition: 'before',
      decimalSeparator: '.',
      thousandsSeparator: ',',
      decimalPlaces: 2,
      spaceBetweenSymbol: false,
    },
    AUD: {
      symbol: '$',
      symbolPosition: 'before',
      decimalSeparator: '.',
      thousandsSeparator: ',',
      decimalPlaces: 2,
      spaceBetweenSymbol: false,
    },
  };

  /**
   * Format currency amount
   */
  format(
    amount: number,
    currency: string,
    options?: CurrencyFormatOptions
  ): string {
    const format = this.getCurrencyFormat(currency);
    const opts = {
      showSymbol: true,
      useGrouping: true,
      minimumFractionDigits: format.decimalPlaces,
      maximumFractionDigits: format.decimalPlaces,
      ...options,
    };

    // Format number part
    let formattedNumber = this.formatNumber(amount, format, opts);

    // Add currency symbol if requested
    if (opts.showSymbol) {
      const space = format.spaceBetweenSymbol ? ' ' : '';
      if (format.symbolPosition === 'before') {
        formattedNumber = `${format.symbol}${space}${formattedNumber}`;
      } else {
        formattedNumber = `${formattedNumber}${space}${format.symbol}`;
      }
    }

    return formattedNumber;
  }

  /**
   * Format currency with conversion
   */
  formatWithConversion(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    conversion: CurrencyConversion,
    options?: CurrencyFormatOptions
  ): string {
    // Validate conversion
    if (
      conversion.fromCurrency !== fromCurrency ||
      conversion.toCurrency !== toCurrency
    ) {
      throw new Error('Conversion currency mismatch');
    }

    const convertedAmount = amount * conversion.rate;
    return this.format(convertedAmount, toCurrency, options);
  }

  /**
   * Parse currency string to number
   */
  parse(formattedAmount: string, currency: string): number {
    const format = this.getCurrencyFormat(currency);

    // Remove currency symbol
    let cleaned = formattedAmount.replace(format.symbol, '').trim();

    // Remove thousands separators
    cleaned = cleaned.replace(
      new RegExp(`\\${format.thousandsSeparator}`, 'g'),
      ''
    );

    // Replace decimal separator with dot
    cleaned = cleaned.replace(format.decimalSeparator, '.');

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      throw new Error(`Failed to parse currency: ${formattedAmount}`);
    }

    return parsed;
  }

  /**
   * Get currency format for a currency code
   */
  getCurrencyFormat(currency: string): CurrencyFormat {
    const upperCurrency = currency.toUpperCase();
    const format = this.currencyFormats[upperCurrency];

    if (!format) {
      // Default to USD format
      console.warn(`Unknown currency: ${currency}, using USD format`);
      return this.currencyFormats.USD;
    }

    return format;
  }

  /**
   * Register or update currency format
   */
  registerCurrencyFormat(currency: string, format: CurrencyFormat): void {
    this.currencyFormats[currency.toUpperCase()] = format;
  }

  /**
   * Format number part of currency
   */
  private formatNumber(
    amount: number,
    format: CurrencyFormat,
    options: Required<CurrencyFormatOptions>
  ): string {
    // Round to appropriate decimal places
    const rounded = this.roundToDecimalPlaces(
      amount,
      options.maximumFractionDigits
    );

    // Split into integer and decimal parts
    const parts = rounded.toString().split('.');
    let integerPart = parts[0];
    let decimalPart = parts[1] || '';

    // Apply grouping (thousands separators)
    if (options.useGrouping) {
      integerPart = this.applyGrouping(integerPart, format.thousandsSeparator);
    }

    // Format decimal part
    if (options.minimumFractionDigits > 0) {
      decimalPart = decimalPart.padEnd(
        options.minimumFractionDigits,
        '0'
      ).slice(0, options.maximumFractionDigits);
    } else {
      decimalPart = '';
    }

    // Combine
    if (decimalPart) {
      return `${integerPart}${format.decimalSeparator}${decimalPart}`;
    } else {
      return integerPart;
    }
  }

  /**
   * Apply thousands grouping
   */
  private applyGrouping(number: string, separator: string): string {
    // Handle negative numbers
    const isNegative = number.startsWith('-');
    const digits = isNegative ? number.slice(1) : number;

    // Add separators from right to left
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
   * Round to specified decimal places
   */
  private roundToDecimalPlaces(value: number, decimalPlaces: number): number {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(value * factor) / factor;
  }

  /**
   * Get all supported currencies
   */
  getSupportedCurrencies(): string[] {
    return Object.keys(this.currencyFormats);
  }
}

