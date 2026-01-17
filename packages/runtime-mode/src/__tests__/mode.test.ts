import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectRuntimeMode,
  isTestMode,
  isProdMode,
  isDevMode,
  assertNoNetwork,
  getNetworkTimeout,
} from '../mode';

describe('Runtime Mode Detection', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('detectRuntimeMode', () => {
    it('returns "test" when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      expect(detectRuntimeMode()).toBe('test');
    });

    it('returns "prod" when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      expect(detectRuntimeMode()).toBe('prod');
    });

    it('returns "dev" when NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      expect(detectRuntimeMode()).toBe('dev');
    });

    it('returns "dev" when NODE_ENV=dev', () => {
      process.env.NODE_ENV = 'dev';
      expect(detectRuntimeMode()).toBe('dev');
    });

    it('returns "dev" when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      expect(detectRuntimeMode()).toBe('dev');
    });

    it('returns "dev" for unknown NODE_ENV values', () => {
      process.env.NODE_ENV = 'staging';
      expect(detectRuntimeMode()).toBe('dev');
    });
  });

  describe('isTestMode', () => {
    it('returns true when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      expect(isTestMode()).toBe(true);
    });

    it('returns false when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      expect(isTestMode()).toBe(false);
    });

    it('returns false when NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      expect(isTestMode()).toBe(false);
    });
  });

  describe('isProdMode', () => {
    it('returns true when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      expect(isProdMode()).toBe(true);
    });

    it('returns false when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      expect(isProdMode()).toBe(false);
    });

    it('returns false when NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      expect(isProdMode()).toBe(false);
    });
  });

  describe('isDevMode', () => {
    it('returns true when NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevMode()).toBe(true);
    });

    it('returns true when NODE_ENV=dev', () => {
      process.env.NODE_ENV = 'dev';
      expect(isDevMode()).toBe(true);
    });

    it('returns false when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      expect(isDevMode()).toBe(false);
    });

    it('returns false when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      expect(isDevMode()).toBe(false);
    });
  });

  describe('assertNoNetwork', () => {
    it('throws in test mode', () => {
      process.env.NODE_ENV = 'test';

      expect(() => assertNoNetwork('testOperation')).toThrow(
        /Network calls forbidden in test mode: testOperation/
      );
    });

    it('error message includes docs link', () => {
      process.env.NODE_ENV = 'test';

      expect(() => assertNoNetwork('testOperation')).toThrow(
        /docs\/execution-modes\.md/
      );
    });

    it('does not throw in dev mode', () => {
      process.env.NODE_ENV = 'development';

      expect(() => assertNoNetwork('devOperation')).not.toThrow();
    });

    it('does not throw in prod mode', () => {
      process.env.NODE_ENV = 'production';

      expect(() => assertNoNetwork('prodOperation')).not.toThrow();
    });
  });

  describe('getNetworkTimeout', () => {
    it('throws in test mode', () => {
      process.env.NODE_ENV = 'test';

      expect(() => getNetworkTimeout()).toThrow(
        /Network operations not allowed in test mode/
      );
    });

    it('returns 30000ms in dev mode', () => {
      process.env.NODE_ENV = 'development';

      expect(getNetworkTimeout()).toBe(30000);
    });

    it('returns 10000ms in prod mode', () => {
      process.env.NODE_ENV = 'production';

      expect(getNetworkTimeout()).toBe(10000);
    });
  });
});
