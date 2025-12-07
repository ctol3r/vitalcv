/**
 * B241A-I18N-009: CurrencyConversionEngine
 *
 * Fetches exchange rates from a public API (mock/stub for now)
 * Converts amounts between currencies
 * Caches rates and refreshes daily
 * Tests for rounding and edge cases
 */

export interface ExchangeRate {
  from: string; // ISO 4217 currency code
  to: string;
  rate: number;
  timestamp: Date;
}

export interface ConversionResult {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  rate: number;
  timestamp: Date;
}

/**
 * CurrencyConversionEngine
 *
 * Handles currency conversion with caching
 */
export class CurrencyConversionEngine {
  private rateCache: Map<string, ExchangeRate> = new Map();
  private cacheExpiry: number = 24 * 60 * 60 * 1000; // 24 hours
  private apiUrl: string = 'https://api.exchangerate-api.com/v4/latest';

  constructor(options?: {
    cacheExpiry?: number;
    apiUrl?: string;
  }) {
    if (options?.cacheExpiry) {
      this.cacheExpiry = options.cacheExpiry;
    }
    if (options?.apiUrl) {
      this.apiUrl = options.apiUrl;
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<ConversionResult> {
    if (fromCurrency === toCurrency) {
      return {
        amount,
        fromCurrency,
        toCurrency,
        convertedAmount: amount,
        rate: 1,
        timestamp: new Date(),
      };
    }

    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    const convertedAmount = this.round(amount * rate.rate, 2);

    return {
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount,
      rate: rate.rate,
      timestamp: rate.timestamp,
    };
  }

  /**
   * Get exchange rate (with caching)
   */
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate> {
    const cacheKey = `${fromCurrency}-${toCurrency}`;
    const cached = this.rateCache.get(cacheKey);

    // Check if cache is valid
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached;
    }

    // Fetch new rate
    const rate = await this.fetchExchangeRate(fromCurrency, toCurrency);
    this.rateCache.set(cacheKey, rate);

    return rate;
  }

  /**
   * Fetch exchange rate from API (mock implementation)
   */
  private async fetchExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate> {
    // Mock implementation - in production, call real API
    // For now, return mock rates for common currencies

    const mockRates: Record<string, Record<string, number>> = {
      USD: {
        EUR: 0.85,
        GBP: 0.73,
        JPY: 110.0,
        CAD: 1.25,
        AUD: 1.35,
        CNY: 6.45,
        INR: 74.0,
      },
      EUR: {
        USD: 1.18,
        GBP: 0.86,
        JPY: 129.4,
        CAD: 1.47,
        AUD: 1.59,
        CNY: 7.61,
        INR: 87.32,
      },
      GBP: {
        USD: 1.37,
        EUR: 1.16,
        JPY: 150.7,
        CAD: 1.71,
        AUD: 1.85,
        CNY: 8.84,
        INR: 101.38,
      },
    };

    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    // Check direct rate
    if (mockRates[from] && mockRates[from][to]) {
      return {
        from,
        to,
        rate: mockRates[from][to],
        timestamp: new Date(),
      };
    }

    // Check reverse rate
    if (mockRates[to] && mockRates[to][from]) {
      return {
        from,
        to,
        rate: 1 / mockRates[to][from],
        timestamp: new Date(),
      };
    }

    // Default: use USD as base
    if (from === 'USD') {
      return {
        from,
        to,
        rate: 1.0, // Default rate
        timestamp: new Date(),
      };
    }

    if (to === 'USD') {
      // Convert via USD
      const fromToUSD = mockRates['USD'][from]
        ? 1 / mockRates['USD'][from]
        : 1.0;
      return {
        from,
        to,
        rate: fromToUSD,
        timestamp: new Date(),
      };
    }

    // Convert via USD
    const fromToUSD = mockRates['USD'][from]
      ? 1 / mockRates['USD'][from]
      : 1.0;
    const usdToTo = mockRates['USD'][to] || 1.0;

    return {
      from,
      to,
      rate: fromToUSD * usdToTo,
      timestamp: new Date(),
    };
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(timestamp: Date): boolean {
    const age = Date.now() - timestamp.getTime();
    return age < this.cacheExpiry;
  }

  /**
   * Round to specified decimal places
   */
  private round(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Clear rate cache
   */
  clearCache(): void {
    this.rateCache.clear();
  }

  /**
   * Get cached rates
   */
  getCachedRates(): ExchangeRate[] {
    return Array.from(this.rateCache.values());
  }

  /**
   * Refresh all cached rates
   */
  async refreshRates(): Promise<void> {
    this.clearCache();
    // In production, pre-fetch common currency pairs
  }
}

