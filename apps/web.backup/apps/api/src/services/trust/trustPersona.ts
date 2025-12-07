import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface TrustPersonaData {
  overallScore: number;
  dimensions: {
    behavioral: number;
    credential: number;
    interpersonal: number;
    performance: number;
  };
  signals: Array<{
    type: string;
    weight: number;
    timestamp: string;
  }>;
  archetype?: string;
  anomalies?: Array<{
    type: string;
    severity: string;
    detectedAt: string;
  }>;
}

/**
 * Task 275.2 — Behavioral trust signal collector
 * Collect login patterns, verification behaviors, doc accuracy
 */
export async function collectBehavioralSignals(
  clinicianId: string,
): Promise<Array<{ type: string; score: number; metadata: Record<string, unknown> }>> {
  const signals: Array<{ type: string; score: number; metadata: Record<string, unknown> }> = [];

  // Check login patterns (simplified - would check actual login logs)
  signals.push({
    type: 'login_consistency',
    score: 0.85,
    metadata: { loginFrequency: 'daily', lastLogin: new Date().toISOString() },
  });

  // Check verification behaviors
  const verifications = await prisma.complianceCheck.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  signals.push({
    type: 'verification_compliance',
    score: verifications.length > 0 ? 0.9 : 0.5,
    metadata: { verificationCount: verifications.length },
  });

  // Check document accuracy (simplified)
  signals.push({
    type: 'document_accuracy',
    score: 0.88,
    metadata: { accuracyRate: 0.88 },
  });

  return signals;
}

/**
 * Task 275.3 — Credential integrity weighting
 * Boost/diminish persona score via evidence strength
 */
export async function calculateCredentialIntegrity(
  clinicianId: string,
): Promise<number> {
  // Check credentials
  const credentials = await prisma.walletCredential.findMany({
    where: { clinicianId, revokedAt: null },
  });

  if (credentials.length === 0) {
    return 0.3; // Low score if no credentials
  }

  // Check credential reliability
  const reliabilityScores = await Promise.all(
    credentials.map(async (cred) => {
      const reliability = await prisma.credentialReliability.findUnique({
        where: { credentialId: cred.credentialId },
      });
      return reliability?.score ?? 0.5;
    }),
  );

  const avgReliability = reliabilityScores.reduce((a, b) => a + b, 0) / reliabilityScores.length;

  // Check for revocations
  const revokedCount = credentials.filter((c) => c.revokedAt !== null).length;
  const revocationPenalty = revokedCount / credentials.length;

  return Math.max(0, avgReliability - revocationPenalty * 0.3);
}

/**
 * Task 275.4 — Interpersonal trust mapping
 * Analyze communications with issuers/employers
 */
export async function analyzeInterpersonalTrust(
  clinicianId: string,
): Promise<number> {
  // Check hiring events (positive signal)
  const hiringEvents = await prisma.hiringEvent.findMany({
    where: { clinicianId, eventType: 'offerAccepted' },
  });

  // Check attestation requests (trust from issuers)
  const attestations = await prisma.attestationRequest.findMany({
    where: { npi: clinicianId, status: 'approved' },
  });

  // Check employer trust scores
  const employerTrustScores = await prisma.employerTrust.findMany({
    where: { orgId: { in: hiringEvents.map((e) => e.employerId) } },
  });

  const avgEmployerTrust =
    employerTrustScores.length > 0
      ? employerTrustScores.reduce((a, b) => a + b.score, 0) / employerTrustScores.length
      : 0.5;

  // Combine signals
  const hiringScore = Math.min(1.0, hiringEvents.length * 0.1);
  const attestationScore = Math.min(1.0, attestations.length * 0.15);

  return (hiringScore + attestationScore + avgEmployerTrust) / 3;
}

/**
 * Task 275.6 — Persona evolution engine
 * Track how trust changes over time
 */
export async function trackPersonaEvolution(
  clinicianId: string,
): Promise<Array<{ timestamp: string; score: number; factors: Record<string, number> }>> {
  // Get historical persona snapshots (simplified - would store historical data)
  const current = await prisma.trustPersona.findUnique({
    where: { clinicianId },
  });

  if (!current) {
    return [];
  }

  const persona = current.persona as TrustPersonaData;

  // Return evolution timeline (simplified)
  return [
    {
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      score: persona.overallScore * 0.9,
      factors: persona.dimensions,
    },
    {
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      score: persona.overallScore * 0.95,
      factors: persona.dimensions,
    },
    {
      timestamp: new Date().toISOString(),
      score: persona.overallScore,
      factors: persona.dimensions,
    },
  ];
}

/**
 * Task 275.7 — Trust anomaly detector
 * Detect suspicious persona changes
 */
export async function detectTrustAnomalies(
  clinicianId: string,
): Promise<Array<{ type: string; severity: string; description: string; detectedAt: string }>> {
  const anomalies: Array<{
    type: string;
    severity: string;
    description: string;
    detectedAt: string;
  }> = [];

  const persona = await prisma.trustPersona.findUnique({
    where: { clinicianId },
  });

  if (!persona) {
    return [];
  }

  const data = persona.persona as TrustPersonaData;

  // Check for sudden drops
  const evolution = await trackPersonaEvolution(clinicianId);
  if (evolution.length >= 2) {
    const recentDrop = evolution[evolution.length - 1].score - evolution[evolution.length - 2].score;
    if (recentDrop < -0.2) {
      anomalies.push({
        type: 'sudden_drop',
        severity: 'high',
        description: `Trust score dropped by ${Math.abs(recentDrop).toFixed(2)}`,
        detectedAt: new Date().toISOString(),
      });
    }
  }

  // Check for credential issues
  const credentialIntegrity = await calculateCredentialIntegrity(clinicianId);
  if (credentialIntegrity < 0.5) {
    anomalies.push({
      type: 'low_credential_integrity',
      severity: 'medium',
      description: 'Credential integrity score is below threshold',
      detectedAt: new Date().toISOString(),
    });
  }

  return anomalies;
}

/**
 * Task 275.8 — Trust persona clustering
 * Group clinicians by trust archetype
 */
export async function clusterTrustPersonas(): Promise<
  Record<string, { clinicians: string[]; avgScore: number; characteristics: string[] }>
> {
  const personas = await prisma.trustPersona.findMany();

  const clusters: Record<
    string,
    { clinicians: string[]; avgScore: number; characteristics: string[] }
  > = {
    high_trust: { clinicians: [], avgScore: 0, characteristics: ['high_credential', 'consistent'] },
    medium_trust: { clinicians: [], avgScore: 0, characteristics: ['moderate', 'variable'] },
    low_trust: { clinicians: [], avgScore: 0, characteristics: ['needs_review', 'inconsistent'] },
  };

  for (const persona of personas) {
    const data = persona.persona as TrustPersonaData;
    const score = data.overallScore;

    let cluster: string;
    if (score >= 0.8) {
      cluster = 'high_trust';
    } else if (score >= 0.5) {
      cluster = 'medium_trust';
    } else {
      cluster = 'low_trust';
    }

    clusters[cluster].clinicians.push(persona.clinicianId);
    clusters[cluster].avgScore =
      (clusters[cluster].avgScore * (clusters[cluster].clinicians.length - 1) + score) /
      clusters[cluster].clinicians.length;
  }

  return clusters;
}

/**
 * Task 275.9 — Persona-based matching engine
 * Prefer high-trust clinicians for high-safety roles
 */
export async function matchByTrustPersona(
  roleSafetyLevel: 'low' | 'medium' | 'high' | 'critical',
  candidateIds: string[],
): Promise<Array<{ clinicianId: string; matchScore: number; rationale: string[] }>> {
  const matches: Array<{ clinicianId: string; matchScore: number; rationale: string[] }> = [];

  for (const clinicianId of candidateIds) {
    const persona = await prisma.trustPersona.findUnique({
      where: { clinicianId },
    });

    if (!persona) {
      continue;
    }

    const data = persona.persona as TrustPersonaData;
    const score = data.overallScore;

    let matchScore = score;
    const rationale: string[] = [];

    // Adjust based on safety level requirements
    if (roleSafetyLevel === 'critical' && score < 0.9) {
      matchScore *= 0.5; // Heavy penalty
      rationale.push('Trust score below critical role threshold');
    } else if (roleSafetyLevel === 'high' && score < 0.75) {
      matchScore *= 0.7;
      rationale.push('Trust score below high-safety threshold');
    }

    if (data.anomalies && data.anomalies.length > 0) {
      matchScore *= 0.8;
      rationale.push(`Found ${data.anomalies.length} trust anomalies`);
    }

    matches.push({
      clinicianId,
      matchScore,
      rationale,
    });
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Update or create trust persona
 */
export async function updateTrustPersona(clinicianId: string): Promise<TrustPersonaData> {
  const behavioral = await collectBehavioralSignals(clinicianId);
  const credential = await calculateCredentialIntegrity(clinicianId);
  const interpersonal = await analyzeInterpersonalTrust(clinicianId);
  const performance = 0.8; // Simplified - would calculate from actual performance data

  const overallScore =
    (credential * 0.3 + interpersonal * 0.3 + performance * 0.2 + behavioral[0]?.score * 0.2) || 0.5;

  const persona: TrustPersonaData = {
    overallScore,
    dimensions: {
      behavioral: behavioral[0]?.score ?? 0.5,
      credential,
      interpersonal,
      performance,
    },
    signals: behavioral.map((s) => ({
      type: s.type,
      weight: s.score,
      timestamp: new Date().toISOString(),
    })),
  };

  await prisma.trustPersona.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      persona: persona as any,
    },
    update: {
      persona: persona as any,
    },
  });

  return persona;
}

/**
 * Task 275.10 — Anchor persona snapshot
 */
export async function anchorPersonaSnapshot(clinicianId: string): Promise<string | null> {
  try {
    const persona = await prisma.trustPersona.findUnique({
      where: { clinicianId },
    });

    if (!persona) {
      return null;
    }

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'trustPersonaAnchored',
      payload: {
        clinicianId,
        overallScore: (persona.persona as TrustPersonaData).overallScore,
        dimensions: (persona.persona as TrustPersonaData).dimensions,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[TrustPersona] Failed to anchor persona snapshot', error);
    return null;
  }
}

