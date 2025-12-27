import { describe, it, expect, beforeEach } from '@jest/globals';
import { IssuerRegistryService } from '../service';
import type { IssuerAnchor } from '../models';

class InMemoryTrustLedger {
  public anchored: IssuerAnchor[] = [];

  async anchor(req: any): Promise<IssuerAnchor> {
    const anchor: IssuerAnchor = {
      type: req.type,
      txId: `tx-${this.anchored.length + 1}`,
      digest: `digest-${this.anchored.length + 1}`,
      anchoredAt: new Date(),
      metadata: req.payload,
    };
    this.anchored.push(anchor);
    return anchor;
  }
}

describe('IssuerRegistryService', () => {
  let trustLedger: InMemoryTrustLedger;
  let service: IssuerRegistryService;

  beforeEach(() => {
    trustLedger = new InMemoryTrustLedger();
    service = new IssuerRegistryService(trustLedger as any);
  });

  it('registers issuer with trust ledger anchor', async () => {
    const issuer = await service.registerIssuer({
      id: 'issuer-1',
      npiType2: '1234567890',
      metadata: { name: 'VitalCV Demo Issuer' },
    });

    expect(issuer.id).toBe('issuer-1');
    expect(issuer.npiType2).toBe('1234567890');
    expect(issuer.verified).toBe(false);
    expect(issuer.anchors).toHaveLength(1);
    expect(trustLedger.anchored).toHaveLength(1);
    expect(trustLedger.anchored[0].type).toBe('registration');
  });

  it('verifies issuer and appends verification anchor', async () => {
    await service.registerIssuer({
      id: 'issuer-2',
      npiType2: '0987654321',
    });

    const verified = await service.verifyIssuer({
      id: 'issuer-2',
      attestation: 'signed-attestation',
      verifierDid: 'did:web:vitalcv.verifier',
    });

    expect(verified.verified).toBe(true);
    expect(verified.anchors).toHaveLength(2);
    expect(verified.anchors[1].type).toBe('verification');
    expect(trustLedger.anchored).toHaveLength(2);
  });
});
