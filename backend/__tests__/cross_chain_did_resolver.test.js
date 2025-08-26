import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrossChainDIDResolver } from '../src/blockchain/cross_chain_did_resolver.js';

test('resolves DID using external resolver', async () => {
  const mockDoc = { id: 'did:example:123', '@context': ['https://www.w3.org/ns/did/v1'] };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ didDocument: mockDoc })
  });

  const resolver = new CrossChainDIDResolver('https://mock.resolver');
  const doc = await resolver.resolve('did:example:123');
  assert.deepEqual(doc, mockDoc);

  global.fetch = originalFetch;
});
