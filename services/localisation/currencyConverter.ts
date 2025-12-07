/**
 * B230A-INTL-005: Currency Converter Service
 *
 * Converts and displays prices in the user's preferred currency using
 * up-to-date exchange rates; caches rates and handles fallback scenarios.
 */

import { Locale, DEFAULT_LOCALE } from './i18nConfig';
import { formatCurrency } from './localeHelpers';

/**
 * Currency code (ISO 4217)
 */
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'CAD' | 'AUD' | 'CHF' | 'INR' | 'BRL';

/**
 * Exchange rate data
 */
export interface ExchangeRate {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  timestamp: number;
  source: string;
}

/**
 * Exchange rate cache entry
 */
interface ExchangeRateCacheEntry {
  rate: ExchangeRate;
  expiresAt: number;
}

/**
 * Exchange rate provider interface
 */
export interface ExchangeRateProvider {
  /**
   * Fetch exchange rate
   */
  fetchRate(from: CurrencyCode, to: CurrencyCode): Promise<number>;

  /**
   * Fetch multiple exchange rates
   */
  fetchRates(base: CurrencyCode, targets: CurrencyCode[]): Promise<Map<CurrencyCode, number>>;

  /**
   * Provider name
   */
  name: string;
}

/**
 * In-memory cache for exchange rates
 */
class ExchangeRateCache {
  private cache = new Map<string, ExchangeRateCacheEntry>();
  private readonly TTL_MS = 60 * 60 * 1000; // 1 hour default TTL

  /**
   * Get cached rate
   */
  get(from: CurrencyCode, to: CurrencyCode): ExchangeRate | null {
    if (from === to) {
      return {
        from,
        to,
        rate: 1,
        timestamp: Date.now(),
        source: 'cache',
      };
    }

    const key = `${from}-${to}`;
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.rate;
  }

  /**
   * Set cached rate
   */
  set(rate: ExchangeRate, ttlMs?: number): void {
    const key = `${rate.from}-${rate.to}`;
    this.cache.set(key, {
      rate,
      expiresAt: Date.now() + (ttlMs || this.TTL_MS),
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Default exchange rate provider using free API
 */
class DefaultExchangeRateProvider implements ExchangeRateProvider {
  name = 'default';

  async fetchRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
    if (from === to) {
      return 1;
    }

    try {
      // Using exchangerate-api.com (free tier)
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${from}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
      }

      const data = await response.json();
      return data.rates[to] || 1;
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      throw error;
    }
  }

  async fetchRates(
    base: CurrencyCode,
    targets: CurrencyCode[]
  ): Promise<Map<CurrencyCode, number>> {
    const rates = new Map<CurrencyCode, number>();

    try {
      const response = await fetch(
        `https://api.exchangerate-api.com/v4/latest/${base}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
      }

      const data = await response.json();

      for (const target of targets) {
        rates.set(target, data.rates[target] || 1);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      throw error;
    }

    return rates;
  }
}

/**
 * Currency converter service
 */
class CurrencyConverterService {
  private cache = new ExchangeRateCache();
  private provider: ExchangeRateProvider = new DefaultExchangeRateProvider();
  private fallbackRates: Map<string, number> = new Map();

  /**
   * Set exchange rate provider
   */
  setProvider(provider: ExchangeRateProvider): void {
    this.provider = provider;
  }

  /**
   * Set fallback exchange rate
   */
  setFallbackRate(from: CurrencyCode, to: CurrencyCode, rate: number): void {
    this.fallbackRates.set(`${from}-${to}`, rate);
  }

  /**
   * Get exchange rate (with caching)
   */
  async getExchangeRate(
    from: CurrencyCode,
    to: CurrencyCode,
    forceRefresh = false
  ): Promise<ExchangeRate> {
    if (from === to) {
      return {
        from,
        to,
        rate: 1,
        timestamp: Date.now(),
        source: 'identity',
      };
    }

    // Check cache first
    if (!forceRefresh) {
      const cached = this.cache.get(from, to);
      if (cached) {
        return cached;
      }
    }

    try {
      // Fetch from provider
      const rate = await this.provider.fetchRate(from, to);
      const exchangeRate: ExchangeRate = {
        from,
        to,
        rate,
        timestamp: Date.now(),
        source: this.provider.name,
      };

      // Cache the rate
      this.cache.set(exchangeRate);
      return exchangeRate;
    } catch (error) {
      console.warn(`Failed to fetch exchange rate ${from}->${to}, using fallback`, error);

      // Try fallback rate
      const fallbackKey = `${from}-${to}`;
      const fallbackRate = this.fallbackRates.get(fallbackKey);

      if (fallbackRate) {
        return {
          from,
          to,
          rate: fallbackRate,
          timestamp: Date.now(),
          source: 'fallback',
        };
      }

      // Last resort: return 1 (no conversion)
      return {
        from,
        to,
        rate: 1,
        timestamp: Date.now(),
        source: 'fallback-default',
      };
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convert(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode,
    forceRefresh = false
  ): Promise<number> {
    const exchangeRate = await this.getExchangeRate(from, to, forceRefresh);
    return amount * exchangeRate.rate;
  }

  /**
   * Format converted amount
   */
  async formatConverted(
    amount: number,
    from: CurrencyCode,
    to: CurrencyCode,
    locale?: Locale,
    options?: Intl.NumberFormatOptions
  ): Promise<string> {
    const converted = await this.convert(amount, from, to);
    return formatCurrency(converted, to, options, locale);
  }

  /**
   * Batch convert amounts
   */
  async batchConvert(
    amounts: Array<{ amount: number; from: CurrencyCode; to: CurrencyCode }>,
    forceRefresh = false
  ): Promise<number[]> {
    // Group by currency pairs to minimize API calls
    const pairs = new Map<string, { from: CurrencyCode; to: CurrencyCode }>();
    for (const { from, to } of amounts) {
      const key = `${from}-${to}`;
      if (!pairs.has(key)) {
        pairs.set(key, { from, to });
      }
    }

    // Fetch all rates
    const rates = new Map<string, number>();
    for (const [key, { from, to }] of pairs) {
      const rate = await this.getExchangeRate(from, to, forceRefresh);
      rates.set(key, rate.rate);
    }

    // Convert amounts
    return amounts.map(({ amount, from, to }) => {
      const key = `${from}-${to}`;
      const rate = rates.get(key) || 1;
      return amount * rate;
    });
  }

  /**
   * Get currency code from locale
   */
  getCurrencyFromLocale(locale: Locale): CurrencyCode {
    const localeToCurrency: Record<Locale, CurrencyCode> = {
      'en-US': 'USD',
      'en-GB': 'GBP',
      'es-ES': 'EUR',
      'fr-FR': 'EUR',
      'de-DE': 'EUR',
      'ja-JP': 'JPY',
      'zh-CN': 'CNY',
    };

    return localeToCurrency[locale] || 'USD';
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; expiresAt: number }> } {
    // This would require exposing cache internals, simplified for now
    return {
      size: this.cache.size(),
      entries: [],
    };
  }
}

/**
 * Singleton instance
 */
export const currencyConverter = new CurrencyConverterService();

/**
 * Convenience functions
 */
export async function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): Promise<number> {
  return currencyConverter.convert(amount, from, to);
}

export async function formatCurrencyAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  locale?: Locale
): Promise<string> {
  return currencyConverter.formatConverted(amount, from, to, locale);
}

export function getCurrencyForLocale(locale: Locale): CurrencyCode {
  return currencyConverter.getCurrencyFromLocale(locale);
}

