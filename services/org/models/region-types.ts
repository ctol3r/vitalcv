/**
 * B139A-INTL-002: Region Types
 *
 * Basic region enum without external dependencies.
 * Extracted to avoid circular dependencies and dependency resolution issues.
 */

/**
 * Supported regions in the platform
 */
export enum Region {
  US = 'us',  // United States (us-east-1, us-west-2)
  EU = 'eu',  // European Union (eu-central-1, eu-west-1)
  AU = 'au',  // Australia (ap-southeast-2)
  // Future regions:
  // CA = 'ca',  // Canada (ca-central-1) - Planned Q3 2026
  // UK = 'uk',  // United Kingdom (eu-west-2) - Planned Q4 2026
  // JP = 'jp',  // Japan (ap-northeast-1) - Planned Q2 2027
}

/**
 * Regulatory framework by region
 */
export enum RegulatoryFramework {
  HIPAA_TEFCA = 'hipaa_tefca',      // US: HIPAA + TEFCA
  GDPR_EUDI = 'gdpr_eudi',          // EU: GDPR + eIDAS/EUDI
  PRIVACY_ACT_AU = 'privacy_act_au', // AU: Privacy Act 1988 + APPs
  PIPEDA = 'pipeda',                // CA: PIPEDA (future)
}

/**
 * Regional cluster endpoints
 */
export const REGION_ENDPOINTS: Record<Region, string> = {
  [Region.US]: process.env.US_CLUSTER_ENDPOINT || 'https://us.api.vitalcv.com',
  [Region.EU]: process.env.EU_CLUSTER_ENDPOINT || 'https://eu.api.vitalcv.com',
  [Region.AU]: process.env.AU_CLUSTER_ENDPOINT || 'https://au.api.vitalcv.com',
};

/**
 * Regional database endpoints (read-only for metadata)
 */
export const REGION_DB_ENDPOINTS: Record<Region, string> = {
  [Region.US]: process.env.US_DB_ENDPOINT || 'postgres://us-primary.rds.amazonaws.com:5432',
  [Region.EU]: process.env.EU_DB_ENDPOINT || 'postgres://eu-primary.rds.amazonaws.com:5432',
  [Region.AU]: process.env.AU_DB_ENDPOINT || 'postgres://au-primary.rds.amazonaws.com:5432',
};

/**
 * Region to regulatory framework mapping
 */
export const REGION_REGULATORY_FRAMEWORK: Record<Region, RegulatoryFramework> = {
  [Region.US]: RegulatoryFramework.HIPAA_TEFCA,
  [Region.EU]: RegulatoryFramework.GDPR_EUDI,
  [Region.AU]: RegulatoryFramework.PRIVACY_ACT_AU,
};
