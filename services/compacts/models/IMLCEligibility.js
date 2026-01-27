"use strict";
/**
 * B138A-IMLC-001: Interstate Medical Licensure Compact (IMLC) Eligibility Model
 *
 * Defines the data model and validation for IMLC eligibility status.
 * IMLC allows physicians to practice across state lines with expedited licensure.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IMLC_STATES = exports.IMLCEligibilitySchema = exports.LicenseHistorySchema = void 0;
exports.validateIMLCEligibility = validateIMLCEligibility;
exports.isIMLCState = isIMLCState;
const zod_1 = require("zod");
// License history entry for eligibility determination
exports.LicenseHistorySchema = zod_1.z.object({
    state: zod_1.z.string().length(2),
    licenseNumber: zod_1.z.string(),
    issueDate: zod_1.z.string().datetime().or(zod_1.z.date()),
    expirationDate: zod_1.z.string().datetime().or(zod_1.z.date()).optional(),
    status: zod_1.z.enum(['active', 'inactive', 'expired', 'revoked']),
    isPrimary: zod_1.z.boolean().default(false),
    disciplinaryActions: zod_1.z.array(zod_1.z.object({
        date: zod_1.z.string().datetime().or(zod_1.z.date()),
        type: zod_1.z.string(),
        description: zod_1.z.string().optional(),
    })).optional(),
});
// IMLC Eligibility validation schema
exports.IMLCEligibilitySchema = zod_1.z.object({
    clinicianDid: zod_1.z.string().min(1, 'Clinician DID is required'),
    homeState: zod_1.z.string().length(2, 'Home state must be 2-letter code'),
    compactStates: zod_1.z.array(zod_1.z.string().length(2)).default([]),
    status: zod_1.z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'LICENSED']).default('NOT_ELIGIBLE'),
    licenseHistory: zod_1.z.array(exports.LicenseHistorySchema).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
// IMLC participating states (as of 2024)
exports.IMLC_STATES = [
    'AL', 'AK', 'AZ', 'CO', 'DC', 'FL', 'GA', 'ID', 'IL', 'IN', 'IA', 'KS',
    'KY', 'ME', 'MD', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NC', 'ND', 'OH', 'OK', 'PA', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA',
    'WA', 'WV', 'WI', 'WY'
];
function validateIMLCEligibility(data) {
    return exports.IMLCEligibilitySchema.parse(data);
}
function isIMLCState(state) {
    return exports.IMLC_STATES.includes(state);
}
