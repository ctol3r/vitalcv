"use strict";
/**
 * B138A-PSY-004: PSYPACT (Psychology Interjurisdictional Compact) Model
 *
 * Defines the data model and validation for PSYPACT eligibility and participation.
 * PSYPACT allows psychologists to practice telepsychology across state lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EPassportStatus = exports.PSYPACT_STATES = exports.PSYPACTCompactSchema = exports.PsychologyLicenseSchema = void 0;
exports.validatePSYPACTCompact = validatePSYPACTCompact;
exports.isPSYPACTState = isPSYPACTState;
const zod_1 = require("zod");
// License data for psychology eligibility
exports.PsychologyLicenseSchema = zod_1.z.object({
    state: zod_1.z.string().length(2),
    licenseNumber: zod_1.z.string(),
    licenseType: zod_1.z.string(), // e.g., "Clinical Psychologist", "Licensed Psychologist"
    issueDate: zod_1.z.string().datetime().or(zod_1.z.date()),
    expirationDate: zod_1.z.string().datetime().or(zod_1.z.date()).optional(),
    status: zod_1.z.enum(['active', 'inactive', 'expired', 'revoked']),
    isPrimary: zod_1.z.boolean().default(false),
});
// PSYPACT Compact validation schema
exports.PSYPACTCompactSchema = zod_1.z.object({
    clinicianDid: zod_1.z.string().min(1, 'Clinician DID is required'),
    participatingStates: zod_1.z.array(zod_1.z.string().length(2)).default([]),
    status: zod_1.z.enum(['NOT_ELIGIBLE', 'ELIGIBLE', 'E_PASS', 'ACTIVE']).default('NOT_ELIGIBLE'),
    ePassportId: zod_1.z.string().optional(),
    primaryState: zod_1.z.string().length(2).optional(),
    licenseData: zod_1.z.array(exports.PsychologyLicenseSchema).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
// PSYPACT participating states (as of 2024)
exports.PSYPACT_STATES = [
    'AL', 'AZ', 'AR', 'CO', 'CT', 'DE', 'DC', 'GA', 'ID', 'IL', 'IN', 'KS',
    'KY', 'ME', 'MD', 'MI', 'MN', 'MS', 'MO', 'NE', 'NV', 'NH', 'NJ', 'NC',
    'OH', 'OK', 'PA', 'TN', 'TX', 'UT', 'VA', 'WA', 'WV', 'WI'
];
function validatePSYPACTCompact(data) {
    return exports.PSYPACTCompactSchema.parse(data);
}
function isPSYPACTState(state) {
    return exports.PSYPACT_STATES.includes(state);
}
// E.Passport status values
var EPassportStatus;
(function (EPassportStatus) {
    EPassportStatus["NOT_ENROLLED"] = "NOT_ENROLLED";
    EPassportStatus["PENDING"] = "PENDING";
    EPassportStatus["ACTIVE"] = "ACTIVE";
    EPassportStatus["SUSPENDED"] = "SUSPENDED";
    EPassportStatus["REVOKED"] = "REVOKED";
})(EPassportStatus || (exports.EPassportStatus = EPassportStatus = {}));
