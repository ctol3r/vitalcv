import { Prisma } from '@prisma/client';
import prisma from '../src/graphql/prisma_client';
import { computeCredentialState } from '../src/services/credentialStatusEngine';
import { computeTrustState } from '../src/services/trustState';
import { CredentialLifecycleState } from '../src/utils/lifecycleState';
import {
  isCanonicalCredentialArtifact,
  isCanonicalVerificationArtifact,
  type ActiveCredentialArtifactRecord,
  type CanonicalCredentialArtifact,
  type CanonicalVerificationArtifact,
  type CompatibilityVerificationArtifactInput,
  type PersistableCanonicalArtifact,
  type PersistIngestionBundleInput,
  type PersistedIngestionBundle,
} from '../src/services/credentials/credentialIngestionTypes';

export interface CredentialIngestionRepository {
  persistIngestionBundle(input: PersistIngestionBundleInput): Promise<PersistedIngestionBundle>;
  createCredentialArtifact(
    verificationRunId: string,
    artifact: PersistableCanonicalArtifact<CanonicalCredentialArtifact>,
  ): Promise<{ id: string }>;
  createVerificationArtifact(
    verificationRunId: string,
    artifact: PersistableCanonicalArtifact<CanonicalVerificationArtifact>,
  ): Promise<{ id: string }>;
  findActiveCredentialsByNpi(npi: string): Promise<ActiveCredentialArtifactRecord[]>;
}

type VerificationRunRecord = {
  id: string;
  providerId: string;
  retrievedAtUtc: Date;
  artifacts: Array<{
    id: string;
    artifactJson: Prisma.JsonValue;
  }>;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function mapCompatibilityStatusForState(status: string): string {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'CLEAR') {
    return 'VERIFIED';
  }
  if (normalized === 'DEACTIVATED' || normalized === 'EXCLUDED' || normalized === 'CHECK_FAILED') {
    return 'PENDING';
  }
  return normalized;
}

function deriveCompatibilityLifecycleState(
  artifact: CompatibilityVerificationArtifactInput,
): CredentialLifecycleState {
  const normalizedStatus = artifact.status.trim().toUpperCase();
  if (normalizedStatus === 'EXCLUDED' || normalizedStatus === 'CHECK_FAILED') {
    return CredentialLifecycleState.SUSPENDED;
  }
  if (normalizedStatus === 'DEACTIVATED' || normalizedStatus === 'NOT_FOUND' || normalizedStatus === 'NOT_AVAILABLE') {
    return CredentialLifecycleState.SUSPENDED;
  }

  return computeCredentialState(
    {
      revokedAt: normalizedStatus === 'REVOKED' ? new Date(artifact.verifiedAt) : null,
      suspendedAt:
        normalizedStatus === 'SUSPENDED' ? new Date(artifact.verifiedAt) : null,
      expiresAt: toDate(artifact.expiresAt),
      status: mapCompatibilityStatusForState(artifact.status),
    },
    new Date(artifact.verifiedAt),
  );
}

function deriveCompatibilityTrustState(artifact: CompatibilityVerificationArtifactInput): string {
  return computeTrustState(
    {
      status: mapCompatibilityStatusForState(artifact.status),
      expiresAt: toDate(artifact.expiresAt),
      monitoring: false,
    },
    new Date(artifact.verifiedAt),
  );
}

function toActiveCredentialArtifactRecord(
  verificationRunId: string,
  artifactId: string,
  artifactJson: Prisma.JsonValue,
  createdAt: Date,
): ActiveCredentialArtifactRecord | null {
  if (!isCanonicalCredentialArtifact(artifactJson)) {
    return null;
  }

  return {
    artifactId,
    verificationRunId,
    artifact: artifactJson,
    createdAt: createdAt.toISOString(),
  };
}

function extractPersistedArtifacts(run: VerificationRunRecord): {
  credentialArtifactId: string;
  credentialArtifact: CanonicalCredentialArtifact;
  verificationArtifactId: string;
  verificationArtifact: CanonicalVerificationArtifact;
} {
  let credentialArtifactId = '';
  let verificationArtifactId = '';
  let credentialArtifact: CanonicalCredentialArtifact | null = null;
  let verificationArtifact: CanonicalVerificationArtifact | null = null;

  for (const artifact of run.artifacts) {
    if (!credentialArtifact && isCanonicalCredentialArtifact(artifact.artifactJson)) {
      credentialArtifact = artifact.artifactJson;
      credentialArtifactId = artifact.id;
      continue;
    }
    if (!verificationArtifact && isCanonicalVerificationArtifact(artifact.artifactJson)) {
      verificationArtifact = artifact.artifactJson;
      verificationArtifactId = artifact.id;
    }
  }

  if (!credentialArtifact || !verificationArtifact) {
    throw new Error(`Verification run ${run.id} is missing canonical ingestion artifacts.`);
  }

  return {
    credentialArtifactId,
    credentialArtifact,
    verificationArtifactId,
    verificationArtifact,
  };
}

export class PrismaCredentialIngestionRepository implements CredentialIngestionRepository {
  async persistIngestionBundle(input: PersistIngestionBundleInput): Promise<PersistedIngestionBundle> {
    const existingRun = await this.findRunBySourceHash(
      input.provider.npi,
      input.sourceName,
      input.rawPayloadHash,
    );

    if (existingRun) {
      const persistedArtifacts = extractPersistedArtifacts(existingRun);
      const compatibilityArtifactId = await this.findCompatibilityArtifactId(
        input.compatibilityArtifact,
      );

      if (!compatibilityArtifactId) {
        throw new Error(`Compatibility artifact missing for verification run ${existingRun.id}.`);
      }

      return {
        providerId: existingRun.providerId,
        verificationRunId: existingRun.id,
        compatibilityArtifactId,
        idempotent: true,
        ...persistedArtifacts,
      };
    }

    return prisma.$transaction(async (tx) => {
      const provider = await this.upsertProvider(tx, input);
      const run = await tx.verificationRun.create({
        data: {
          providerId: provider.id,
          sourceName: input.sourceName,
          retrievedAtUtc: new Date(input.retrievedAt),
          rawPayloadHash: input.rawPayloadHash,
          artifactHash: input.runArtifactHash,
        },
        select: {
          id: true,
          providerId: true,
        },
      });

      const credentialArtifact = await this.createCredentialArtifactWithTx(
        tx,
        run.id,
        input.credentialArtifact,
      );
      const verificationArtifact = await this.createVerificationArtifactWithTx(
        tx,
        run.id,
        input.verificationArtifact,
      );
      const compatibilityArtifact = await this.upsertCompatibilityArtifactWithTx(
        tx,
        input.compatibilityArtifact,
      );

      return {
        providerId: run.providerId,
        verificationRunId: run.id,
        credentialArtifactId: credentialArtifact.id,
        verificationArtifactId: verificationArtifact.id,
        compatibilityArtifactId: compatibilityArtifact.id,
        idempotent: false,
        credentialArtifact: input.credentialArtifact.artifact,
        verificationArtifact: input.verificationArtifact.artifact,
      };
    });
  }

  async createCredentialArtifact(
    verificationRunId: string,
    artifact: PersistableCanonicalArtifact<CanonicalCredentialArtifact>,
  ): Promise<{ id: string }> {
    return this.createCredentialArtifactWithTx(prisma, verificationRunId, artifact);
  }

  async createVerificationArtifact(
    verificationRunId: string,
    artifact: PersistableCanonicalArtifact<CanonicalVerificationArtifact>,
  ): Promise<{ id: string }> {
    return this.createVerificationArtifactWithTx(prisma, verificationRunId, artifact);
  }

  async findActiveCredentialsByNpi(npi: string): Promise<ActiveCredentialArtifactRecord[]> {
    const runs = await prisma.verificationRun.findMany({
      where: {
        provider: {
          npi,
        },
      },
      include: {
        artifacts: {
          select: {
            id: true,
            artifactJson: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        retrievedAtUtc: 'desc',
      },
    });

    return runs
      .flatMap((run) =>
        run.artifacts
          .map((artifact) =>
            toActiveCredentialArtifactRecord(run.id, artifact.id, artifact.artifactJson, artifact.createdAt),
          )
          .filter((artifact): artifact is ActiveCredentialArtifactRecord => Boolean(artifact)),
      )
      .filter((artifact) => {
        const expiresAt = artifact.artifact.expires_at;
        if (artifact.artifact.status !== 'ACTIVE' && artifact.artifact.status !== 'VERIFIED' && artifact.artifact.status !== 'CLEAR') {
          return false;
        }
        return !expiresAt || Date.parse(expiresAt) > Date.now();
      });
  }

  private async upsertProvider(
    tx: Prisma.TransactionClient,
    input: PersistIngestionBundleInput,
  ): Promise<{ id: string }> {
    return tx.provider.upsert({
      where: {
        npi: input.provider.npi,
      },
      update: {
        fullName: input.provider.fullName,
        providerType: input.provider.providerType,
        taxonomyCode: input.provider.taxonomyCode,
        stateOfPractice: input.provider.stateOfPractice,
      },
      create: {
        npi: input.provider.npi,
        fullName: input.provider.fullName,
        providerType: input.provider.providerType,
        taxonomyCode: input.provider.taxonomyCode,
        stateOfPractice: input.provider.stateOfPractice,
      },
      select: {
        id: true,
      },
    });
  }

  private async findRunBySourceHash(
    npi: string,
    sourceName: string,
    rawPayloadHash: string,
  ): Promise<VerificationRunRecord | null> {
    return prisma.verificationRun.findFirst({
      where: {
        sourceName,
        rawPayloadHash,
        provider: {
          npi,
        },
      },
      include: {
        artifacts: {
          select: {
            id: true,
            artifactJson: true,
          },
        },
      },
      orderBy: {
        retrievedAtUtc: 'desc',
      },
    });
  }

  private async findCompatibilityArtifactId(
    artifact: CompatibilityVerificationArtifactInput,
  ): Promise<string | null> {
    const existing = await prisma.verificationArtifact.findFirst({
      where: {
        npi: artifact.npi,
        source: artifact.source,
        checksum: artifact.checksum,
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return existing?.id ?? null;
  }

  private async createCredentialArtifactWithTx(
    tx: Prisma.TransactionClient | typeof prisma,
    verificationRunId: string,
    artifact: PersistableCanonicalArtifact<CanonicalCredentialArtifact>,
  ): Promise<{ id: string }> {
    return tx.w2Artifact.create({
      data: {
        id: artifact.id,
        verificationRunId,
        artifactJson: toJsonValue(artifact.artifact),
        signature: artifact.signature,
        signatureAlgorithm: artifact.signatureAlgorithm,
        signatureIssuedAt: new Date(artifact.signatureIssuedAt),
      },
      select: {
        id: true,
      },
    });
  }

  private async createVerificationArtifactWithTx(
    tx: Prisma.TransactionClient | typeof prisma,
    verificationRunId: string,
    artifact: PersistableCanonicalArtifact<CanonicalVerificationArtifact>,
  ): Promise<{ id: string }> {
    return tx.w2Artifact.create({
      data: {
        id: artifact.id,
        verificationRunId,
        artifactJson: toJsonValue(artifact.artifact),
        signature: artifact.signature,
        signatureAlgorithm: artifact.signatureAlgorithm,
        signatureIssuedAt: new Date(artifact.signatureIssuedAt),
      },
      select: {
        id: true,
      },
    });
  }

  private async upsertCompatibilityArtifactWithTx(
    tx: Prisma.TransactionClient,
    artifact: CompatibilityVerificationArtifactInput,
  ): Promise<{ id: string }> {
    const existing = await tx.verificationArtifact.findFirst({
      where: {
        npi: artifact.npi,
        source: artifact.source,
        checksum: artifact.checksum,
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const payload = {
      npi: artifact.npi,
      source: artifact.source,
      ...artifact.rawPayload,
    };
    const data = {
      npi: artifact.npi,
      source: artifact.source,
      status: artifact.status,
      rawPayload: toJsonValue(payload),
      checksum: artifact.checksum,
      claimHashes: toJsonValue([...artifact.claimHashes]),
      lifecycleState: deriveCompatibilityLifecycleState(artifact),
      statusLastChecked: new Date(artifact.verifiedAt),
      psvWindowStart: new Date(artifact.psvWindowStart),
      psvWindowDeadline: new Date(artifact.psvWindowDeadline),
      psvWindowCompliant: artifact.psvWindowCompliant,
      verifiedAt: new Date(artifact.verifiedAt),
      expiresAt: toDate(artifact.expiresAt),
      monitoring: false,
      trustState: deriveCompatibilityTrustState(artifact),
    };

    if (existing) {
      return tx.verificationArtifact.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
        },
      });
    }

    return tx.verificationArtifact.create({
      data,
      select: {
        id: true,
      },
    });
  }
}

export class InMemoryCredentialIngestionRepository implements CredentialIngestionRepository {
  private readonly providers = new Map<string, { id: string; npi: string }>();
  private readonly runs = new Map<string, {
    id: string;
    providerId: string;
    providerNpi: string;
    sourceName: string;
    rawPayloadHash: string;
    createdAt: string;
    artifacts: Array<{
      id: string;
      artifactJson: CanonicalCredentialArtifact | CanonicalVerificationArtifact;
    }>;
  }>();
  private readonly compatibilityArtifacts = new Map<string, {
    id: string;
    artifact: CompatibilityVerificationArtifactInput;
  }>();

  async persistIngestionBundle(input: PersistIngestionBundleInput): Promise<PersistedIngestionBundle> {
    const existingRun = Array.from(this.runs.values())
      .find((run) => run.providerNpi === input.provider.npi && run.sourceName === input.sourceName && run.rawPayloadHash === input.rawPayloadHash);

    if (existingRun) {
      const credential = existingRun.artifacts.find((artifact) => artifact.artifactJson.kind === 'credential_artifact');
      const verification = existingRun.artifacts.find((artifact) => artifact.artifactJson.kind === 'verification_artifact');
      const compatibility = Array.from(this.compatibilityArtifacts.values())
        .find((artifact) => artifact.artifact.npi === input.compatibilityArtifact.npi && artifact.artifact.source === input.compatibilityArtifact.source && artifact.artifact.checksum === input.compatibilityArtifact.checksum);

      if (!credential || !verification || !compatibility) {
        throw new Error(`In-memory verification run ${existingRun.id} is incomplete.`);
      }

      return {
        providerId: existingRun.providerId,
        verificationRunId: existingRun.id,
        credentialArtifactId: credential.id,
        verificationArtifactId: verification.id,
        compatibilityArtifactId: compatibility.id,
        idempotent: true,
        credentialArtifact: credential.artifactJson as CanonicalCredentialArtifact,
        verificationArtifact: verification.artifactJson as CanonicalVerificationArtifact,
      };
    }

    const providerId = this.providers.get(input.provider.npi)?.id ?? `provider-${this.providers.size + 1}`;
    this.providers.set(input.provider.npi, { id: providerId, npi: input.provider.npi });

    const runId = `run-${this.runs.size + 1}`;
    this.runs.set(runId, {
      id: runId,
      providerId,
      providerNpi: input.provider.npi,
      sourceName: input.sourceName,
      rawPayloadHash: input.rawPayloadHash,
      createdAt: input.retrievedAt,
      artifacts: [],
    });

    await this.createCredentialArtifact(runId, input.credentialArtifact);
    await this.createVerificationArtifact(runId, input.verificationArtifact);

    const compatibilityId = `compat-${this.compatibilityArtifacts.size + 1}`;
    this.compatibilityArtifacts.set(compatibilityId, {
      id: compatibilityId,
      artifact: input.compatibilityArtifact,
    });

    return {
      providerId,
      verificationRunId: runId,
      credentialArtifactId: input.credentialArtifact.id,
      verificationArtifactId: input.verificationArtifact.id,
      compatibilityArtifactId: compatibilityId,
      idempotent: false,
      credentialArtifact: input.credentialArtifact.artifact,
      verificationArtifact: input.verificationArtifact.artifact,
    };
  }

  async createCredentialArtifact(
    verificationRunId: string,
    artifact: PersistableCanonicalArtifact<CanonicalCredentialArtifact>,
  ): Promise<{ id: string }> {
    const run = this.runs.get(verificationRunId);
    if (!run) {
      throw new Error(`Verification run not found: ${verificationRunId}`);
    }
    run.artifacts.push({
      id: artifact.id,
      artifactJson: structuredClone(artifact.artifact),
    });
    return { id: artifact.id };
  }

  async createVerificationArtifact(
    verificationRunId: string,
    artifact: PersistableCanonicalArtifact<CanonicalVerificationArtifact>,
  ): Promise<{ id: string }> {
    const run = this.runs.get(verificationRunId);
    if (!run) {
      throw new Error(`Verification run not found: ${verificationRunId}`);
    }
    run.artifacts.push({
      id: artifact.id,
      artifactJson: structuredClone(artifact.artifact),
    });
    return { id: artifact.id };
  }

  async findActiveCredentialsByNpi(npi: string): Promise<ActiveCredentialArtifactRecord[]> {
    const now = Date.now();
    return Array.from(this.runs.values())
      .filter((run) => run.providerNpi === npi)
      .flatMap((run) =>
        run.artifacts
          .filter((artifact): artifact is {
            id: string;
            artifactJson: CanonicalCredentialArtifact;
          } => artifact.artifactJson.kind === 'credential_artifact')
          .filter((artifact) => {
            const status = artifact.artifactJson.status;
            if (status !== 'ACTIVE' && status !== 'VERIFIED' && status !== 'CLEAR') {
              return false;
            }
            const expiresAt = artifact.artifactJson.expires_at;
            return !expiresAt || Date.parse(expiresAt) > now;
          })
          .map((artifact) => ({
            artifactId: artifact.id,
            verificationRunId: run.id,
            artifact: structuredClone(artifact.artifactJson),
            createdAt: run.createdAt,
          })),
      )
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }
}
