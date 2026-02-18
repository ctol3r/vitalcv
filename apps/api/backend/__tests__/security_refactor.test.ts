import { buildMerkleTree, buildMerkleProofPath } from '../src/utils/merkle';
import { computeCredentialState } from '../src/services/credentialStatusEngine';
import { verifyClaimProof, generateClaimProof, reconstructCanonicalClaims } from '../src/services/selectiveProofEngine';
import type { ClaimProof } from '../src/types/selectiveProof';
import { evaluateHaipNoDowngrade } from '../src/utils/haip';
import { resolveCrossOrgTrustLevel, type TrustLevel } from '../src/utils/federation';
import {
  computeCrossCheckBundleChecksum,
  type CrossCheckBundleCorePayload,
} from '../src/services/crossCheckBundleEngine';
import { runRuntimeGuards } from '../src/services/runtimeGuards';

type CanonicalClaimLike = {
  type: string;
  value: string;
};

describe('Backend security refactor validation', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    STRICT_TRANSITION_MODE: process.env.STRICT_TRANSITION_MODE,
    ISSUER_DID: process.env.ISSUER_DID,
    ISSUER_SIGNING_JWK: process.env.ISSUER_SIGNING_JWK,
    DATABASE_URL: process.env.DATABASE_URL,
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.STRICT_TRANSITION_MODE = 'false';
    process.env.ISSUER_DID = 'did:web:vitalcv.com';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.STRICT_TRANSITION_MODE = originalEnv.STRICT_TRANSITION_MODE;
    process.env.ISSUER_DID = originalEnv.ISSUER_DID;
    process.env.ISSUER_SIGNING_JWK = originalEnv.ISSUER_SIGNING_JWK;
    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
  });

  it('builds deterministic Merkle roots for reordered claims', () => {
    const claimsA = [
      { type: 'licenseStatus', value: 'ACTIVE' },
      { type: 'npi', value: '1234567890' },
      { type: 'source', value: 'NURSYS' },
    ];

    const claimsB = [
      { type: 'source', value: 'NURSYS' },
      { type: 'npi', value: '1234567890' },
      { type: 'licenseStatus', value: 'ACTIVE' },
    ];

    const treeA = buildMerkleTree(claimsA as CanonicalClaimLike[]);
    const treeB = buildMerkleTree(claimsB as CanonicalClaimLike[]);

    expect(treeA.root).toBe(treeB.root);
    expect(treeA.leaves).toEqual(treeB.leaves);
    expect(treeA.levels).toEqual(treeB.levels);
  });

  it('rejects a tampered claim proof during verification', () => {
    const artifact = {
      npi: '1234567890',
      status: 'ACTIVE',
      rawPayload: {
        jurisdiction: 'CA',
        sourceUrl: 'https://www.nursys.com/LLV/LLVVerification.aspx?npi=1234567890',
        lastUpdated: '2026-02-16T00:00:00.000Z',
        expirationDate: '2028-02-16T00:00:00.000Z',
        extra: 'keep',
      },
      checksum: 'fingerprint',
      merkleRoot: '',
      claimHashes: [] as string[],
      verifiedAt: new Date('2026-02-16T00:00:00.000Z'),
      expiresAt: new Date('2028-02-16T00:00:00.000Z'),
    };

    // Build Merkle tree from the same canonical claims the engine will reconstruct
    const canonicalClaims = reconstructCanonicalClaims(artifact);
    const tree = buildMerkleTree(canonicalClaims);
    artifact.merkleRoot = tree.root;
    artifact.claimHashes = tree.leaves;

    const proofInput = generateClaimProof(artifact, 'licenseStatus');

    const canonicalProof: ClaimProof = {
      claimType: proofInput.claimType,
      claimValue: proofInput.claimValue,
      leafHash: proofInput.leafHash,
      leafIndex: proofInput.leafIndex,
      proofPath: proofInput.proofPath,
      merkleRoot: proofInput.merkleRoot,
      fingerprint: proofInput.fingerprint,
    };

    expect(verifyClaimProof(canonicalProof)).toBe(true);

    const malformedProof: ClaimProof = {
      ...canonicalProof,
      leafHash: `${canonicalProof.leafHash}00`,
    };
    expect(verifyClaimProof(malformedProof)).toBe(false);
  });

  it('maps credential lifecycle transitions deterministically with strict null defaults', () => {
    const now = new Date('2026-02-16T00:00:00.000Z');

    expect(
      computeCredentialState(
        {
          revokedAt: new Date('2026-02-10T00:00:00.000Z'),
          suspendedAt: null,
          expiresAt: new Date('2028-02-16T00:00:00.000Z'),
          status: 'ACTIVE',
        },
        now,
      ),
    ).toBe('revoked');

    expect(
      computeCredentialState(
        {
          revokedAt: null,
          suspendedAt: new Date('2026-02-14T00:00:00.000Z'),
          expiresAt: new Date('2028-02-16T00:00:00.000Z'),
          status: 'ACTIVE',
        },
        now,
      ),
    ).toBe('suspended');

    expect(
      computeCredentialState(
        {
          revokedAt: null,
          suspendedAt: null,
          expiresAt: new Date('2026-02-15T23:59:59.000Z'),
          status: 'ACTIVE',
        },
        now,
      ),
    ).toBe('expired');

    expect(
      computeCredentialState(
        {
          revokedAt: null,
          suspendedAt: null,
          expiresAt: null,
          status: undefined,
        },
        now,
      ),
    ).toBe('active');

    expect(
      computeCredentialState(
        {
          revokedAt: null,
          suspendedAt: null,
          expiresAt: new Date('2026-02-17T00:00:00.000Z'),
          status: 'needs_review',
        },
        now,
      ),
    ).toBe('suspended');

    expect(
      computeCredentialState(
        {
          revokedAt: null,
          suspendedAt: null,
          expiresAt: new Date('2027-02-17T00:00:00.000Z'),
          status: 'revoked',
        },
        now,
      ),
    ).toBe('revoked');
  });

  it('enforces HAIP no-downgrade policy for algorithm, token mode, and issuer DID', () => {
    const valid = evaluateHaipNoDowngrade({
      algorithm: 'ES256',
      signed: true,
      tokenType: 'dpop',
      issuerDid: 'did:web:vitalcv.com',
    });
    expect(valid.valid).toBe(true);
    expect(valid.violations).toHaveLength(0);

    const badAlg = evaluateHaipNoDowngrade({
      algorithm: 'RS256',
      signed: true,
      tokenType: 'dpop',
      issuerDid: 'did:web:vitalcv.com',
    });
    expect(badAlg.valid).toBe(false);
    expect(badAlg.violations.some((entry) => entry.includes('ES256'))).toBe(true);

    const forgedDid = evaluateHaipNoDowngrade({
      algorithm: 'ES256',
      signed: true,
      tokenType: 'dpop',
      issuerDid: 'did:web:attacker.example',
    });
    expect(forgedDid.valid).toBe(false);
    expect(forgedDid.violations.some((entry) => entry.includes('issuer DID'))).toBe(true);

    const bearer = evaluateHaipNoDowngrade({
      algorithm: 'ES256',
      signed: true,
      tokenType: 'bearer',
      issuerDid: 'did:web:vitalcv.com',
    });
    expect(bearer.valid).toBe(false);
    expect(bearer.violations.some((entry) => entry.includes('Bearer'))).toBe(true);
  });

  it('supports federation trust resolution for same-tenant, cross-tenant, and missing requests', async () => {
    const sameOrg = await resolveCrossOrgTrustLevel({
      requestOrganizationId: 'org-1',
      artifactOrganizationId: 'org-1',
      isSuperAdmin: false,
      resolveTrustLevel: async () => 'partial' as const,
    });
    expect(sameOrg).toBe('full');

    const noTenant = await resolveCrossOrgTrustLevel({
      requestOrganizationId: undefined,
      artifactOrganizationId: 'org-1',
      isSuperAdmin: false,
      resolveTrustLevel: async () => 'partial' as const,
    });
    expect(noTenant).toBeNull();

    const bypass = await resolveCrossOrgTrustLevel({
      requestOrganizationId: 'org-a',
      artifactOrganizationId: 'org-b',
      isSuperAdmin: false,
      resolveTrustLevel: async () => 'partial' as const,
    });
    expect(bypass).toBe('partial');

    const denied = await resolveCrossOrgTrustLevel({
      requestOrganizationId: 'org-a',
      artifactOrganizationId: 'org-b',
      isSuperAdmin: false,
      resolveTrustLevel: async (): Promise<TrustLevel | null> => null,
    });
    expect(denied).toBeNull();
  });

  it('keeps cross-check bundle checksum stable across time and entry ordering', () => {
    const basePayload: CrossCheckBundleCorePayload = {
      artifactId: 'artifact-1',
      fingerprint: 'fingerprint',
      merkleRoot: 'merkle-root',
      lifecycleState: 'ACTIVE',
      pecosEnrollmentStatus: true,
      nursysEventCount: 3,
      transparencyEntries: [
        {
          fingerprint: 'fp-a',
          merkleRoot: 'mr-a',
          lifecycleState: 'ACTIVE',
          createdAt: '2026-02-16T10:00:00.000Z',
        },
        {
          fingerprint: 'fp-b',
          merkleRoot: 'mr-b',
          lifecycleState: 'ACTIVE',
          createdAt: '2026-02-16T09:00:00.000Z',
        },
      ],
      crossCheckPass: true,
    };

    const generatedAt = computeCrossCheckBundleChecksum(basePayload);
    const reordered = computeCrossCheckBundleChecksum({
      ...basePayload,
      transparencyEntries: [...basePayload.transparencyEntries].reverse(),
    });
    const withSame = computeCrossCheckBundleChecksum({
      ...basePayload,
      artifactId: 'artifact-1',
      nursysEventCount: 3,
    });

    expect(generatedAt).toBe(reordered);
    expect(generatedAt).toBe(withSame);
  });

  it('rejects startup when production strict mode is disabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.STRICT_TRANSITION_MODE = 'false';
    process.env.DATABASE_URL = 'postgres://test';
    process.env.ISSUER_SIGNING_JWK = JSON.stringify({
      kty: 'EC',
      crv: 'P-256',
      x: 'aa',
      y: 'bb',
      d: 'cc',
      alg: 'ES256',
      use: 'sig',
    });

    expect(() => runRuntimeGuards()).toThrow(/STRICT_TRANSITION_MODE must be true in production/);
  });
});
