"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USAGE_EXAMPLES = exports.EUDI_PILOT_COUNTRIES = exports.EEA_COUNTRY_NAMES = exports.EEA_COUNTRY_CODES = void 0;
exports.mapCountryToRegion = mapCountryToRegion;
exports.isEeaCountry = isEeaCountry;
exports.isEudiEligible = isEudiEligible;
exports.hasEudiPilot = hasEudiPilot;
exports.getCountryName = getCountryName;
exports.getEeaCountries = getEeaCountries;
exports.getEeaCountriesWithNames = getEeaCountriesWithNames;
exports.isValidCountryCode = isValidCountryCode;
exports.getEudiIssuanceRegion = getEudiIssuanceRegion;
exports.getRegulatoryFramework = getRegulatoryFramework;
exports.getEudiCountryMetadata = getEudiCountryMetadata;
exports.batchMapCountriesToRegions = batchMapCountriesToRegions;
exports.filterEudiEligible = filterEudiEligible;
const log = (0, serviceLogger_1.getServiceLogger)('compacts/euRegionMap');
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
const TenantRegion_1 = require("../org/models/TenantRegion");
const serviceLogger_1 = require("../logging/serviceLogger");
/**
 * ISO 3166-1 alpha-2 country codes for EEA member states
 *
 * Includes:
 * - 27 EU member states
 * - 3 EFTA states (Iceland, Liechtenstein, Norway)
 * - Switzerland (special case - bilateral agreements)
 */
exports.EEA_COUNTRY_CODES = [
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
exports.EEA_COUNTRY_NAMES = {
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
exports.EUDI_PILOT_COUNTRIES = [
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
function mapCountryToRegion(countryCode) {
    const upperCode = countryCode.toUpperCase();
    if (exports.EEA_COUNTRY_CODES.includes(upperCode)) {
        return TenantRegion_1.Region.EU;
    }
    // Non-EEA countries - map to appropriate regions
    // US and territories
    if (['US', 'PR', 'VI', 'GU', 'MP'].includes(upperCode)) {
        return TenantRegion_1.Region.US;
    }
    // Australia and territories
    if (['AU', 'NZ'].includes(upperCode)) {
        return TenantRegion_1.Region.AU;
    }
    // Default to US for unknown countries (could be changed to throw error)
    log.warn(`Unknown country code: ${countryCode}, defaulting to US region`);
    return TenantRegion_1.Region.US;
}
/**
 * Check if country code is in EEA
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns true if country is in EEA
 */
function isEeaCountry(countryCode) {
    return exports.EEA_COUNTRY_CODES.includes(countryCode.toUpperCase());
}
/**
 * Check if country is eligible for EUDI Wallet credentials
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns true if country can use EUDI Wallet
 */
function isEudiEligible(countryCode) {
    // EUDI Wallet is available to EEA member states
    return isEeaCountry(countryCode);
}
/**
 * Check if country has EUDI Wallet pilot program
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns true if country has active pilot
 */
function hasEudiPilot(countryCode) {
    return exports.EUDI_PILOT_COUNTRIES.includes(countryCode.toUpperCase());
}
/**
 * Get country name from country code
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Country name or undefined if not found
 */
function getCountryName(countryCode) {
    return exports.EEA_COUNTRY_NAMES[countryCode.toUpperCase()];
}
/**
 * Get all EEA country codes
 *
 * @returns Array of ISO 3166-1 alpha-2 country codes
 */
function getEeaCountries() {
    return [...exports.EEA_COUNTRY_CODES];
}
/**
 * Get EEA countries with their names
 *
 * @returns Array of objects with code and name
 */
function getEeaCountriesWithNames() {
    return exports.EEA_COUNTRY_CODES.map(code => ({
        code,
        name: exports.EEA_COUNTRY_NAMES[code],
    }));
}
/**
 * Validate country code format
 *
 * @param countryCode Country code to validate
 * @returns true if valid ISO 3166-1 alpha-2 format
 */
function isValidCountryCode(countryCode) {
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
function getEudiIssuanceRegion(countryCode) {
    if (!isValidCountryCode(countryCode)) {
        throw new Error(`Invalid country code format: ${countryCode}`);
    }
    if (!isEudiEligible(countryCode)) {
        throw new Error(`Country ${countryCode} (${getCountryName(countryCode) || 'Unknown'}) is not eligible for EUDI Wallet credentials`);
    }
    return TenantRegion_1.Region.EU;
}
/**
 * Get regulatory framework for country
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Regulatory framework description
 */
function getRegulatoryFramework(countryCode) {
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
 * Get comprehensive EUDI metadata for country
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns EudiCountryMetadata object
 */
function getEudiCountryMetadata(countryCode) {
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
function batchMapCountriesToRegions(countryCodes) {
    const result = new Map();
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
function filterEudiEligible(countryCodes) {
    const eligible = [];
    const ineligible = [];
    for (const code of countryCodes) {
        const upperCode = code.toUpperCase();
        if (isEudiEligible(upperCode)) {
            eligible.push(upperCode);
        }
        else {
            ineligible.push(upperCode);
        }
    }
    return { eligible, ineligible };
}
/**
 * Example usage and testing data
 */
exports.USAGE_EXAMPLES = `
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
