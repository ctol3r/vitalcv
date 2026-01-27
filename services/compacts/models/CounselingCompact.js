"use strict";
/**
 * B138A-CC-006: Counseling Compact Model
 *
 * Defines the data model and validation for the Counseling Compact eligibility.
 * The Counseling Compact allows licensed professional counselors to practice across state lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COUNSELING_COMPACT_STATES = exports.CounselingCompactSchema = exports.CounselingLicenseSchema = exports.CounselingLicenseTypes = void 0;
exports.validateCounselingCompact = validateCounselingCompact;
exports.isCounselingCompactState = isCounselingCompactState;
const zod_1 = require("zod");
// Counseling license types
exports.CounselingLicenseTypes = [
    'LPC', // Licensed Professional Counselor
    'LPCC', // Licensed Professional Clinical Counselor
    'LMHC', // Licensed Mental Health Counselor
    'LCMHC', // Licensed Clinical Mental Health Counselor
    'LCPC', // Licensed Clinical Professional Counselor
];
// License data for counseling eligibility
exports.CounselingLicenseSchema = zod_1.z.object({
    state: zod_1.z.string().length(2),
    licenseNumber: zod_1.z.string(),
    licenseType: zod_1.z.enum(exports.CounselingLicenseTypes),
    issueDate: zod_1.z.string().datetime().or(zod_1.z.date()),
    expirationDate: zod_1.z.string().datetime().or(zod_1.z.date()).optional(),
    status: zod_1.z.enum(['active', 'inactive', 'expired', 'revoked']),
    isPrimary: zod_1.z.boolean().default(false),
});
// Counseling Compact validation schema
exports.CounselingCompactSchema = zod_1.z.object({
    clinicianDid: zod_1.z.string().min(1, 'Clinician DID is required'),
    homeState: zod_1.z.string().length(2).optional(),
    compactStates: zod_1.z.array(zod_1.z.string().length(2)).default([]),
    status: zod_1.z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'ACTIVE']).default('NOT_ELIGIBLE'),
    licenseType: zod_1.z.enum(exports.CounselingLicenseTypes).optional(),
    licenseData: zod_1.z.array(exports.CounselingLicenseSchema).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
// Counseling Compact participating states (as of 2024)
// Note: This is a relatively new compact, state participation may vary
exports.COUNSELING_COMPACT_STATES = [
    'AL', 'AR', 'CO', 'DE', 'FL', 'GA', 'ID', 'IL', 'KS', 'KY', 'MD', 'MS',
    'MO', 'NE', 'NH', 'NC', 'OH', 'OK', 'SC', 'TN', 'TX', 'UT', 'VA', 'WV', 'WI'
];
function validateCounselingCompact(data) {
    return exports.CounselingCompactSchema.parse(data);
}
function isCounselingCompactState(state) {
    return exports.COUNSELING_COMPACT_STATES.includes(state);
}
