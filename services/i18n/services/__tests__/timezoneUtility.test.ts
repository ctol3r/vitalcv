/**
 * B241A-I18N-005: TimezoneUtility tests
 */

import { TimezoneUtility } from '../timezoneUtility';

describe('TimezoneUtility', () => {
  let utility: TimezoneUtility;

  beforeEach(() => {
    utility = new TimezoneUtility();
  });

  describe('getSupportedTimezones', () => {
    it('should return list of timezones', () => {
      const timezones = utility.getSupportedTimezones();
      expect(timezones.length).toBeGreaterThan(0);
      expect(timezones[0]).toHaveProperty('name');
      expect(timezones[0]).toHaveProperty('offset');
    });
  });

  describe('getTimezoneInfo', () => {
    it('should get timezone info', () => {
      const info = utility.getTimezoneInfo('America/New_York');
      expect(info).toBeDefined();
      expect(info?.name).toBe('America/New_York');
    });

    it('should return null for invalid timezone', () => {
      const info = utility.getTimezoneInfo('Invalid/Timezone');
      expect(info).toBeNull();
    });
  });

  describe('convertTimezone', () => {
    it('should convert between timezones', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const converted = utility.convertTimezone(
        date,
        'UTC',
        'America/New_York'
      );

      expect(converted).toBeDefined();
      expect(converted.zoneName).toBe('America/New_York');
    });
  });

  describe('formatDateTime', () => {
    it('should format datetime for display and storage', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      const formatted = utility.formatDateTime(date, 'America/New_York');

      expect(formatted).toHaveProperty('display');
      expect(formatted).toHaveProperty('storage');
      expect(formatted).toHaveProperty('timestamp');
    });
  });

  describe('isDST', () => {
    it('should detect daylight saving time', () => {
      const summer = new Date('2024-07-01T12:00:00Z');
      const winter = new Date('2024-01-01T12:00:00Z');

      const summerDST = utility.isDST(summer, 'America/New_York');
      const winterDST = utility.isDST(winter, 'America/New_York');

      expect(summerDST).toBe(true);
      expect(winterDST).toBe(false);
    });
  });
});

