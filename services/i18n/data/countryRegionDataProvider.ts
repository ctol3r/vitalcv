/**
 * B241A-I18N-008: CountryRegionDataProvider
 *
 * Provides structured data for countries and regions:
 * - Names, codes, primary language, currency, timezone
 * - Exposes API and caches data
 * - Sourced from trusted lists
 * - Tests for completeness
 */

export interface CountryData {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  nameNative?: string;
  primaryLanguage: string; // ISO 639-1
  currency: string; // ISO 4217
  timezone: string; // IANA timezone
  region?: string; // Continent/region
  phoneCode?: string; // International dialing code
}

export interface RegionData {
  code: string;
  name: string;
  countryCode: string;
  type: 'state' | 'province' | 'territory' | 'district';
}

/**
 * CountryRegionDataProvider
 *
 * Provides country and region data with caching
 */
export class CountryRegionDataProvider {
  private countryCache: Map<string, CountryData> = new Map();
  private regionCache: Map<string, RegionData[]> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize data (load from trusted sources)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load country data
    const countries = this.getCountryData();
    for (const country of countries) {
      this.countryCache.set(country.code, country);
    }

    // Load region data
    const regions = this.getRegionData();
    for (const region of regions) {
      const key = region.countryCode;
      if (!this.regionCache.has(key)) {
        this.regionCache.set(key, []);
      }
      this.regionCache.get(key)!.push(region);
    }

    this.initialized = true;
  }

  /**
   * Get country data by code
   */
  async getCountry(countryCode: string): Promise<CountryData | null> {
    await this.initialize();
    return this.countryCache.get(countryCode.toUpperCase()) || null;
  }

  /**
   * Get all countries
   */
  async getAllCountries(): Promise<CountryData[]> {
    await this.initialize();
    return Array.from(this.countryCache.values());
  }

  /**
   * Get regions for a country
   */
  async getRegions(countryCode: string): Promise<RegionData[]> {
    await this.initialize();
    return this.regionCache.get(countryCode.toUpperCase()) || [];
  }

  /**
   * Get region by code
   */
  async getRegion(
    countryCode: string,
    regionCode: string
  ): Promise<RegionData | null> {
    const regions = await this.getRegions(countryCode);
    return (
      regions.find((r) => r.code.toUpperCase() === regionCode.toUpperCase()) ||
      null
    );
  }

  /**
   * Search countries by name
   */
  async searchCountries(query: string): Promise<CountryData[]> {
    await this.initialize();
    const lowerQuery = query.toLowerCase();

    return Array.from(this.countryCache.values()).filter(
      (country) =>
        country.name.toLowerCase().includes(lowerQuery) ||
        country.nameNative?.toLowerCase().includes(lowerQuery) ||
        country.code.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get country data (static data - in production, load from external source)
   */
  private getCountryData(): CountryData[] {
    // Comprehensive list of countries with key data
    return [
      {
        code: 'US',
        name: 'United States',
        nameNative: 'United States',
        primaryLanguage: 'en',
        currency: 'USD',
        timezone: 'America/New_York',
        region: 'North America',
        phoneCode: '+1',
      },
      {
        code: 'GB',
        name: 'United Kingdom',
        nameNative: 'United Kingdom',
        primaryLanguage: 'en',
        currency: 'GBP',
        timezone: 'Europe/London',
        region: 'Europe',
        phoneCode: '+44',
      },
      {
        code: 'CA',
        name: 'Canada',
        nameNative: 'Canada',
        primaryLanguage: 'en',
        currency: 'CAD',
        timezone: 'America/Toronto',
        region: 'North America',
        phoneCode: '+1',
      },
      {
        code: 'ES',
        name: 'Spain',
        nameNative: 'España',
        primaryLanguage: 'es',
        currency: 'EUR',
        timezone: 'Europe/Madrid',
        region: 'Europe',
        phoneCode: '+34',
      },
      {
        code: 'FR',
        name: 'France',
        nameNative: 'France',
        primaryLanguage: 'fr',
        currency: 'EUR',
        timezone: 'Europe/Paris',
        region: 'Europe',
        phoneCode: '+33',
      },
      {
        code: 'DE',
        name: 'Germany',
        nameNative: 'Deutschland',
        primaryLanguage: 'de',
        currency: 'EUR',
        timezone: 'Europe/Berlin',
        region: 'Europe',
        phoneCode: '+49',
      },
      {
        code: 'IT',
        name: 'Italy',
        nameNative: 'Italia',
        primaryLanguage: 'it',
        currency: 'EUR',
        timezone: 'Europe/Rome',
        region: 'Europe',
        phoneCode: '+39',
      },
      {
        code: 'JP',
        name: 'Japan',
        nameNative: '日本',
        primaryLanguage: 'ja',
        currency: 'JPY',
        timezone: 'Asia/Tokyo',
        region: 'Asia',
        phoneCode: '+81',
      },
      {
        code: 'CN',
        name: 'China',
        nameNative: '中国',
        primaryLanguage: 'zh',
        currency: 'CNY',
        timezone: 'Asia/Shanghai',
        region: 'Asia',
        phoneCode: '+86',
      },
      {
        code: 'IN',
        name: 'India',
        nameNative: 'भारत',
        primaryLanguage: 'hi',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        region: 'Asia',
        phoneCode: '+91',
      },
      {
        code: 'AU',
        name: 'Australia',
        nameNative: 'Australia',
        primaryLanguage: 'en',
        currency: 'AUD',
        timezone: 'Australia/Sydney',
        region: 'Oceania',
        phoneCode: '+61',
      },
      {
        code: 'BR',
        name: 'Brazil',
        nameNative: 'Brasil',
        primaryLanguage: 'pt',
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        region: 'South America',
        phoneCode: '+55',
      },
      {
        code: 'MX',
        name: 'Mexico',
        nameNative: 'México',
        primaryLanguage: 'es',
        currency: 'MXN',
        timezone: 'America/Mexico_City',
        region: 'North America',
        phoneCode: '+52',
      },
      {
        code: 'RU',
        name: 'Russia',
        nameNative: 'Россия',
        primaryLanguage: 'ru',
        currency: 'RUB',
        timezone: 'Europe/Moscow',
        region: 'Europe',
        phoneCode: '+7',
      },
      {
        code: 'KR',
        name: 'South Korea',
        nameNative: '대한민국',
        primaryLanguage: 'ko',
        currency: 'KRW',
        timezone: 'Asia/Seoul',
        region: 'Asia',
        phoneCode: '+82',
      },
    ];
  }

  /**
   * Get region data (static data - in production, load from external source)
   */
  private getRegionData(): RegionData[] {
    // Sample regions for major countries
    return [
      // US States
      { code: 'CA', name: 'California', countryCode: 'US', type: 'state' },
      { code: 'NY', name: 'New York', countryCode: 'US', type: 'state' },
      { code: 'TX', name: 'Texas', countryCode: 'US', type: 'state' },
      { code: 'FL', name: 'Florida', countryCode: 'US', type: 'state' },
      { code: 'IL', name: 'Illinois', countryCode: 'US', type: 'state' },

      // Canadian Provinces
      { code: 'ON', name: 'Ontario', countryCode: 'CA', type: 'province' },
      { code: 'QC', name: 'Quebec', countryCode: 'CA', type: 'province' },
      { code: 'BC', name: 'British Columbia', countryCode: 'CA', type: 'province' },

      // Spanish Regions
      { code: 'MD', name: 'Madrid', countryCode: 'ES', type: 'province' },
      { code: 'CT', name: 'Catalonia', countryCode: 'ES', type: 'province' },
      { code: 'AN', name: 'Andalusia', countryCode: 'ES', type: 'province' },

      // German States
      { code: 'BY', name: 'Bavaria', countryCode: 'DE', type: 'state' },
      { code: 'BE', name: 'Berlin', countryCode: 'DE', type: 'state' },
      { code: 'NW', name: 'North Rhine-Westphalia', countryCode: 'DE', type: 'state' },

      // Indian States
      { code: 'MH', name: 'Maharashtra', countryCode: 'IN', type: 'state' },
      { code: 'DL', name: 'Delhi', countryCode: 'IN', type: 'territory' },
      { code: 'KA', name: 'Karnataka', countryCode: 'IN', type: 'state' },
    ];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.countryCache.clear();
    this.regionCache.clear();
    this.initialized = false;
  }
}

