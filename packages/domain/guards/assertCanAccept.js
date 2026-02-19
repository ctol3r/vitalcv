"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCanAccept = assertCanAccept;
const errors_1 = require("../errors");
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function assertCanAccept(recognition) {
    if (!recognition) {
        throw new errors_1.DomainError('Recognition is required before acceptance', 'MISSING_RECOGNITION');
    }
    if (!recognition.verification ||
        !isNonEmptyString(recognition.verification.verifiedAt) ||
        !isNonEmptyString(recognition.verification.verificationRef)) {
        throw new errors_1.DomainError('Recognition verification is required before acceptance', 'MISSING_VERIFICATION');
    }
    if (recognition.expiresAt) {
        const expiresAt = Date.parse(recognition.expiresAt);
        if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
            throw new errors_1.DomainError('Recognition is expired and cannot be accepted', 'RECOGNITION_EXPIRED');
        }
    }
    if (recognition.revocation) {
        throw new errors_1.DomainError('Recognition has been revoked', 'RECOGNITION_REVOKED');
    }
}
