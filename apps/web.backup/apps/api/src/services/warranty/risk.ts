import { NCIVerifiableProofType, PrismaClient } from '@prisma/client';

import { getTrustWeightSnapshot } from '../trust/weights';

const prisma = new PrismaClient();

const CREDENTIAL_TYPE_FACTORS: Record<string, number> = {
  license: 0.25,
  board: 0.28,
  certification: 0.32,
  privileging: 0.35,
  compact: 0.22,
  dea: 0.3,
  credential: 0.3,
  default: 0.3,
};

const ISSUER_RISK_WEIGHT = 0.5;
const TYPE_RISK_WEIGHT = 0.3;
const REVOCATION_RISK_WEIGHT = 0.2;

export interface WarrantyRiskInput {
  credentialId: string;
  credentialType: string;
  issuerDid: string;
}

export interface WarrantyRiskResult {
  credentialId: string;
  issuerDid: string;
  issuerTrust: number;
  issuerRisk: number;
  credentialTypeFactor: number;
  revocationHistory: number;
  compositeRisk: number;
  revocationRate: number;
  rationale: string[];
  generatedAt: string;
}

export async function evaluateWarrantyRisk(input: WarrantyRiskInput): Promise<WarrantyRiskResult> {
  const credentialId = input.credentialId?.trim();
  const issuerDid = input.issuerDid?.trim();
  const credentialType = input.credentialType?.trim().toLowerCase();

  if (!credentialId || !issuerDid || !credentialType) {
    throw new Error('credentialId, credentialType, and issuerDid are required to evaluate warranty risk');
  }

  const [trustSnapshot, issuerRevocations, issuerIssuances, credentialRevocations] = await Promise.all([
    getTrustWeightSnapshot(issuerDid),
    prisma.nCIVerifiableProof.count({
      where: { did: issuerDid, proofType: NCIVerifiableProofType.REVOCATION },
    }),
    prisma.nCIVerifiableProof.count({
      where: { did: issuerDid, proofType: NCIVerifiableProofType.ISSUANCE },
    }),
    prisma.nCIVerifiableProof.count({
      where: { issuedFor: credentialId, proofType: NCIVerifiableProofType.REVOCATION },
    }),
  ]);

  const issuerTrust = clamp01(trustSnapshot.normalizedWeight ?? 0);
  const issuerRisk = clamp01(1 - issuerTrust);

  const credentialTypeFactor =
    CREDENTIAL_TYPE_FACTORS[credentialType] ?? CREDENTIAL_TYPE_FACTORS.default;

  const issuerRevocationRate = issuerIssuances ? issuerRevocations / issuerIssuances : 0;
  const revocationHistory =
    credentialRevocations > 0 ? 1 : clamp01(issuerRevocationRate * 1.5);

  const compositeRisk = Number(
    (
      issuerRisk * ISSUER_RISK_WEIGHT +
      credentialTypeFactor * TYPE_RISK_WEIGHT +
      revocationHistory * REVOCATION_RISK_WEIGHT
    ).toFixed(4),
  );

  const rationale: string[] = [
    `issuer_trust:${issuerTrust.toFixed(2)}`,
    `credential_type_factor:${credentialTypeFactor.toFixed(2)}`,
    `issuer_revocation_rate:${issuerRevocationRate.toFixed(3)}`,
    `credential_revocations:${credentialRevocations}`,
  ];

  return {
    credentialId,
    issuerDid,
    issuerTrust,
    issuerRisk,
    credentialTypeFactor,
    revocationHistory,
    revocationRate: Number(issuerRevocationRate.toFixed(3)),
    compositeRisk,
    rationale,
    generatedAt: new Date().toISOString(),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}










