"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployerAcceptance = void 0;
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
class EmployerAcceptance {
    constructor(input) {
        if (!input || typeof input !== 'object') {
            throw new errors_1.DomainError('EmployerAcceptance input is required', 'MISSING_FIELD');
        }
        assertNonEmpty(input.recognitionId, 'EmployerAcceptance.recognitionId');
        assertNonEmpty(input.subjectId, 'EmployerAcceptance.subjectId');
        assertNonEmpty(input.employerId, 'EmployerAcceptance.employerId');
        assertNonEmpty(input.facilityId, 'EmployerAcceptance.facilityId');
        assertTimestamp(input.acceptedAt, 'EmployerAcceptance.acceptedAt');
        this.acceptanceId = input.acceptanceId ?? generateId('acc');
        this.recognitionId = input.recognitionId;
        this.subjectId = input.subjectId;
        this.employerId = input.employerId;
        this.facilityId = input.facilityId;
        this.acceptedAt = input.acceptedAt;
        Object.freeze(this);
    }
}
exports.EmployerAcceptance = EmployerAcceptance;
