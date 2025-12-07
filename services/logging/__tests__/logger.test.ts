/**
 * B146C-SEC-001: Unit tests for PHI filtering in logger
 */

import { createLogger } from '../logger';

describe('Logger PHI Filtering', () => {
  const logger = createLogger({ service: 'test' });

  // Mock console methods to capture output
  const originalConsole = { ...console };
  let logOutput: any[] = [];

  beforeEach(() => {
    logOutput = [];
    console.info = jest.fn((...args) => logOutput.push(args));
    console.error = jest.fn((...args) => logOutput.push(args));
    console.warn = jest.fn((...args => logOutput.push(args)));
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });

  it('should redact name fields from logs', () => {
    logger.info('User action', { name: 'John Doe', userId: '123' });

    const logEntry = JSON.parse(logOutput[0][0]);
    expect(logEntry.meta.name).toBe('[REDACTED:8chars]');
    expect(logEntry.meta.userId).toBe('123'); // Non-PHI field preserved
  });

  it('should redact birthDate fields', () => {
    logger.info('Patient record', { birthDate: '1990-01-01', status: 'active' });

    const logEntry = JSON.parse(logOutput[0][0]);
    expect(logEntry.meta.birthDate).toBe('[REDACTED:10chars]');
    expect(logEntry.meta.status).toBe('active');
  });

  it('should redact address fields', () => {
    logger.info('Address update', {
      address: '123 Main St',
      city: 'Springfield',
      zipCode: '12345'
    });

    const logEntry = JSON.parse(logOutput[0][0]);
    expect(logEntry.meta.address).toBe('[REDACTED:12chars]');
    expect(logEntry.meta.city).toBe('[REDACTED:11chars]');
    expect(logEntry.meta.zipCode).toBe('[REDACTED:5chars]');
  });

  it('should redact diagnosis fields', () => {
    logger.info('Medical record', { diagnosis: 'Diabetes Type 2', code: 'E11' });

    const logEntry = JSON.parse(logOutput[0][0]);
    expect(logEntry.meta.diagnosis).toBe('[REDACTED:15chars]');
    expect(logEntry.meta.code).toBe('E11'); // Non-PHI field preserved
  });

  it('should handle nested objects', () => {
    logger.info('Nested data', {
      patient: {
        name: 'Jane Doe',
        birthDate: '1985-05-15',
        metadata: {
          userId: '456'
        }
      }
    });

    const logEntry = JSON.parse(logOutput[0][0]);
    expect(logEntry.meta.patient.name).toBe('[REDACTED:8chars]');
    expect(logEntry.meta.patient.birthDate).toBe('[REDACTED:10chars]');
    expect(logEntry.meta.patient.metadata.userId).toBe('456');
  });

  it('should handle arrays', () => {
    logger.info('Multiple patients', {
      patients: [
        { name: 'Patient 1', id: '1' },
        { name: 'Patient 2', id: '2' }
      ]
    });

    const logEntry = JSON.parse(logOutput[0][0]);
    expect(logEntry.meta.patients[0].name).toBe('[REDACTED:9chars]');
    expect(logEntry.meta.patients[0].id).toBe('1');
    expect(logEntry.meta.patients[1].name).toBe('[REDACTED:9chars]');
  });

  it('should preserve non-PHI fields', () => {
    logger.info('Safe data', {
      userId: '123',
      timestamp: '2025-01-01',
      action: 'login',
      count: 42
    });

    const logEntry = JSON.parse(logOutput[0][0]);
    expect(logEntry.meta.userId).toBe('123');
    expect(logEntry.meta.timestamp).toBe('2025-01-01');
    expect(logEntry.meta.action).toBe('login');
    expect(logEntry.meta.count).toBe(42);
  });

  it('should handle case-insensitive field matching', () => {
    logger.info('Case variants', {
      Name: 'John',
      BIRTHDATE: '1990-01-01',
      Address: '123 Main St'
    });

    const logEntry = JSON.parse(logOutput[0][0]);
    expect(logEntry.meta.Name).toBe('[REDACTED:4chars]');
    expect(logEntry.meta.BIRTHDATE).toBe('[REDACTED:10chars]');
    expect(logEntry.meta.Address).toBe('[REDACTED:12chars]');
  });
});
