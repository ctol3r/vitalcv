/**
 * B252B-I18N-014: DateTimeFormatService
 *
 * Formats dates and times according to locale settings:
 * - Supports various date/time patterns
 * - Timezone conversion via Timezone model
 * - Includes unit tests
 */

import { PrismaClient } from '@prisma/client';

export interface DateTimeFormatOptions {
  dateStyle?: 'short' | 'medium' | 'long' | 'full';
  timeStyle?: 'short' | 'medium' | 'long' | 'full';
  timeZone?: string;
  hour12?: boolean;
  showTime?: boolean;
  showDate?: boolean;
  relative?: boolean;
}

export interface FormattedDateTime {
  formatted: string;
  dateFormatted?: string;
  timeFormatted?: string;
  timezone: string;
  offsetMinutes: number;
}

/**
 * DateTimeFormatService
 *
 * Service for formatting dates and times according to locale and timezone settings
 */
export class DateTimeFormatService {
  private timezoneCache: Map<string, any> = new Map();

  constructor(private prisma: PrismaClient) {}

  /**
   * Format date and time according to locale
   */
  async formatDateTime(
    date: Date,
    languageCode: string,
    options: DateTimeFormatOptions = {}
  ): Promise<FormattedDateTime> {
    const {
      dateStyle = 'medium',
      timeStyle = 'short',
      timeZone,
      hour12,
      showTime = true,
      showDate = true,
      relative = false,
    } = options;

    // Get timezone
    const timezone = await this.getTimezone(timeZone || 'UTC', languageCode);

    // Convert date to timezone
    const convertedDate = this.convertToTimezone(date, timezone);

    // Get locale format patterns
    const localeFormat = this.getLocaleFormat(languageCode);

    // Format date
    let dateFormatted: string | undefined;
    if (showDate) {
      if (relative) {
        dateFormatted = this.formatRelativeDate(convertedDate, languageCode);
      } else {
        dateFormatted = this.formatDateWithStyle(convertedDate, dateStyle, localeFormat);
      }
    }

    // Format time
    let timeFormatted: string | undefined;
    if (showTime) {
      timeFormatted = this.formatTimeWithStyle(
        convertedDate,
        timeStyle,
        localeFormat,
        hour12 ?? localeFormat.hour12
      );
    }

    // Combine
    const formatted = [dateFormatted, timeFormatted].filter(Boolean).join(', ');

    return {
      formatted,
      dateFormatted,
      timeFormatted,
      timezone: timezone.name,
      offsetMinutes: timezone.offsetMinutes,
    };
  }

  /**
   * Format date only
   */
  async formatDate(
    date: Date,
    languageCode: string,
    options: Omit<DateTimeFormatOptions, 'showTime' | 'timeStyle'> = {}
  ): Promise<string> {
    const result = await this.formatDateTime(date, languageCode, {
      ...options,
      showTime: false,
    });
    return result.dateFormatted || result.formatted;
  }

  /**
   * Format time only
   */
  async formatTime(
    date: Date,
    languageCode: string,
    options: Omit<DateTimeFormatOptions, 'showDate' | 'dateStyle'> = {}
  ): Promise<string> {
    const result = await this.formatDateTime(date, languageCode, {
      ...options,
      showDate: false,
    });
    return result.timeFormatted || result.formatted;
  }

  /**
   * Get timezone from database (with caching)
   */
  private async getTimezone(timezoneName: string, languageCode: string) {
    const cacheKey = `timezone:${timezoneName}`;

    if (this.timezoneCache.has(cacheKey)) {
      return this.timezoneCache.get(cacheKey);
    }

    // Try to get from database
    let timezone = await this.prisma.timezone.findUnique({
      where: { name: timezoneName },
    });

    // If not found, try to get user's timezone from locale settings
    if (!timezone) {
      const userSettings = await this.getUserLocaleSettings(languageCode);
      if (userSettings?.timezone) {
        timezone = userSettings.timezone;
      }
    }

    // Fallback to UTC
    if (!timezone) {
      timezone = {
        id: 'utc',
        name: 'UTC',
        offsetMinutes: 0,
        observesDST: false,
        region: 'UTC',
      };
    }

    // Cache for 1 hour
    this.timezoneCache.set(cacheKey, timezone);
    setTimeout(() => this.timezoneCache.delete(cacheKey), 3600000);

    return timezone;
  }

  /**
   * Get user locale settings by language code
   */
  private async getUserLocaleSettings(languageCode: string) {
    try {
      const language = await this.prisma.translationLanguage.findUnique({
        where: { languageCode },
        include: {
          userLocaleSettings: {
            include: {
              timezone: true,
            },
            take: 1,
          },
        },
      });

      return language?.userLocaleSettings?.[0] || null;
    } catch (error) {
      console.error('Error fetching user locale settings:', error);
      return null;
    }
  }

  /**
   * Convert date to timezone
   */
  private convertToTimezone(date: Date, timezone: any): Date {
    // Calculate offset in milliseconds
    const offsetMs = timezone.offsetMinutes * 60 * 1000;

    // Get UTC time
    const utcTime = date.getTime();

    // Apply offset
    const localTime = new Date(utcTime + offsetMs);

    return localTime;
  }

  /**
   * Get locale format patterns
   */
  private getLocaleFormat(languageCode: string) {
    const formats: Record<string, any> = {
      'en-US': {
        dateFormat: 'MM/DD/YYYY',
        timeFormat: 'hh:mm A',
        hour12: true,
        firstDayOfWeek: 0,
      },
      'en-GB': {
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
        hour12: false,
        firstDayOfWeek: 1,
      },
      'es-ES': {
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
        hour12: false,
        firstDayOfWeek: 1,
      },
      'fr-FR': {
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
        hour12: false,
        firstDayOfWeek: 1,
      },
      'de-DE': {
        dateFormat: 'DD.MM.YYYY',
        timeFormat: 'HH:mm',
        hour12: false,
        firstDayOfWeek: 1,
      },
    };

    return formats[languageCode] || formats['en-US'];
  }

  /**
   * Format date with style
   */
  private formatDateWithStyle(date: Date, style: string, localeFormat: any): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const pattern = localeFormat.dateFormat;

    return pattern
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('YY', String(year).slice(-2));
  }

  /**
   * Format time with style
   */
  private formatTimeWithStyle(
    date: Date,
    style: string,
    localeFormat: any,
    hour12: boolean
  ): string {
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    let ampm = '';

    if (hour12) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) {
        hours = 12;
      }
    }

    const hoursStr = String(hours).padStart(2, '0');
    const pattern = localeFormat.timeFormat;

    return pattern
      .replace('HH', String(date.getHours()).padStart(2, '0'))
      .replace('hh', hoursStr)
      .replace('mm', minutes)
      .replace('ss', seconds)
      .replace('A', ampm)
      .replace('a', ampm.toLowerCase());
  }

  /**
   * Format relative date (e.g., "yesterday", "in 5 days")
   */
  private formatRelativeDate(date: Date, languageCode: string): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    const relativeStrings = this.getRelativeStrings(languageCode);

    // Past
    if (diffDays === -1) {
      return relativeStrings.yesterday;
    }
    if (diffDays < -1 && diffDays >= -7) {
      return relativeStrings.daysAgo.replace('{count}', Math.abs(diffDays).toString());
    }

    // Today
    if (diffDays === 0) {
      if (diffHours === 0) {
        if (diffMinutes === 0) {
          return relativeStrings.justNow;
        }
        if (diffMinutes === 1) {
          return relativeStrings.minuteAgo;
        }
        if (diffMinutes < 60) {
          return relativeStrings.minutesAgo.replace('{count}', diffMinutes.toString());
        }
      }
      if (diffHours === 1) {
        return relativeStrings.hourAgo;
      }
      if (diffHours < 24) {
        return relativeStrings.hoursAgo.replace('{count}', diffHours.toString());
      }
    }

    // Future
    if (diffDays === 1) {
      return relativeStrings.tomorrow;
    }
    if (diffDays > 1 && diffDays <= 7) {
      return relativeStrings.inDays.replace('{count}', diffDays.toString());
    }

    // Fallback to formatted date
    const localeFormat = this.getLocaleFormat(languageCode);
    return this.formatDateWithStyle(date, 'medium', localeFormat);
  }

  /**
   * Get relative time strings for locale
   */
  private getRelativeStrings(languageCode: string): Record<string, string> {
    const strings: Record<string, Record<string, string>> = {
      'en-US': {
        justNow: 'just now',
        minuteAgo: 'a minute ago',
        minutesAgo: '{count} minutes ago',
        hourAgo: 'an hour ago',
        hoursAgo: '{count} hours ago',
        yesterday: 'yesterday',
        daysAgo: '{count} days ago',
        tomorrow: 'tomorrow',
        inDays: 'in {count} days',
      },
      'es-ES': {
        justNow: 'ahora mismo',
        minuteAgo: 'hace un minuto',
        minutesAgo: 'hace {count} minutos',
        hourAgo: 'hace una hora',
        hoursAgo: 'hace {count} horas',
        yesterday: 'ayer',
        daysAgo: 'hace {count} días',
        tomorrow: 'mañana',
        inDays: 'en {count} días',
      },
      'fr-FR': {
        justNow: 'à l\'instant',
        minuteAgo: 'il y a une minute',
        minutesAgo: 'il y a {count} minutes',
        hourAgo: 'il y a une heure',
        hoursAgo: 'il y a {count} heures',
        yesterday: 'hier',
        daysAgo: 'il y a {count} jours',
        tomorrow: 'demain',
        inDays: 'dans {count} jours',
      },
    };

    return strings[languageCode] || strings['en-US'];
  }

  /**
   * Get all supported timezones
   */
  async getSupportedTimezones(): Promise<Array<{ name: string; offsetMinutes: number; region: string }>> {
    const timezones = await this.prisma.timezone.findMany({
      select: {
        name: true,
        offsetMinutes: true,
        region: true,
      },
      orderBy: { offsetMinutes: 'asc' },
    });

    return timezones;
  }
}

