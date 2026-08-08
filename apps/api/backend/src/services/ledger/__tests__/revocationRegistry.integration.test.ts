/**
 * Launch blocker #14 — the revocation registry actually revokes.
 *
 * Each describe block below fails if one of the three original breaks returns:
 *
 *   (a) `model StatusListState` missing from schema.prisma → every DB path in
 *       statusListManager throws. These tests exercise those paths against a
 *       real database, which is precisely what no existing test did — which is
 *       why CI stayed green for the entire time the manager was dead.
 *   (b) GraphCascader.setRevocationBit only bumped `version` and never flipped
 *       the bit, so a cascaded revocation still read "not revoked".
 *   (c) /api/credentials/status-list was missing from the tenant-guard
 *       skip-list and 401'd the unauthenticated verifiers it exists to serve.
 *
 * These assert the OUTCOME a verifier observes (is the bit set in the served
 * list?), not the mechanism, so a future refactor that keeps the behaviour
 * passes and one that quietly stops flipping bits fails.
 */

import { gunzipSync } from 'node:zlib';
import prisma from '../../../graphql/prisma_client';
import { shouldSkipTenantContext } from '../../../middleware/tenantGuard';
import {
  assignStatusIndex,
  getStatusListCredential,
  isRevoked,
  setRevoked,
  DEMO_STATUS_LIST_INDEX,
} from '../statusListManager';
import { graphCascader } from '../../intelligence/graphCascader';

const TEST_NPI = '1407202518';

async function resetState(): Promise<void> {
  await prisma.authorityEdge.deleteMany({});
  await prisma.knowledgeNode.deleteMany({});
  await prisma.verificationArtifact.deleteMany({});
  await prisma.statusListState.deleteMany({});
}

async function createArtifact(npi = TEST_NPI): Promise<string> {
  const artifact = await prisma.verificationArtifact.create({
    data: {
      npi,
      source: 'test',
      status: 'active',
      checksum: `checksum-${Math.random().toString(36).slice(2)}`,
      verifiedAt: new Date(),
    },
  });
  return artifact.id;
}

/** Decode the bitstring out of the served credential, as a verifier would. */
function readBitFromCredential(credential: any, index: number): 0 | 1 {
  const encoded: string = credential.credentialSubject.encodedList;
  const withoutMultibase = encoded.startsWith('u') ? encoded.slice(1) : encoded;
  const bytes = gunzipSync(Buffer.from(withoutMultibase, 'base64url'));
  const byte = bytes[Math.floor(index / 8)];
  return ((byte >> (7 - (index % 8))) & 1) as 0 | 1;
}

describe('#14(a) — the status list state table exists and every DB path works', () => {
  beforeEach(resetState);
  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('assigns an index, flips the bit, and reads it back', async () => {
    const artifactId = await createArtifact();

    const index = await assignStatusIndex(artifactId);
    expect(typeof index).toBe('number');
    await expect(isRevoked(index)).resolves.toBe(false);

    await setRevoked(artifactId);
    await expect(isRevoked(index)).resolves.toBe(true);
  });

  it('serves a credential whose bitstring carries the flipped bit', async () => {
    const artifactId = await createArtifact();
    const index = await assignStatusIndex(artifactId);
    await setRevoked(artifactId);

    const credential: any = await getStatusListCredential();
    expect(credential.credentialSubject.type).toBe('BitstringStatusList');
    expect(credential.credentialSubject.statusPurpose).toBe('revocation');

    // The bit a verifier would actually read.
    expect(readBitFromCredential(credential, index)).toBe(1);
  });

  it('is idempotent — revoking twice leaves the bit set', async () => {
    const artifactId = await createArtifact();
    const index = await assignStatusIndex(artifactId);

    await setRevoked(artifactId);
    await setRevoked(artifactId);

    await expect(isRevoked(index)).resolves.toBe(true);
  });

  it('never hands out the bit reserved for the demo credential', async () => {
    const artifactId = await createArtifact();
    const index = await assignStatusIndex(artifactId);
    expect(index).not.toBe(DEMO_STATUS_LIST_INDEX);

    const credential: any = await getStatusListCredential();
    expect(readBitFromCredential(credential, DEMO_STATUS_LIST_INDEX)).toBe(0);
  });
});

describe('#14(b) — a cascaded revocation flips the bit', () => {
  beforeEach(resetState);
  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('revokeClinician marks the artifact revoked in the served status list', async () => {
    const artifactId = await createArtifact();
    const index = await assignStatusIndex(artifactId);

    const clinicianNode = await prisma.knowledgeNode.create({
      data: {
        entityType: 'CLINICIAN',
        entityId: `clinician-${artifactId}`,
        label: 'Test Clinician',
        attributes: { npi: TEST_NPI },
      },
    });

    const credentialNode = await prisma.knowledgeNode.create({
      data: {
        entityType: 'CREDENTIAL',
        entityId: artifactId,
        label: 'Test Credential',
        attributes: {},
      },
    });

    await prisma.authorityEdge.create({
      data: {
        sourceNodeId: credentialNode.id,
        targetNodeId: clinicianNode.id,
        relationType: 'ISSUED_TO',
      },
    });

    await expect(isRevoked(index)).resolves.toBe(false);

    const edgesRevoked = await graphCascader.revokeClinician(TEST_NPI, 'test-source');
    expect(edgesRevoked).toBe(1);

    // The outcome that matters: a verifier reading the served list sees it.
    await expect(isRevoked(index)).resolves.toBe(true);
    const credential: any = await getStatusListCredential();
    expect(readBitFromCredential(credential, index)).toBe(1);
  });
});

describe('#14(c) — the status list is reachable without org context', () => {
  it('skips the tenant guard for the status list route', () => {
    expect(shouldSkipTenantContext('/api/credentials/status-list')).toBe(true);
  });

  it('does not blanket-skip the rest of /api/credentials', () => {
    expect(shouldSkipTenantContext('/api/credentials/issue')).toBe(false);
  });
});
