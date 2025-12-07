/**
 * B241B-I18N-019: NumberFormattingService
 *
 * Formats numbers with locale-specific conventions:
 * - Thousands separators
 * - Decimal points
 * - Grouping conventions
 * - Configurable for scientific notation or percent display
 * - Tested with multiple locales
 */

export interface NumberFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  notation?: 'standard' | 'scientific' | 'percent';
  signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero';
}

export interface LocaleNumberFormat {
  decimalSeparator: string;
  thousandsSeparator: string;
  groupingSize: number;
  secondaryGroupingSize?: number;
  percentSymbol: string;
  minusSign: string;
  plusSign: string;
}

/**
 * Number formatting service
 * Formats numbers according to locale-specific conventions
 */
export class NumberFormattingService {
  private localeFormats: Record<string, LocaleNumberFormat> = {
    'en-US': {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      groupingSize: 3,
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
    'en-GB': {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      groupingSize: 3,
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
    'es-ES': {
      decimalSeparator: ',',
      thousandsSeparator: '.',
      groupingSize: 3,
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
    'es-MX': {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      groupingSize: 3,
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
    'fr-FR': {
      decimalSeparator: ',',
      thousandsSeparator: ' ',
      groupingSize: 3,
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
    'de-DE': {
      decimalSeparator: ',',
      thousandsSeparator: '.',
      groupingSize: 3,
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
    'ja-JP': {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      groupingSize: 3,
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
    'zh-CN': {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      groupingSize: 3,
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
    'pt-BR': {
      decimalSeparator: ',',
      thousandsSeparator: '.',
      groupingSize: 3,
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
    'hi-IN': {
      decimalSeparator: '.',
      thousandsSeparator: ',',
      groupingSize: 3,
      secondaryGroupingSize: 2, // Indian numbering system
      percentSymbol: '%',
      minusSign: '-',
      plusSign: '+',
    },
  };

  /**
   * Format a number
   */
  format(
    value: number,
    locale: string,
    options?: NumberFormatOptions
  ): string {
    const format = this.getLocaleFormat(locale);
    const opts: Required<NumberFormatOptions> = {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
      useGrouping: true,
      notation: 'standard',
      signDisplay: 'auto',
      ...options,
    };

    // Handle special notations
    if (opts.notation === 'percent') {
      return this.formatPercent(value, locale, opts);
    }

    if (opts.notation === 'scientific') {
      return this.formatScientific(value, opts);
    }

    // Standard formatting
    return this.formatStandard(value, format, opts);
  }

  /**
   * Format as percent
   */
  private formatPercent(
    value: number,
    locale: string,
    options: Required<NumberFormatOptions>
  ): string {
    const format = this.getLocaleFormat(locale);
    const percentValue = value * 100;
    const formatted = this.formatStandard(percentValue, format, {
      ...options,
      notation: 'standard',
    });
    return `${formatted}${format.percentSymbol}`;
  }

  /**
   * Format in scientific notation
   */
  private formatScientific(
    value: number,
    options: Required<NumberFormatOptions>
  ): string {
    if (value === 0) {
      return '0';
    }

    const sign = value < 0 ? '-' : '';
    const absValue = Math.abs(value);
    const exponent = Math.floor(Math.log10(absValue));
    const mantissa = absValue / Math.pow(10, exponent);

    const formattedMantissa = mantissa.toFixed(options.maximumFractionDigits);
    return `${sign}${formattedMantissa}e${exponent >= 0 ? '+' : ''}${exponent}`;
  }

  /**
   * Format in standard notation
   */
  private formatStandard(
    value: number,
    format: LocaleNumberFormat,
    options: Required<NumberFormatOptions>
  ): string {
    // Handle sign
    const isNegative = value < 0;
    const absValue = Math.abs(value);
    let sign = '';

    if (options.signDisplay === 'always') {
      sign = isNegative ? format.minusSign : format.plusSign;
    } else if (options.signDisplay === 'exceptZero' && value !== 0) {
      sign = isNegative ? format.minusSign : format.plusSign;
    } else if (options.signDisplay === 'never') {
      // No sign
    } else if (isNegative) {
      sign = format.minusSign;
    }

    // Round to appropriate decimal places
    const rounded = this.roundToDecimalPlaces(absValue, options.maximumFractionDigits);

    // Split into integer and decimal parts
    const parts = rounded.toString().split('.');
    let integerPart = parts[0];
    let decimalPart = parts[1] || '';

    // Apply grouping
    if (options.useGrouping) {
      integerPart = this.applyGrouping(
        integerPart,
        format.thousandsSeparator,
        format.groupingSize,
        format.secondaryGroupingSize
      );
    }

    // Format decimal part
    if (options.minimumFractionDigits > 0 || decimalPart) {
      decimalPart = decimalPart.padEnd(options.minimumFractionDigits, '0').slice(0, options.maximumFractionDigits);
    }

    // Combine
    let result = integerPart;
    if (decimalPart) {
      result += format.decimalSeparator + decimalPart;
    } else if (options.minimumFractionDigits > 0) {
      result += format.decimalSeparator + '0'.repeat(options.minimumFractionDigits);
    }

    return sign + result;
  }

  /**
   * Apply thousands grouping
   */
  private applyGrouping(
    number: string,
    separator: string,
    groupingSize: number,
    secondaryGroupingSize?: number
  ): string {
    // Handle negative numbers
    const isNegative = number.startsWith('-');
    const digits = isNegative ? number.slice(1) : number;

    // For Indian numbering system (secondary grouping)
    if (secondaryGroupingSize) {
      let grouped = '';
      let count = 0;
      let useSecondary = false;

      for (let i = digits.length - 1; i >= 0; i--) {
        if (count > 0) {
          if (useSecondary && count % secondaryGroupingSize === 0) {
            grouped = separator + grouped;
          } else if (!useSecondary && count % groupingSize === 0) {
            grouped = separator + grouped;
            if (count === groupingSize) {
              useSecondary = true;
            }
          }
        }
        grouped = digits[i] + grouped;
        count++;
      }

      return isNegative ? '-' + grouped : grouped;
    }

    // Standard grouping
    let grouped = '';
    let count = 0;

    for (let i = digits.length - 1; i >= 0; i--) {
      if (count > 0 && count % groupingSize === 0) {
        grouped = separator + grouped;
      }
      grouped = digits[i] + grouped;
      count++;
    }

    return isNegative ? '-' + grouped : grouped;
  }

  /**
   * Round to specified decimal places
   */
  private roundToDecimalPlaces(value: number, decimalPlaces: number): number {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(value * factor) / factor;
  }

  /**
   * Parse a formatted number string
   */
  parse(formattedValue: string, locale: string): number {
    const format = this.getLocaleFormat(locale);

    // Remove percent symbol if present
    let cleaned = formattedValue.replace(format.percentSymbol, '').trim();

    // Handle sign
    const isNegative = cleaned.startsWith(format.minusSign);
    if (isNegative) {
      cleaned = cleaned.replace(format.minusSign, '');
    }

    // Remove thousands separators
    cleaned = cleaned.replace(
      new RegExp(`\\${format.thousandsSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
      ''
    );

    // Replace decimal separator with dot
    cleaned = cleaned.replace(format.decimalSeparator, '.');

    const parsed = parseFloat(cleaned);
    if (isNaN(parsed)) {
      throw new Error(`Failed to parse number: ${formattedValue}`);
    }

    // If percent was present, divide by 100
    if (formattedValue.includes(format.percentSymbol)) {
      return (isNegative ? -1 : 1) * parsed / 100;
    }

    return isNegative ? -parsed : parsed;
  }

  /**
   * Get locale format
   */
  private getLocaleFormat(locale: string): LocaleNumberFormat {
    const format = this.localeFormats[locale];
    if (!format) {
      console.warn(`Unknown locale: ${locale}, using en-US format`);
      return this.localeFormats['en-US'];
    }
    return format;
  }

  /**
   * Register or update locale format
   */
  registerLocaleFormat(locale: string, format: LocaleNumberFormat): void {
    this.localeFormats[locale] = format;
  }

  /**
   * Get all supported locales
   */
  getSupportedLocales(): string[] {
    return Object.keys(this.localeFormats);
  }
}

