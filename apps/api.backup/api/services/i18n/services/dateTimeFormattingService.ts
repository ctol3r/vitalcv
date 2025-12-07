/**
 * B241B-I18N-018: DateTimeFormattingService
 *
 * Formats dates and times according to locale-specific patterns:
 * - DD/MM/YYYY vs MM/DD/YYYY
 * - 24-hour vs 12-hour
 * - Includes relative time strings (e.g., 'yesterday', 'in 5 days')
 */

export interface DateTimeFormatOptions {
  dateStyle?: 'short' | 'medium' | 'long' | 'full';
  timeStyle?: 'short' | 'medium' | 'long' | 'full';
  timeZone?: string;
  hour12?: boolean;
  showTime?: boolean;
  showDate?: boolean;
  relative?: boolean;
}

export interface LocaleDateTimeFormat {
  dateFormat: string;
  timeFormat: string;
  dateTimeFormat: string;
  hour12: boolean;
  firstDayOfWeek: 0 | 1; // 0 = Sunday, 1 = Monday
}

/**
 * DateTime formatting service
 * Formats dates and times according to locale-specific conventions
 */
export class DateTimeFormattingService {
  private localeFormats: Record<string, LocaleDateTimeFormat> = {
    'en-US': {
      dateFormat: 'MM/DD/YYYY',
      timeFormat: 'hh:mm A',
      dateTimeFormat: 'MM/DD/YYYY, hh:mm A',
      hour12: true,
      firstDayOfWeek: 0,
    },
    'en-GB': {
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm',
      dateTimeFormat: 'DD/MM/YYYY, HH:mm',
      hour12: false,
      firstDayOfWeek: 1,
    },
    'es-ES': {
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm',
      dateTimeFormat: 'DD/MM/YYYY, HH:mm',
      hour12: false,
      firstDayOfWeek: 1,
    },
    'es-MX': {
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'hh:mm A',
      dateTimeFormat: 'DD/MM/YYYY, hh:mm A',
      hour12: true,
      firstDayOfWeek: 0,
    },
    'fr-FR': {
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm',
      dateTimeFormat: 'DD/MM/YYYY, HH:mm',
      hour12: false,
      firstDayOfWeek: 1,
    },
    'de-DE': {
      dateFormat: 'DD.MM.YYYY',
      timeFormat: 'HH:mm',
      dateTimeFormat: 'DD.MM.YYYY, HH:mm',
      hour12: false,
      firstDayOfWeek: 1,
    },
    'ja-JP': {
      dateFormat: 'YYYY/MM/DD',
      timeFormat: 'HH:mm',
      dateTimeFormat: 'YYYY/MM/DD, HH:mm',
      hour12: false,
      firstDayOfWeek: 0,
    },
    'zh-CN': {
      dateFormat: 'YYYY/MM/DD',
      timeFormat: 'HH:mm',
      dateTimeFormat: 'YYYY/MM/DD, HH:mm',
      hour12: false,
      firstDayOfWeek: 1,
    },
    'pt-BR': {
      dateFormat: 'DD/MM/YYYY',
      timeFormat: 'HH:mm',
      dateTimeFormat: 'DD/MM/YYYY, HH:mm',
      hour12: false,
      firstDayOfWeek: 0,
    },
  };

  /**
   * Format a date
   */
  formatDate(
    date: Date,
    locale: string,
    options?: DateTimeFormatOptions
  ): string {
    const format = this.getLocaleFormat(locale);
    const opts = {
      showDate: true,
      showTime: false,
      relative: false,
      ...options,
    };

    if (opts.relative) {
      return this.formatRelativeDate(date, locale);
    }

    if (!opts.showDate) {
      return '';
    }

    return this.formatDateWithPattern(date, format.dateFormat, format.hour12);
  }

  /**
   * Format a time
   */
  formatTime(
    date: Date,
    locale: string,
    options?: DateTimeFormatOptions
  ): string {
    const format = this.getLocaleFormat(locale);
    const opts = {
      showTime: true,
      showDate: false,
      hour12: format.hour12,
      ...options,
    };

    if (!opts.showTime) {
      return '';
    }

    return this.formatTimeWithPattern(date, format.timeFormat, opts.hour12 ?? format.hour12);
  }

  /**
   * Format a date and time
   */
  formatDateTime(
    date: Date,
    locale: string,
    options?: DateTimeFormatOptions
  ): string {
    const format = this.getLocaleFormat(locale);
    const opts = {
      showDate: true,
      showTime: true,
      relative: false,
      hour12: format.hour12,
      ...options,
    };

    if (opts.relative) {
      return this.formatRelativeDateTime(date, locale);
    }

    const parts: string[] = [];

    if (opts.showDate) {
      parts.push(this.formatDateWithPattern(date, format.dateFormat, opts.hour12 ?? format.hour12));
    }

    if (opts.showTime) {
      parts.push(this.formatTimeWithPattern(date, format.timeFormat, opts.hour12 ?? format.hour12));
    }

    return parts.join(', ');
  }

  /**
   * Format relative date (e.g., "yesterday", "in 5 days")
   */
  formatRelativeDate(date: Date, locale: string): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    const relativeStrings = this.getRelativeStrings(locale);

    // Past
    if (diffDays === -1) {
      return relativeStrings.yesterday;
    }
    if (diffDays < -1 && diffDays >= -7) {
      return relativeStrings.daysAgo.replace('{count}', Math.abs(diffDays).toString());
    }
    if (diffDays < -7) {
      return this.formatDateWithPattern(date, this.getLocaleFormat(locale).dateFormat, false);
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
    if (diffDays > 7) {
      return this.formatDateWithPattern(date, this.getLocaleFormat(locale).dateFormat, false);
    }

    return this.formatDateWithPattern(date, this.getLocaleFormat(locale).dateFormat, false);
  }

  /**
   * Format relative date and time
   */
  formatRelativeDateTime(date: Date, locale: string): string {
    const relativeDate = this.formatRelativeDate(date, locale);
    const format = this.getLocaleFormat(locale);
    const time = this.formatTimeWithPattern(date, format.timeFormat, format.hour12);
    return `${relativeDate}, ${time}`;
  }

  /**
   * Format date with pattern
   */
  private formatDateWithPattern(date: Date, pattern: string, hour12: boolean): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return pattern
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('YY', String(year).slice(-2));
  }

  /**
   * Format time with pattern
   */
  private formatTimeWithPattern(date: Date, pattern: string, hour12: boolean): string {
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

    return pattern
      .replace('HH', String(date.getHours()).padStart(2, '0'))
      .replace('hh', hoursStr)
      .replace('mm', minutes)
      .replace('ss', seconds)
      .replace('A', ampm)
      .replace('a', ampm.toLowerCase());
  }

  /**
   * Get locale format
   */
  private getLocaleFormat(locale: string): LocaleDateTimeFormat {
    const format = this.localeFormats[locale];
    if (!format) {
      console.warn(`Unknown locale: ${locale}, using en-US format`);
      return this.localeFormats['en-US'];
    }
    return format;
  }

  /**
   * Get relative time strings for locale
   */
  private getRelativeStrings(locale: string): Record<string, string> {
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
      'de-DE': {
        justNow: 'gerade eben',
        minuteAgo: 'vor einer Minute',
        minutesAgo: 'vor {count} Minuten',
        hourAgo: 'vor einer Stunde',
        hoursAgo: 'vor {count} Stunden',
        yesterday: 'gestern',
        daysAgo: 'vor {count} Tagen',
        tomorrow: 'morgen',
        inDays: 'in {count} Tagen',
      },
    };

    return strings[locale] || strings['en-US'];
  }

  /**
   * Register or update locale format
   */
  registerLocaleFormat(locale: string, format: LocaleDateTimeFormat): void {
    this.localeFormats[locale] = format;
  }

  /**
   * Get all supported locales
   */
  getSupportedLocales(): string[] {
    return Object.keys(this.localeFormats);
  }
}

