import prisma from '../src/graphql/prisma_client';
import { sha256Hex } from '../src/utils/deterministic';
import {
  InMemoryCredentialIngestionRepository,
  PrismaCredentialIngestionRepository,
} from '../repositories/credentialIngestion.repo';
import {
  buildRunArtifactHash,
  createCredentialArtifactRecord,
  createVerificationArtifactRecord,
} from '../src/services/credentials/credentialIngestionArtifacts';
import type { PersistIngestionBundleInput } from '../src/services/credentials/credentialIngestionTypes';

function deterministicUuid(seed: string): string {
  const hex = sha256Hex(seed);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function buildPersistInput(
  npi: string,
  rawPayloadHash: string,
): PersistIngestionBundleInput {
  const credentialArtifact = createCredentialArtifactRecord({
    subject_npi: npi,
    source_name: 'npi-registry',
    credential_type: 'NPI_ENROLLMENT',
    issuer_org_id: 'cms:nppes',
    issued_at: '2026-03-13T12:00:00.000Z',
    expires_at: null,
    status: 'ACTIVE',
    metadata: {
      full_name: 'Seeded Provider',
      provider_type: 'INDIVIDUAL',
      taxonomy_code: '207Q00000X',
      practice_state: 'CA',
      practice_states: ['CA'],
    },
  });
  const verificationArtifact = createVerificationArtifactRecord({
    subject_npi: npi,
    source_name: 'npi-registry',
    related_credential_hash: credentialArtifact.credential_hash,
    source_type: 'NPPES',
    verification_method: 'API',
    verified_at: '2026-03-13T12:00:00.000Z',
    fresh_until: '2026-04-12T12:00:00.000Z',
    payload_json: {
      provider_name: 'Seeded Provider',
      practice_state: 'CA',
      source_status: 'ACTIVE',
    },
  });

  return {
    sourceName: 'npi-registry',
    rawPayloadHash,
    retrievedAt: '2026-03-13T12:00:00.000Z',
    runArtifactHash: buildRunArtifactHash([credentialArtifact, verificationArtifact]),
    provider: {
      npi,
      fullName: 'Seeded Provider',
      providerType: 'INDIVIDUAL',
      taxonomyCode: '207Q00000X',
      stateOfPractice: 'CA',
    },
    credentialArtifact: {
      id: deterministicUuid(`cred:${npi}:${rawPayloadHash}`),
      artifact: credentialArtifact,
      signature: 'sig-cred',
      signatureAlgorithm: 'ES256',
      signatureIssuedAt: '2026-03-13T12:00:01.000Z',
    },
    verificationArtifact: {
      id: deterministicUuid(`ver:${npi}:${rawPayloadHash}`),
      artifact: verificationArtifact,
      signature: 'sig-ver',
      signatureAlgorithm: 'ES256',
      signatureIssuedAt: '2026-03-13T12:00:01.000Z',
    },
    compatibilityArtifact: {
      npi,
      source: 'NPPES',
      status: 'ACTIVE',
      checksum: verificationArtifact.evidence_hash,
      rawPayload: verificationArtifact,
      verifiedAt: '2026-03-13T12:00:00.000Z',
      expiresAt: '2026-04-12T12:00:00.000Z',
      psvWindowStart: '2026-03-13T12:00:00.000Z',
      psvWindowDeadline: '2026-04-12T12:00:00.000Z',
      psvWindowCompliant: true,
      claimHashes: [credentialArtifact.credential_hash, verificationArtifact.evidence_hash],
    },
  };
}

async function cleanupNpi(npi: string): Promise<void> {
  await prisma.w2Artifact.deleteMany({
    where: {
      verificationRun: {
        provider: {
          npi,
        },
      },
    },
  });
  await prisma.verificationRun.deleteMany({
    where: {
      provider: {
        npi,
      },
    },
  });
  await prisma.provider.deleteMany({
    where: {
      npi,
    },
  });
  await prisma.verificationArtifact.deleteMany({
    where: {
      npi,
      source: {
        in: ['NPPES', 'OIG', 'STATE_BOARD'],
      },
    },
  });
}

describe('credential ingestion repository', () => {
  describe('in-memory repository', () => {
    test('persists bundle idempotently and returns active credentials', async () => {
      const repository = new InMemoryCredentialIngestionRepository();
      const input = buildPersistInput('1003000126', 'in-memory-hash');

      const first = await repository.persistIngestionBundle(input);
      const second = await repository.persistIngestionBundle(input);
      const active = await repository.findActiveCredentialsByNpi('1003000126');

      expect(first.idempotent).toBe(false);
      expect(second.idempotent).toBe(true);
      expect(active).toHaveLength(1);
      expect(active[0].artifact.credential_type).toBe('NPI_ENROLLMENT');
      expect(active[0].artifact.metadata?.practice_state).toBe('CA');
    });
  });

  describe('prisma repository', () => {
    const repository = new PrismaCredentialIngestionRepository();
    const npi = '1003000126';

    beforeEach(async () => {
      await cleanupNpi(npi);
    });

    afterAll(async () => {
      await cleanupNpi(npi);
    });

    test('persists W2 artifacts and compatibility verification artifact', async () => {
      const input = buildPersistInput(npi, 'prisma-hash');

      const persisted = await repository.persistIngestionBundle(input);
      const compatibility = await prisma.verificationArtifact.findFirst({
        where: {
          npi,
          source: 'NPPES',
        },
        select: {
          checksum: true,
          psvWindowDeadline: true,
          claimHashes: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      const active = await repository.findActiveCredentialsByNpi(npi);

      expect(persisted.idempotent).toBe(false);
      expect(compatibility).not.toBeNull();
      expect(compatibility?.checksum).toBe(input.compatibilityArtifact.checksum);
      expect(compatibility?.psvWindowDeadline?.toISOString()).toBe('2026-04-12T12:00:00.000Z');
      expect(compatibility?.claimHashes).toEqual(
        expect.arrayContaining(input.compatibilityArtifact.claimHashes),
      );
      expect(active).toHaveLength(1);
      expect(active[0].artifact.metadata?.practice_state).toBe('CA');
    });

    test('does not duplicate persistence on repeated source hash', async () => {
      const input = buildPersistInput(npi, 'repeat-prisma-hash');

      const first = await repository.persistIngestionBundle(input);
      const second = await repository.persistIngestionBundle(input);
      const runCount = await prisma.verificationRun.count({
        where: {
          provider: {
            npi,
          },
          sourceName: 'npi-registry',
          rawPayloadHash: 'repeat-prisma-hash',
        },
      });
      const artifactCount = await prisma.w2Artifact.count({
        where: {
          verificationRun: {
            provider: {
              npi,
            },
            sourceName: 'npi-registry',
            rawPayloadHash: 'repeat-prisma-hash',
          },
        },
      });

      expect(first.idempotent).toBe(false);
      expect(second.idempotent).toBe(true);
      expect(second.verificationRunId).toBe(first.verificationRunId);
      expect(runCount).toBe(1);
      expect(artifactCount).toBe(2);
    });
  });
});
