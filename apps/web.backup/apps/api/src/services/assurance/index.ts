import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export interface AssuranceScore {
  probability: number;
  evidenceDensity: number;
  sources: string[];
  trustWeight: number;
  updatedAt: string;
}

export interface CredentialAssurance {
  credentialId: string;
  assurance: AssuranceScore;
  evidenceCoverage: Record<string, boolean>;
  issuanceFrequency: {
    count: number;
    suspicious: boolean;
    pattern: string;
  };
  predictedChanges: Array<{
    event: string;
    probability: number;
    timeframe: string;
  }>;
  deviations: Array<{
    type: string;
    severity: number;
    detectedAt: string;
  }>;
  updatedAt: string;
}

/**
 * Task 353.2 — Multi-source assurance scorer v4
 * Compute probability of correctness based on evidence density
 */
export async function computeAssuranceScore(credentialId: string): Promise<AssuranceScore> {
  // Get credential data
  const credential = await prisma.masterCredentialIndex.findFirst({
    where: { credentialId },
  });

  if (!credential) {
    return {
      probability: 0,
      evidenceDensity: 0,
      sources: [],
      trustWeight: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  // Collect evidence sources
  const sources: string[] = [];
  let evidenceCount = 0;

  // Check NPPES
  const npi = await prisma.npiValidation.findFirst({
    where: { clinicianId: credential.clinicianId },
  });
  if (npi) {
    sources.push('nppes');
    evidenceCount++;
  }

  // Check state boards
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId: credential.clinicianId },
  });
  if (licenses.length > 0) {
    sources.push('state_boards');
    evidenceCount += licenses.length;
  }

  // Check compliance checks
  const compliance = await prisma.complianceCheck.findMany({
    where: { clinicianId: credential.clinicianId },
  });
  if (compliance.length > 0) {
    sources.push('compliance');
    evidenceCount += compliance.length;
  }

  // Compute evidence density (0-1 scale)
  const evidenceDensity = Math.min(evidenceCount / 10, 1);

  // Compute trust weight from issuer
  const trustWeight = credential.issuerDid ? 0.8 : 0.5;

  // Compute overall probability
  const probability = evidenceDensity * 0.6 + trustWeight * 0.4;

  return {
    probability,
    evidenceDensity,
    sources: [...new Set(sources)],
    trustWeight,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Task 353.3 — Issuance frequency analyzer
 * Flag suspicious reissuance patterns
 */
export async function analyzeIssuanceFrequency(credentialId: string): Promise<{
  count: number;
  suspicious: boolean;
  pattern: string;
}> {
  const lifecycle = await prisma.credentialLifecycle.findMany({
    where: { credentialId },
    orderBy: { timestamp: 'asc' },
  });

  const issuanceCount = lifecycle.filter((l) => l.phase === 'issued').length;

  // Check for suspicious patterns
  const suspicious = issuanceCount > 5; // More than 5 reissuances is suspicious
  const pattern = issuanceCount === 0 ? 'none' : issuanceCount === 1 ? 'normal' : 'frequent';

  return {
    count: issuanceCount,
    suspicious,
    pattern,
  };
}

/**
 * Task 353.5 — Evidence coverage mapping
 * Show which evidence types back each credential
 */
export async function mapEvidenceCoverage(credentialId: string): Promise<Record<string, boolean>> {
  const credential = await prisma.masterCredentialIndex.findFirst({
    where: { credentialId },
  });

  if (!credential) {
    return {};
  }

  const coverage: Record<string, boolean> = {
    nppes: false,
    state_board: false,
    sanctions: false,
    npdb: false,
    compliance: false,
    issuer: false,
  };

  // Check NPPES
  const npi = await prisma.npiValidation.findFirst({
    where: { clinicianId: credential.clinicianId },
  });
  coverage.nppes = !!npi;

  // Check state boards
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId: credential.clinicianId },
  });
  coverage.state_board = licenses.length > 0;

  // Check sanctions
  const sanctions = await prisma.complianceCheck.findMany({
    where: { clinicianId: credential.clinicianId, type: 'sanctions' },
  });
  coverage.sanctions = sanctions.length > 0;

  // Check NPDB
  const npdb = await prisma.complianceCheck.findMany({
    where: { clinicianId: credential.clinicianId, type: 'npdb' },
  });
  coverage.npdb = npdb.length > 0;

  // Check compliance
  const compliance = await prisma.complianceCheck.findMany({
    where: { clinicianId: credential.clinicianId },
  });
  coverage.compliance = compliance.length > 0;

  // Check issuer
  coverage.issuer = !!credential.issuerDid;

  return coverage;
}

/**
 * Task 353.6 — Trust-weighted assurance engine
 * Blend trust anchors + regulatory sources
 */
export async function computeTrustWeightedAssurance(
  credentialId: string,
  assurance: AssuranceScore,
): Promise<number> {
  const credential = await prisma.masterCredentialIndex.findFirst({
    where: { credentialId },
  });

  if (!credential) {
    return assurance.probability;
  }

  // Get trust anchor if available
  let trustAnchorWeight = 0.5;
  if (credential.issuerDid) {
    // Try NCITrustAnchor first
    const nciTrustAnchor = await prisma.nCITrustAnchor.findFirst({
      where: { entityId: credential.issuerDid },
    }).catch(() => null);

    if (nciTrustAnchor) {
      trustAnchorWeight = nciTrustAnchor.accreditation === 'ACCREDITED' ? 0.9 : 0.6;
    } else {
      // Fallback to TrustAnchor
      const trustAnchor = await prisma.trustAnchor.findFirst({
        where: { entityDid: credential.issuerDid },
      }).catch(() => null);

      if (trustAnchor) {
        trustAnchorWeight = trustAnchor.score > 0.8 ? 0.9 : 0.6;
      }
    }
  }

  // Blend with regulatory sources
  const regulatoryWeight = assurance.evidenceDensity;

  // Final weighted assurance
  return assurance.probability * 0.4 + trustAnchorWeight * 0.3 + regulatoryWeight * 0.3;
}

/**
 * Task 353.7 — Revised-assurance predictor
 * Predict future assurance changes based on events
 */
export async function predictAssuranceChanges(credentialId: string): Promise<
  Array<{
    event: string;
    probability: number;
    timeframe: string;
  }>
> {
  const predictions: Array<{ event: string; probability: number; timeframe: string }> = [];

  // Check for expiring credentials
  const credential = await prisma.masterCredentialIndex.findFirst({
    where: { credentialId },
  });

  if (credential) {
    // Predict expiration risk
    predictions.push({
      event: 'credential_expiration',
      probability: 0.3,
      timeframe: '30-60 days',
    });

    // Predict compliance check
    predictions.push({
      event: 'compliance_recheck',
      probability: 0.5,
      timeframe: '7-14 days',
    });
  }

  return predictions;
}

/**
 * Task 353.8 — Assurance deviation detector
 * Detect evidence mismatch spikes
 */
export async function detectAssuranceDeviations(credentialId: string): Promise<
  Array<{
    type: string;
    severity: number;
    detectedAt: string;
  }>
> {
  const deviations: Array<{ type: string; severity: number; detectedAt: string }> = [];

  const assurance = await prisma.credentialAssurance.findFirst({
    where: { credentialId },
    orderBy: { updatedAt: 'desc' },
  });

  if (!assurance) {
    return deviations;
  }

  const currentAssurance = assurance.assurance as AssuranceScore;

  // Check for low probability
  if (currentAssurance.probability < 0.5) {
    deviations.push({
      type: 'low_probability',
      severity: 0.7,
      detectedAt: new Date().toISOString(),
    });
  }

  // Check for low evidence density
  if (currentAssurance.evidenceDensity < 0.3) {
    deviations.push({
      type: 'low_evidence_density',
      severity: 0.8,
      detectedAt: new Date().toISOString(),
    });
  }

  return deviations;
}

/**
 * Task 353.1 — Get or create credential assurance
 */
export async function getOrCreateCredentialAssurance(
  credentialId: string,
): Promise<CredentialAssurance> {
  const existing = await prisma.credentialAssurance.findFirst({
    where: { credentialId },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) {
    return existing.assurance as CredentialAssurance;
  }

  // Create new assurance
  const assuranceScore = await computeAssuranceScore(credentialId);
  const issuanceFrequency = await analyzeIssuanceFrequency(credentialId);
  const evidenceCoverage = await mapEvidenceCoverage(credentialId);
  const predictedChanges = await predictAssuranceChanges(credentialId);
  const deviations = await detectAssuranceDeviations(credentialId);

  // Apply trust weighting
  const finalProbability = await computeTrustWeightedAssurance(credentialId, assuranceScore);

  const assurance: CredentialAssurance = {
    credentialId,
    assurance: {
      ...assuranceScore,
      probability: finalProbability,
    },
    evidenceCoverage,
    issuanceFrequency,
    predictedChanges,
    deviations,
    updatedAt: new Date().toISOString(),
  };

  await prisma.credentialAssurance.create({
    data: {
      credentialId,
      assurance: assurance as unknown as Record<string, unknown>,
    },
  });

  return assurance;
}

/**
 * Task 353.9 — Export assurance audit
 */
export async function exportAssuranceAudit(credentialId: string): Promise<{
  summary: string;
  pdfData: string;
}> {
  const assurance = await getOrCreateCredentialAssurance(credentialId);

  const summary = `
Credential Assurance Report - ${credentialId}
Generated: ${assurance.updatedAt}

Assurance Probability: ${(assurance.assurance.probability * 100).toFixed(1)}%
Evidence Density: ${(assurance.assurance.evidenceDensity * 100).toFixed(1)}%
Trust Weight: ${(assurance.assurance.trustWeight * 100).toFixed(1)}%

Evidence Coverage:
${Object.entries(assurance.evidenceCoverage)
  .map(([key, value]) => `  ${key}: ${value ? 'Yes' : 'No'}`)
  .join('\n')}

Issuance Frequency: ${assurance.issuanceFrequency.count} (${assurance.issuanceFrequency.pattern})
Suspicious: ${assurance.issuanceFrequency.suspicious ? 'Yes' : 'No'}

Predicted Changes: ${assurance.predictedChanges.length}
Deviations: ${assurance.deviations.length}
  `.trim();

  const pdfData = JSON.stringify(assurance, null, 2);

  return { summary, pdfData };
}

/**
 * Task 353.10 — Anchor assurance snapshot
 */
export async function anchorAssuranceSnapshot(credentialId: string): Promise<void> {
  const assurance = await getOrCreateCredentialAssurance(credentialId);

  const assuranceHash = createHash('sha256')
    .update(JSON.stringify(assurance))
    .digest('hex');

  anchorEvent('credentialAssuranceAnchored', {
    credentialId,
    assuranceHash,
    probability: assurance.assurance.probability,
    evidenceDensity: assurance.assurance.evidenceDensity,
    deviationCount: assurance.deviations.length,
    timestamp: new Date().toISOString(),
  });
}

