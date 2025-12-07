import type { ClinicianProfile, User } from '@prisma/client';
import {
  getNciProofBundle,
  type NciCredentialCategory,
  type NciCredentialProof,
  type NciProofBundle,
} from '@packages/nci-data';

const DEFAULT_TRUST_SCORE = 82;

export interface ResolveNciProofParams {
  clinician: ClinicianProfile & { user: User };
  did: string;
}

export interface NciProofSummary {
  lastRefreshedAt: string;
  trustScore: number;
  categories: Record<
    NciCredentialCategory,
    {
      issuer: string;
      verifier: string;
      reference: string;
      status: string;
      trustScore: number;
      updatedAt: string;
    }
  >;
}

export async function resolveNciProofBundle(
  params: ResolveNciProofParams,
): Promise<NciProofBundle> {
  const existing =
    getNciProofBundle({ did: params.did, npi: params.clinician.npi }) ||
    getNciProofBundle({ npi: params.clinician.npi });

  if (existing) {
    return existing;
  }

  return buildSyntheticProofBundle(params.clinician, params.did);
}

export function summarizeNciProofs(bundle: NciProofBundle): NciProofSummary {
  const entries = Object.entries(bundle.proofs) as [NciCredentialCategory, NciCredentialProof][];
  const categories = entries.reduce(
    (acc, [category, proof]) => {
      acc[category] = {
        issuer: proof.issuer,
        verifier: proof.verifier,
        reference: proof.reference,
        status: proof.status,
        trustScore: proof.trustScore,
        updatedAt: proof.updatedAt,
      };
      return acc;
    },
    {} as NciProofSummary['categories'],
  );

  const trustScore =
    entries.length > 0
      ? Math.round(entries.reduce((sum, [, proof]) => sum + proof.trustScore, 0) / entries.length)
      : DEFAULT_TRUST_SCORE;

  return {
    lastRefreshedAt: bundle.lastRefreshedAt,
    trustScore,
    categories,
  };
}

export function attachNciProofMetadata<T extends Record<string, any>>(
  proof: NciCredentialProof | undefined,
  baseSubject: T,
): T {
  if (!proof) {
    return baseSubject;
  }

  return {
    ...baseSubject,
    nciProofReference: proof.reference,
    nciProofIssuer: proof.issuer,
    nciProofVerifier: proof.verifier,
    nciProofStatus: proof.status,
    nciProofTrustScore: proof.trustScore,
    nciProofUpdatedAt: proof.updatedAt,
  };
}

function buildSyntheticProofBundle(
  clinician: ClinicianProfile & { user: User },
  did: string,
): NciProofBundle {
  const timestamp = new Date().toISOString();
  const homeState = clinician.state || 'CA';
  const npi = clinician.npi || '0000000000';

  const proof = (category: NciCredentialCategory, overrides: Partial<NciCredentialProof>): NciCredentialProof => ({
    category,
    issuer: `${homeState} Medical Board`,
    verifier: 'VitalCV NCI Federation',
    status: 'VERIFIED',
    scope: `${homeState} • ${category.toUpperCase()}`,
    trustScore: DEFAULT_TRUST_SCORE,
    reference: `NCI-${category.toUpperCase()}-${homeState}-${npi.slice(-4)}`,
    effectiveAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      clinician: clinician.user.name,
      state: homeState,
      specialty: clinician.specialty,
      ...overrides.metadata,
    },
    ...overrides,
  });

  const proofs: Record<NciCredentialCategory, NciCredentialProof> = {
    license: proof('license', {
      scope: `${homeState} · Synthetic License`,
      metadata: {
        jurisdiction: homeState,
        expiration: new Date(new Date().setFullYear(new Date().getFullYear() + 2))
          .toISOString()
          .slice(0, 10),
      },
    }),
    board: proof('board', {
      issuer: 'Synthetic Medical Board',
      scope: `${clinician.specialty || 'General'} · Board`,
    }),
    privilege: proof('privilege', {
      verifier: 'VitalCV Privilege Graph',
      scope: `Facility · ${clinician.state || 'Distributed'}`,
    }),
    enrollment: proof('enrollment', {
      issuer: 'Synthetic Payer Federation',
      verifier: 'VitalCV Enrollment Graph',
      scope: 'Payer enrollment · Multi-state',
    }),
    compact: proof('compact', {
      issuer: 'IMLC Synthetic Registry',
      scope: `IMLC Letter · ${homeState}`,
    }),
  };

  return {
    clinicianDid: did,
    clinicianNpi: npi,
    lastRefreshedAt: timestamp,
    proofs,
  };
}

