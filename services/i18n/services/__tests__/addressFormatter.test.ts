/**
 * B241A-I18N-006: AddressFormatter tests
 */

import { AddressFormatter } from '../addressFormatter';

describe('AddressFormatter', () => {
  let formatter: AddressFormatter;

  beforeEach(() => {
    formatter = new AddressFormatter();
  });

  describe('formatAddress', () => {
    it('should format US address', () => {
      const result = formatter.formatAddress({
        street: '123 Main St',
        city: 'San Francisco',
        region: 'CA',
        postalCode: '94102',
        countryCode: 'US',
      });

      expect(result.formatted).toContain('123 Main St');
      expect(result.formatted).toContain('San Francisco');
      expect(result.lines.length).toBeGreaterThan(0);
    });

    it('should format UK address', () => {
      const result = formatter.formatAddress({
        street: '10 Downing Street',
        city: 'London',
        region: 'England',
        postalCode: 'SW1A 2AA',
        countryCode: 'GB',
      });

      expect(result.formatted).toContain('10 Downing Street');
      expect(result.formatted).toContain('London');
    });

    it('should format German address', () => {
      const result = formatter.formatAddress({
        street: 'Unter den Linden 1',
        city: 'Berlin',
        postalCode: '10117',
        countryCode: 'DE',
      });

      expect(result.formatted).toContain('Unter den Linden 1');
      expect(result.formatted).toContain('10117');
    });

    it('should format Japanese address', () => {
      const result = formatter.formatAddress({
        street: '1-1-1 Chiyoda',
        city: 'Tokyo',
        region: 'Tokyo',
        postalCode: '100-0001',
        countryCode: 'JP',
      });

      expect(result.formatted).toContain('〒');
      expect(result.formatted).toContain('100-0001');
    });
  });
});

