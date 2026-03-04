/**
 * gapAnalyzer.ts — Wave 51: Credential Gap Analysis
 *
 * When CRS < 100%, generates an actionable gap report explaining
 * exactly what the clinician needs to become fully cleared.
 * Translates missing requirements into machine-readable action items
 * that the frontend widget can render directly.
 */

import type { CrsEvaluationResult, MatchedCredential } from './crsEvaluator';

// ── Types ─────────────────────────────────────────────────────────────────

export interface GapItem {
  requirementType: string;
  requirementLabel: string;
  status: 'missing' | 'expired' | 'revoked' | 'pending_verification';
  priority: 'required' | 'preferred';
  actionRequired: string;
  estimatedResolutionDays: number;
}

export interface GapReport {
  npi: string;
  policyId: string;
  totalRequirements: number;
  satisfiedCount: number;
  gapCount: number;
  gaps: GapItem[];
  recommendations: string[];
  generatedAt: string;
}

// ── Resolution Estimates ──────────────────────────────────────────────────

const RESOLUTION_DAYS: Record<string, number> = {
  state_license: 30,
  medical_license: 30,
  board_certification: 14,
  board_cert: 14,
  dea: 21,
  dea_certificate: 21,
  npi: 7,
  malpractice: 14,
  malpractice_insurance: 14,
  acls: 3,
  bls: 3,
  pals: 3,
  cpr: 1,
  background_check: 10,
  immunization: 5,
  tb_test: 3,
  drug_screen: 3,
};

function estimateResolutionDays(credentialType: string): number {
  const normalized = credentialType.toLowerCase().replace(/[\s-]/g, '_');
  return RESOLUTION_DAYS[normalized] ?? 14; // default 14 days
}

// ── Action Text Generation ────────────────────────────────────────────────

function generateActionText(cred: MatchedCredential): string {
  const label = cred.requirementLabel;

  switch (cred.status) {
    case 'missing':
      return `Submit a valid ${label}`;
    case 'expired':
      return `Renew your expired ${label}`;
    case 'revoked':
      return `Address revocation of ${label} and resubmit`;
    default:
      return `Complete verification for ${label}`;
  }
}

function mapStatus(
  status: MatchedCredential['status'],
): GapItem['status'] {
  switch (status) {
    case 'missing':
      return 'missing';
    case 'expired':
    case 'expiring':
      return 'expired';
    case 'revoked':
      return 'revoked';
    default:
      return 'pending_verification';
  }
}

// ── Analyzer ──────────────────────────────────────────────────────────────

function analyzeGaps(evaluation: CrsEvaluationResult): GapReport {
  const allCredentials = [
    ...evaluation.matchedCredentials,
    ...evaluation.missingCredentials,
  ];

  const satisfiedCount = evaluation.matchedCredentials.filter(
    (m) => m.status === 'active' || m.status === 'expiring',
  ).length;

  // Build gap items from missing + non-active matched
  const gapCredentials = [
    ...evaluation.missingCredentials,
    ...evaluation.matchedCredentials.filter(
      (m) => m.status !== 'active' && m.status !== 'expiring',
    ),
  ];

  const gaps: GapItem[] = gapCredentials.map((cred) => ({
    requirementType: cred.requirementType,
    requirementLabel: cred.requirementLabel,
    status: mapStatus(cred.status),
    priority: 'required',
    actionRequired: generateActionText(cred),
    estimatedResolutionDays: estimateResolutionDays(cred.requirementType),
  }));

  // Sort: revoked first (most urgent), then missing, then expired
  const statusOrder: Record<GapItem['status'], number> = {
    revoked: 0,
    missing: 1,
    expired: 2,
    pending_verification: 3,
  };
  gaps.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  // Generate prioritized recommendations
  const recommendations: string[] = [];

  const revokedGaps = gaps.filter((g) => g.status === 'revoked');
  if (revokedGaps.length > 0) {
    recommendations.push(
      `URGENT: ${revokedGaps.length} credential(s) have been revoked and require immediate attention.`,
    );
  }

  const missingGaps = gaps.filter((g) => g.status === 'missing');
  if (missingGaps.length > 0) {
    recommendations.push(
      `Submit ${missingGaps.length} missing credential(s): ${missingGaps.map((g) => g.requirementLabel).join(', ')}.`,
    );
  }

  const expiredGaps = gaps.filter((g) => g.status === 'expired');
  if (expiredGaps.length > 0) {
    recommendations.push(
      `Renew ${expiredGaps.length} expired credential(s): ${expiredGaps.map((g) => g.requirementLabel).join(', ')}.`,
    );
  }

  if (gaps.length === 0) {
    recommendations.push('All requirements satisfied. Clinician is cleared.');
  }

  const maxDays = gaps.length > 0
    ? Math.max(...gaps.map((g) => g.estimatedResolutionDays))
    : 0;
  if (maxDays > 0) {
    recommendations.push(
      `Estimated time to full clearance: ${maxDays} days (based on slowest requirement).`,
    );
  }

  return {
    npi: evaluation.npi,
    policyId: evaluation.policyId,
    totalRequirements: allCredentials.length,
    satisfiedCount,
    gapCount: gaps.length,
    gaps,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

export const gapAnalyzer = { analyzeGaps };
