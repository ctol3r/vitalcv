const crypto = require('crypto');
const polkadot = require('./polkadot_service');

/**
 * Represents a credential operation.
 * @typedef {Object} CredentialOp
 * @property {string} type - Operation type like 'ISSUE' or 'REVOKE'.
 * @property {string} credentialId - Identifier for the credential.
 * @property {any} payload - Additional data for the operation.
 */

class ZkRollupBatcher {
  constructor(batchSize = 10) {
    this.batchSize = batchSize;
    this.ops = [];
  }

  /**
   * Add an operation to the current batch.
   * When the batch is full, finalize and anchor the proof on-chain.
   * @param {CredentialOp} op
   * @returns {Promise<null|{proof: string, txHash: string, batch: CredentialOp[]}>}
   */
  async addOperation(op) {
    this.ops.push(op);
    if (this.ops.length >= this.batchSize) {
      return this.finalizeBatch();
    }
    return null;
  }

  /**
   * Finalize the current batch into a zk-rollup proof and anchor it on-chain.
   */
  async finalizeBatch() {
    const batch = this.ops;
    this.ops = [];
    const data = JSON.stringify(batch);
    const proof = crypto.createHash('sha256').update(data).digest('hex');
    const txHash = await polkadot.anchorProof(proof);
    return { proof, txHash, batch };
  }
}

module.exports = { ZkRollupBatcher };
