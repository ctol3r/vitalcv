"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartAttestation = void 0;
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
class StartAttestation {
    constructor(input) {
        if (!input || typeof input !== 'object') {
            throw new errors_1.DomainError('StartAttestation input is required', 'MISSING_FIELD');
        }
        assertNonEmpty(input.acceptanceId, 'StartAttestation.acceptanceId');
        assertNonEmpty(input.subjectId, 'StartAttestation.subjectId');
        assertNonEmpty(input.employerId, 'StartAttestation.employerId');
        assertTimestamp(input.attestedAt, 'StartAttestation.attestedAt');
        this.startId = input.startId ?? generateId('start');
        this.acceptanceId = input.acceptanceId;
        this.subjectId = input.subjectId;
        this.employerId = input.employerId;
        this.attestedAt = input.attestedAt;
        Object.freeze(this);
    }
}
exports.StartAttestation = StartAttestation;
