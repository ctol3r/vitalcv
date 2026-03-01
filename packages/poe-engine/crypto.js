"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Hex = sha256Hex;
exports.hashMerkleConcat = hashMerkleConcat;
const node_crypto_1 = require("node:crypto");
/**
 * SHA-256 hash returning lowercase hex.
 * Mirrors apps/api/backend/src/utils/deterministic.ts:sha256Hex
 */
function sha256Hex(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
}
/**
 * Hash-concat for Merkle tree internal nodes.
 * Mirrors apps/api/backend/src/utils/merkle.ts:hashMerkleConcat
 */
function hashMerkleConcat(left, right) {
    return sha256Hex(`${left}${right}`);
}
