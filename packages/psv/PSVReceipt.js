"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PSVReceipt = exports.SOURCE_AUTHORITIES = void 0;
const crypto_1 = __importDefault(require("crypto"));
exports.SOURCE_AUTHORITIES = ['ABMS', 'FSMB', 'NPI', 'LEIE', 'OTHER'];
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/i;
function assertNonEmptyString(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${field} is required`);
    }
}
function assertSourceAuthority(value) {
    if (!exports.SOURCE_AUTHORITIES.includes(value)) {
        throw new Error('source_authority must be one of ABMS | FSMB | NPI | LEIE | OTHER');
    }
}
function assertRfc3339Utc(value, field) {
    assertNonEmptyString(value, field);
    if (!RFC3339_UTC_REGEX.test(value) || !Number.isFinite(Date.parse(value))) {
        throw new Error(`${field} must be RFC3339 UTC`);
    }
}
function assertPositiveInteger(value, field) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${field} must be a positive integer`);
    }
}
function assertUuidV4(value, field) {
    assertNonEmptyString(value, field);
    if (!UUID_V4_REGEX.test(value)) {
        throw new Error(`${field} must be a UUID v4`);
    }
}
function assertSha256Hex(value, field) {
    assertNonEmptyString(value, field);
    if (!SHA256_HEX_REGEX.test(value)) {
        throw new Error(`${field} must be a sha256 hex string`);
    }
}
function hashRawResponse(rawResponse) {
    return crypto_1.default.createHash('sha256').update(rawResponse).digest('hex');
}
class PSVReceipt {
    constructor(snapshot) {
        assertUuidV4(snapshot.receipt_id, 'receipt_id');
        assertSourceAuthority(snapshot.source_authority);
        assertNonEmptyString(snapshot.access_or_license_id, 'access_or_license_id');
        assertNonEmptyString(snapshot.transaction_id, 'transaction_id');
        assertRfc3339Utc(snapshot.fetched_at, 'fetched_at');
        assertSha256Hex(snapshot.response_hash, 'response_hash');
        assertPositiveInteger(snapshot.ttl_seconds, 'ttl_seconds');
        this.receipt_id = snapshot.receipt_id;
        this.source_authority = snapshot.source_authority;
        this.access_or_license_id = snapshot.access_or_license_id;
        this.transaction_id = snapshot.transaction_id;
        this.fetched_at = snapshot.fetched_at;
        this.response_hash = snapshot.response_hash;
        this.ttl_seconds = snapshot.ttl_seconds;
        this.revoked = Boolean(snapshot.revoked);
        Object.freeze(this);
    }
    static create(input) {
        if (!input || typeof input !== 'object') {
            throw new Error('PSVReceipt input is required');
        }
        assertSourceAuthority(input.source_authority);
        assertNonEmptyString(input.access_or_license_id, 'access_or_license_id');
        assertNonEmptyString(input.transaction_id, 'transaction_id');
        assertRfc3339Utc(input.fetched_at, 'fetched_at');
        assertPositiveInteger(input.ttl_seconds, 'ttl_seconds');
        assertNonEmptyString(input.raw_response, 'raw_response');
        const receipt_id = input.receipt_id ?? crypto_1.default.randomUUID();
        assertUuidV4(receipt_id, 'receipt_id');
        // Raw source response is intentionally not persisted.
        const response_hash = hashRawResponse(input.raw_response);
        return new PSVReceipt({
            receipt_id,
            source_authority: input.source_authority,
            access_or_license_id: input.access_or_license_id,
            transaction_id: input.transaction_id,
            fetched_at: input.fetched_at,
            response_hash,
            ttl_seconds: input.ttl_seconds,
            revoked: Boolean(input.revoked),
        });
    }
    toJSON() {
        return Object.freeze({
            receipt_id: this.receipt_id,
            source_authority: this.source_authority,
            access_or_license_id: this.access_or_license_id,
            transaction_id: this.transaction_id,
            fetched_at: this.fetched_at,
            response_hash: this.response_hash,
            ttl_seconds: this.ttl_seconds,
            revoked: this.revoked,
        });
    }
}
exports.PSVReceipt = PSVReceipt;
