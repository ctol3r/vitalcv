/**
 * Launch blocker #14 — the revocation registry actually revokes.
 *
 * Each block below fails if one of the three original breaks returns:
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
 * These assert the OUTCOME a verifier observes — the bit decoded out of the
 * served credential — not the mechanism, so a refactor that preserves the
 * behaviour passes and one that quietly stops flipping bits fails.
 *
 * ISOLATION
 * ─────────
 * The status list is a singleton shared by the whole backend suite, so this
 * file deliberately does NOT reset it: every assertion is written against the
 * index it was just handed, which is correct whatever the cursor started at.
 * Cleanup deletes only the rows this file created, by id. An earlier revision
 * called `deleteMany({})` on VerificationArtifact and tripped
 * `AuditSnapshot_artifactId_fkey` against rows other suites had left behind —
 * it passed alone and failed in the full run.
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

const createdArtifactIds: string[] = [];
const createdNodeIds: string[] = [];
const createdEdgeIds: string[] = [];

/** Synthetic, deliberately invalid NPI (leading zero) — never a real person. */
let npiCounter = 0;
function syntheticNpi(): string {
  npiCounter += 1;
  return `0${String(npiCounter).padStart(9, '0')}`;
}

async function createArtifact(npi: string): Promise<string> {
  const artifact = await prisma.verificationArtifact.create({
    data: {
      npi,
      source: 'revocation-registry-test',
      status: 'active',
      checksum: `checksum-${npi}-${Date.now()}`,
      verifiedAt: new Date(),
    },
  });
  createdArtifactIds.push(artifact.id);
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

afterAll(async () => {
  // FK-safe order, scoped to this file's own rows.
  await prisma.authorityEdge.deleteMany({ where: { id: { in: createdEdgeIds } } });
  await prisma.knowledgeNode.deleteMany({ where: { id: { in: createdNodeIds } } });
  await prisma.auditSnapshot.deleteMany({ where: { artifactId: { in: createdArtifactIds } } });
  await prisma.verificationArtifact.deleteMany({ where: { id: { in: createdArtifactIds } } });
  await prisma.$disconnect();
});

describe('#14(a) — the status list state table exists and every DB path works', () => {
  it('assigns an index, flips the bit, and reads it back', async () => {
    const artifactId = await createArtifact(syntheticNpi());

    const index = await assignStatusIndex(artifactId);
    expect(typeof index).toBe('number');
    await expect(isRevoked(index)).resolves.toBe(false);

    await setRevoked(artifactId);
    await expect(isRevoked(index)).resolves.toBe(true);
  });

  it('serves a credential whose bitstring carries the flipped bit', async () => {
    const artifactId = await createArtifact(syntheticNpi());
    const index = await assignStatusIndex(artifactId);
    await setRevoked(artifactId);

    const credential: any = await getStatusListCredential();
    expect(credential.credentialSubject.type).toBe('BitstringStatusList');
    expect(credential.credentialSubject.statusPurpose).toBe('revocation');

    // The bit a verifier would actually read.
    expect(readBitFromCredential(credential, index)).toBe(1);
  });

  it('is idempotent — revoking twice leaves the bit set', async () => {
    const artifactId = await createArtifact(syntheticNpi());
    const index = await assignStatusIndex(artifactId);

    await setRevoked(artifactId);
    await setRevoked(artifactId);

    await expect(isRevoked(index)).resolves.toBe(true);
  });

  it('never hands out the bit reserved for the demo credential', async () => {
    const artifactId = await createArtifact(syntheticNpi());
    const index = await assignStatusIndex(artifactId);
    expect(index).not.toBe(DEMO_STATUS_LIST_INDEX);

    await expect(isRevoked(DEMO_STATUS_LIST_INDEX)).resolves.toBe(false);
  });
});

describe('#14(b) — a cascaded revocation flips the bit', () => {
  it('revokeClinician marks the artifact revoked in the served status list', async () => {
    const npi = syntheticNpi();
    const artifactId = await createArtifact(npi);
    const index = await assignStatusIndex(artifactId);

    const clinicianNode = await prisma.knowledgeNode.create({
      data: {
        entityType: 'CLINICIAN',
        entityId: `clinician-${artifactId}`,
        label: 'Test Clinician',
        attributes: { npi },
      },
    });
    createdNodeIds.push(clinicianNode.id);

    const credentialNode = await prisma.knowledgeNode.create({
      data: {
        entityType: 'CREDENTIAL',
        entityId: artifactId,
        label: 'Test Credential',
        attributes: {},
      },
    });
    createdNodeIds.push(credentialNode.id);

    const edge = await prisma.authorityEdge.create({
      data: {
        sourceNodeId: credentialNode.id,
        targetNodeId: clinicianNode.id,
        relationType: 'ISSUED_TO',
      },
    });
    createdEdgeIds.push(edge.id);

    await expect(isRevoked(index)).resolves.toBe(false);

    const edgesRevoked = await graphCascader.revokeClinician(npi, 'test-source');
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
