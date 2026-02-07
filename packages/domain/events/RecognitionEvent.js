"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecognitionEvent = void 0;
const errors_1 = require("../errors");
function generateId(prefix) {
    const random = typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}_${random}`;
}
function assertNonEmpty(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new errors_1.DomainError(`${field} is required`, 'MISSING_FIELD');
    }
}
function assertTimestamp(value, field) {
    assertNonEmpty(value, field);
    if (Number.isNaN(Date.parse(value))) {
        throw new errors_1.DomainError(`${field} must be a valid ISO 8601 timestamp`, 'INVALID_TIMESTAMP');
    }
}
class RecognitionEvent {
    constructor(input) {
        if (!input || typeof input !== 'object') {
            throw new errors_1.DomainError('RecognitionEvent input is required', 'MISSING_FIELD');
        }
        assertNonEmpty(input.subjectId, 'RecognitionEvent.subjectId');
        assertNonEmpty(input.employerId, 'RecognitionEvent.employerId');
        assertTimestamp(input.recognizedAt, 'RecognitionEvent.recognizedAt');
        if (!input.verification || typeof input.verification !== 'object') {
            throw new errors_1.DomainError('RecognitionEvent.verification is required', 'MISSING_VERIFICATION');
        }
        assertTimestamp(input.verification.verifiedAt, 'RecognitionEvent.verification.verifiedAt');
        assertNonEmpty(input.verification.verificationRef, 'RecognitionEvent.verification.verificationRef');
        if (input.expiresAt !== null) {
            assertTimestamp(input.expiresAt, 'RecognitionEvent.expiresAt');
        }
        const revocation = input.revocation ?? null;
        if (revocation) {
            assertTimestamp(revocation.revokedAt, 'RecognitionEvent.revocation.revokedAt');
            assertNonEmpty(revocation.revocationRef, 'RecognitionEvent.revocation.revocationRef');
        }
        this.recognitionId = input.recognitionId ?? generateId('rec');
        this.subjectId = input.subjectId;
        this.employerId = input.employerId;
        this.recognizedAt = input.recognizedAt;
        this.verification = Object.freeze({ ...input.verification });
        this.expiresAt = input.expiresAt;
        this.revocation = revocation ? Object.freeze({ ...revocation }) : null;
        Object.freeze(this);
    }
}
exports.RecognitionEvent = RecognitionEvent;
