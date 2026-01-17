"use strict";
/**
 * B138A-COMPACT-008: Unified CompactsStatus Model
 *
 * Defines the unified data model for all compact eligibility statuses.
 * This model aggregates IMLC, PSYPACT, and Counseling Compact eligibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPACTS_STATUS_CACHE_TTL_MS = exports.CompactsStatusSchema = void 0;
exports.validateCompactsStatus = validateCompactsStatus;
exports.computeEligibilitySummary = computeEligibilitySummary;
exports.isRefreshNeeded = isRefreshNeeded;
const zod_1 = require("zod");
// Unified Compacts Status validation schema
exports.CompactsStatusSchema = zod_1.z.object({
    clinicianDid: zod_1.z.string().min(1, 'Clinician DID is required'),
    // IMLC fields
    imlcStatus: zod_1.z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'LICENSED']).default('NOT_ELIGIBLE'),
    imlcHomeState: zod_1.z.string().length(2).optional(),
    imlcCompactStates: zod_1.z.array(zod_1.z.string().length(2)).default([]),
    // PSYPACT fields
    psypactStatus: zod_1.z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'E_PASS', 'ACTIVE']).default('NOT_ELIGIBLE'),
    psypactStates: zod_1.z.array(zod_1.z.string().length(2)).default([]),
    // Counseling Compact fields
    counselingStatus: zod_1.z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'ACTIVE']).default('NOT_ELIGIBLE'),
    counselingHomeState: zod_1.z.string().length(2).optional(),
    counselingStates: zod_1.z.array(zod_1.z.string().length(2)).default([]),
    // Metadata
    lastComputedAt: zod_1.z.string().datetime().or(zod_1.z.date()).optional(),
    nextRefreshAt: zod_1.z.string().datetime().or(zod_1.z.date()).optional(),
    vcHash: zod_1.z.string().optional(),
    vcCredentialId: zod_1.z.string().optional(),
    anchoredTxHash: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
function validateCompactsStatus(data) {
    return exports.CompactsStatusSchema.parse(data);
}
// Helper function to compute eligibility summary
function computeEligibilitySummary(status) {
    const imlcEligible = status.imlcStatus === 'ELIGIBLE' || status.imlcStatus === 'LICENSED';
    const psypactEligible = status.psypactStatus !== 'NOT_ELIGIBLE';
    const counselingEligible = status.counselingStatus !== 'NOT_ELIGIBLE';
    const allStates = new Set([
        ...(imlcEligible ? status.imlcCompactStates : []),
        ...(psypactEligible ? status.psypactStates : []),
        ...(counselingEligible ? status.counselingStates : []),
    ]);
    const compactTypes = [];
    if (imlcEligible)
        compactTypes.push('IMLC');
    if (psypactEligible)
        compactTypes.push('PSYPACT');
    if (counselingEligible)
        compactTypes.push('CounselingCompact');
    return {
        clinicianDid: status.clinicianDid,
        hasAnyCompactEligibility: imlcEligible || psypactEligible || counselingEligible,
        imlcEligible,
        psypactEligible,
        counselingEligible,
        totalEligibleStates: Array.from(allStates),
        compactTypes,
    };
}
// Cache TTL for compacts status (24 hours)
exports.COMPACTS_STATUS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
function isRefreshNeeded(status) {
    if (!status.nextRefreshAt)
        return true;
    const nextRefresh = typeof status.nextRefreshAt === 'string'
        ? new Date(status.nextRefreshAt)
        : status.nextRefreshAt;
    return new Date() >= nextRefresh;
}
