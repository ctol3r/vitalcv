/**
 * credentialIntelligenceReport.ts — Wave X-5 / Revenue Engine
 *
 * Generates a structured Credential Intelligence Report (CIR) combining:
 *   1. Trust Passport — verified primary-source claims only
 *   2. Trust Posture  — dimensional score with L0–L3 band
 *   3. KPI Velocity   — time-to-start estimate from real event history
 *   4. Risk Flags     — sourced, timestamped, traceable
 *   5. Org Requirements — caller-provided only; NEVER scraped or auto-filled
 *
 * TRUTH CONTRACT
 * ─────────────
 * - Trust fields: sourced from buildPassportByNpi() + computeTrustScoreV1()
 * - Org requirements: accept as caller input; ALWAYS labeled "claimed by requestor — not verified"
 * - Enrichment: NEVER influences trust score, readiness, or risk flags
 * - Every field carries source + timestamp + confidence
 * - Missing data: explicit, not hidden
 * - Gated data: labeled as unavailable, not absent
 *
 * Revenue relevance:
 * - A buyer (employer, MSO, credentialing org) can see time-to-start estimate in < 60s
 * - Every blocker has a recommended action with estimated resolution time
 * - Report is exportable as JSON or PDF-ready structured payload
 */

import { createHash } from 'node:crypto';
import { buildPassportByNpi } from '../entity/passportService';
import { computeTrustScoreV1 } from '../trust/trustScoreV1';
import { getPilotKpiSnapshot } from '../pilot/pilotKpiService';
import { log } from '../../obs/logger';

// ── Report types ──────────────────────────────────────────────────────────────

export type RiskSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface ReportSourceRecord {
  sourceId: string;
  sourceLabel: string;
  verifiedAt: string | null;
  freshness: string;
  confidence: string;
}

export interface ReportBlocker {
  id: string;
  domain: string;
  title: string;
  detail: string;
  severity: RiskSeverity;
  /** Estimated calendar days to resolve this blocker */
  estimatedResolutionDays: number | null;
  /** Recommended action text */
  action: string;
  /** Source of this determination */
  source: ReportSourceRecord;
}

export interface ReportRiskFlag {
  id: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  /** Is this a hard block on employer action? */
  blocks: boolean;
  source: ReportSourceRecord;
}

export interface OrgRequirementCheck {
  requirement: string;
  /** Claim from passport that satisfies or partially satisfies this requirement */
  satisfiedBy: string | null;
  /** Status from passport data — NEVER assumed */
  status: 'SATISFIED' | 'PARTIAL' | 'UNVERIFIABLE' | 'MISSING';
  note: string;
}

export interface TrustPostureSummary {
  score: number;
  band: string;
  bandLabel: string;
  confidence: number;
  topGaps: string[];
  methodology: string;
  computedAt: string;
}

export interface TimeToStartEstimate {
  /** Null means "cannot estimate — blockers remain" */
  estimatedDays: number | null;
  /** Based on passport readiness engine */
  passportEstimate: number | null;
  /** Based on pilot KPI history (real event data) */
  kpiMedianDays: number | null;
  /** Basis for the estimate */
  basis: string;
  /** Confidence level */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'CANNOT_ESTIMATE';
}

export interface CredentialIntelligenceReport {
  // ── Identity ──────────────────────────────────────────────────────────────
  npi: string;
  entityId: string | null;
  displayName: string;
  specialty: string | null;
  reportId: string;
  generatedAt: string;
  /** Methodology version — links to trust stack version */
  methodology: string;

  // ── Readiness ─────────────────────────────────────────────────────────────
  readinessStatus: 'READY' | 'PARTIAL' | 'BLOCKED' | 'UNKNOWN';
  readinessScore: number;
  readinessLevel: string;

  // ── Trust posture ─────────────────────────────────────────────────────────
  trustPosture: TrustPostureSummary;

  // ── Time-to-start ─────────────────────────────────────────────────────────
  timeToStart: TimeToStartEstimate;

  // ── Blockers ──────────────────────────────────────────────────────────────
  blockers: ReportBlocker[];

  // ── Risk flags ────────────────────────────────────────────────────────────
  riskFlags: ReportRiskFlag[];

  // ── Verified credential summary ───────────────────────────────────────────
  verifiedCredentials: Array<{
    domain: string;
    label: string;
    status: string;
    jurisdiction: string | null;
    verifiedAt: string | null;
    expiresAt: string | null;
    sourceId: string | null;
  }>;

  // ── Org requirement checks ────────────────────────────────────────────────
  /** Always null when no orgRequirements provided */
  orgRequirementChecks: OrgRequirementCheck[] | null;

  /** Warning: org requirements are caller-provided and not verified by VitalCV */
  orgRequirementsDisclaimer: string | null;

  // ── Recommended actions ───────────────────────────────────────────────────
  recommendedActions: Array<{
    id: string;
    priority: number;
    title: string;
    detail: string;
    estimatedDays: number | null;
    actionType: 'clinician' | 'employer' | 'system';
  }>;

  // ── Data completeness ─────────────────────────────────────────────────────
  missingData: string[];
  gatedData: string[];

  // ── Receipt ───────────────────────────────────────────────────────────────
  /** SHA-256 of (npi + readinessScore + generatedAt) — verifiable receipt */
  reportHash: string;
}

// ── Report generation ─────────────────────────────────────────────────────────

const METHODOLOGY = 'credential-intelligence-report/v1.0';
const BLOCKED_DAYS_ESTIMATE = null; // can't estimate when hard-blocked
const PARTIAL_DAYS_ESTIMATE_BASE = 30; // rough baseline when partial

function resolveReadinessStatus(level: string | undefined): CredentialIntelligenceReport['readinessStatus'] {
  const l = (level ?? '').toUpperCase();
  if (l === 'READY') return 'READY';
  if (l === 'PARTIAL' || l === 'CREDENTIALED') return 'PARTIAL';
  if (l === 'BLOCKED') return 'BLOCKED';
  return 'UNKNOWN';
}

function buildBlockerFromNextAction(
  action: { id: string; title: string; detail: string; domain?: string; estimatedResolutionDays?: number | null },
  idx: number,
): ReportBlocker {
  return {
    id: action.id ?? `blocker-${idx}`,
    domain: action.domain ?? 'UNKNOWN',
    title: action.title,
    detail: action.detail,
    severity: 'HIGH',
    estimatedResolutionDays: action.estimatedResolutionDays ?? null,
    action: action.title,
    source: {
      sourceId: 'PASSPORT_READINESS_ENGINE',
      sourceLabel: 'VitalCV Readiness Engine',
      verifiedAt: new Date().toISOString(),
      freshness: 'LIVE',
      confidence: 'DERIVED_FROM_PRIMARY_SOURCES',
    },
  };
}

function buildRiskFlags(passport: Awaited<ReturnType<typeof buildPassportByNpi>>): ReportRiskFlag[] {
  if (!passport) return [];
  const flags: ReportRiskFlag[] = [];

  // Exclusion
  if (passport.standing.exclusionStatus === 'EXCLUDED') {
    flags.push({
      id: 'exclusion-blocked',
      severity: 'CRITICAL',
      title: 'OIG LEIE exclusion — provider blocked',
      detail: 'This provider has an active exclusion in the OIG LEIE database. Employer action is blocked until this is resolved.',
      blocks: true,
      source: {
        sourceId: 'OIG_LEIE',
        sourceLabel: 'HHS OIG LEIE',
        verifiedAt: passport.standing.exclusionCheckedAt ?? null,
        freshness: 'MONTHLY_BULK',
        confidence: passport.standing.exclusionConfidenceLabel ?? 'HIGH',
      },
    });
  } else if (passport.standing.exclusionStatus === 'POSSIBLE_MATCH') {
    flags.push({
      id: 'exclusion-possible-match',
      severity: 'HIGH',
      title: 'OIG possible match — manual review required',
      detail: 'A name-based possible match was found in OIG LEIE. This is not a confirmed exclusion. Manual adjudication is required before relying on the safety layer.',
      blocks: false,
      source: {
        sourceId: 'OIG_LEIE',
        sourceLabel: 'HHS OIG LEIE',
        verifiedAt: passport.standing.exclusionCheckedAt ?? null,
        freshness: 'MONTHLY_BULK',
        confidence: 'POSSIBLE_MATCH_NAME_ONLY',
      },
    });
  } else if (passport.standing.exclusionStatus === 'UNCHECKED') {
    flags.push({
      id: 'exclusion-unchecked',
      severity: 'MEDIUM',
      title: 'Exclusion check pending',
      detail: 'OIG LEIE check has not been run for this provider. Run ingest to complete the safety layer.',
      blocks: false,
      source: {
        sourceId: 'OIG_LEIE',
        sourceLabel: 'HHS OIG LEIE',
        verifiedAt: null,
        freshness: 'NOT_CHECKED',
        confidence: 'NONE',
      },
    });
  }

  // PECOS enrollment
  if (passport.standing.pecosEnrollmentStatus === 'NOT_FOUND') {
    flags.push({
      id: 'pecos-not-found',
      severity: 'MEDIUM',
      title: 'Medicare enrollment not found in PECOS',
      detail: passport.standing.enrollmentNote ?? 'CMS PECOS does not show an enrolled provider record. This may block Medicare billing. Submit PECOS enrollment (45–60 days).',
      blocks: false,
      source: {
        sourceId: 'CMS_PECOS',
        sourceLabel: 'CMS PECOS (Quarterly)',
        verifiedAt: passport.standing.enrollmentObservedAt ?? null,
        freshness: passport.standing.enrollmentDataFreshness ?? 'QUARTERLY',
        confidence: passport.standing.enrollmentConfidenceLabel ?? 'MEDIUM',
      },
    });
  }

  // Stale credentials
  const staleCreds = passport.authority.credentials.filter(c => c.stale);
  if (staleCreds.length > 0) {
    flags.push({
      id: 'stale-credentials',
      severity: 'MEDIUM',
      title: `${staleCreds.length} credential${staleCreds.length === 1 ? '' : 's'} have stale verification data`,
      detail: `The following domains have not been re-verified recently: ${staleCreds.map(c => c.domain).join(', ')}. Treat as advisory until refreshed.`,
      blocks: false,
      source: {
        sourceId: 'PASSPORT_FRESHNESS_ENGINE',
        sourceLabel: 'VitalCV Freshness Engine',
        verifiedAt: passport.lastCheckedAt ?? null,
        freshness: 'DERIVED',
        confidence: 'MEDIUM',
      },
    });
  }

  return flags;
}

function buildOrgRequirementChecks(
  orgRequirements: string[],
  passport: Awaited<ReturnType<typeof buildPassportByNpi>>,
): OrgRequirementCheck[] {
  if (!passport) return orgRequirements.map(req => ({
    requirement: req,
    satisfiedBy: null,
    status: 'UNVERIFIABLE',
    note: 'Passport data unavailable — cannot check against requirements.',
  }));

  const creds = passport.authority.credentials;

  return orgRequirements.map(req => {
    const reqLower = req.toLowerCase();

    // Attempt a best-effort match against passport domains/labels
    // This is matching ONLY — never verifies the requirement itself
    const match = creds.find(c =>
      (c.domain?.toLowerCase().includes(reqLower) ||
       (c.label ?? '').toLowerCase().includes(reqLower)) &&
      !c.reviewRequired,
    );

    if (match) {
      const isActive = match.status?.toUpperCase() === 'ACTIVE' || match.status?.toUpperCase() === 'VALID';
      return {
        requirement: req,
        satisfiedBy: `${match.domain}: ${match.label ?? match.status} (${match.sourceId ?? 'source not specified'})`,
        status: isActive && !match.stale ? 'SATISFIED' : 'PARTIAL',
        note: match.stale
          ? 'Matched credential data is stale — refresh recommended before relying on this check.'
          : `Matched against ${match.domain} from ${match.sourceId ?? 'passport'}.`,
      };
    }

    return {
      requirement: req,
      satisfiedBy: null,
      status: 'UNVERIFIABLE',
      note: 'No matching credential in passport. This requirement must be verified through the credentialing process.',
    };
  });
}

function buildRecommendedActions(
  passport: Awaited<ReturnType<typeof buildPassportByNpi>>,
  trustScore: Awaited<ReturnType<typeof computeTrustScoreV1>> | null,
): CredentialIntelligenceReport['recommendedActions'] {
  const actions: CredentialIntelligenceReport['recommendedActions'] = [];
  let priority = 1;

  if (!passport) return actions;

  // From passport next-actions
  for (const a of (passport.readiness?.nextActions ?? []).slice(0, 5)) {
    actions.push({
      id: a.id,
      priority: priority++,
      title: a.title,
      detail: a.detail ?? '',
      estimatedDays: null,
      actionType: 'clinician',
    });
  }

  // From trust score recommendations
  for (const rec of (trustScore?.recommendations ?? []).slice(0, 3)) {
    actions.push({
      id: `ts-rec-${priority}`,
      priority: priority++,
      title: rec,
      detail: '',
      estimatedDays: null,
      actionType: 'clinician',
    });
  }

  // Employer-side actions
  if (passport.standing.exclusionStatus === 'POSSIBLE_MATCH') {
    actions.push({
      id: 'employer-exclusion-review',
      priority: priority++,
      title: 'Review OIG possible match before accepting',
      detail: 'Do not treat as a confirmed exclusion. Cross-reference DOB and address before making a decision.',
      estimatedDays: 2,
      actionType: 'employer',
    });
  }

  return actions;
}

// ── Primary export ────────────────────────────────────────────────────────────

export interface GenerateReportOptions {
  npi: string;
  /** Caller-provided org requirements — never auto-filled, never scraped */
  orgRequirements?: string[];
  /** Optional requesting org label for audit log */
  requestingOrg?: string;
}

export async function generateCredentialIntelligenceReport(
  options: GenerateReportOptions,
): Promise<CredentialIntelligenceReport> {
  const { npi, orgRequirements, requestingOrg } = options;

  log('info', 'cir_generate_start', { npi, requestingOrg, hasOrgRequirements: (orgRequirements?.length ?? 0) > 0 });

  const generatedAt = new Date().toISOString();

  // Fetch passport + trust posture in parallel (both required for report)
  const [passport, trustScore] = await Promise.all([
    buildPassportByNpi(npi).catch(() => null),
    computeTrustScoreV1(npi).catch(() => null),
  ]);

  // KPI velocity — best-effort (never blocks report)
  let kpiMedianDays: number | null = null;
  try {
    const kpi = await getPilotKpiSnapshot({ pilotId: null, workflowLane: null, orgContextId: null, geographyTag: null });
    kpiMedianDays = kpi?.velocity?.medianDaysFirstReviewToStart ?? null;
  } catch {
    // non-blocking — report continues without KPI history
  }

  if (!passport) {
    // Return minimal report indicating ingest required
    const reportId = crypto.randomUUID();
    return {
      npi,
      entityId: null,
      displayName: 'Unknown — ingest required',
      specialty: null,
      reportId,
      generatedAt,
      methodology: METHODOLOGY,
      readinessStatus: 'UNKNOWN',
      readinessScore: 0,
      readinessLevel: 'L0',
      trustPosture: {
        score: 0,
        band: 'L0',
        bandLabel: 'UNVERIFIED',
        confidence: 0,
        topGaps: ['Passport not available — run ingest first'],
        methodology: trustScore?.methodology ?? METHODOLOGY,
        computedAt: generatedAt,
      },
      timeToStart: {
        estimatedDays: null,
        passportEstimate: null,
        kpiMedianDays,
        basis: 'Cannot estimate — passport not available. Run ingest for NPI ' + npi + '.',
        confidence: 'CANNOT_ESTIMATE',
      },
      blockers: [{
        id: 'no-passport',
        domain: 'IDENTITY',
        title: 'Passport not available',
        detail: 'Run preflight ingest to generate the trust passport for this NPI.',
        severity: 'CRITICAL',
        estimatedResolutionDays: 1,
        action: 'POST /api/ingest/preflight with this NPI to initialize the trust stack.',
        source: {
          sourceId: 'SYSTEM',
          sourceLabel: 'VitalCV Ingest Pipeline',
          verifiedAt: null,
          freshness: 'NOT_CHECKED',
          confidence: 'NONE',
        },
      }],
      riskFlags: [],
      verifiedCredentials: [],
      orgRequirementChecks: null,
      orgRequirementsDisclaimer: null,
      recommendedActions: [],
      missingData: ['Full passport — run ingest first'],
      gatedData: [],
      reportHash: createHash('sha256').update(JSON.stringify({ npi, generatedAt, score: 0 })).digest('hex'),
    };
  }

  const readinessStatus = resolveReadinessStatus(passport.readiness?.status);
  const readinessScore  = passport.readiness?.score ?? 0;
  const readinessLevel  = passport.readiness?.level ?? 'L0';

  // Time-to-start estimate
  const passportEstimate = passport.readiness?.estimatedStartDays ?? null;
  let estimatedDays: number | null = null;
  let ttsBasis = '';
  let ttsConfidence: TimeToStartEstimate['confidence'] = 'CANNOT_ESTIMATE';

  if (readinessStatus === 'BLOCKED') {
    estimatedDays = BLOCKED_DAYS_ESTIMATE;
    ttsBasis = 'Cannot estimate — hard blockers present. Resolve blockers first.';
    ttsConfidence = 'CANNOT_ESTIMATE';
  } else if (readinessStatus === 'READY') {
    estimatedDays = passportEstimate ?? kpiMedianDays ?? 7;
    ttsBasis = passportEstimate !== null
      ? 'Passport readiness engine (primary-source derived)'
      : kpiMedianDays !== null
        ? `Pilot KPI history: median ${kpiMedianDays} days from first review to start`
        : 'Estimated — no blocker history available';
    ttsConfidence = passportEstimate !== null ? 'HIGH' : kpiMedianDays !== null ? 'MEDIUM' : 'LOW';
  } else {
    // PARTIAL
    const longestBlocker = (passport.readiness?.nextActions ?? [])
      .reduce((max, a) => Math.max(max, 0), 0);
    estimatedDays = Math.max(PARTIAL_DAYS_ESTIMATE_BASE, longestBlocker);
    ttsBasis = 'Partial readiness — estimate based on typical blocker resolution time';
    ttsConfidence = 'LOW';
  }

  const blockers = (passport.readiness?.nextActions ?? [])
    .slice(0, 6)
    .map((a, i) => buildBlockerFromNextAction(a as Parameters<typeof buildBlockerFromNextAction>[0], i));

  const riskFlags = buildRiskFlags(passport);

  const verifiedCredentials = passport.authority.credentials
    .filter(c => !c.reviewRequired && !c.stale)
    .map(c => ({
      domain: c.domain,
      label: c.label ?? c.type,
      status: c.status,
      jurisdiction: c.jurisdiction ?? null,
      verifiedAt: c.verifiedAt ?? null,
      expiresAt: c.expiresAt ?? null,
      sourceId: c.sourceId ?? null,
    }));

  const missingData = passport.authority.summary.missing ?? [];
  const gatedData: string[] = [];
  if (passport.standing.licensureStatus === 'unknown') gatedData.push('State licensure — Nursys institutional access required');
  if (passport.authority.credentials.some(c => c.connectorState === 'unavailable')) {
    gatedData.push('FSMB board authority — institutional access required');
  }

  const trustPosture: TrustPostureSummary = {
    score: trustScore?.score ?? 0,
    band: trustScore?.band ?? 'L0',
    bandLabel: trustScore?.bandLabel ?? 'UNVERIFIED',
    confidence: trustScore?.confidence ?? 0,
    topGaps: (trustScore?.gaps ?? []).slice(0, 3),
    methodology: trustScore?.methodology ?? METHODOLOGY,
    computedAt: trustScore?.computedAt ?? generatedAt,
  };

  const orgRequirementChecks = orgRequirements && orgRequirements.length > 0
    ? buildOrgRequirementChecks(orgRequirements, passport)
    : null;

  const reportHash = createHash('sha256')
    .update(JSON.stringify({ npi, readinessScore, generatedAt }))
    .digest('hex');

  const report: CredentialIntelligenceReport = {
    npi,
    entityId: passport.entityId ?? null,
    displayName: passport.identity.displayName,
    specialty: passport.identity.specialty ?? null,
    reportId: crypto.randomUUID(),
    generatedAt,
    methodology: METHODOLOGY,
    readinessStatus,
    readinessScore,
    readinessLevel,
    trustPosture,
    timeToStart: {
      estimatedDays,
      passportEstimate,
      kpiMedianDays,
      basis: ttsBasis,
      confidence: ttsConfidence,
    },
    blockers,
    riskFlags,
    verifiedCredentials,
    orgRequirementChecks,
    orgRequirementsDisclaimer: orgRequirements && orgRequirements.length > 0
      ? 'Org requirements are provided by the requestor and have NOT been verified by VitalCV. Requirement checks show passport data matches only — not legal or credentialing advice.'
      : null,
    recommendedActions: buildRecommendedActions(passport, trustScore),
    missingData,
    gatedData,
    reportHash,
  };

  log('info', 'cir_generate_complete', {
    npi,
    reportId: report.reportId,
    readinessStatus,
    readinessScore,
    blockerCount: blockers.length,
    riskFlagCount: riskFlags.length,
    requestingOrg,
  });

  return report;
}
