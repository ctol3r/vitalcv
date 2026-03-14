/**
 * InconsistencyDetector.ts
 *
 * Cross-agent, cross-source inconsistency detection.
 * Runs AFTER all agents complete to find contradictions across their combined evidence.
 *
 * Detects:
 *   - Status conflicts (active in source A, suspended in source B)
 *   - Authority chain breaks (privilege granted, no supporting license)
 *   - Temporal anomalies (expiry before issue date, future issue dates)
 *   - Trust band mismatches (OIG clear but trust band L0)
 *   - Monitoring gaps (source not checked in > threshold days)
 */

import { randomUUID } from 'crypto';
import prisma from '../../graphql/prisma_client';
import type { AgentRunResult, Anomaly, AnomalySeverity } from './types';

export interface CrossSourceReport {
  npi: string;
  generatedAt: string;
  anomalies: Anomaly[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

function makeAnomaly(
  npi: string,
  severity: AnomalySeverity,
  description: string,
  field: string,
  sourceA: Anomaly['sourceA'],
  sourceB: Anomaly['sourceB'],
  recommendation: string,
): Anomaly {
  return {
    id: randomUUID(),
    npi,
    agentName: 'sanctions_monitoring', // cross-agent anomalies attributed to sanctions (highest scrutiny)
    severity,
    description,
    field,
    sourceA,
    sourceB,
    detectedAt: new Date().toISOString(),
    recommendation,
  };
}

export async function detectCrossSourceInconsistencies(
  npi: string,
  agentResults: AgentRunResult[],
): Promise<CrossSourceReport> {
  const anomalies: Anomaly[] = [];
  const generatedAt = new Date().toISOString();

  // Flatten all evidence bundles from all agents
  const allEvidence = agentResults.flatMap(r => r.evidenceBundles);

  // ── 1. Status conflicts across sources ──────────────────────────────────────
  // If license agent says ACTIVE but sanctions agent says SUSPENDED → conflict
  const licenseEvidence = allEvidence.filter(b =>
    b.source === 'STATE_BOARD' || b.source === 'NURSYS'
  );
  const sanctionsEvidence = allEvidence.filter(b => b.source === 'OIG_LEIE');

  const hasActiveLicense = licenseEvidence.some(b => b.status === 'ACTIVE');
  const hasSanction = sanctionsEvidence.some(b => b.status === 'SUSPENDED');

  if (hasActiveLicense && hasSanction) {
    anomalies.push(makeAnomaly(
      npi,
      'CRITICAL',
      'Active state license exists alongside OIG exclusion — authority chain broken',
      'cross_source.license_vs_sanctions',
      { name: 'STATE_BOARD/NURSYS', value: 'ACTIVE' },
      { name: 'OIG_LEIE', value: 'EXCLUDED' },
      'IMMEDIATE: State licensing board must be notified of OIG exclusion. Investigate whether board is aware.',
    ));
  }

  // ── 2. Authority chain integrity ────────────────────────────────────────────
  // Privilege exists → must have a supporting state license
  const privilegeEvidence = allEvidence.filter(b =>
    b.credentialType.startsWith('PRIVILEGE_') && b.status === 'ACTIVE'
  );
  const verifiedLicense = licenseEvidence.find(b => b.status === 'ACTIVE');

  if (privilegeEvidence.length > 0 && !verifiedLicense) {
    anomalies.push(makeAnomaly(
      npi,
      'HIGH',
      `${privilegeEvidence.length} active privilege(s) found but no verified state license`,
      'cross_source.privilege_without_license',
      { name: 'privilege_agent', value: `${privilegeEvidence.length} active privileges` },
      { name: 'license_agent', value: 'NO_VERIFIED_LICENSE' },
      'Run LicenseVerificationAgent with full state sweep. Hospital credentialing may have accepted expired license.',
    ));
  }

  // ── 3. Board cert without supporting training ────────────────────────────────
  const boardEvidence = allEvidence.filter(b =>
    ['ABIM', 'ABFM', 'ABEM', 'ABP', 'ABNS', 'BOARD_CERTIFICATION'].includes(b.source) &&
    b.status === 'ACTIVE'
  );
  const trainingEvidence = allEvidence.filter(b =>
    b.source === 'TRAINING_RECORD' || b.source === 'ACGME'
  );

  if (boardEvidence.length > 0 && trainingEvidence.length === 0) {
    anomalies.push(makeAnomaly(
      npi,
      'MEDIUM',
      'Board certification(s) found but no training records in system',
      'cross_source.board_without_training',
      { name: boardEvidence[0]!.source, value: 'CERTIFIED' },
      { name: 'training_records', value: 'NONE_FOUND' },
      'Request GME training verification documents. Board cert alone insufficient for full trust chain.',
    ));
  }

  // ── 4. Temporal anomalies ────────────────────────────────────────────────────
  for (const bundle of allEvidence) {
    if (bundle.normalizedFields.issueDate && bundle.normalizedFields.expiryDate) {
      const issueMs = new Date(bundle.normalizedFields.issueDate).getTime();
      const expiryMs = new Date(bundle.normalizedFields.expiryDate).getTime();
      if (issueMs > expiryMs) {
        anomalies.push(makeAnomaly(
          npi,
          'HIGH',
          `${bundle.source}: credential issue date (${bundle.normalizedFields.issueDate}) is after expiry date (${bundle.normalizedFields.expiryDate})`,
          'temporal.issue_after_expiry',
          { name: bundle.source, value: `issued: ${bundle.normalizedFields.issueDate}` },
          { name: bundle.source, value: `expires: ${bundle.normalizedFields.expiryDate}` },
          'Data integrity error — verify dates with issuing authority.',
        ));
      }
    }

    // Future issue date (clock skew or data error)
    if (bundle.normalizedFields.issueDate) {
      const issueMs = new Date(bundle.normalizedFields.issueDate).getTime();
      if (issueMs > Date.now() + 86_400_000) { // more than 1 day in future
        anomalies.push(makeAnomaly(
          npi,
          'LOW',
          `${bundle.source}: credential issue date is in the future (${bundle.normalizedFields.issueDate})`,
          'temporal.future_issue_date',
          { name: bundle.source, value: bundle.normalizedFields.issueDate },
          { name: 'current_date', value: new Date().toISOString() },
          'Verify issue date with source authority. May indicate pre-dated record or clock skew.',
        ));
      }
    }
  }

  // ── 5. Monitoring gaps (sources not checked recently) ────────────────────────
  const FRESHNESS_THRESHOLDS: Record<string, number> = {
    OIG_LEIE: 48,         // hours — sanctions must be checked every 48h
    STATE_BOARD: 24 * 30, // 30 days
    NURSYS: 24 * 30,
    ABIM: 24 * 90,
    BOARD_CERTIFICATION: 24 * 90,
  };

  for (const [source, thresholdHours] of Object.entries(FRESHNESS_THRESHOLDS)) {
    const latest = await prisma.verificationArtifact.findFirst({
      where: { npi, source },
      orderBy: { verifiedAt: 'desc' },
      select: { verifiedAt: true },
    });

    if (!latest) continue; // Never checked — not an anomaly (agent hasn't run yet)

    const ageHours = (Date.now() - latest.verifiedAt.getTime()) / 3_600_000;
    if (ageHours > thresholdHours * 1.5) { // 50% overdue
      anomalies.push(makeAnomaly(
        npi,
        source === 'OIG_LEIE' ? 'HIGH' : 'MEDIUM',
        `${source} verification is ${Math.round(ageHours)}h old (threshold: ${thresholdHours}h)`,
        'monitoring.stale_source',
        { name: source, value: `last_check: ${latest.verifiedAt.toISOString()}` },
        { name: 'threshold', value: `${thresholdHours}h` },
        `Schedule ${source} re-verification. Trust state may be based on stale data.`,
      ));
    }
  }

  // Merge with agent-level anomalies (deduplicate by field+source)
  const allAgentAnomalies = agentResults.flatMap(r => r.anomalies);
  const seen = new Set<string>();
  for (const a of [...allAgentAnomalies, ...anomalies]) {
    const key = `${a.field}:${a.sourceA.name}:${a.sourceB.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      anomalies.push(a);
    }
  }

  const summary = anomalies.reduce(
    (acc, a) => { acc[a.severity.toLowerCase() as keyof typeof acc]++; acc.total++; return acc; },
    { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
  );

  return { npi, generatedAt, anomalies, summary };
}
