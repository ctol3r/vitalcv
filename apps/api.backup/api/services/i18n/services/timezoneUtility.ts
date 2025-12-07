/**
 * B241A-I18N-005: TimezoneUtility
 *
 * Provides conversion between timezones
 * Returns lists of supported zones with offsets
 * Given a datetime and user zone, returns display and storage formats
 * Tested for daylight savings
 */

import { DateTime, IANAZone } from 'luxon';

export interface TimezoneInfo {
  name: string;
  offset: string; // e.g., "+05:30", "-08:00"
  offsetMinutes: number;
  abbreviation?: string;
  isDST: boolean;
}

export interface DateTimeFormat {
  display: string; // User-friendly format
  storage: string; // ISO 8601 for storage
  timestamp: number; // Unix timestamp
}

/**
 * TimezoneUtility
 *
 * Handles timezone conversions and formatting
 */
export class TimezoneUtility {
  /**
   * Get list of all supported timezones with current offsets
   */
  getSupportedTimezones(): TimezoneInfo[] {
    const zones = IANAZone.create('UTC').isValid
      ? Intl.supportedValuesOf('timeZone')
      : [];

    return zones.map((zoneName) => {
      const zone = IANAZone.create(zoneName);
      const now = DateTime.now().setZone(zone);

      return {
        name: zoneName,
        offset: now.toFormat('ZZZZ'),
        offsetMinutes: now.offset,
        abbreviation: now.toFormat('ZZZ'),
        isDST: now.isInDST || false,
      };
    });
  }

  /**
   * Get timezone info for a specific zone
   */
  getTimezoneInfo(zoneName: string): TimezoneInfo | null {
    try {
      const zone = IANAZone.create(zoneName);
      if (!zone.isValid) {
        return null;
      }

      const now = DateTime.now().setZone(zone);

      return {
        name: zoneName,
        offset: now.toFormat('ZZZZ'),
        offsetMinutes: now.offset,
        abbreviation: now.toFormat('ZZZ'),
        isDST: now.isInDST || false,
      };
    } catch {
      return null;
    }
  }

  /**
   * Convert datetime from one timezone to another
   */
  convertTimezone(
    dateTime: Date | string | number,
    fromZone: string,
    toZone: string
  ): DateTime {
    const dt = this.toDateTime(dateTime, fromZone);
    return dt.setZone(toZone);
  }

  /**
   * Format datetime for display and storage
   */
  formatDateTime(
    dateTime: Date | string | number,
    userZone: string,
    displayFormat?: string
  ): DateTimeFormat {
    const dt = this.toDateTime(dateTime, userZone);
    const format = displayFormat || 'yyyy-MM-dd HH:mm:ss ZZZZ';

    return {
      display: dt.toFormat(format),
      storage: dt.toISO() || '',
      timestamp: dt.toMillis(),
    };
  }

  /**
   * Get current time in a specific timezone
   */
  getCurrentTime(zone: string): DateTimeFormat {
    const dt = DateTime.now().setZone(zone);
    return {
      display: dt.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
      storage: dt.toISO() || '',
      timestamp: dt.toMillis(),
    };
  }

  /**
   * Convert UTC timestamp to user timezone
   */
  fromUTC(timestamp: number, userZone: string): DateTimeFormat {
    const dt = DateTime.fromMillis(timestamp, { zone: 'utc' }).setZone(userZone);
    return {
      display: dt.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
      storage: dt.toISO() || '',
      timestamp: dt.toMillis(),
    };
  }

  /**
   * Convert user timezone to UTC
   */
  toUTC(dateTime: Date | string | number, userZone: string): DateTimeFormat {
    const dt = this.toDateTime(dateTime, userZone);
    const utc = dt.toUTC();

    return {
      display: utc.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
      storage: utc.toISO() || '',
      timestamp: utc.toMillis(),
    };
  }

  /**
   * Check if a timezone is valid
   */
  isValidTimezone(zone: string): boolean {
    try {
      const z = IANAZone.create(zone);
      return z.isValid;
    } catch {
      return false;
    }
  }

  /**
   * Get offset difference between two timezones (in minutes)
   */
  getOffsetDifference(zone1: string, zone2: string): number | null {
    try {
      const dt1 = DateTime.now().setZone(zone1);
      const dt2 = DateTime.now().setZone(zone2);
      return dt2.offset - dt1.offset;
    } catch {
      return null;
    }
  }

  /**
   * Check if a date is in daylight saving time for a zone
   */
  isDST(dateTime: Date | string | number, zone: string): boolean {
    const dt = this.toDateTime(dateTime, zone);
    return dt.isInDST || false;
  }

  /**
   * Helper: Convert various input types to DateTime
   */
  private toDateTime(
    dateTime: Date | string | number,
    zone: string
  ): DateTime {
    if (dateTime instanceof Date) {
      return DateTime.fromJSDate(dateTime).setZone(zone);
    }
    if (typeof dateTime === 'number') {
      return DateTime.fromMillis(dateTime).setZone(zone);
    }
    return DateTime.fromISO(dateTime).setZone(zone);
  }
}

