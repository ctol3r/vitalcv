/**
 * Career Packet derivation layer (Wave 205).
 *
 * Single source of truth for the Verified Clinician Career Packet. Both the
 * `/packet/[entityId]` UI and the PDF export consume `buildCareerPacket` so the
 * screen and the document can never disagree.
 *
 * Discipline (mirrors lib/issuer-verification/*): these are PURE transforms over
 * an already-hydrated `PassportData`. No fetches, no writes, no Date.now in the
 * derivations, no source checks. The packet is a snapshot of a passport that was
 * already computed upstream — it never upgrades a source state or a readiness
 * verdict, and it is honest about gated / stale / unknown coverage.
 */

import type {
  PassportData,
  PassportTrustPosture,
  ReadinessStatus,
} from '@/lib/trust/passport-contract';
import {
  sourceCoverageStateLabel,
  type PassportSourceCoverageCheck,
  type PassportSourceCoverageState,
} from '@/lib/trust/source-coverage';

// ── Public types ─────────────────────────────────────────────────────────────

export type RecruiterStatus = 'ready' | 'needs_review' | 'blocked' | 'missing_evidence';

export interface ExecutiveSummary {
  /** "Ada Lovelace, Cardiology" — or an honest fallback when identity is absent. */
  who: string;
  /** Plain-language readiness verdict (never a bare "Verified"/"Complete" claim). */
  verdict: string;
  /** The single highest-priority blocker/gap/action, or an honest all-clear line. */
  headline: string;
  /** Recruiter rollup status, surfaced at the top for the <30s scan. */
  recruiterStatus: RecruiterStatus;
}

export interface IdentitySummaryView {
  displayName: string;
  npi: string | null;
  specialty: string | null;
  entityType: string;
  status: string;
  /** Honest source attribution for the identity row. */
  sourceLabel: string;
}

export interface ReadinessView {
  status: ReadinessStatus;
  statusLabel: string;
  score: number;
  level: string;
  estimatedStartDays: number | null;
  blockers: string[];
  gaps: string[];
}

export interface VerificationSourceRow {
  sourceId: string;
  state: PassportSourceCoverageState;
  stateLabel: string;
  checkedAt: string | null;
  reason: string;
  /** Only the literal 'checked' state is decision-grade. */
  decisionGrade: boolean;
}

export interface EvidenceCredentialView {
  label: string;
  type: string;
  status: string;
  jurisdiction: string | null;
  stale: boolean;
}

export interface EvidenceTrainingView {
  label: string;
  recordType: string;
  institutionName: string | null;
  endYear: number | null;
  completed: boolean;
}

export interface EvidenceSummaryView {
  credentials: EvidenceCredentialView[];
  training: EvidenceTrainingView[];
  hasAny: boolean;
  summary: { active: number; expired: number; stale: number; missing: string[] };
}

export interface RecruiterRollup {
  status: RecruiterStatus;
  /** Uppercase display label: READY / NEEDS REVIEW / BLOCKED / MISSING EVIDENCE. */
  label: string;
  headline: string;
  reasons: string[];
}

export interface EmployerView {
  /** True ONLY when readiness is decision-grade with zero blockers. */
  startReady: boolean;
  startReadyLabel: string;
  blockers: string[];
  /** What an employer should request to move the candidate forward. */
  requestItems: string[];
  estimatedStartDays: number | null;
}

export interface TrustSignalDimensionView {
  id: string;
  label: string;
  state: string;
  detail: string;
}

export interface TrustSignalsView {
  band: string;
  bandLabel: string;
  score: number;
  dimensions: TrustSignalDimensionView[];
  safeToRelyOnNow: string[];
}

export interface MissingEvidenceItem {
  label: string;
  /** Coverage state ('gated', 'stale', …) or 'gap' for readiness gaps. */
  state: PassportSourceCoverageState | 'gap';
  stateLabel: string;
  detail: string;
}

export interface Recommendation {
  title: string;
  detail: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CareerPacketModel {
  entityId: string;
  generatedFor: { displayName: string; npi: string | null; specialty: string | null };
  executive: ExecutiveSummary;
  identity: IdentitySummaryView;
  readiness: ReadinessView;
  sources: VerificationSourceRow[];
  evidence: EvidenceSummaryView;
  recruiter: RecruiterRollup;
  employer: EmployerView;
  trustSignals: TrustSignalsView | null;
  missingEvidence: MissingEvidenceItem[];
  recommendations: Recommendation[];
  footer: { lineageKey: string | null; lastCheckedAt: string | null; degraded: boolean };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Recommendation['priority'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Coverage states that mean "evidence is owed", not merely "still fresh-checking". */
const MISSING_EVIDENCE_STATES: ReadonlySet<PassportSourceCoverageState> = new Set([
  'gated',
  'accessRequired',
  'notDecisionGrade',
  'previewOnly',
  'unavailable',
  'stale',
  'reviewRequired',
]);

function readinessStatusLabel(status: ReadinessStatus): string {
  switch (status) {
    case 'DECISION_GRADE':
      return 'Source-backed & review-ready';
    case 'PARTIAL':
      return 'Partially checked — review recommended';
    case 'CHECKING':
      return 'Checks in progress';
    case 'BLOCKED':
      return 'Blocked — see blockers';
    default:
      return 'Status unknown';
  }
}

function isDegraded(passport: PassportData): boolean {
  return Boolean((passport as PassportData & { _degraded?: boolean })._degraded);
}

function hasBlockers(passport: PassportData): boolean {
  return passport.readiness.blockers.length > 0 || passport.trustPosture.blockers.length > 0;
}

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

// ── The four net-new derivations ─────────────────────────────────────────────

/** W205-3: recruiter rollup. READY only when DECISION_GRADE with zero blockers. */
export function deriveRecruiterRollup(passport: PassportData): RecruiterRollup {
  const { readiness, trustPosture, sourceCoverage } = passport;
  const checks = sourceCoverage.checks ?? [];

  const allBlockers = [...readiness.blockers, ...trustPosture.blockers];
  const reviewChecks = checks.filter((c) => c.state === 'reviewRequired');
  const missingChecks = checks.filter((c) => MISSING_EVIDENCE_STATES.has(c.state) && c.state !== 'reviewRequired');

  let status: RecruiterStatus;
  const reasons: string[] = [];

  if (allBlockers.length > 0) {
    status = 'blocked';
    reasons.push(...allBlockers);
  } else if (readiness.status === 'CHECKING' || reviewChecks.length > 0) {
    status = 'needs_review';
    if (readiness.status === 'CHECKING') reasons.push('Source checks are still in progress.');
    reviewChecks.forEach((c) => reasons.push(`${c.sourceId} requires review: ${c.reason}`));
  } else if (
    missingChecks.length > 0
    || trustPosture.missingItems.length > 0
    || trustPosture.gatedItems.length > 0
  ) {
    status = 'missing_evidence';
    missingChecks.forEach((c) => reasons.push(`${c.sourceId} (${sourceCoverageStateLabel(c.state)}): ${c.reason}`));
    trustPosture.missingItems.forEach((item) => reasons.push(`Missing: ${item}`));
    trustPosture.gatedItems.forEach((item) => reasons.push(`Gated: ${item}`));
  } else if (readiness.status === 'DECISION_GRADE') {
    status = 'ready';
    reasons.push('Decision-grade launch-spine evidence with no open blockers.');
  } else {
    // Never default to ready: anything we cannot positively confirm degrades to review.
    status = 'needs_review';
    reasons.push('Coverage is incomplete; manual review recommended before moving forward.');
  }

  const label: Record<RecruiterStatus, string> = {
    ready: 'READY',
    needs_review: 'NEEDS REVIEW',
    blocked: 'BLOCKED',
    missing_evidence: 'MISSING EVIDENCE',
  };

  return { status, label: label[status], headline: reasons[0] ?? label[status], reasons };
}

/** W205: 3-line "who / are they ready / one blocker" executive header. */
export function deriveExecutiveSummary(passport: PassportData): ExecutiveSummary {
  const name = trimOrNull(passport.identity.displayName);
  const specialty = trimOrNull(passport.identity.specialty);
  const who = name ? (specialty ? `${name}, ${specialty}` : name) : 'Identity unavailable';

  const headline =
    trimOrNull(passport.readiness.blockers[0])
    ?? trimOrNull(passport.trustPosture.blockers[0])
    ?? trimOrNull(passport.readiness.gaps[0])
    ?? trimOrNull(passport.readiness.nextActions[0]?.title)
    ?? 'No blockers on file.';

  return {
    who,
    verdict: readinessStatusLabel(passport.readiness.status),
    headline,
    recruiterStatus: deriveRecruiterRollup(passport).status,
  };
}

/** W205: honest gaps assembled from coverage states + readiness gaps. */
export function deriveMissingEvidence(passport: PassportData): MissingEvidenceItem[] {
  const items: MissingEvidenceItem[] = [];

  for (const check of passport.sourceCoverage.checks ?? []) {
    if (MISSING_EVIDENCE_STATES.has(check.state)) {
      items.push({
        label: check.sourceId,
        state: check.state,
        stateLabel: sourceCoverageStateLabel(check.state),
        detail: check.reason,
      });
    }
  }

  for (const gap of passport.readiness.gaps) {
    const detail = trimOrNull(gap);
    if (detail) {
      items.push({ label: detail, state: 'gap', stateLabel: 'Gap', detail });
    }
  }

  for (const missing of passport.authority.summary.missing) {
    const detail = trimOrNull(missing);
    if (detail) {
      items.push({ label: detail, state: 'gap', stateLabel: 'Missing credential', detail });
    }
  }

  return items;
}

/** W205: clinician-actionable next steps, ordered by priority. */
export function deriveRecommendations(passport: PassportData): Recommendation[] {
  const fromActions = passport.readiness.nextActions.map((action) => ({
    title: action.title,
    detail: action.detail,
    priority: action.priority,
  }));

  if (fromActions.length > 0) {
    return [...fromActions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  }

  // Fall back to deriving recommendations from open blockers/gaps so the section
  // is never empty when there is unresolved work.
  const derived: Recommendation[] = [];
  for (const blocker of [...passport.readiness.blockers, ...passport.trustPosture.blockers]) {
    const detail = trimOrNull(blocker);
    if (detail) derived.push({ title: `Resolve: ${detail}`, detail, priority: 'HIGH' });
  }
  for (const gap of passport.readiness.gaps) {
    const detail = trimOrNull(gap);
    if (detail) derived.push({ title: `Add evidence: ${detail}`, detail, priority: 'MEDIUM' });
  }
  return derived;
}

// ── Section projections (pure field mapping) ────────────────────────────────

function deriveSources(checks: readonly PassportSourceCoverageCheck[]): VerificationSourceRow[] {
  return checks.map((check) => ({
    sourceId: check.sourceId,
    state: check.state,
    stateLabel: sourceCoverageStateLabel(check.state),
    checkedAt: check.checkedAt ?? null,
    reason: check.reason,
    decisionGrade: check.state === 'checked',
  }));
}

function deriveEvidence(passport: PassportData): EvidenceSummaryView {
  const credentials: EvidenceCredentialView[] = passport.authority.credentials.map((c) => ({
    label: c.domain || c.type,
    type: c.type,
    status: c.statusLabel ?? c.status,
    jurisdiction: trimOrNull(c.jurisdiction),
    stale: c.stale,
  }));

  const training: EvidenceTrainingView[] = passport.training.records.map((r) => ({
    label: trimOrNull(r.degreeOrTitle) ?? r.recordType,
    recordType: r.recordType,
    institutionName: trimOrNull(r.institutionName),
    endYear: typeof r.endYear === 'number' ? r.endYear : null,
    completed: r.completed,
  }));

  return {
    credentials,
    training,
    hasAny: credentials.length > 0 || training.length > 0,
    summary: passport.authority.summary,
  };
}

function deriveEmployerView(passport: PassportData): EmployerView {
  const startReady = passport.readiness.status === 'DECISION_GRADE' && !hasBlockers(passport);
  const blockers = [...passport.readiness.blockers, ...passport.trustPosture.blockers];
  const requestItems = [
    ...passport.trustPosture.missingItems,
    ...passport.trustPosture.gatedItems,
    ...passport.trustPosture.reviewRequiredItems,
  ];

  return {
    startReady,
    startReadyLabel: startReady ? 'Start ready' : 'Not start ready',
    blockers,
    requestItems,
    estimatedStartDays: passport.readiness.estimatedStartDays,
  };
}

function deriveTrustSignals(trustPosture: PassportTrustPosture): TrustSignalsView | null {
  if (!trustPosture) return null;
  return {
    band: trustPosture.band,
    bandLabel: trustPosture.bandLabel,
    score: trustPosture.score,
    dimensions: trustPosture.dimensions.map((d) => ({
      id: d.id,
      label: d.label,
      state: d.state,
      detail: d.detail,
    })),
    safeToRelyOnNow: trustPosture.safeToRelyOnNow,
  };
}

// ── Top-level assembly ───────────────────────────────────────────────────────

export interface BuildCareerPacketOptions {
  /** Audience changes section emphasis only — never the underlying truth. */
  audience?: 'recruiter' | 'employer' | 'clinician';
}

export function buildCareerPacket(
  passport: PassportData,
  _opts: BuildCareerPacketOptions = {},
): CareerPacketModel {
  const checks = passport.sourceCoverage.checks ?? [];

  return {
    entityId: passport.entityId,
    generatedFor: {
      displayName: passport.identity.displayName,
      npi: passport.identity.npi ?? passport.npi ?? null,
      specialty: trimOrNull(passport.identity.specialty),
    },
    executive: deriveExecutiveSummary(passport),
    identity: {
      displayName: passport.identity.displayName || 'Identity unavailable',
      npi: passport.identity.npi ?? passport.npi ?? null,
      specialty: trimOrNull(passport.identity.specialty),
      entityType: passport.identity.entityType,
      status: passport.identity.status,
      sourceLabel: 'Checked against CMS NPPES',
    },
    readiness: {
      status: passport.readiness.status,
      statusLabel: readinessStatusLabel(passport.readiness.status),
      score: passport.readiness.score,
      level: passport.readiness.level,
      estimatedStartDays: passport.readiness.estimatedStartDays,
      blockers: passport.readiness.blockers,
      gaps: passport.readiness.gaps,
    },
    sources: deriveSources(checks),
    evidence: deriveEvidence(passport),
    recruiter: deriveRecruiterRollup(passport),
    employer: deriveEmployerView(passport),
    trustSignals: deriveTrustSignals(passport.trustPosture),
    missingEvidence: deriveMissingEvidence(passport),
    recommendations: deriveRecommendations(passport),
    footer: {
      lineageKey: passport.lineageKey ?? null,
      lastCheckedAt: passport.lastCheckedAt ?? null,
      degraded: isDegraded(passport),
    },
  };
}
