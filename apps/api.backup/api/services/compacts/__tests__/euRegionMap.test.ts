/**
 * B139A-INTL-005: Tests for EUDI Region Mapping
 */

import {
  mapCountryToRegion,
  isEeaCountry,
  isEudiEligible,
  hasEudiPilot,
  getCountryName,
  getEeaCountries,
  getEeaCountriesWithNames,
  isValidCountryCode,
  getEudiIssuanceRegion,
  getRegulatoryFramework,
  getEudiCountryMetadata,
  batchMapCountriesToRegions,
  filterEudiEligible,
  EEA_COUNTRY_CODES,
  EUDI_PILOT_COUNTRIES,
} from '../euRegionMap';
import { Region } from '../../org/models/TenantRegion';

describe('EUDI Region Mapping', () => {
  describe('mapCountryToRegion', () => {
    it('should map EU member states to EU region', () => {
      expect(mapCountryToRegion('DE')).toBe(Region.EU); // Germany
      expect(mapCountryToRegion('FR')).toBe(Region.EU); // France
      expect(mapCountryToRegion('IT')).toBe(Region.EU); // Italy
      expect(mapCountryToRegion('ES')).toBe(Region.EU); // Spain
      expect(mapCountryToRegion('NL')).toBe(Region.EU); // Netherlands
    });

    it('should map EFTA states to EU region', () => {
      expect(mapCountryToRegion('NO')).toBe(Region.EU); // Norway
      expect(mapCountryToRegion('IS')).toBe(Region.EU); // Iceland
      expect(mapCountryToRegion('LI')).toBe(Region.EU); // Liechtenstein
    });

    it('should map Switzerland to EU region', () => {
      expect(mapCountryToRegion('CH')).toBe(Region.EU); // Switzerland
    });

    it('should map US to US region', () => {
      expect(mapCountryToRegion('US')).toBe(Region.US);
    });

    it('should map Australia to AU region', () => {
      expect(mapCountryToRegion('AU')).toBe(Region.AU);
    });

    it('should map New Zealand to AU region', () => {
      expect(mapCountryToRegion('NZ')).toBe(Region.AU);
    });

    it('should be case insensitive', () => {
      expect(mapCountryToRegion('de')).toBe(Region.EU);
      expect(mapCountryToRegion('De')).toBe(Region.EU);
      expect(mapCountryToRegion('DE')).toBe(Region.EU);
    });

    it('should default to US for unknown countries', () => {
      expect(mapCountryToRegion('XX')).toBe(Region.US);
    });
  });

  describe('isEeaCountry', () => {
    it('should return true for EU member states', () => {
      expect(isEeaCountry('DE')).toBe(true);
      expect(isEeaCountry('FR')).toBe(true);
      expect(isEeaCountry('IT')).toBe(true);
    });

    it('should return true for EFTA states', () => {
      expect(isEeaCountry('NO')).toBe(true);
      expect(isEeaCountry('IS')).toBe(true);
      expect(isEeaCountry('LI')).toBe(true);
    });

    it('should return true for Switzerland', () => {
      expect(isEeaCountry('CH')).toBe(true);
    });

    it('should return false for non-EEA countries', () => {
      expect(isEeaCountry('US')).toBe(false);
      expect(isEeaCountry('AU')).toBe(false);
      expect(isEeaCountry('CA')).toBe(false);
      expect(isEeaCountry('JP')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isEeaCountry('de')).toBe(true);
      expect(isEeaCountry('us')).toBe(false);
    });
  });

  describe('isEudiEligible', () => {
    it('should return true for EEA countries', () => {
      expect(isEudiEligible('DE')).toBe(true);
      expect(isEudiEligible('FR')).toBe(true);
      expect(isEudiEligible('NO')).toBe(true);
    });

    it('should return false for non-EEA countries', () => {
      expect(isEudiEligible('US')).toBe(false);
      expect(isEudiEligible('AU')).toBe(false);
      expect(isEudiEligible('GB')).toBe(false); // UK post-Brexit
    });
  });

  describe('hasEudiPilot', () => {
    it('should return true for pilot countries', () => {
      expect(hasEudiPilot('DE')).toBe(true); // Germany
      expect(hasEudiPilot('ES')).toBe(true); // Spain
      expect(hasEudiPilot('FR')).toBe(true); // France
      expect(hasEudiPilot('IT')).toBe(true); // Italy
    });

    it('should return false for non-pilot countries', () => {
      expect(hasEudiPilot('US')).toBe(false);
      expect(hasEudiPilot('FI')).toBe(false); // Finland (EU but no pilot yet)
    });
  });

  describe('getCountryName', () => {
    it('should return country name for valid codes', () => {
      expect(getCountryName('DE')).toBe('Germany');
      expect(getCountryName('FR')).toBe('France');
      expect(getCountryName('IT')).toBe('Italy');
      expect(getCountryName('ES')).toBe('Spain');
    });

    it('should return undefined for unknown codes', () => {
      expect(getCountryName('XX')).toBeUndefined();
    });

    it('should be case insensitive', () => {
      expect(getCountryName('de')).toBe('Germany');
      expect(getCountryName('De')).toBe('Germany');
    });
  });

  describe('getEeaCountries', () => {
    it('should return array of country codes', () => {
      const countries = getEeaCountries();

      expect(Array.isArray(countries)).toBe(true);
      expect(countries.length).toBeGreaterThan(20);
      expect(countries).toContain('DE');
      expect(countries).toContain('FR');
      expect(countries).toContain('NO');
    });

    it('should return a copy of the array', () => {
      const countries1 = getEeaCountries();
      const countries2 = getEeaCountries();

      expect(countries1).not.toBe(countries2); // Different array instances
      expect(countries1).toEqual(countries2); // Same content
    });
  });

  describe('getEeaCountriesWithNames', () => {
    it('should return array of objects with code and name', () => {
      const countries = getEeaCountriesWithNames();

      expect(Array.isArray(countries)).toBe(true);
      expect(countries.length).toBe(EEA_COUNTRY_CODES.length);

      const germany = countries.find(c => c.code === 'DE');
      expect(germany).toEqual({ code: 'DE', name: 'Germany' });
    });
  });

  describe('isValidCountryCode', () => {
    it('should return true for valid 2-letter codes', () => {
      expect(isValidCountryCode('DE')).toBe(true);
      expect(isValidCountryCode('US')).toBe(true);
      expect(isValidCountryCode('FR')).toBe(true);
    });

    it('should return true for lowercase codes', () => {
      expect(isValidCountryCode('de')).toBe(true);
      expect(isValidCountryCode('us')).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(isValidCountryCode('DEU')).toBe(false); // 3 letters
      expect(isValidCountryCode('D')).toBe(false); // 1 letter
      expect(isValidCountryCode('123')).toBe(false); // Numbers
      expect(isValidCountryCode('D1')).toBe(false); // Mixed
    });
  });

  describe('getEudiIssuanceRegion', () => {
    it('should return EU region for EUDI-eligible countries', () => {
      expect(getEudiIssuanceRegion('DE')).toBe(Region.EU);
      expect(getEudiIssuanceRegion('FR')).toBe(Region.EU);
      expect(getEudiIssuanceRegion('NO')).toBe(Region.EU);
    });

    it('should throw error for non-EUDI-eligible countries', () => {
      expect(() => getEudiIssuanceRegion('US')).toThrow(
        /not eligible for EUDI Wallet/
      );
      expect(() => getEudiIssuanceRegion('AU')).toThrow(
        /not eligible for EUDI Wallet/
      );
    });

    it('should throw error for invalid country codes', () => {
      expect(() => getEudiIssuanceRegion('XXX')).toThrow(/Invalid country code format/);
      expect(() => getEudiIssuanceRegion('1')).toThrow(/Invalid country code format/);
    });
  });

  describe('getRegulatoryFramework', () => {
    it('should return GDPR + eIDAS for EEA countries', () => {
      const framework = getRegulatoryFramework('DE');
      expect(framework).toContain('GDPR');
      expect(framework).toContain('eIDAS');
    });

    it('should return HIPAA + TEFCA for US', () => {
      const framework = getRegulatoryFramework('US');
      expect(framework).toContain('HIPAA');
      expect(framework).toContain('TEFCA');
    });

    it('should return Privacy Act for AU', () => {
      const framework = getRegulatoryFramework('AU');
      expect(framework).toContain('Privacy Act');
    });

    it('should return Unknown for unrecognized countries', () => {
      const framework = getRegulatoryFramework('XX');
      expect(framework).toBe('Unknown');
    });
  });

  describe('getEudiCountryMetadata', () => {
    it('should return complete metadata for EEA country', () => {
      const metadata = getEudiCountryMetadata('DE');

      expect(metadata).toEqual({
        countryCode: 'DE',
        countryName: 'Germany',
        region: Region.EU,
        eudiEligible: true,
        hasPilot: true,
        regulatoryFramework: expect.stringContaining('GDPR'),
      });
    });

    it('should return metadata for non-EUDI country', () => {
      const metadata = getEudiCountryMetadata('US');

      expect(metadata.countryCode).toBe('US');
      expect(metadata.region).toBe(Region.US);
      expect(metadata.eudiEligible).toBe(false);
      expect(metadata.hasPilot).toBe(false);
    });

    it('should handle unknown country codes', () => {
      const metadata = getEudiCountryMetadata('XX');

      expect(metadata.countryCode).toBe('XX');
      expect(metadata.countryName).toBe('Unknown');
      expect(metadata.regulatoryFramework).toBe('Unknown');
    });
  });

  describe('batchMapCountriesToRegions', () => {
    it('should map multiple countries to regions', () => {
      const countries = ['DE', 'FR', 'US', 'AU', 'ES'];
      const regionMap = batchMapCountriesToRegions(countries);

      expect(regionMap.size).toBe(5);
      expect(regionMap.get('DE')).toBe(Region.EU);
      expect(regionMap.get('FR')).toBe(Region.EU);
      expect(regionMap.get('US')).toBe(Region.US);
      expect(regionMap.get('AU')).toBe(Region.AU);
      expect(regionMap.get('ES')).toBe(Region.EU);
    });

    it('should skip invalid country codes', () => {
      const countries = ['DE', 'XXX', 'US', '123'];
      const regionMap = batchMapCountriesToRegions(countries);

      expect(regionMap.size).toBe(2); // Only DE and US
      expect(regionMap.has('XXX')).toBe(false);
      expect(regionMap.has('123')).toBe(false);
    });

    it('should normalize country codes to uppercase', () => {
      const countries = ['de', 'fr', 'us'];
      const regionMap = batchMapCountriesToRegions(countries);

      expect(regionMap.get('DE')).toBe(Region.EU);
      expect(regionMap.get('FR')).toBe(Region.EU);
      expect(regionMap.get('US')).toBe(Region.US);
    });
  });

  describe('filterEudiEligible', () => {
    it('should separate eligible and ineligible countries', () => {
      const countries = ['DE', 'FR', 'US', 'AU', 'ES', 'NO'];
      const { eligible, ineligible } = filterEudiEligible(countries);

      expect(eligible).toContain('DE');
      expect(eligible).toContain('FR');
      expect(eligible).toContain('ES');
      expect(eligible).toContain('NO');

      expect(ineligible).toContain('US');
      expect(ineligible).toContain('AU');
    });

    it('should return empty arrays for empty input', () => {
      const { eligible, ineligible } = filterEudiEligible([]);

      expect(eligible).toEqual([]);
      expect(ineligible).toEqual([]);
    });

    it('should normalize country codes', () => {
      const countries = ['de', 'us'];
      const { eligible, ineligible } = filterEudiEligible(countries);

      expect(eligible).toEqual(['DE']);
      expect(ineligible).toEqual(['US']);
    });
  });

  describe('EEA_COUNTRY_CODES completeness', () => {
    it('should include all 27 EU member states', () => {
      const euMembers = [
        'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
        'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
        'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
      ];

      for (const country of euMembers) {
        expect(EEA_COUNTRY_CODES).toContain(country);
      }
    });

    it('should include EFTA states', () => {
      expect(EEA_COUNTRY_CODES).toContain('IS'); // Iceland
      expect(EEA_COUNTRY_CODES).toContain('LI'); // Liechtenstein
      expect(EEA_COUNTRY_CODES).toContain('NO'); // Norway
    });

    it('should include Switzerland', () => {
      expect(EEA_COUNTRY_CODES).toContain('CH');
    });

    it('should not include UK (post-Brexit)', () => {
      expect(EEA_COUNTRY_CODES).not.toContain('GB');
      expect(EEA_COUNTRY_CODES).not.toContain('UK');
    });
  });

  describe('EUDI_PILOT_COUNTRIES', () => {
    it('should only include countries with active pilots', () => {
      // Verify known pilot countries
      expect(EUDI_PILOT_COUNTRIES).toContain('DE'); // Germany
      expect(EUDI_PILOT_COUNTRIES).toContain('ES'); // Spain
      expect(EUDI_PILOT_COUNTRIES).toContain('FR'); // France
    });

    it('should only include EEA countries', () => {
      for (const country of EUDI_PILOT_COUNTRIES) {
        expect(EEA_COUNTRY_CODES).toContain(country);
      }
    });
  });

  describe('Integration scenarios', () => {
    it('should handle German healthcare provider', () => {
      const metadata = getEudiCountryMetadata('DE');

      expect(metadata.eudiEligible).toBe(true);
      expect(metadata.region).toBe(Region.EU);
      expect(metadata.hasPilot).toBe(true);

      const region = getEudiIssuanceRegion('DE');
      expect(region).toBe(Region.EU);
    });

    it('should handle US healthcare provider', () => {
      const metadata = getEudiCountryMetadata('US');

      expect(metadata.eudiEligible).toBe(false);
      expect(metadata.region).toBe(Region.US);
      expect(metadata.regulatoryFramework).toContain('HIPAA');

      expect(() => getEudiIssuanceRegion('US')).toThrow();
    });

    it('should handle Norwegian provider (EFTA but EUDI-eligible)', () => {
      const metadata = getEudiCountryMetadata('NO');

      expect(metadata.eudiEligible).toBe(true);
      expect(metadata.region).toBe(Region.EU);

      const region = getEudiIssuanceRegion('NO');
      expect(region).toBe(Region.EU);
    });
  });
});

