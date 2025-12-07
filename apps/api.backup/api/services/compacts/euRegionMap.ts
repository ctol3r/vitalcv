const log = getServiceLogger('compacts/euRegionMap');
/**
 * B139A-INTL-005: EUDI Region Mapping
 *
 * Maps European Economic Area (EEA) member states to EU region.
 * Used to determine if EUDI Wallet credentials can be issued.
 *
 * References:
 * - EEA Member States: https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Glossary:European_Economic_Area_(EEA)
 * - EUDI Wallet ARF: https://github.com/eu-digital-identity-wallet/eudi-doc-architecture-and-reference-framework
 */

import { Region } from '../org/models/TenantRegion';
import { getServiceLogger } from '../logging/serviceLogger';

/**
 * ISO 3166-1 alpha-2 country codes for EEA member states
 *
 * Includes:
 * - 27 EU member states
 * - 3 EFTA states (Iceland, Liechtenstein, Norway)
 * - Switzerland (special case - bilateral agreements)
 */
export const EEA_COUNTRY_CODES = [
  // EU Member States (27)
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czech Republic (Czechia)
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden

  // EFTA States (3) - part of EEA but not EU
  'IS', // Iceland
  'LI', // Liechtenstein
  'NO', // Norway

  // Special cases
  'CH', // Switzerland - not EEA but bilateral agreements
];

/**
 * Country code to country name mapping
 */
export const EEA_COUNTRY_NAMES: Record<string, string> = {
  'AT': 'Austria',
  'BE': 'Belgium',
  'BG': 'Bulgaria',
  'HR': 'Croatia',
  'CY': 'Cyprus',
  'CZ': 'Czech Republic',
  'DK': 'Denmark',
  'EE': 'Estonia',
  'FI': 'Finland',
  'FR': 'France',
  'DE': 'Germany',
  'GR': 'Greece',
  'HU': 'Hungary',
  'IE': 'Ireland',
  'IT': 'Italy',
  'LV': 'Latvia',
  'LT': 'Lithuania',
  'LU': 'Luxembourg',
  'MT': 'Malta',
  'NL': 'Netherlands',
  'PL': 'Poland',
  'PT': 'Portugal',
  'RO': 'Romania',
  'SK': 'Slovakia',
  'SI': 'Slovenia',
  'ES': 'Spain',
  'SE': 'Sweden',
  'IS': 'Iceland',
  'LI': 'Liechtenstein',
  'NO': 'Norway',
  'CH': 'Switzerland',
};

/**
 * Countries with special EUDI Wallet pilot programs
 * These countries may have additional requirements or early access
 */
export const EUDI_PILOT_COUNTRIES = [
  'DE', // Germany - active pilot
  'ES', // Spain - active pilot
  'IT', // Italy - active pilot
  'FR', // France - active pilot
  'NL', // Netherlands - active pilot
  'BE', // Belgium - active pilot
  'PT', // Portugal - active pilot
];

/**
 * Map country code to region
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Region enum value
 */
export function mapCountryToRegion(countryCode: string): Region {
  const upperCode = countryCode.toUpperCase();

  if (EEA_COUNTRY_CODES.includes(upperCode)) {
    return Region.EU;
  }

  // Non-EEA countries - map to appropriate regions
  // US and territories
  if (['US', 'PR', 'VI', 'GU', 'MP'].includes(upperCode)) {
    return Region.US;
  }

  // Australia and territories
  if (['AU', 'NZ'].includes(upperCode)) {
    return Region.AU;
  }

  // Default to US for unknown countries (could be changed to throw error)
  log.warn(`Unknown country code: ${countryCode}, defaulting to US region`);
  return Region.US;
}

/**
 * Check if country code is in EEA
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns true if country is in EEA
 */
export function isEeaCountry(countryCode: string): boolean {
  return EEA_COUNTRY_CODES.includes(countryCode.toUpperCase());
}

/**
 * Check if country is eligible for EUDI Wallet credentials
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns true if country can use EUDI Wallet
 */
export function isEudiEligible(countryCode: string): boolean {
  // EUDI Wallet is available to EEA member states
  return isEeaCountry(countryCode);
}

/**
 * Check if country has EUDI Wallet pilot program
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns true if country has active pilot
 */
export function hasEudiPilot(countryCode: string): boolean {
  return EUDI_PILOT_COUNTRIES.includes(countryCode.toUpperCase());
}

/**
 * Get country name from country code
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Country name or undefined if not found
 */
export function getCountryName(countryCode: string): string | undefined {
  return EEA_COUNTRY_NAMES[countryCode.toUpperCase()];
}

/**
 * Get all EEA country codes
 *
 * @returns Array of ISO 3166-1 alpha-2 country codes
 */
export function getEeaCountries(): string[] {
  return [...EEA_COUNTRY_CODES];
}

/**
 * Get EEA countries with their names
 *
 * @returns Array of objects with code and name
 */
export function getEeaCountriesWithNames(): Array<{ code: string; name: string }> {
  return EEA_COUNTRY_CODES.map(code => ({
    code,
    name: EEA_COUNTRY_NAMES[code],
  }));
}

/**
 * Validate country code format
 *
 * @param countryCode Country code to validate
 * @returns true if valid ISO 3166-1 alpha-2 format
 */
export function isValidCountryCode(countryCode: string): boolean {
  return /^[A-Z]{2}$/i.test(countryCode);
}

/**
 * Get region for EUDI credential issuance
 *
 * This is a convenience function that combines country-to-region mapping
 * with EUDI eligibility checking.
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Region.EU if eligible, throws error otherwise
 * @throws Error if country is not EUDI eligible
 */
export function getEudiIssuanceRegion(countryCode: string): Region {
  if (!isValidCountryCode(countryCode)) {
    throw new Error(`Invalid country code format: ${countryCode}`);
  }

  if (!isEudiEligible(countryCode)) {
    throw new Error(
      `Country ${countryCode} (${getCountryName(countryCode) || 'Unknown'}) is not eligible for EUDI Wallet credentials`
    );
  }

  return Region.EU;
}

/**
 * Get regulatory framework for country
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Regulatory framework description
 */
export function getRegulatoryFramework(countryCode: string): string {
  const upperCode = countryCode.toUpperCase();

  if (isEeaCountry(upperCode)) {
    return 'GDPR + eIDAS 2.0 / EUDI Framework';
  }

  if (['US', 'PR', 'VI', 'GU', 'MP'].includes(upperCode)) {
    return 'HIPAA + TEFCA';
  }

  if (['AU', 'NZ'].includes(upperCode)) {
    return 'Privacy Act 1988 + Australian Privacy Principles';
  }

  return 'Unknown';
}

/**
 * EUDI Wallet metadata for country
 */
export interface EudiCountryMetadata {
  countryCode: string;
  countryName: string;
  region: Region;
  eudiEligible: boolean;
  hasPilot: boolean;
  regulatoryFramework: string;
}

/**
 * Get comprehensive EUDI metadata for country
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns EudiCountryMetadata object
 */
export function getEudiCountryMetadata(countryCode: string): EudiCountryMetadata {
  const upperCode = countryCode.toUpperCase();

  return {
    countryCode: upperCode,
    countryName: getCountryName(upperCode) || 'Unknown',
    region: mapCountryToRegion(upperCode),
    eudiEligible: isEudiEligible(upperCode),
    hasPilot: hasEudiPilot(upperCode),
    regulatoryFramework: getRegulatoryFramework(upperCode),
  };
}

/**
 * Batch map multiple country codes to regions
 *
 * @param countryCodes Array of ISO 3166-1 alpha-2 country codes
 * @returns Map of country code to region
 */
export function batchMapCountriesToRegions(
  countryCodes: string[]
): Map<string, Region> {
  const result = new Map<string, Region>();

  for (const code of countryCodes) {
    if (isValidCountryCode(code)) {
      result.set(code.toUpperCase(), mapCountryToRegion(code));
    }
  }

  return result;
}

/**
 * Filter countries by EUDI eligibility
 *
 * @param countryCodes Array of ISO 3166-1 alpha-2 country codes
 * @returns Object with eligible and ineligible arrays
 */
export function filterEudiEligible(countryCodes: string[]): {
  eligible: string[];
  ineligible: string[];
} {
  const eligible: string[] = [];
  const ineligible: string[] = [];

  for (const code of countryCodes) {
    const upperCode = code.toUpperCase();
    if (isEudiEligible(upperCode)) {
      eligible.push(upperCode);
    } else {
      ineligible.push(upperCode);
    }
  }

  return { eligible, ineligible };
}

/**
 * Example usage and testing data
 */
export const USAGE_EXAMPLES = `
# EUDI Region Mapping Usage Examples

## Map country to region

\`\`\`typescript
import { mapCountryToRegion, Region } from './euRegionMap';

const region = mapCountryToRegion('DE'); // Germany
log.info(region); // Region.EU

const usRegion = mapCountryToRegion('US');
log.info(usRegion); // Region.US
\`\`\`

## Check EUDI eligibility

\`\`\`typescript
import { isEudiEligible, getEudiIssuanceRegion } from './euRegionMap';

const isGermanyEligible = isEudiEligible('DE');
log.info(isGermanyEligible); // true

const isUsEligible = isEudiEligible('US');
log.info(isUsEligible); // false

try {
  const region = getEudiIssuanceRegion('DE');
  log.info('Can issue EUDI credential in region:', region);
} catch (error) {
  log.error('Cannot issue EUDI credential:', error.message);
}
\`\`\`

## Get country metadata

\`\`\`typescript
import { getEudiCountryMetadata } from './euRegionMap';

const metadata = getEudiCountryMetadata('FR');
log.info(metadata);
// {
//   countryCode: 'FR',
//   countryName: 'France',
//   region: Region.EU,
//   eudiEligible: true,
//   hasPilot: true,
//   regulatoryFramework: 'GDPR + eIDAS 2.0 / EUDI Framework'
// }
\`\`\`

## Batch processing

\`\`\`typescript
import { batchMapCountriesToRegions, filterEudiEligible } from './euRegionMap';

const countries = ['DE', 'FR', 'US', 'ES', 'AU'];

const regionMap = batchMapCountriesToRegions(countries);
log.info(regionMap);
// Map { 'DE' => Region.EU, 'FR' => Region.EU, 'US' => Region.US, ... }

const { eligible, ineligible } = filterEudiEligible(countries);
log.info('EUDI eligible:', eligible); // ['DE', 'FR', 'ES']
log.info('Not eligible:', ineligible); // ['US', 'AU']
\`\`\`

## Get all EEA countries

\`\`\`typescript
import { getEeaCountriesWithNames } from './euRegionMap';

const eeaCountries = getEeaCountriesWithNames();
log.info(eeaCountries);
// [
//   { code: 'AT', name: 'Austria' },
//   { code: 'BE', name: 'Belgium' },
//   ...
// ]
\`\`\`
`;

