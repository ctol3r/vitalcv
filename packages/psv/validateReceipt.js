"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveReceiptStatus = resolveReceiptStatus;
exports.validateReceipt = validateReceipt;
exports.validateReceiptSet = validateReceiptSet;
const RFC3339_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function parseAsEpoch(value, field) {
    if (value instanceof Date) {
        const epochMs = value.getTime();
        if (!Number.isFinite(epochMs)) {
            throw new Error(`${field} must be a valid timestamp`);
        }
        return epochMs;
    }
    if (typeof value !== 'string' || !RFC3339_UTC_REGEX.test(value)) {
        throw new Error(`${field} must be RFC3339 UTC`);
    }
    const epochMs = Date.parse(value);
    if (!Number.isFinite(epochMs)) {
        throw new Error(`${field} must be a valid timestamp`);
    }
    return epochMs;
}
function isValidReceiptShape(receipt) {
    return (typeof receipt?.fetched_at === 'string' &&
        RFC3339_UTC_REGEX.test(receipt.fetched_at) &&
        Number.isFinite(Date.parse(receipt.fetched_at)) &&
        Number.isInteger(receipt.ttl_seconds) &&
        receipt.ttl_seconds > 0 &&
        typeof receipt.revoked === 'boolean');
}
function resolveReceiptStatus(receipt, as_of) {
    const asOfEpochMs = parseAsEpoch(as_of, 'as_of');
    if (!isValidReceiptShape(receipt)) {
        // Fail closed for malformed payloads.
        return 'EXPIRED';
    }
    if (receipt.revoked === true) {
        return 'REVOKED';
    }
    const fetchedAtEpochMs = Date.parse(receipt.fetched_at);
    const expiresAtEpochMs = fetchedAtEpochMs + receipt.ttl_seconds * 1000;
    return asOfEpochMs > expiresAtEpochMs ? 'EXPIRED' : 'VALID';
}
function validateReceipt(receipt, as_of) {
    const status = resolveReceiptStatus(receipt, as_of);
    const is_revoked = status === 'REVOKED';
    const is_expired = status === 'EXPIRED';
    return Object.freeze({
        status,
        is_valid: !is_expired && !is_revoked,
        is_expired,
        is_revoked,
    });
}
function validateReceiptSet(receipts, as_of) {
    if (!Array.isArray(receipts) || receipts.length === 0) {
        return Object.freeze({
            has_missing: true,
            has_expired: false,
            has_revoked: false,
            all_valid: false,
        });
    }
    let has_expired = false;
    let has_revoked = false;
    for (const receipt of receipts) {
        const result = validateReceipt(receipt, as_of);
        if (result.is_expired)
            has_expired = true;
        if (result.is_revoked)
            has_revoked = true;
    }
    return Object.freeze({
        has_missing: false,
        has_expired,
        has_revoked,
        all_valid: !has_expired && !has_revoked,
    });
}
