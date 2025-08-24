const assert = require('assert');
const { ZkRollupBatcher } = require('../src/blockchain/zk_rollup');

(async () => {
  const batcher = new ZkRollupBatcher(2);
  let result = await batcher.addOperation({ type: 'ISSUE', credentialId: '1', payload: {} });
  assert.strictEqual(result, null);

  result = await batcher.addOperation({ type: 'REVOKE', credentialId: '1', payload: {} });
  assert.ok(result.proof, 'proof should be generated');
  assert.strictEqual(result.batch.length, 2, 'batch should contain two ops');
  console.log('zk_rollup test passed');
})();
