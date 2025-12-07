import { describe, it, expect, jest } from '@jest/globals';
import { NCINodeType, TrustEntityType } from '@prisma/client';
import { buildNciGraph } from '../buildGraph.js';

describe('buildNciGraph', () => {
  it('builds clinician graphs with trust anchor and proofs', async () => {
    const prismaMock = {
      nCINode: {
        findUnique: jest.fn().mockResolvedValue({
          nodeId: 'node-1',
          did: 'did:example:graph',
          nodeType: NCINodeType.CLINICIAN,
          jurisdiction: 'CA',
          metadata: { orgId: 'org-1' },
          trustAnchorId: 'anchor-1',
          trustAnchor: {
            entityId: 'anchor-1',
            entityType: TrustEntityType.ISSUER,
            publicKey: 'pk',
            certificateChain: null,
            accreditation: 'ACCREDITED',
            jurisdiction: 'CA',
            isActive: true,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
      },
      clinicianProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'clinician-1',
          userId: 'user-1',
          npi: '1234567890',
          state: 'CA',
          user: { name: 'Test Clinician' },
        }),
      },
      stateLicenseVerification: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'lic-1', state: 'CA', licenseNumber: 'A1', status: 'ACTIVE', metadata: null },
        ]),
      },
      pECOSProvider: { findFirst: jest.fn().mockResolvedValue(null) },
      payerEnrollment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'payer-enroll-1',
            payerId: 'payer-1',
            payer: { id: 'payer-1', name: 'Payer One', requiresPecos: true, requiresMedicaid: false },
            metadata: null,
          },
        ]),
      },
      privilegeGranted: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'priv-1', orgId: 'org-1', status: 'ACTIVE', expiresAt: new Date() },
        ]),
      },
      credential: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'cred-1', type: 'TestVC', userId: 'user-1', metadata: { scope: 'clinical' } },
        ]),
      },
      credentialTimelineEvent: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'event-1', eventType: 'VC_ISSUED', metadata: { relatesToId: 'priv-1' } },
        ]),
      },
      compactsStatus: {
        findUnique: jest.fn().mockResolvedValue({
          clinicianDid: 'did:example:graph',
          imlcCompactStates: ['AZ'],
          psypactStates: [],
          counselingStates: [],
        }),
      },
      nCIVerifiableProof: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'proof-1',
            did: 'did:example:graph',
            proofType: 'ISSUANCE',
            eventType: 'VC_ISSUED',
            anchorTxHash: '0x123',
            chainId: 'testnet',
            issuedFor: 'anchor-1',
          },
        ]),
      },
    };

    const graph = await buildNciGraph({
      did: 'did:example:graph',
      includeProofs: true,
      prismaClient: prismaMock as never,
    });

    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(Array.from(graph.nodes.keys())).toContain('proof:proof-1');
    expect(graph.edges.some((edge) => edge.relationType === 'VERIFIED_BY')).toBe(true);
  });
});
