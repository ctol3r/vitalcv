import { createHash } from 'crypto';

export interface PartialSignatureInput {
  issuerDid: string;
  proof: Record<string, any>;
  signedAt: string;
  anchor?: {
    txHash: string;
    timestamp: string;
    network?: string;
  } | null;
}

export interface AggregatedProofSet {
  rootHash: string;
  issuedAt: string;
  proofSet: {
    type: 'MultiIssuerProofSet';
    created: string;
    proofPurpose: 'assertionMethod';
    proofCount: number;
    rootHash: string;
    proofs: JointProofEntry[];
  };
  issuers: Array<{
    issuerDid: string;
    signedAt: string;
    anchor?: JointProofEntry['anchor'];
  }>;
}

export interface JointProofEntry {
  issuerDid: string;
  signedAt: string;
  proof: Record<string, any>;
  anchor?: {
    txHash: string;
    timestamp: string;
    network?: string;
  } | null;
}

export function aggregatePartialSignatures(
  baseCredentialId: string,
  partials: PartialSignatureInput[],
): AggregatedProofSet {
  if (!baseCredentialId?.trim()) {
    throw new Error('baseCredentialId is required to aggregate partial signatures');
  }

  const normalized = dedupePartials(partials);
  if (!normalized.length) {
    throw new Error('At least one partial signature is required');
  }

  const issuedAt = new Date().toISOString();
  const rootHash = computeRootHash(baseCredentialId, normalized);

  const proofSet = {
    type: 'MultiIssuerProofSet' as const,
    created: issuedAt,
    proofPurpose: 'assertionMethod' as const,
    proofCount: normalized.length,
    rootHash,
    proofs: normalized.map((entry) => ({
      issuerDid: entry.issuerDid,
      signedAt: entry.signedAt,
      proof: entry.proof,
      anchor: entry.anchor ?? null,
    })),
  };

  return {
    rootHash,
    issuedAt,
    proofSet,
    issuers: proofSet.proofs.map((entry) => ({
      issuerDid: entry.issuerDid,
      signedAt: entry.signedAt,
      anchor: entry.anchor ?? null,
    })),
  };
}

function dedupePartials(partials: PartialSignatureInput[]): JointProofEntry[] {
  const map = new Map<string, JointProofEntry>();
  partials.forEach((entry) => {
    const issuerDid = entry.issuerDid?.trim();
    if (!issuerDid) {
      return;
    }
    const signedAt = coerceIso(entry.signedAt);
    const proof = sanitizeProof(entry.proof);
    const anchor = entry.anchor
      ? {
          txHash: entry.anchor.txHash,
          timestamp: coerceIso(entry.anchor.timestamp),
          network: entry.anchor.network,
        }
      : null;

    if (!map.has(issuerDid) || isNewer(signedAt, map.get(issuerDid)!.signedAt)) {
      map.set(issuerDid, {
        issuerDid,
        signedAt,
        proof,
        anchor,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.issuerDid.localeCompare(b.issuerDid));
}

function computeRootHash(baseCredentialId: string, partials: JointProofEntry[]): string {
  const hasher = createHash('sha256');
  hasher.update(baseCredentialId);
  partials.forEach((entry) => {
    hasher.update(entry.issuerDid);
    hasher.update(entry.signedAt);
    hasher.update(JSON.stringify(entry.proof));
    if (entry.anchor?.txHash) {
      hasher.update(entry.anchor.txHash);
    }
  });
  return `0x${hasher.digest('hex')}`;
}

function sanitizeProof(proof: Record<string, any>): Record<string, any> {
  try {
    return JSON.parse(JSON.stringify(proof ?? {}));
  } catch {
    return { error: 'proof_not_serializable' };
  }
}

function coerceIso(input: string | number | Date): string {
  if (!input) {
    return new Date().toISOString();
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.valueOf())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function isNewer(nextIso: string, prevIso: string): boolean {
  return new Date(nextIso).valueOf() >= new Date(prevIso).valueOf();
}









