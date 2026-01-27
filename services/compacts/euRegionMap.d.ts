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
/**
 * ISO 3166-1 alpha-2 country codes for EEA member states
 *
 * Includes:
 * - 27 EU member states
 * - 3 EFTA states (Iceland, Liechtenstein, Norway)
 * - Switzerland (special case - bilateral agreements)
 */
export declare const EEA_COUNTRY_CODES: string[];
/**
 * Country code to country name mapping
 */
export declare const EEA_COUNTRY_NAMES: Record<string, string>;
/**
 * Countries with special EUDI Wallet pilot programs
 * These countries may have additional requirements or early access
 */
export declare const EUDI_PILOT_COUNTRIES: string[];
/**
 * Map country code to region
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Region enum value
 */
export declare function mapCountryToRegion(countryCode: string): Region;
/**
 * Check if country code is in EEA
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns true if country is in EEA
 */
export declare function isEeaCountry(countryCode: string): boolean;
/**
 * Check if country is eligible for EUDI Wallet credentials
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns true if country can use EUDI Wallet
 */
export declare function isEudiEligible(countryCode: string): boolean;
/**
 * Check if country has EUDI Wallet pilot program
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns true if country has active pilot
 */
export declare function hasEudiPilot(countryCode: string): boolean;
/**
 * Get country name from country code
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Country name or undefined if not found
 */
export declare function getCountryName(countryCode: string): string | undefined;
/**
 * Get all EEA country codes
 *
 * @returns Array of ISO 3166-1 alpha-2 country codes
 */
export declare function getEeaCountries(): string[];
/**
 * Get EEA countries with their names
 *
 * @returns Array of objects with code and name
 */
export declare function getEeaCountriesWithNames(): Array<{
    code: string;
    name: string;
}>;
/**
 * Validate country code format
 *
 * @param countryCode Country code to validate
 * @returns true if valid ISO 3166-1 alpha-2 format
 */
export declare function isValidCountryCode(countryCode: string): boolean;
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
export declare function getEudiIssuanceRegion(countryCode: string): Region;
/**
 * Get regulatory framework for country
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @returns Regulatory framework description
 */
export declare function getRegulatoryFramework(countryCode: string): string;
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
export declare function getEudiCountryMetadata(countryCode: string): EudiCountryMetadata;
/**
 * Batch map multiple country codes to regions
 *
 * @param countryCodes Array of ISO 3166-1 alpha-2 country codes
 * @returns Map of country code to region
 */
export declare function batchMapCountriesToRegions(countryCodes: string[]): Map<string, Region>;
/**
 * Filter countries by EUDI eligibility
 *
 * @param countryCodes Array of ISO 3166-1 alpha-2 country codes
 * @returns Object with eligible and ineligible arrays
 */
export declare function filterEudiEligible(countryCodes: string[]): {
    eligible: string[];
    ineligible: string[];
};
/**
 * Example usage and testing data
 */
export declare const USAGE_EXAMPLES = "\n# EUDI Region Mapping Usage Examples\n\n## Map country to region\n\n```typescript\nimport { mapCountryToRegion, Region } from './euRegionMap';\n\nconst region = mapCountryToRegion('DE'); // Germany\nlog.info(region); // Region.EU\n\nconst usRegion = mapCountryToRegion('US');\nlog.info(usRegion); // Region.US\n```\n\n## Check EUDI eligibility\n\n```typescript\nimport { isEudiEligible, getEudiIssuanceRegion } from './euRegionMap';\n\nconst isGermanyEligible = isEudiEligible('DE');\nlog.info(isGermanyEligible); // true\n\nconst isUsEligible = isEudiEligible('US');\nlog.info(isUsEligible); // false\n\ntry {\n  const region = getEudiIssuanceRegion('DE');\n  log.info('Can issue EUDI credential in region:', region);\n} catch (error) {\n  log.error('Cannot issue EUDI credential:', error.message);\n}\n```\n\n## Get country metadata\n\n```typescript\nimport { getEudiCountryMetadata } from './euRegionMap';\n\nconst metadata = getEudiCountryMetadata('FR');\nlog.info(metadata);\n// {\n//   countryCode: 'FR',\n//   countryName: 'France',\n//   region: Region.EU,\n//   eudiEligible: true,\n//   hasPilot: true,\n//   regulatoryFramework: 'GDPR + eIDAS 2.0 / EUDI Framework'\n// }\n```\n\n## Batch processing\n\n```typescript\nimport { batchMapCountriesToRegions, filterEudiEligible } from './euRegionMap';\n\nconst countries = ['DE', 'FR', 'US', 'ES', 'AU'];\n\nconst regionMap = batchMapCountriesToRegions(countries);\nlog.info(regionMap);\n// Map { 'DE' => Region.EU, 'FR' => Region.EU, 'US' => Region.US, ... }\n\nconst { eligible, ineligible } = filterEudiEligible(countries);\nlog.info('EUDI eligible:', eligible); // ['DE', 'FR', 'ES']\nlog.info('Not eligible:', ineligible); // ['US', 'AU']\n```\n\n## Get all EEA countries\n\n```typescript\nimport { getEeaCountriesWithNames } from './euRegionMap';\n\nconst eeaCountries = getEeaCountriesWithNames();\nlog.info(eeaCountries);\n// [\n//   { code: 'AT', name: 'Austria' },\n//   { code: 'BE', name: 'Belgium' },\n//   ...\n// ]\n```\n";
