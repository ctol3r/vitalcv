import type { CascadeResult } from '../../decision/revocationCascade';

const propagateRevocation = jest.fn<Promise<CascadeResult>, [string]>();

jest.mock('../../decision/revocationCascade', () => ({
  revocationCascade: {
    propagateRevocation: (credentialId: string) => propagateRevocation(credentialId),
  },
}));

import {
  getRevocationEntry,
  revokeCredentialWithCascade,
} from '../revocationRegistry';

let counter = 0;

function nextCredentialId(): string {
  counter += 1;
  return `credential-revocation-${counter}`;
}

function makeCascadeResult(credentialId: string): CascadeResult {
  return {
    trigger: 'credential.revoked',
    credentialId,
    subjectNpi: '1234567890',
    affectedCapsules: [],
    totalAffected: 0,
    invalidatedCount: 0,
    atRiskCount: 0,
    auditEventIds: [],
    outbox: {
      outboxIds: [],
      totalEnqueued: 0,
    },
    trustState: null,
    bidirectionalFlagged: 0,
    bidirectionalAcceptancesFlagged: 0,
    bidirectionalStartsFlagged: 0,
    bidirectionalTraversalHash: null,
    cascadedAt: '2026-03-07T00:00:00.000Z',
  };
}

describe('revokeCredentialWithCascade', () => {
  beforeEach(() => {
    propagateRevocation.mockReset();
  });

  it('stores the revocation entry and propagates the cascade', async () => {
    const credentialId = nextCredentialId();
    propagateRevocation.mockResolvedValue(makeCascadeResult(credentialId));

    const result = await revokeCredentialWithCascade({
      credentialId,
      issuer: 'did:vitalcv:issuer:test',
      reason: 'manual revoke',
    });

    expect(getRevocationEntry(credentialId)).toEqual(result.entry);
    expect(propagateRevocation).toHaveBeenCalledWith(credentialId);
    expect(result.cascadeTriggered).toBe(true);
    expect(result.cascadeResult?.credentialId).toBe(credentialId);
  });

  it('preserves the revocation entry even when cascade propagation fails', async () => {
    const credentialId = nextCredentialId();
    propagateRevocation.mockRejectedValue(new Error('database unavailable'));

    const result = await revokeCredentialWithCascade({
      credentialId,
      issuer: 'did:vitalcv:issuer:test',
      reason: 'forced revoke',
    });

    expect(getRevocationEntry(credentialId)?.reason).toBe('forced revoke');
    expect(propagateRevocation).toHaveBeenCalledWith(credentialId);
    expect(result.cascadeTriggered).toBe(false);
    expect(result.cascadeResult).toBeNull();
  });
});
