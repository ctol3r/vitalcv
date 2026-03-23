export type CredentialEvidenceInput = {
  id: string;
  verificationLevel: string;
  artifactIds: readonly string[];
  receiptIds: readonly string[];
};

export type CredentialArtifactEvidence = {
  id: string;
  source: string | null | undefined;
};

export type CredentialReceiptEvidence = {
  receiptId: string;
  sourceArtifactId: string | null | undefined;
  verificationArtifactId: string | null | undefined;
};

export type CredentialEvidenceResolution = {
  publicSafe: boolean;
  requiresReceiptProof: boolean;
  validArtifactIds: string[];
  validReceiptIds: string[];
  issues: string[];
};

function dedupeStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

export function verificationLevelRequiresReceipt(level: string): boolean {
  return level.trim().toUpperCase() !== 'SELF_REPORTED';
}

export function assertCredentialObservationIntegrity(input: {
  verificationLevel: string;
  artifactIds: readonly string[];
  receiptIds: readonly string[];
  context: string;
}): void {
  const artifactIds = dedupeStrings(input.artifactIds);
  if (artifactIds.length === 0) {
    throw new Error(`Credential observation is missing a backing artifact (${input.context}).`);
  }

  if (verificationLevelRequiresReceipt(input.verificationLevel) && dedupeStrings(input.receiptIds).length === 0) {
    throw new Error(`Credential observation is missing a verification receipt (${input.context}).`);
  }
}

export function resolveCredentialEvidence(input: {
  credential: CredentialEvidenceInput;
  artifactsById: ReadonlyMap<string, CredentialArtifactEvidence>;
  receiptsById: ReadonlyMap<string, CredentialReceiptEvidence>;
}): CredentialEvidenceResolution {
  const requiresReceiptProof = verificationLevelRequiresReceipt(input.credential.verificationLevel);
  const validArtifactIds = dedupeStrings(
    input.credential.artifactIds.filter((artifactId) => {
      const artifact = input.artifactsById.get(artifactId);
      return Boolean(artifact && typeof artifact.source === 'string' && artifact.source.trim().length > 0);
    }),
  );

  const validArtifactIdSet = new Set(validArtifactIds);
  const validReceiptIds = dedupeStrings(
    input.credential.receiptIds.filter((receiptId) => {
      const receipt = input.receiptsById.get(receiptId);
      if (!receipt) {
        return false;
      }

      const linkedArtifactId = receipt.sourceArtifactId?.trim() || receipt.verificationArtifactId?.trim() || null;
      return Boolean(linkedArtifactId && validArtifactIdSet.has(linkedArtifactId));
    }),
  );

  const issues: string[] = [];
  if (validArtifactIds.length === 0) {
    issues.push('missing_artifact');
  }
  if (requiresReceiptProof && validReceiptIds.length === 0) {
    issues.push('missing_receipt');
  }

  return {
    publicSafe: issues.length === 0,
    requiresReceiptProof,
    validArtifactIds,
    validReceiptIds,
    issues,
  };
}
