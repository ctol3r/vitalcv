import {
  validateCredentialArtifact,
  validateVerificationArtifact,
} from '../../../../../../packages/trust-state';
import prisma from '../../graphql/prisma_client';
import { capsuleEngine } from '../decision/capsuleEngine';
import {
  buildCredentialHash,
  buildEvidenceHash,
} from '../credentials/credentialIngestionArtifacts';
import {
  isCanonicalCredentialArtifact,
  isCanonicalVerificationArtifact,
  type ActiveCredentialArtifactRecord,
  type ActiveVerificationArtifactRecord,
} from '../credentials/credentialIngestionTypes';

export interface AuditBundleProof {
  file_name: 'audit_bundle.json';
  subject_npi: string;
  generated_at: string;
  credential_artifacts: Array<{
    artifact_id: string;
    verification_run_id: string;
    created_at: string;
    artifact: unknown;
  }>;
  verification_artifacts: Array<{
    artifact_id: string;
    verification_run_id: string;
    created_at: string;
    artifact: unknown;
  }>;
  trust_state_snapshot: unknown;
  decision_capsule_reference: {
    capsule_id: string;
    decision_type: string;
    decision_action: string | null;
    verifier_org: string | null;
    trust_state_hash: string | null;
    artifact_hash: string;
    decision_timestamp: string;
    replay_valid: boolean;
    replay_artifact_hash: string;
  };
  evidence_hashes: string[];
  ledger_anchor_reference: {
    audit_event_id: string;
    merkle_root: string;
    anchored_at: string;
  } | null;
}

type CanonicalArtifacts = {
  credentialArtifacts: ActiveCredentialArtifactRecord[];
  verificationArtifacts: ActiveVerificationArtifactRecord[];
};

function assertArtifactCompleteness(
  npi: string,
  artifacts: CanonicalArtifacts,
): void {
  if (artifacts.credentialArtifacts.length === 0) {
    throw new Error(`Audit bundle missing credential artifacts for ${npi}`);
  }

  if (artifacts.verificationArtifacts.length === 0) {
    throw new Error(`Audit bundle missing verification artifacts for ${npi}`);
  }
}

async function listCanonicalArtifactsByNpi(npi: string): Promise<CanonicalArtifacts> {
  const runs = await prisma.verificationRun.findMany({
    where: {
      provider: { npi },
    },
    orderBy: {
      retrievedAtUtc: 'desc',
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
  });

  const credentialArtifacts: ActiveCredentialArtifactRecord[] = [];
  const verificationArtifacts: ActiveVerificationArtifactRecord[] = [];

  for (const run of runs) {
    for (const artifact of run.artifacts) {
      if (isCanonicalCredentialArtifact(artifact.artifactJson)) {
        validateCredentialArtifact(artifact.artifactJson);
        credentialArtifacts.push({
          artifactId: artifact.id,
          verificationRunId: run.id,
          artifact: artifact.artifactJson,
          createdAt: artifact.createdAt.toISOString(),
        });
        continue;
      }

      if (isCanonicalVerificationArtifact(artifact.artifactJson)) {
        validateVerificationArtifact(artifact.artifactJson);
        verificationArtifacts.push({
          artifactId: artifact.id,
          verificationRunId: run.id,
          artifact: artifact.artifactJson,
          createdAt: artifact.createdAt.toISOString(),
        });
      }
    }
  }

  return {
    credentialArtifacts,
    verificationArtifacts,
  };
}

export function validateAuditBundleEvidenceHashes(bundle: AuditBundleProof): boolean {
  const credentialArtifactsValid = bundle.credential_artifacts.every((entry) => {
    const artifact = entry.artifact as Record<string, unknown>;
    if (artifact.kind !== 'credential_artifact') {
      return false;
    }

    const { credential_hash: credentialHash, ...artifactWithoutHash } = artifact;
    return credentialHash === buildCredentialHash(
      artifactWithoutHash as Parameters<typeof buildCredentialHash>[0],
    );
  });

  const verificationArtifactsValid = bundle.verification_artifacts.every((entry) => {
    const artifact = entry.artifact as Record<string, unknown>;
    if (artifact.kind !== 'verification_artifact') {
      return false;
    }

    return artifact.evidence_hash === buildEvidenceHash(
      artifact.payload_json as Record<string, unknown>,
    );
  });

  return credentialArtifactsValid && verificationArtifactsValid;
}

export async function buildAuditBundleProof(npi: string): Promise<AuditBundleProof> {
  const [artifacts, capsules, ledgerAnchor] = await Promise.all([
    listCanonicalArtifactsByNpi(npi),
    capsuleEngine.getCapsulesByNpi(npi),
    prisma.auditEvent.findFirst({
      where: {
        clinicianId: npi,
        anchored: true,
        merkleRoot: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        merkleRoot: true,
        createdAt: true,
      },
    }),
  ]);

  assertArtifactCompleteness(npi, artifacts);

  const latestCapsule = capsules[0];
  if (!latestCapsule) {
    throw new Error(`Decision capsule reference not found for ${npi}`);
  }

  const replay = await capsuleEngine.verifyDecisionCapsuleReplay(latestCapsule.id);
  if (!replay.valid) {
    throw new Error(`Decision capsule replay verification failed for ${latestCapsule.id}`);
  }

  const metadata = typeof latestCapsule.metadata === 'object' && latestCapsule.metadata !== null
    ? latestCapsule.metadata as Record<string, unknown>
    : {};
  const trustStateSnapshot = metadata.trust_state_snapshot ?? metadata.trust_state_snapshot_v2;
  if (!trustStateSnapshot) {
    throw new Error(`Trust-state snapshot not found for decision capsule ${latestCapsule.id}`);
  }

  const evidenceHashes = [
    ...artifacts.credentialArtifacts.map(({ artifact }) => artifact.credential_hash),
    ...artifacts.verificationArtifacts.map(({ artifact }) => artifact.evidence_hash),
    latestCapsule.artifactHash,
    ...(typeof latestCapsule.trustStateHash === 'string' ? [latestCapsule.trustStateHash] : []),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .sort((left, right) => left.localeCompare(right));

  const bundle: AuditBundleProof = {
    file_name: 'audit_bundle.json',
    subject_npi: npi,
    generated_at: new Date().toISOString(),
    credential_artifacts: artifacts.credentialArtifacts.map((entry) => ({
      artifact_id: entry.artifactId,
      verification_run_id: entry.verificationRunId,
      created_at: entry.createdAt,
      artifact: entry.artifact,
    })),
    verification_artifacts: artifacts.verificationArtifacts.map((entry) => ({
      artifact_id: entry.artifactId,
      verification_run_id: entry.verificationRunId,
      created_at: entry.createdAt,
      artifact: entry.artifact,
    })),
    trust_state_snapshot: trustStateSnapshot,
    decision_capsule_reference: {
      capsule_id: latestCapsule.id,
      decision_type: latestCapsule.decisionType,
      decision_action: latestCapsule.decisionAction,
      verifier_org: latestCapsule.verifierOrgId,
      trust_state_hash: latestCapsule.trustStateHash,
      artifact_hash: latestCapsule.artifactHash,
      decision_timestamp: latestCapsule.decisionTimestamp,
      replay_valid: replay.valid,
      replay_artifact_hash: replay.actualArtifactHash,
    },
    evidence_hashes: [...new Set(evidenceHashes)],
    ledger_anchor_reference: ledgerAnchor?.merkleRoot
      ? {
          audit_event_id: ledgerAnchor.id,
          merkle_root: ledgerAnchor.merkleRoot,
          anchored_at: ledgerAnchor.createdAt.toISOString(),
        }
      : null,
  };

  if (!validateAuditBundleEvidenceHashes(bundle)) {
    throw new Error(`Audit bundle evidence hash validation failed for ${npi}`);
  }

  return bundle;
}
