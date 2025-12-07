/**
 * B241A-I18N-006: AddressFormatter
 *
 * Formats addresses according to country-specific standards
 * Inputs: street, city, region, postalCode, countryCode
 * Outputs correctly ordered and punctuated string
 * Includes test cases for multiple regions
 */

export interface AddressInput {
  street: string;
  city: string;
  region?: string; // State, province, etc.
  postalCode?: string;
  countryCode: string; // ISO 3166-1 alpha-2
}

export interface AddressOutput {
  formatted: string;
  lines: string[]; // Address lines for multi-line display
  countryCode: string;
}

/**
 * AddressFormatter
 *
 * Formats addresses according to country-specific standards
 */
export class AddressFormatter {
  /**
   * Format address for a country
   */
  formatAddress(input: AddressInput): AddressOutput {
    const formatter = this.getFormatter(input.countryCode);
    return formatter(input);
  }

  /**
   * Get formatter function for a country
   */
  private getFormatter(
    countryCode: string
  ): (input: AddressInput) => AddressOutput {
    const code = countryCode.toUpperCase();

    switch (code) {
      case 'US':
      case 'CA':
        return this.formatNorthAmerican;
      case 'GB':
      case 'IE':
        return this.formatUK;
      case 'DE':
      case 'AT':
      case 'CH':
        return this.formatGerman;
      case 'FR':
      case 'BE':
      case 'LU':
        return this.formatFrench;
      case 'ES':
      case 'PT':
      case 'IT':
        return this.formatSouthernEuropean;
      case 'JP':
        return this.formatJapanese;
      case 'CN':
        return this.formatChinese;
      case 'IN':
        return this.formatIndian;
      default:
        return this.formatInternational;
    }
  }

  /**
   * North American format (US, Canada)
   * Street
   * City, Region PostalCode
   * Country
   */
  private formatNorthAmerican(input: AddressInput): AddressOutput {
    const lines: string[] = [input.street];

    const cityLine = [
      input.city,
      input.region,
      input.postalCode,
    ]
      .filter(Boolean)
      .join(', ');

    if (cityLine) {
      lines.push(cityLine);
    }

    return {
      formatted: lines.join('\n'),
      lines,
      countryCode: input.countryCode,
    };
  }

  /**
   * UK format
   * Street
   * City
   * Region
   * PostalCode
   * Country
   */
  private formatUK(input: AddressInput): AddressOutput {
    const lines: string[] = [input.street];

    if (input.city) lines.push(input.city);
    if (input.region) lines.push(input.region);
    if (input.postalCode) lines.push(input.postalCode);

    return {
      formatted: lines.join('\n'),
      lines,
      countryCode: input.countryCode,
    };
  }

  /**
   * German format
   * Street
   * PostalCode City
   * Country
   */
  private formatGerman(input: AddressInput): AddressOutput {
    const lines: string[] = [input.street];

    const cityLine = [input.postalCode, input.city]
      .filter(Boolean)
      .join(' ');

    if (cityLine) {
      lines.push(cityLine);
    }

    if (input.region) {
      lines.push(input.region);
    }

    return {
      formatted: lines.join('\n'),
      lines,
      countryCode: input.countryCode,
    };
  }

  /**
   * French format
   * Street
   * PostalCode City
   * Country
   */
  private formatFrench(input: AddressInput): AddressOutput {
    const lines: string[] = [input.street];

    const cityLine = [input.postalCode, input.city]
      .filter(Boolean)
      .join(' ');

    if (cityLine) {
      lines.push(cityLine);
    }

    return {
      formatted: lines.join('\n'),
      lines,
      countryCode: input.countryCode,
    };
  }

  /**
   * Southern European format (Spain, Portugal, Italy)
   * Street
   * PostalCode City, Region
   * Country
   */
  private formatSouthernEuropean(input: AddressInput): AddressOutput {
    const lines: string[] = [input.street];

    const cityLine = [
      input.postalCode,
      input.city,
      input.region,
    ]
      .filter(Boolean)
      .join(' ');

    if (cityLine) {
      lines.push(cityLine);
    }

    return {
      formatted: lines.join('\n'),
      lines,
      countryCode: input.countryCode,
    };
  }

  /**
   * Japanese format
   * PostalCode
   * Region City
   * Street
   * Country
   */
  private formatJapanese(input: AddressInput): AddressOutput {
    const lines: string[] = [];

    if (input.postalCode) {
      lines.push(`〒${input.postalCode}`);
    }

    const regionCity = [input.region, input.city]
      .filter(Boolean)
      .join(' ');

    if (regionCity) {
      lines.push(regionCity);
    }

    if (input.street) {
      lines.push(input.street);
    }

    return {
      formatted: lines.join('\n'),
      lines,
      countryCode: input.countryCode,
    };
  }

  /**
   * Chinese format
   * Country Region City
   * Street
   * PostalCode
   */
  private formatChinese(input: AddressInput): AddressOutput {
    const lines: string[] = [];

    const locationLine = [
      input.countryCode,
      input.region,
      input.city,
    ]
      .filter(Boolean)
      .join(' ');

    if (locationLine) {
      lines.push(locationLine);
    }

    if (input.street) {
      lines.push(input.street);
    }

    if (input.postalCode) {
      lines.push(input.postalCode);
    }

    return {
      formatted: lines.join('\n'),
      lines,
      countryCode: input.countryCode,
    };
  }

  /**
   * Indian format
   * Street
   * City, Region PostalCode
   * Country
   */
  private formatIndian(input: AddressInput): AddressOutput {
    const lines: string[] = [input.street];

    const cityLine = [
      input.city,
      input.region,
      input.postalCode,
    ]
      .filter(Boolean)
      .join(' ');

    if (cityLine) {
      lines.push(cityLine);
    }

    return {
      formatted: lines.join('\n'),
      lines,
      countryCode: input.countryCode,
    };
  }

  /**
   * International format (default)
   * Street
   * City, Region PostalCode
   * Country
   */
  private formatInternational(input: AddressInput): AddressOutput {
    const lines: string[] = [input.street];

    const cityLine = [
      input.city,
      input.region,
      input.postalCode,
    ]
      .filter(Boolean)
      .join(', ');

    if (cityLine) {
      lines.push(cityLine);
    }

    return {
      formatted: lines.join('\n'),
      lines,
      countryCode: input.countryCode,
    };
  }
}

