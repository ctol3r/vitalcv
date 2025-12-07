/**
 * B241A-I18N-007: PhoneNumberFormatter tests
 */

import { PhoneNumberFormatter } from '../phoneNumberFormatter';

describe('PhoneNumberFormatter', () => {
  let formatter: PhoneNumberFormatter;

  beforeEach(() => {
    formatter = new PhoneNumberFormatter();
  });

  describe('formatPhoneNumber', () => {
    it('should format US phone number', () => {
      const result = formatter.formatPhoneNumber({
        number: '4155552671',
        countryCode: 'US',
      });

      expect(result.e164).toContain('+1');
      expect(result.international).toBeDefined();
      expect(result.national).toBeDefined();
    });

    it('should format international number', () => {
      const result = formatter.formatPhoneNumber({
        number: '+34612345678',
        countryCode: 'ES',
      });

      expect(result.e164).toContain('+34');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate correct phone number', () => {
      const isValid = formatter.validatePhoneNumber('4155552671', 'US');
      expect(isValid).toBe(true);
    });

    it('should reject invalid phone number', () => {
      const isValid = formatter.validatePhoneNumber('123', 'US');
      expect(isValid).toBe(false);
    });
  });

  describe('normalizeToE164', () => {
    it('should normalize to E.164 format', () => {
      const e164 = formatter.normalizeToE164({
        number: '4155552671',
        countryCode: 'US',
      });

      expect(e164).toContain('+1');
      expect(e164?.length).toBeGreaterThan(10);
    });
  });
});

