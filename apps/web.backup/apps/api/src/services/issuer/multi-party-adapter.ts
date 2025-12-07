import type { AggregatedProofSet } from './partial-signature-aggregator';

export interface MultiIssuerCredentialEnvelope {
  issuer: Array<{
    id: string;
    role: 'lead' | 'co-issuer';
    signedAt: string;
    anchor?: {
      txHash: string;
      timestamp: string;
      network?: string;
    } | null;
  }>;
  proof: Array<{
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    rootHash: string;
    proofCount: number;
    proofs: Array<{
      issuer: string;
      signedAt: string;
      proof: Record<string, any>;
      anchor?: {
        txHash: string;
        timestamp: string;
        network?: string;
      } | null;
    }>;
  }>;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export function adaptToMultiIssuerCredential(
  baseCredential: Record<string, any>,
  aggregation: AggregatedProofSet,
): MultiIssuerCredentialEnvelope {
  const clone = deepClone(baseCredential);
  const issuerEntries = aggregation.issuers.map((entry, index) => ({
    id: entry.issuerDid,
    role: index === 0 ? ('lead' as const) : ('co-issuer' as const),
    signedAt: entry.signedAt,
    anchor: entry.anchor ?? null,
  }));

  const combinedProof = {
    type: aggregation.proofSet.type,
    created: aggregation.proofSet.created,
    proofPurpose: aggregation.proofSet.proofPurpose,
    verificationMethod: `${issuerEntries[0]?.id ?? 'did:web:vitalcv.multi'}#aggregated`,
    rootHash: aggregation.rootHash,
    proofCount: aggregation.proofSet.proofCount,
    proofs: aggregation.proofSet.proofs.map((entry) => ({
      issuer: entry.issuerDid,
      signedAt: entry.signedAt,
      proof: entry.proof,
      anchor: entry.anchor ?? null,
    })),
  };

  return {
    ...clone,
    issuer: issuerEntries,
    proof: [combinedProof],
    metadata: {
      ...(clone.metadata ?? {}),
      multiIssuer: {
        participantCount: issuerEntries.length,
        rootHash: aggregation.rootHash,
        issuedAt: aggregation.issuedAt,
      },
    },
  };
}

function deepClone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}









