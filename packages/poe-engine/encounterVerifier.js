"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEncounterRoot = verifyEncounterRoot;
const merkle_1 = require("./merkle");
/**
 * Verify that a set of leaf hashes produces the claimed Merkle root.
 * This is the verifier-side operation: given the leaf hashes from the
 * PoE credential, rebuild the tree and check the root matches.
 */
function verifyEncounterRoot(leafHashes, claimedRoot) {
    if (!Array.isArray(leafHashes) || leafHashes.length === 0) {
        return {
            valid: false,
            expectedRoot: claimedRoot,
            actualRoot: '',
            volumeCount: 0,
        };
    }
    try {
        const tree = (0, merkle_1.buildMerkleTreeFromLeafHashes)(leafHashes);
        return {
            valid: tree.root === claimedRoot,
            expectedRoot: claimedRoot,
            actualRoot: tree.root,
            volumeCount: leafHashes.length,
        };
    }
    catch {
        return {
            valid: false,
            expectedRoot: claimedRoot,
            actualRoot: '',
            volumeCount: leafHashes.length,
        };
    }
}
