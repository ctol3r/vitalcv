/**
 * mirofishEngine.ts — MiroFish Decision Intelligence Layer
 *
 * ISOLATION CONTRACT:
 *   - Reads real passport data. Never writes to it.
 *   - Never sets a verified/confirmed status on any claim.
 *   - All outputs are advisory and explicitly labeled.
 *   - Simulation runs client-side. No DB access. No trust layer mutation.
 *
 * DISCLAIMER (always shown to user):
 *   "Simulation-based recommendation. Not a compliance decision."
 *
 * Version: mf-1.0
 */

import type { PassportData } from '@/lib/trust/passport-contract';

// ── Input context ─────────────────────────────────────────────────────────────

export interface MirofishContext {
  /** Target specialty (may differ from passport specialty) */
  specialty?:    string;
  /** Target US state (affects licensing analysis) */
  state?:        string;
  /** Employer type influences required credentials */
  employerType?: 'hospital' | 'clinic' | 'telehealth' | 'agency' | 'locum' | 'unknown';
  /** Whether DEA is required for this role */
  deaRequired?:  boolean;
  /** Whether Medicare/Medicaid billing is required */
  billingRequired?: boolean;
}

// ── Output types ──────────────────────────────────────────────────────────────

export type MirofishRecommendation = 'PROCEED' | 'DELAY' | 'REQUEST_MISSING';

export interface MirofishRisk {
  area:        string;
  description: string;
  severity:    'HIGH' | 'MEDIUM' | 'LOW';
  mitigable:   boolean;
}

export interface MirofishPathStep {
  step:           number;
  action:         string;
  owner:          'CLINICIAN' | 'EMPLOYER' | 'BOTH';
  estimatedDays:  number;
  blocksStart:    boolean;
  notes?:         string;
}

export interface MirofishResult {
  /** Primary recommendation */
  recommendation:       MirofishRecommendation;
  /** Short rationale lines (2–4 max) */
  reasoning:            string[];
  /** Identified risks from trust state gaps */
  risks:                MirofishRisk[];
  /** Steps to reach start-ready state */
  fastestPath:          MirofishPathStep[];
  /** Total estimated days across all blocking steps */
  totalEstimatedDays:   number;
  /** Confidence in the recommendation (depends on data completeness) */
  confidence:           'HIGH' | 'MEDIUM' | 'LOW';
  /** Engine version for traceability */
  simulationVersion:    'mf-1.0';
  /** ISO timestamp of when this simulation ran */
  generatedAt:          string;
  /**
   * MANDATORY DISCLAIMER — always show this verbatim in the UI.
   * Never omit or shorten.
   */
  disclaimer: 'Simulation-based recommendation. Not a compliance decision.';
}

// ── Time estimates by domain (days) ───────────────────────────────────────────

const DOMAIN_TIME_ESTIMATES: Record<string, { days: number; label: string }> = {
  IDENTITY:            { days: 0,   label: 'Automated — no delay' },
  LICENSURE:           { days: 21,  label: '2–4 weeks (state board)' },
  BOARD_CERTIFICATION: { days: 84,  label: '8–12 weeks (exam cycle)' },
  DEA_REGISTRATION:    { days: 35,  label: '4–6 weeks (DEA application)' },
  MEDICARE_ENROLLMENT: { days: 42,  label: '4–8 weeks (PECOS)' },
  EXCLUSION_CHECK:     { days: 0,   label: 'Automated — no delay' },
  HOSPITAL_PRIVILEGE:  { days: 75,  label: '60–90 days (credentialing committee)' },
  NURSING_LICENSE:     { days: 14,  label: '1–3 weeks (Nursys/state board)' },
  NPI_REGISTRATION:    { days: 10,  label: '7–10 days (CMS NPPES)' },
};

function domainTime(domain: string): { days: number; label: string } {
  return DOMAIN_TIME_ESTIMATES[domain] ?? { days: 30, label: '2–6 weeks (varies by source)' };
}

// ── Core simulation ───────────────────────────────────────────────────────────

/**
 * Simulate a hiring decision based on passport data and org context.
 *
 * Pure function — no side effects. Returns advisory output only.
 */
export function simulateDecision(
  passport: PassportData,
  context:  MirofishContext = {},
): MirofishResult {
  const now = new Date().toISOString();
  const { standing, authority, readiness, training } = passport;

  const risks:        MirofishRisk[]     = [];
  const reasoning:    string[]           = [];
  const fastestPath:  MirofishPathStep[] = [];
  let   stepNum = 1;
  let   totalDays = 0;

  // ── 1. Safety gate — exclusion is always first ────────────────────────────

  if (standing.exclusionStatus === 'EXCLUDED') {
    risks.push({
      area: 'Safety',
      description: 'Provider appears on OIG LEIE exclusion list. Cannot proceed without resolution.',
      severity: 'HIGH',
      mitigable: false,
    });
    reasoning.push('OIG exclusion match detected — do not proceed.');
    return finalize('DELAY', reasoning, risks, fastestPath, totalDays, 'HIGH', now);
  }

  if (standing.exclusionStatus === 'POSSIBLE_MATCH') {
    risks.push({
      area: 'Safety',
      description: 'Possible exclusion match — low-confidence NPI hit. Manual review required before proceeding.',
      severity: 'HIGH',
      mitigable: true,
    });
    reasoning.push('Possible OIG match requires manual review before hiring decision.');
    fastestPath.push({
      step: stepNum++,
      action: 'Request OIG exclusion manual review',
      owner: 'EMPLOYER',
      estimatedDays: 3,
      blocksStart: true,
      notes: 'Contact OIG directly or use state licensing board verification.',
    });
    totalDays += 3;
  }

  if (standing.exclusionStatus === 'UNKNOWN' || standing.exclusionStatus === 'UNCHECKED') {
    risks.push({
      area: 'Safety',
      description: 'OIG exclusion check not yet completed. Required before start.',
      severity: 'MEDIUM',
      mitigable: true,
    });
    fastestPath.push({
      step: stepNum++,
      action: 'Complete OIG/LEIE exclusion check',
      owner: 'EMPLOYER',
      estimatedDays: 1,
      blocksStart: true,
      notes: 'Automated check via VitalCV (daily LEIE cache).',
    });
    totalDays += 1;
  }

  // ── 2. Identity ─────────────────────────────────────────────────────────────

  if (!passport.npi) {
    risks.push({
      area: 'Identity',
      description: 'No NPI on record. Cannot verify identity anchor.',
      severity: 'HIGH',
      mitigable: true,
    });
    fastestPath.push({
      step: stepNum++,
      action: 'Obtain NPI via CMS NPPES',
      owner: 'CLINICIAN',
      estimatedDays: domainTime('NPI_REGISTRATION').days,
      blocksStart: true,
      notes: domainTime('NPI_REGISTRATION').label,
    });
    totalDays += domainTime('NPI_REGISTRATION').days;
  }

  // ── 3. Licensure ────────────────────────────────────────────────────────────

  const licenseActive = authority.credentials.some(
    c => c.domain === 'LICENSURE' && c.status === 'ACTIVE',
  );

  if (!licenseActive) {
    const hasStale = authority.credentials.some(c => c.domain === 'LICENSURE' && c.stale);
    risks.push({
      area: 'Authority',
      description: hasStale
        ? 'License on file is stale — requires re-verification before start.'
        : 'Active license not confirmed. Required for clinical practice.',
      severity: 'HIGH',
      mitigable: true,
    });
    fastestPath.push({
      step: stepNum++,
      action: hasStale ? 'Re-verify license with state board' : 'Confirm active state license',
      owner: 'CLINICIAN',
      estimatedDays: domainTime('LICENSURE').days,
      blocksStart: true,
      notes: domainTime('LICENSURE').label,
    });
    totalDays += domainTime('LICENSURE').days;
  } else {
    const staleLicense = authority.credentials.find(c => c.domain === 'LICENSURE' && c.stale);
    if (staleLicense) {
      risks.push({
        area: 'Authority',
        description: 'License verification is stale and approaching re-verification window.',
        severity: 'LOW',
        mitigable: true,
      });
    }
  }

  // ── 4. DEA (contextual) ──────────────────────────────────────────────────────

  if (context.deaRequired === true && standing.deaStatus !== 'registered') {
    risks.push({
      area: 'Authority',
      description: 'DEA registration required for this role but not confirmed.',
      severity: 'HIGH',
      mitigable: true,
    });
    fastestPath.push({
      step: stepNum++,
      action: 'Complete DEA registration',
      owner: 'CLINICIAN',
      estimatedDays: domainTime('DEA_REGISTRATION').days,
      blocksStart: true,
      notes: domainTime('DEA_REGISTRATION').label,
    });
    totalDays += domainTime('DEA_REGISTRATION').days;
  }

  // ── 5. Medicare enrollment (contextual) ─────────────────────────────────────

  const billingReq = context.billingRequired ?? true; // assume billing required unless told otherwise
  const pecosEnrollmentStatus =
    standing.pecosEnrollmentStatus ?? (
      standing.pecosStatus === 'enrolled' ? 'ENROLLED' : 'UNCHECKED'
    );
  if (billingReq && pecosEnrollmentStatus !== 'ENROLLED') {
    risks.push({
      area: 'Eligibility',
      description:
        pecosEnrollmentStatus === 'NOT_FOUND'
          ? 'Quarterly PECOS release did not show Medicare enrollment for this provider. Billing may be blocked until enrollment is confirmed.'
          : 'Medicare enrollment is unresolved. PECOS is quarterly data and billing readiness must be confirmed before start.',
      severity: 'MEDIUM',
      mitigable: true,
    });
    fastestPath.push({
      step: stepNum++,
      action: 'Enroll or confirm PECOS Medicare enrollment',
      owner: 'CLINICIAN',
      estimatedDays: domainTime('MEDICARE_ENROLLMENT').days,
      blocksStart: false, // delays billing, not always start
      notes: domainTime('MEDICARE_ENROLLMENT').label,
    });
    // PECOS doesn't always block start — add partial time only
    totalDays = Math.max(totalDays, domainTime('MEDICARE_ENROLLMENT').days);
  }

  // ── 6. Training gaps ────────────────────────────────────────────────────────

  if (!training.hasDegree) {
    risks.push({
      area: 'Training',
      description: 'Degree record not on file. Required for most clinical roles.',
      severity: 'MEDIUM',
      mitigable: true,
    });
    fastestPath.push({
      step: stepNum++,
      action: 'Upload and verify medical degree',
      owner: 'CLINICIAN',
      estimatedDays: 7,
      blocksStart: false,
      notes: 'Verification via VitalCV Document Intelligence.',
    });
  }

  // ── 7. Missing credential domains ───────────────────────────────────────────

  for (const domain of authority.summary.missing) {
    // Skip domains already addressed above
    if (['IDENTITY', 'LICENSURE', 'DEA_REGISTRATION', 'EXCLUSION_CHECK', 'MEDICARE_ENROLLMENT'].includes(domain)) continue;

    const est = domainTime(domain);
    fastestPath.push({
      step: stepNum++,
      action: `Obtain ${domain.replace(/_/g, ' ').toLowerCase()}`,
      owner: 'CLINICIAN',
      estimatedDays: est.days,
      blocksStart: est.days > 30,
      notes: est.label,
    });
    if (est.days > 30) totalDays = Math.max(totalDays, est.days);
  }

  // ── 8. Build recommendation ──────────────────────────────────────────────────

  const blockingRisks   = risks.filter(r => r.severity === 'HIGH');
  const blockingSteps   = fastestPath.filter(s => s.blocksStart);
  const highRiskCount   = blockingRisks.length;
  const score           = readiness.score;

  let recommendation: MirofishRecommendation;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';

  if (highRiskCount === 0 && score >= 80) {
    recommendation = 'PROCEED';
    confidence = score >= 95 ? 'HIGH' : 'MEDIUM';
    reasoning.push(`Readiness score ${score}% — all critical signals clear.`);
    if (standing.exclusionStatus === 'CLEAR') reasoning.push('OIG exclusion check clear.');
    if (licenseActive) reasoning.push('Active license on file.');
  } else if (highRiskCount === 0 && blockingSteps.length === 0) {
    recommendation = 'PROCEED';
    confidence = 'MEDIUM';
    reasoning.push(`No blocking gaps identified. Some items may need follow-up.`);
  } else if (blockingSteps.length <= 2 && totalDays <= 21) {
    recommendation = 'REQUEST_MISSING';
    confidence = 'MEDIUM';
    reasoning.push(
      `${blockingSteps.length} item${blockingSteps.length > 1 ? 's' : ''} needed before start.`,
    );
    reasoning.push(`Estimated ${totalDays} days to clear.`);
  } else {
    recommendation = 'DELAY';
    confidence = highRiskCount > 0 ? 'HIGH' : 'MEDIUM';
    reasoning.push(`${highRiskCount} high-risk gap${highRiskCount > 1 ? 's' : ''} identified.`);
    if (totalDays > 0) reasoning.push(`Estimated ${totalDays} days to resolve critical blockers.`);
  }

  return finalize(recommendation, reasoning, risks, fastestPath, totalDays, confidence, now);
}

// ── Finalizer ─────────────────────────────────────────────────────────────────

function finalize(
  recommendation: MirofishRecommendation,
  reasoning:      string[],
  risks:          MirofishRisk[],
  fastestPath:    MirofishPathStep[],
  totalDays:      number,
  confidence:     'HIGH' | 'MEDIUM' | 'LOW',
  now:            string,
): MirofishResult {
  // Re-number steps after filtering
  const numbered = fastestPath.map((s, i) => ({ ...s, step: i + 1 }));

  return {
    recommendation,
    reasoning:           reasoning.slice(0, 4),
    risks,
    fastestPath:         numbered,
    totalEstimatedDays:  totalDays,
    confidence,
    simulationVersion:   'mf-1.0',
    generatedAt:         now,
    disclaimer:          'Simulation-based recommendation. Not a compliance decision.',
  };
}

// ── Feature flag helper ───────────────────────────────────────────────────────

/**
 * Returns true when MiroFish UI is enabled.
 * Gate: NEXT_PUBLIC_MIROFISH_ENABLED=true
 * Never enable in contexts where advisory output could be mistaken for compliance truth.
 */
export function isMirofishEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MIROFISH_ENABLED === 'true';
}

// ── Recommendation display config ────────────────────────────────────────────

export const RECOMMENDATION_CONFIG: Record<
  MirofishRecommendation,
  { label: string; detail: string; opacity: string; border: string }
> = {
  PROCEED: {
    label:   'Recommended: Proceed',
    detail:  'Critical signals are clear. Advisory confidence supports moving forward.',
    opacity: 'text-white/75',
    border:  'border-white/15',
  },
  REQUEST_MISSING: {
    label:   'Recommended: Request missing items',
    detail:  'One or more items needed before start. Short estimated resolution time.',
    opacity: 'text-white/65',
    border:  'border-white/12',
  },
  DELAY: {
    label:   'Recommended: Delay pending review',
    detail:  'High-risk gaps require resolution before a start decision.',
    opacity: 'text-white/50',
    border:  'border-white/8',
  },
};
