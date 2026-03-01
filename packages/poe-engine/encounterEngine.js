"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEncounterRoot = generateEncounterRoot;
const crypto_1 = require("./crypto");
const merkle_1 = require("./merkle");
function assertValidEncounter(encounter, index) {
    if (typeof encounter.date !== 'string' || encounter.date.trim().length === 0) {
        throw new Error(`encounter[${index}].date is required`);
    }
    if (typeof encounter.cptCode !== 'string' || encounter.cptCode.trim().length === 0) {
        throw new Error(`encounter[${index}].cptCode is required`);
    }
    if (typeof encounter.riskOutcome !== 'string' || encounter.riskOutcome.trim().length === 0) {
        throw new Error(`encounter[${index}].riskOutcome is required`);
    }
}
/**
 * Hash a single encounter into a leaf hash.
 * Uses a pipe-delimited canonical form prefixed with "encounter:" to avoid
 * collisions with the existing claim hash format (type:value).
 */
function hashEncounter(encounter) {
    const canonicalValue = [
        encounter.date.trim(),
        encounter.cptCode.trim(),
        encounter.riskOutcome.trim(),
        encounter.facilityHash?.trim() ?? '',
    ].join('|');
    return (0, crypto_1.sha256Hex)(`encounter:${canonicalValue}`);
}
/**
 * Generate a Merkle root from an array of encounter records.
 *
 * PHI ISOLATION: After computing leaf hashes, the raw encounter data
 * is no longer referenced. The caller MUST NOT persist the raw encounters.
 * The returned result contains ONLY the Merkle root, volume count,
 * and leaf hashes (opaque SHA-256 digests).
 */
function generateEncounterRoot(encounters) {
    if (!Array.isArray(encounters) || encounters.length === 0) {
        throw new Error('encounters array must be non-empty');
    }
    for (let i = 0; i < encounters.length; i++) {
        assertValidEncounter(encounters[i], i);
    }
    const leafHashes = encounters.map((enc) => hashEncounter(enc));
    const tree = (0, merkle_1.buildMerkleTreeFromLeafHashes)(leafHashes);
    return {
        merkleRoot: tree.root,
        volumeCount: encounters.length,
        leafHashes: tree.leaves,
        computedAt: new Date().toISOString(),
    };
}
