/**
 * decisionEngine.ts — Wave 83: Decision Intelligence Engine
 *
 * Analyzes graph state and generates actionable decision insights
 * for verifiers and clinicians.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { analyzeRisks, type RiskFactor } from './riskAnalysis';
import { generateActions, type RecommendedAction } from './actionGenerator';

// ── Types ─────────────────────────────────────────────────────────────

export type ReadinessLevel = 'READY' | 'AT_RISK' | 'BLOCKED';

export interface DecisionInsightReport {
  npi: string;
  readinessLevel: ReadinessLevel;
  blockingCredentials: Array<{ id: string; source: string; status: string; reason: string }>;
  nextActions: RecommendedAction[];
  riskFactors: RiskFactor[];
  recommendedDecisions: Array<{ decisionType: string; recommendation: 'APPROVE' | 'HOLD' | 'DENY'; reason: string }>;
  generatedAt: string;
}

// ── Core Generator ────────────────────────────────────────────────────

export async function generateDecisionInsights(npi: string): Promise<DecisionInsightReport> {
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi },
    orderBy: { createdAt: 'desc' },
  });

  const capsuleEvents = await prisma.auditEvent.findMany({
    where: { type: 'DECISION_CAPSULE', clinicianId: npi },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const capsules = capsuleEvents.map((ev) => {
    const meta = (ev.metadata ?? {}) as Record<string, unknown>;
    return {
      id: ev.id,
      status: typeof meta['status'] === 'string' ? meta['status'] : 'VALID',
      decisionType: typeof meta['decisionType'] === 'string' ? meta['decisionType'] : 'UNKNOWN',
      credentialIds: Array.isArray(meta['credentialIds']) ? meta['credentialIds'] as string[] : [],
    };
  });

  // Analyze risks from credentials
  const riskFactors = analyzeRisks(artifacts);

  // Determine blocking credentials
  const blockingCredentials = artifacts
    .filter((a) => a.status === 'REVOKED' || a.status === 'SUSPENDED' || a.status === 'EXPIRED')
    .map((a) => ({
      id: a.id,
      source: a.source,
      status: a.status,
      reason: a.status === 'REVOKED' ? 'Credential has been revoked by issuer'
        : a.status === 'SUSPENDED' ? 'Credential is currently suspended'
        : 'Credential has expired and needs renewal',
    }));

  // Calculate readiness
  const hasCritical = riskFactors.some((r) => r.severity === 'CRITICAL');
  const hasHigh = riskFactors.some((r) => r.severity === 'HIGH');
  const readinessLevel: ReadinessLevel = hasCritical || blockingCredentials.length > 0
    ? 'BLOCKED'
    : hasHigh ? 'AT_RISK' : 'READY';

  // Generate recommended actions
  const nextActions = generateActions(artifacts, riskFactors, capsules);

  // Recommend decisions for active capsules
  const recommendedDecisions = capsules
    .filter((c: { status: string }) => c.status === 'VALID')
    .slice(0, 5)
    .map((c: { decisionType: string; credentialIds: string[] }) => {
      const credDeps = artifacts.filter((a) => c.credentialIds.includes(a.id));
      const allClean = credDeps.every((a) => a.status === 'Valid' || a.trustState === 'verified');
      const anyRevoked = credDeps.some((a) => a.status === 'REVOKED' || a.status === 'SUSPENDED');

      return {
        decisionType: c.decisionType,
        recommendation: anyRevoked ? 'DENY' as const : allClean ? 'APPROVE' as const : 'HOLD' as const,
        reason: anyRevoked
          ? 'One or more dependent credentials are revoked'
          : allClean
          ? 'All dependent credentials are verified and active'
          : 'Some credentials require additional verification',
      };
    });

  log('info', 'decision_engine: insights generated', {
    npi,
    readinessLevel,
    riskCount: riskFactors.length,
    blockingCount: blockingCredentials.length,
  });

  return {
    npi,
    readinessLevel,
    blockingCredentials,
    nextActions,
    riskFactors,
    recommendedDecisions,
    generatedAt: new Date().toISOString(),
  };
}
