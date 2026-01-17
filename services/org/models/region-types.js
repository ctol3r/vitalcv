"use strict";
/**
 * B139A-INTL-002: Region Types
 *
 * Basic region enum without external dependencies.
 * Extracted to avoid circular dependencies and dependency resolution issues.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGION_REGULATORY_FRAMEWORK = exports.REGION_DB_ENDPOINTS = exports.REGION_ENDPOINTS = exports.RegulatoryFramework = exports.Region = void 0;
/**
 * Supported regions in the platform
 */
var Region;
(function (Region) {
    Region["US"] = "us";
    Region["EU"] = "eu";
    Region["AU"] = "au";
    // Future regions:
    // CA = 'ca',  // Canada (ca-central-1) - Planned Q3 2026
    // UK = 'uk',  // United Kingdom (eu-west-2) - Planned Q4 2026
    // JP = 'jp',  // Japan (ap-northeast-1) - Planned Q2 2027
})(Region || (exports.Region = Region = {}));
/**
 * Regulatory framework by region
 */
var RegulatoryFramework;
(function (RegulatoryFramework) {
    RegulatoryFramework["HIPAA_TEFCA"] = "hipaa_tefca";
    RegulatoryFramework["GDPR_EUDI"] = "gdpr_eudi";
    RegulatoryFramework["PRIVACY_ACT_AU"] = "privacy_act_au";
    RegulatoryFramework["PIPEDA"] = "pipeda";
})(RegulatoryFramework || (exports.RegulatoryFramework = RegulatoryFramework = {}));
/**
 * Regional cluster endpoints
 */
exports.REGION_ENDPOINTS = {
    [Region.US]: process.env.US_CLUSTER_ENDPOINT || 'https://us.api.vitalcv.com',
    [Region.EU]: process.env.EU_CLUSTER_ENDPOINT || 'https://eu.api.vitalcv.com',
    [Region.AU]: process.env.AU_CLUSTER_ENDPOINT || 'https://au.api.vitalcv.com',
};
/**
 * Regional database endpoints (read-only for metadata)
 */
exports.REGION_DB_ENDPOINTS = {
    [Region.US]: process.env.US_DB_ENDPOINT || 'postgres://us-primary.rds.amazonaws.com:5432',
    [Region.EU]: process.env.EU_DB_ENDPOINT || 'postgres://eu-primary.rds.amazonaws.com:5432',
    [Region.AU]: process.env.AU_DB_ENDPOINT || 'postgres://au-primary.rds.amazonaws.com:5432',
};
/**
 * Region to regulatory framework mapping
 */
exports.REGION_REGULATORY_FRAMEWORK = {
    [Region.US]: RegulatoryFramework.HIPAA_TEFCA,
    [Region.EU]: RegulatoryFramework.GDPR_EUDI,
    [Region.AU]: RegulatoryFramework.PRIVACY_ACT_AU,
};
