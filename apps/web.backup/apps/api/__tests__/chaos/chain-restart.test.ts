import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ChainClient } from '../../src/services/chain/client';

describe('Chaos: chain node restart', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch!;
    jest.restoreAllMocks();
  });

  it('builds local receipts while the node is crashed', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('connection reset'));
    global.fetch = fetchMock as any;

    const client = new ChainClient({ requestTimeoutMs: 25 });
    const payload = {
      merkleRoot: '0xdeadbeef',
      entryCount: 1,
      entries: [
        {
          type: 'verification',
          hash: '0xabc',
        },
      ],
      committedAt: new Date().toISOString(),
    };

    const receipt = await client.commitBatchRoot(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(receipt.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.raw).toEqual({ emulated: true });
  });

  it('recovers automatically once the RPC node is back online', async () => {
    const recoveredReceipt = {
      txHash: '0x1234',
      blockNumber: 99,
      timestamp: new Date().toISOString(),
    };

    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('node restarting'))
      .mockResolvedValueOnce(buildRpcResponse(recoveredReceipt));

    global.fetch = fetchMock as any;

    const client = new ChainClient({ requestTimeoutMs: 25 });

    const firstAttempt = await client.submitAuditEvent({
      eventType: 'credential_anchor',
      payload: { id: 'cred-1' },
    });
    const secondAttempt = await client.submitAuditEvent({
      eventType: 'credential_anchor',
      payload: { id: 'cred-2' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(firstAttempt.raw).toEqual({ emulated: true });
    expect(secondAttempt.raw).toEqual(recoveredReceipt);
    expect(secondAttempt.txHash).toBe(recoveredReceipt.txHash);
  });
});

function buildRpcResponse(result: any) {
  return {
    ok: true,
    json: async () => ({ result }),
  };
}

