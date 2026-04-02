import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { validateMerkleIntegrity } from './merkleIntegrity';

import { isTrustedIssuer } from './issuerRegistry';
import { computeCredentialState } from './credentialStatusEngine';
import { getTransparencyEntries } from './transparencyLog';
import { getConfiguredIssuerDid } from '../utils/issuerDid';
import { isSameLifecycleState } from '../utils/lifecycleState';

type CrossCheckResult = {
  passed: boolean;
  failures: string[];
};

type ArtifactForCrossCheck = {
  id: string;
  npi: string;
  status: string;
  checksum: string;
  merkleRoot: string | null;
  claimHashes: unknown;
  revokedAt: Date | null;
  suspendedAt: Date | null;
  expiresAt: Date | null;
  lifecycleState: string;
};

export async function runIndependentCrossCheck(
  artifactId: string,
  tx?: Prisma.TransactionClient,
): Promise<CrossCheckResult> {
  const normalizedArtifactId = artifactId.trim();
  if (!normalizedArtifactId) {
    throw new Error('artifactId is required');
  }

  const client = tx ?? prisma;
  const artifact = await client.verificationArtifact.findUnique({
    where: { id: normalizedArtifactId },
    select: {
      id: true,
      npi: true,
      status: true,
      checksum: true,
      merkleRoot: true,
      claimHashes: true,
      revokedAt: true,
      suspendedAt: true,
      expiresAt: true,
      lifecycleState: true,
    } as unknown as Prisma.VerificationArtifactSelect,
  });

  const failures: string[] = [];
  if (!artifact) {
    failures.push('artifact_not_found');
    return {
      passed: false,
      failures,
    };
  }

  const artifactForState = {
    id: artifact.id,
    npi: artifact.npi,
    status: artifact.status,
    checksum: artifact.checksum,
    merkleRoot: artifact.merkleRoot,
    claimHashes: artifact.claimHashes,
    revokedAt: artifact.revokedAt,
    suspendedAt: artifact.suspendedAt,
    expiresAt: artifact.expiresAt,
    lifecycleState: artifact.lifecycleState,
  };

  if (!artifactForState.checksum || artifactForState.checksum.trim().length === 0) {
    failures.push('missing_artifact_checksum');
  }

  if (!artifactForState.merkleRoot || artifactForState.merkleRoot.trim().length === 0) {
    failures.push('missing_artifact_merkle_root');
  }

  if (!artifactForState.claimHashes || !Array.isArray(artifactForState.claimHashes)) {
    failures.push('missing_artifact_claim_hashes');
  }

  if (
    !validateMerkleIntegrity({
      merkleRoot: artifactForState.merkleRoot ?? '',
      claimHashes: artifactForState.claimHashes,
    })
  ) {
    failures.push('invalid_merkle_integrity');
  }

  const expectedLifecycle = computeCredentialState({
    revokedAt: artifactForState.revokedAt,
    suspendedAt: artifactForState.suspendedAt,
    expiresAt: artifactForState.expiresAt,
    status: artifactForState.status,
  });

  if (
    !isSameLifecycleState(expectedLifecycle, artifactForState.lifecycleState)
  ) {
    failures.push('lifecycle_state_mismatch');
  }

  // PECOS: read from the most recent real PecosCheck record rather than
  // calling the deprecated simulation function in pecosEngine.ts.
  const recentPecos = await client.pecosCheck.findFirst({
    where: { npi: artifactForState.npi },
    orderBy: { checkedAt: 'desc' },
    select: { enrolled: true },
  });
  if (recentPecos === null) {
    // No PECOS data on record — source unavailable, not a hard enrollment failure.
    failures.push('pecos_enrollment_unavailable');
  } else if (!recentPecos.enrolled) {
    failures.push('pecos_enrollment_check_failed');
  }

  const issuerDid = getConfiguredIssuerDid();
  try {
    const issuerTrusted = await isTrustedIssuer(issuerDid);
    if (!issuerTrusted) {
      failures.push('issuer_not_trusted');
    }
  } catch {
    failures.push('issuer_trust_check_failed');
  }

  const transparencyEntries = await getTransparencyEntries(normalizedArtifactId, tx);
  if (transparencyEntries.length === 0) {
    failures.push('transparency_log_missing');
  } else {
    const latest = transparencyEntries[transparencyEntries.length - 1];
    if (!isSameLifecycleState(latest.lifecycleState, artifactForState.lifecycleState)) {
      failures.push('transparency_log_inconsistent');
    }
    if (latest.fingerprint.trim().length === 0 || latest.fingerprint !== artifactForState.checksum) {
      failures.push('transparency_fingerprint_mismatch');
    }
    if (latest.merkleRoot.trim().length === 0 || latest.merkleRoot !== (artifactForState.merkleRoot ?? '')) {
      failures.push('transparency_merkle_mismatch');
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}
