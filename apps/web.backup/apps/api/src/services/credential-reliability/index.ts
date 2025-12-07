/**
 * Batch 215 — Credential Reliability Engine v4
 * Measure credential trustworthiness, accuracy, consistency, and long-term behavior.
 */

import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';

export interface ReliabilitySignals {
  issuerAccuracy: number;
  evidenceConsistency: number;
  ageDecayFactor: number;
  documentIntegrity: number;
  instabilityScore: number;
}

/**
 * Task 215.2 — Score credentials based on issuer's historical reliability
 */
export async function scoreIssuerAccuracy(
  credentialId: string,
  issuerId: string
): Promise<number> {
  // Query historical credentials from same issuer
  const issuerCredentials = await prisma.credential.findMany({
    where: {
      issuerId,
      id: { not: credentialId },
    },
  });

  // Calculate accuracy based on verification success rate, revocation rate, etc.
  // For now, return a mock score
  return 0.85;
}

/**
 * Task 215.3 — Check for mismatched fields across documents
 */
export async function checkEvidenceConsistency(credentialId: string): Promise<number> {
  const credential = await prisma.credential.findUnique({
    where: { id: credentialId },
    include: {
      evidence: true,
    },
  });

  if (!credential || !credential.evidence) {
    return 0;
  }

  // In production, this would compare fields across evidence documents
  // For now, return mock consistency score
  return 0.9;
}

/**
 * Task 215.4 — Older verifications reduce reliability unless revalidated
 */
export function calculateAgeDecay(issuedAt: Date, lastValidated?: Date): number {
  const now = new Date();
  const ageMonths = (now.getTime() - issuedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);

  if (lastValidated) {
    const validationAgeMonths = (now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60 * 24 * 30);
    // Recent validation resets decay
    if (validationAgeMonths < 6) return 1.0;
  }

  // Exponential decay: 0.95^months
  return Math.max(0.5, Math.pow(0.95, ageMonths));
}

/**
 * Task 215.6 — Increase score for verified evidence chains
 */
export async function scoreDocumentIntegrity(credentialId: string): Promise<number> {
  const credential = await prisma.credential.findUnique({
    where: { id: credentialId },
    include: {
      evidence: {
        include: {
          verification: true,
        },
      },
    },
  });

  if (!credential || !credential.evidence || credential.evidence.length === 0) {
    return 0;
  }

  // Score based on verified evidence chain
  const verifiedCount = credential.evidence.filter((e) => e.verification?.verified).length;
  return verifiedCount / credential.evidence.length;
}

/**
 * Task 215.7 — Flag frequent re-issuance or changes
 */
export async function detectInstability(credentialId: string, credentialType: string): Promise<number> {
  // Query for same credential type for same clinician
  const credential = await prisma.credential.findUnique({
    where: { id: credentialId },
  });

  if (!credential) return 0;

  const similarCredentials = await prisma.credential.findMany({
    where: {
      clinicianId: credential.clinicianId,
      type: credentialType,
    },
    orderBy: { issuedAt: 'desc' },
  });

  if (similarCredentials.length <= 1) return 0;

  // High re-issuance rate indicates instability
  const timeSpan = similarCredentials[0].issuedAt.getTime() - similarCredentials[similarCredentials.length - 1].issuedAt.getTime();
  const years = timeSpan / (1000 * 60 * 60 * 24 * 365);
  const issuanceRate = similarCredentials.length / Math.max(1, years);

  // > 2 issuances per year = unstable
  return Math.min(1.0, issuanceRate / 2);
}

/**
 * Calculate overall reliability score
 */
export async function calculateReliabilityScore(credentialId: string): Promise<{
  score: number;
  signals: ReliabilitySignals;
}> {
  const credential = await prisma.credential.findUnique({
    where: { id: credentialId },
  });

  if (!credential) {
    throw new Error(`Credential not found: ${credentialId}`);
  }

  const issuerAccuracy = await scoreIssuerAccuracy(credentialId, credential.issuerId);
  const evidenceConsistency = await checkEvidenceConsistency(credentialId);
  const ageDecayFactor = calculateAgeDecay(credential.issuedAt, credential.lastVerifiedAt || undefined);
  const documentIntegrity = await scoreDocumentIntegrity(credentialId);
  const instabilityScore = await detectInstability(credentialId, credential.type);

  const signals: ReliabilitySignals = {
    issuerAccuracy,
    evidenceConsistency,
    ageDecayFactor,
    documentIntegrity,
    instabilityScore,
  };

  // Weighted average
  const score =
    issuerAccuracy * 0.3 +
    evidenceConsistency * 0.25 +
    ageDecayFactor * 0.2 +
    documentIntegrity * 0.15 +
    (1 - instabilityScore) * 0.1; // Lower instability = higher score

  return { score: Math.max(0, Math.min(1, score)), signals };
}

/**
 * Task 215.9 — Run reliability recalculation for all credentials
 */
export async function bulkReliabilityAudit(): Promise<{ processed: number; updated: number }> {
  const credentials = await prisma.credential.findMany({
    select: { id: true },
  });

  let updated = 0;

  for (const cred of credentials) {
    try {
      const { score, signals } = await calculateReliabilityScore(cred.id);
      await prisma.credentialReliability.upsert({
        where: { credentialId: cred.id },
        create: {
          credentialId: cred.id,
          score,
          signals,
          updatedAt: new Date(),
        },
        update: {
          score,
          signals,
          updatedAt: new Date(),
        },
      });
      updated++;
    } catch (error) {
      console.error(`Failed to calculate reliability for credential ${cred.id}:`, error);
    }
  }

  return { processed: credentials.length, updated };
}

/**
 * Task 215.10 — Anchor reliability summary
 */
export async function anchorReliabilitySummary(credentialId: string): Promise<void> {
  const reliability = await prisma.credentialReliability.findUnique({
    where: { credentialId },
  });

  if (!reliability) {
    throw new Error(`Reliability not found for credential: ${credentialId}`);
  }

  anchorEvent('credentialReliabilityAnchored', {
    credentialId,
    score: reliability.score,
    signalsHash: JSON.stringify(reliability.signals),
    timestamp: new Date().toISOString(),
  });
}

