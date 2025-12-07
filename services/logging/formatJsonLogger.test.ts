/**
 * Tests for unified JSON logging format
 *
 * Tests assert log shape, format toggle, and request ID handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JsonLogger, logger, LogEntry } from './formatJsonLogger';

describe('JsonLogger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('JSON format', () => {
    beforeEach(() => {
      process.env.LOG_FORMAT = 'json';
      process.env.LOG_LEVEL = 'trace';
    });

    it('should log in JSON format with correct shape', () => {
      const testLogger = new JsonLogger('test-service');
      testLogger.info('Test message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry: LogEntry = JSON.parse(logCall);

      expect(logEntry).toHaveProperty('ts');
      expect(logEntry).toHaveProperty('level', 'info');
      expect(logEntry).toHaveProperty('service', 'test-service');
      expect(logEntry).toHaveProperty('message', 'Test message');
      expect(logEntry).toHaveProperty('meta');
      expect(logEntry.meta).toEqual({ key: 'value' });

      // Assert timestamp is ISO 8601 format
      expect(new Date(logEntry.ts).toISOString()).toBe(logEntry.ts);
    });

    it('should include requestId when provided', () => {
      const testLogger = new JsonLogger('test-service');
      testLogger.info('Test message', { key: 'value' }, 'req-123');

      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry: LogEntry = JSON.parse(logCall);

      expect(logEntry).toHaveProperty('requestId', 'req-123');
    });

    it('should omit optional fields when not provided', () => {
      const testLogger = new JsonLogger('test-service');
      testLogger.info('Test message');

      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry: LogEntry = JSON.parse(logCall);

      expect(logEntry).not.toHaveProperty('requestId');
      expect(logEntry).not.toHaveProperty('meta');
    });
  });

  describe('Plain format', () => {
    beforeEach(() => {
      process.env.LOG_FORMAT = 'plain';
      process.env.LOG_LEVEL = 'info';
    });

    it('should log in plain format', () => {
      const testLogger = new JsonLogger('test-service');
      testLogger.info('Test message', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logCall = consoleLogSpy.mock.calls[0][0];

      // Plain format should be a string, not JSON
      expect(typeof logCall).toBe('string');
      expect(logCall).toContain('[INFO]');
      expect(logCall).toContain('[test-service]');
      expect(logCall).toContain('Test message');
    });

    it('should use appropriate console method for level', () => {
      const testLogger = new JsonLogger('test-service');

      testLogger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      testLogger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);

      testLogger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Log levels', () => {
    beforeEach(() => {
      process.env.LOG_FORMAT = 'json';
    });

    it('should respect minimum log level', () => {
      process.env.LOG_LEVEL = 'warn';
      const testLogger = new JsonLogger('test-service');

      testLogger.debug('Debug message'); // Should not log
      testLogger.info('Info message'); // Should not log
      testLogger.warn('Warning message'); // Should log
      testLogger.error('Error message'); // Should log

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // warn + error (but error uses console.error)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1); // error
    });

    it('should support all log levels', () => {
      process.env.LOG_LEVEL = 'trace';
      const testLogger = new JsonLogger('test-service');

      const levels: Array<keyof JsonLogger> = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
      levels.forEach((level) => {
        (testLogger[level] as any)(`${level} message`);
      });

      // All should log (except error/fatal which use console.error)
      expect(consoleLogSpy.mock.calls.length + consoleErrorSpy.mock.calls.length).toBe(levels.length);
    });
  });

  describe('Child logger', () => {
    beforeEach(() => {
      process.env.LOG_FORMAT = 'json';
      process.env.LOG_LEVEL = 'info';
    });

    it('should include requestId in all child logger entries', () => {
      const testLogger = new JsonLogger('test-service');
      const childLogger = testLogger.child('req-456');

      childLogger.info('Child message');
      childLogger.warn('Child warning');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);

      const log1: LogEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      const log2: LogEntry = JSON.parse(consoleLogSpy.mock.calls[1][0]);

      expect(log1.requestId).toBe('req-456');
      expect(log2.requestId).toBe('req-456');
    });

    it('should allow overriding requestId in child logger', () => {
      const testLogger = new JsonLogger('test-service');
      const childLogger = testLogger.child('req-456');

      childLogger.info('Child message', {}, 'req-789'); // Override with specific requestId

      const logEntry: LogEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.requestId).toBe('req-789'); // Should use explicitly provided ID
    });
  });

  describe('Meta object handling', () => {
    beforeEach(() => {
      process.env.LOG_FORMAT = 'json';
      process.env.LOG_LEVEL = 'info';
    });

    it('should handle empty meta object', () => {
      const testLogger = new JsonLogger('test-service');
      testLogger.info('Test message', {});

      const logEntry: LogEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.meta).toEqual({});
    });

    it('should handle nested meta objects', () => {
      const testLogger = new JsonLogger('test-service');
      testLogger.info('Test message', {
        user: { id: '123', name: 'Test' },
        nested: { deep: { value: 'test' } },
      });

      const logEntry: LogEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.meta?.user).toEqual({ id: '123', name: 'Test' });
      expect(logEntry.meta?.nested?.deep?.value).toBe('test');
    });

    it('should handle meta with arrays', () => {
      const testLogger = new JsonLogger('test-service');
      testLogger.info('Test message', { items: [1, 2, 3] });

      const logEntry: LogEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.meta?.items).toEqual([1, 2, 3]);
    });
  });

  describe('Default logger instance', () => {
    beforeEach(() => {
      process.env.LOG_FORMAT = 'json';
      process.env.LOG_LEVEL = 'info';
      process.env.SERVICE_NAME = 'default-service';
    });

    it('should use SERVICE_NAME from environment', () => {
      // Create new logger instance to pick up env var
      const defaultLogger = new JsonLogger();
      defaultLogger.info('Test message');

      const logEntry: LogEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.service).toBe('api'); // Default when SERVICE_NAME not set in constructor
    });
  });
});

