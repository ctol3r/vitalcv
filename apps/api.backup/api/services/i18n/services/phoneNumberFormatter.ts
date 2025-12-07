/**
 * B241A-I18N-007: PhoneNumberFormatter
 *
 * Normalises and formats phone numbers using international and national formats
 * Validates numbers per country
 * Returns E.164 for storage and locale-specific display
 */

import {
  parsePhoneNumber,
  formatIncompletePhoneNumber,
  getCountries,
  CountryCode,
  AsYouType,
  isValidPhoneNumber,
} from 'libphonenumber-js';

export interface PhoneNumberInput {
  number: string;
  countryCode?: CountryCode; // ISO 3166-1 alpha-2
}

export interface PhoneNumberOutput {
  e164: string; // E.164 format for storage (e.g., +14155552671)
  international: string; // International format (e.g., +1 415-555-2671)
  national: string; // National format (e.g., (415) 555-2671)
  countryCode: CountryCode | undefined;
  isValid: boolean;
  type?: 'MOBILE' | 'FIXED_LINE' | 'FIXED_LINE_OR_MOBILE' | 'VOIP' | 'UNKNOWN';
}

/**
 * PhoneNumberFormatter
 *
 * Formats and validates phone numbers
 */
export class PhoneNumberFormatter {
  /**
   * Format phone number
   */
  formatPhoneNumber(input: PhoneNumberInput): PhoneNumberOutput {
    try {
      const phoneNumber = parsePhoneNumber(input.number, input.countryCode);

      return {
        e164: phoneNumber.number,
        international: phoneNumber.formatInternational(),
        national: phoneNumber.formatNational(),
        countryCode: phoneNumber.country,
        isValid: phoneNumber.isValid(),
        type: phoneNumber.getType(),
      };
    } catch (error) {
      // Invalid number, return what we can
      const asYouType = new AsYouType(input.countryCode);
      const partial = asYouType.input(input.number);

      return {
        e164: '',
        international: partial || input.number,
        national: partial || input.number,
        countryCode: input.countryCode,
        isValid: false,
      };
    }
  }

  /**
   * Validate phone number
   */
  validatePhoneNumber(number: string, countryCode?: CountryCode): boolean {
    return isValidPhoneNumber(number, countryCode);
  }

  /**
   * Normalize phone number to E.164
   */
  normalizeToE164(input: PhoneNumberInput): string | null {
    try {
      const phoneNumber = parsePhoneNumber(input.number, input.countryCode);
      return phoneNumber.isValid() ? phoneNumber.number : null;
    } catch {
      return null;
    }
  }

  /**
   * Format as you type (for input fields)
   */
  formatAsYouType(number: string, countryCode?: CountryCode): string {
    const asYouType = new AsYouType(countryCode);
    return asYouType.input(number);
  }

  /**
   * Get country code from phone number
   */
  getCountryCode(number: string): CountryCode | undefined {
    try {
      const phoneNumber = parsePhoneNumber(number);
      return phoneNumber.country;
    } catch {
      return undefined;
    }
  }

  /**
   * Get all supported countries
   */
  getSupportedCountries(): CountryCode[] {
    return getCountries();
  }

  /**
   * Check if country code is supported
   */
  isCountrySupported(countryCode: CountryCode): boolean {
    return getCountries().includes(countryCode);
  }

  /**
   * Format for display based on locale
   */
  formatForLocale(
    number: string,
    locale: string,
    countryCode?: CountryCode
  ): string {
    try {
      const phoneNumber = parsePhoneNumber(number, countryCode);

      // Extract country from locale (e.g., "en-US" -> "US")
      const localeCountry = locale.split('-')[1] as CountryCode | undefined;
      const displayCountry = localeCountry || countryCode;

      if (displayCountry && phoneNumber.country === displayCountry) {
        return phoneNumber.formatNational();
      }

      return phoneNumber.formatInternational();
    } catch {
      return number;
    }
  }
}

