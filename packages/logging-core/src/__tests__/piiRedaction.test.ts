/**
 * Tests for PII Redaction
 */

import { describe, it, expect } from 'vitest';
import { redactPII, getDefaultPiiFields, isPii } from '../piiRedaction';

describe('PII Redaction', () => {
  describe('redactPII', () => {
    it('should redact NPI field', () => {
      const input = { name: 'Dr. Smith', npi: '1234567890', age: 45 };
      const result = redactPII(input);

      expect(result).toEqual({
        name: 'Dr. Smith',
        npi: '[REDACTED]',
        age: 45,
      });
    });

    it('should redact multiple PII fields', () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        phone_number: '555-1234',
        ssn: '123-45-6789',
        occupation: 'Doctor',
      };

      const result = redactPII(input);

      expect(result).toEqual({
        name: 'John Doe',
        email: '[REDACTED]',
        phone_number: '[REDACTED]',
        ssn: '[REDACTED]',
        occupation: 'Doctor',
      });
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: 'Jane Doe',
          npi: '9876543210',
        },
        metadata: {
          timestamp: Date.now(),
        },
      };

      const result = redactPII(input);

      expect(result).toEqual({
        user: {
          name: 'Jane Doe',
          npi: '[REDACTED]',
        },
        metadata: {
          timestamp: expect.any(Number),
        },
      });
    });

    it('should handle arrays', () => {
      const input = {
        users: [
          { name: 'Alice', npi: '1111111111' },
          { name: 'Bob', license_number: 'ABC123' },
        ],
      };

      const result = redactPII(input);

      expect(result).toEqual({
        users: [
          { name: 'Alice', npi: '[REDACTED]' },
          { name: 'Bob', license_number: '[REDACTED]' },
        ],
      });
    });

    it('should redact additional custom fields', () => {
      const input = {
        name: 'Test User',
        customField: 'sensitive-data',
      };

      const result = redactPII(input, ['customField']);

      expect(result).toEqual({
        name: 'Test User',
        customField: '[REDACTED]',
      });
    });

    it('should handle null and undefined', () => {
      const input = {
        name: 'Test',
        npi: null,
        email: undefined,
      };

      const result = redactPII(input);

      expect(result).toEqual({
        name: 'Test',
        npi: null,
        email: undefined,
      });
    });

    it('should preserve Date objects', () => {
      const now = new Date();
      const input = {
        timestamp: now,
        npi: '1234567890',
      };

      const result = redactPII(input);

      expect(result).toEqual({
        timestamp: now,
        npi: '[REDACTED]',
      });
    });
  });

  describe('getDefaultPiiFields', () => {
    it('should return array of default PII fields', () => {
      const fields = getDefaultPiiFields();

      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields).toContain('npi');
      expect(fields).toContain('email');
      expect(fields).toContain('ssn');
    });
  });

  describe('isPii', () => {
    it('should identify PII fields', () => {
      expect(isPii('npi')).toBe(true);
      expect(isPii('email')).toBe(true);
      expect(isPii('ssn')).toBe(true);
      expect(isPii('license_number')).toBe(true);
    });

    it('should not identify non-PII fields', () => {
      expect(isPii('name')).toBe(false);
      expect(isPii('age')).toBe(false);
      expect(isPii('occupation')).toBe(false);
    });

    it('should handle custom PII fields', () => {
      expect(isPii('customField', ['customField'])).toBe(true);
      expect(isPii('otherField', ['customField'])).toBe(false);
    });
  });
});
