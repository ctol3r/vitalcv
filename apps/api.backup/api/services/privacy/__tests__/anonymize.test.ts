/**
 * B150A-DSAR-005: Unit tests for anonymization helpers
 */

import {
  anonymizeName,
  anonymizeEmail,
  anonymizePhone,
  anonymizeFreeText,
  anonymizeFreeTextDeterministic,
  anonymizeDid,
  anonymizeNpi,
  isAnonymized,
  hashForAudit,
} from '../anonymize';

describe('Anonymization Helpers', () => {
  describe('anonymizeName', () => {
    it('should anonymize a name deterministically', () => {
      const name = 'John Doe';
      const result1 = anonymizeName(name);
      const result2 = anonymizeName(name);

      expect(result1).toBe(result2); // Deterministic
      expect(result1).not.toBe(name);
      expect(result1).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/); // Format check
    });

    it('should use seed for different anonymization', () => {
      const name = 'John Doe';
      const result1 = anonymizeName(name, 'seed1');
      const result2 = anonymizeName(name, 'seed2');

      expect(result1).not.toBe(result2);
    });

    it('should handle empty name', () => {
      expect(anonymizeName('')).toBe('[REDACTED]');
      expect(anonymizeName('   ')).toBe('[REDACTED]');
    });
  });

  describe('anonymizeEmail', () => {
    it('should anonymize an email deterministically', () => {
      const email = 'john.doe@example.com';
      const result1 = anonymizeEmail(email);
      const result2 = anonymizeEmail(email);

      expect(result1).toBe(result2); // Deterministic
      expect(result1).toMatch(/^[a-f0-9]+@anonymous\.local$/);
    });

    it('should use seed for different anonymization', () => {
      const email = 'john.doe@example.com';
      const result1 = anonymizeEmail(email, 'seed1');
      const result2 = anonymizeEmail(email, 'seed2');

      expect(result1).not.toBe(result2);
    });

    it('should handle empty email', () => {
      expect(anonymizeEmail('')).toBe('[REDACTED]@example.com');
    });
  });

  describe('anonymizePhone', () => {
    it('should anonymize a phone number deterministically', () => {
      const phone = '555-123-4567';
      const result1 = anonymizePhone(phone);
      const result2 = anonymizePhone(phone);

      expect(result1).toBe(result2); // Deterministic
      expect(result1).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
    });

    it('should handle various phone formats', () => {
      const formats = [
        '555-123-4567',
        '(555) 123-4567',
        '5551234567',
        '+1 555-123-4567',
      ];

      formats.forEach(phone => {
        const result = anonymizePhone(phone);
        expect(result).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
      });
    });

    it('should handle empty phone', () => {
      expect(anonymizePhone('')).toBe('[REDACTED]');
    });
  });

  describe('anonymizeFreeText', () => {
    it('should replace email addresses', () => {
      const text = 'Contact me at john@example.com';
      const result = anonymizeFreeText(text);

      expect(result).toContain('[EMAIL_REDACTED]');
      expect(result).not.toContain('john@example.com');
    });

    it('should replace phone numbers', () => {
      const text = 'Call me at 555-123-4567';
      const result = anonymizeFreeText(text);

      expect(result).toContain('[PHONE_REDACTED]');
      expect(result).not.toContain('555-123-4567');
    });

    it('should replace SSN patterns', () => {
      const text = 'SSN: 123-45-6789';
      const result = anonymizeFreeText(text);

      expect(result).toContain('[SSN_REDACTED]');
      expect(result).not.toContain('123-45-6789');
    });

    it('should handle empty text', () => {
      expect(anonymizeFreeText('')).toBe('[REDACTED]');
    });
  });

  describe('anonymizeFreeTextDeterministic', () => {
    it('should anonymize text deterministically', () => {
      const text = 'This is some text';
      const result1 = anonymizeFreeTextDeterministic(text);
      const result2 = anonymizeFreeTextDeterministic(text);

      expect(result1).toBe(result2); // Deterministic
      expect(result1).not.toBe(text);
    });

    it('should use seed for different anonymization', () => {
      const text = 'This is some text';
      const result1 = anonymizeFreeTextDeterministic(text, 'seed1');
      const result2 = anonymizeFreeTextDeterministic(text, 'seed2');

      expect(result1).not.toBe(result2);
    });
  });

  describe('anonymizeDid', () => {
    it('should anonymize a DID', () => {
      const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
      const result = anonymizeDid(did);

      expect(result).toMatch(/^did:key:[a-f0-9]{32}$/);
      expect(result).not.toContain('z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK');
    });

    it('should preserve DID method', () => {
      const did = 'did:web:example.com';
      const result = anonymizeDid(did);

      expect(result).toMatch(/^did:web:/);
    });
  });

  describe('anonymizeNpi', () => {
    it('should anonymize an NPI', () => {
      const npi = '1234567890';
      const result = anonymizeNpi(npi);

      expect(result).toMatch(/^\d{10}$/);
      expect(result).not.toBe(npi);
      expect(result[0]).not.toBe('0'); // NPI cannot start with 0
    });

    it('should handle formatted NPI', () => {
      const npi = '123-456-7890';
      const result = anonymizeNpi(npi);

      expect(result).toMatch(/^\d{10}$/);
    });
  });

  describe('isAnonymized', () => {
    it('should detect anonymized values', () => {
      expect(isAnonymized('[REDACTED]')).toBe(true);
      expect(isAnonymized('[EMAIL_REDACTED]')).toBe(true);
      expect(isAnonymized('test@anonymous.local')).toBe(true);
      expect(isAnonymized('john@example.com')).toBe(false);
      expect(isAnonymized('John Doe')).toBe(false);
    });
  });

  describe('hashForAudit', () => {
    it('should generate consistent hash', () => {
      const value = 'test value';
      const hash1 = hashForAudit(value);
      const hash2 = hashForAudit(value);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash
    });

    it('should use salt for different hashes', () => {
      const value = 'test value';
      const hash1 = hashForAudit(value, 'salt1');
      const hash2 = hashForAudit(value, 'salt2');

      expect(hash1).not.toBe(hash2);
    });
  });
});

