/**
 * B139A-INTL-002: Region Types
 *
 * Basic region enum without external dependencies.
 * Extracted to avoid circular dependencies and dependency resolution issues.
 */
/**
 * Supported regions in the platform
 */
export declare enum Region {
    US = "us",// United States (us-east-1, us-west-2)
    EU = "eu",// European Union (eu-central-1, eu-west-1)
    AU = "au"
}
/**
 * Regulatory framework by region
 */
export declare enum RegulatoryFramework {
    HIPAA_TEFCA = "hipaa_tefca",// US: HIPAA + TEFCA
    GDPR_EUDI = "gdpr_eudi",// EU: GDPR + eIDAS/EUDI
    PRIVACY_ACT_AU = "privacy_act_au",// AU: Privacy Act 1988 + APPs
    PIPEDA = "pipeda"
}
/**
 * Regional cluster endpoints
 */
export declare const REGION_ENDPOINTS: Record<Region, string>;
/**
 * Regional database endpoints (read-only for metadata)
 */
export declare const REGION_DB_ENDPOINTS: Record<Region, string>;
/**
 * Region to regulatory framework mapping
 */
export declare const REGION_REGULATORY_FRAMEWORK: Record<Region, RegulatoryFramework>;
