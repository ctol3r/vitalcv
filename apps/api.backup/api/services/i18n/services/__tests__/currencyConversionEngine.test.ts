/**
 * B241A-I18N-009: CurrencyConversionEngine tests
 */

import { CurrencyConversionEngine } from '../currencyConversionEngine';

describe('CurrencyConversionEngine', () => {
  let engine: CurrencyConversionEngine;

  beforeEach(() => {
    engine = new CurrencyConversionEngine();
  });

  describe('convert', () => {
    it('should convert between currencies', async () => {
      const result = await engine.convert(100, 'USD', 'EUR');
      expect(result.convertedAmount).toBeGreaterThan(0);
      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('EUR');
      expect(result.rate).toBeGreaterThan(0);
    });

    it('should return same amount for same currency', async () => {
      const result = await engine.convert(100, 'USD', 'USD');
      expect(result.convertedAmount).toBe(100);
      expect(result.rate).toBe(1);
    });

    it('should round to 2 decimal places', async () => {
      const result = await engine.convert(100, 'USD', 'EUR');
      const decimals = (result.convertedAmount.toString().split('.')[1] || '').length;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });

  describe('getExchangeRate', () => {
    it('should get exchange rate', async () => {
      const rate = await engine.getExchangeRate('USD', 'EUR');
      expect(rate).toBeDefined();
      expect(rate.from).toBe('USD');
      expect(rate.to).toBe('EUR');
      expect(rate.rate).toBeGreaterThan(0);
    });

    it('should cache exchange rates', async () => {
      const rate1 = await engine.getExchangeRate('USD', 'EUR');
      const rate2 = await engine.getExchangeRate('USD', 'EUR');

      // Should be same object (cached)
      expect(rate1.timestamp.getTime()).toBe(rate2.timestamp.getTime());
    });
  });
});

