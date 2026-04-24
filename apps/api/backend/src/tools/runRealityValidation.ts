import { getDecisionSummary } from '../../../../web/lib/apply/decision-summary';
import {
  calculateDeterministicElapsedDays,
  summarizeDeterministicDecision,
  type DeterministicDecisionState,
} from '@vitalcv/trust-state';
import {
  detectContradictions,
  ProofAvailability,
  ReadinessPosture,
  SourceStatus,
  type SourceLane,
  type TrustStateSnapshot,
} from '../../../../../packages/trust-contract/src/index';
import {
  getEventBusHealthSnapshot,
  getLatestEventTimestamp,
  listRecentEvents,
  publish,
  resetEventBusForTests,
} from '../core/events/eventBus';

type ClinicianRole = 'MD' | 'NP' | 'PA';
type ScenarioKind =
  | 'ready_clean'
  | 'ready_clean_fast'
  | 'partial_missing'
  | 'partial_stale'
  | 'partial_access_required'
  | 'partial_review_required'
  | 'unknown_no_sources'
  | 'blocked_license_expired'
  | 'blocked_dea_expired'
  | 'blocked_exclusion';
type EventMode = 'clean' | 'duplicate' | 'delayed' | 'out_of_order' | 'replay_cycle';
type ExecutedAction = 'accept' | 'refresh' | 'review';
type FinalOutcome = 'started' | 'refresh_pending' | 'manual_review' | 'blocked';

interface SyntheticClinician {
  caseId: string;
  npi: string;
  role: ClinicianRole;
  state: string;
  scenario: ScenarioKind;
  eventMode: EventMode;
}

interface ScenarioConfig {
  status: 'unknown' | 'partial' | 'ready' | 'blocked';
  claims: Array<{
    credentialType: string;
    issuer: string;
    status: 'VERIFIED' | 'ACTIVE' | 'UNVERIFIED' | 'PENDING';
  }>;
  limitations: Array<{
    state: 'pending' | 'stale' | 'access_required' | 'unavailable' | 'review_required' | 'expired';
    label: string;
    detail: string;
  }>;
  standing?: {
    deaStatus?: string | null;
    licenseStatus?: string | null;
    exclusionStatus?: string | null;
  };
  blockers?: string[];
  readinessScore: number;
  missingSources: number;
  blockedStates: number;
  expectedAction: ExecutedAction;
}

interface CaseResult {
  clinician: SyntheticClinician;
  decisionState: DeterministicDecisionState;
  blockers: string[];
  nextAction: string;
  proofAllowed: boolean;
  executedAction: ExecutedAction;
  estimatedStartDays: number | null;
  timeToStartDays: number | null;
  finalOutcome: FinalOutcome;
  contradictions: string[];
  eventIntegrityPassed: boolean;
  failures: string[];
  confusingOutputs: string[];
}

interface ValidationReport {
  totals: {
    clinicians: number;
    started: number;
    blocked: number;
    manualReview: number;
    refreshPending: number;
    failedCases: number;
    confusingCases: number;
  };
  summary: {
    averageTimeToStartDays: number | null;
    medianTimeToStartDays: number | null;
    averageDaysSavedVs90DayBaseline: number | null;
    realismAssessment: string;
  };
  failures: Array<Pick<CaseResult, 'clinician' | 'failures' | 'decisionState' | 'executedAction' | 'finalOutcome'>>;
  logicBreaks: Array<Pick<CaseResult, 'clinician' | 'failures' | 'blockers' | 'nextAction'>>;
  outputRisks: Array<Pick<CaseResult, 'clinician' | 'confusingOutputs' | 'decisionState' | 'nextAction'>>;
  uxRisks: Array<Pick<CaseResult, 'clinician' | 'confusingOutputs' | 'executedAction' | 'finalOutcome'>>;
}

const DEFAULT_PILOT_START_BASELINE_DAYS = 90;
const MIN_ESTIMATED_START_DAYS = 10;
const MAX_MISSING_SOURCE_PENALTY = 5;
const MAX_BLOCKED_STATE_PENALTY = 4;

const STATES = ['CA', 'TX', 'FL', 'NY', 'WA', 'IL', 'MA', 'CO', 'GA', 'AZ'] as const;
const ROLES: ClinicianRole[] = ['MD', 'NP', 'PA'];
const SCENARIOS: readonly ScenarioKind[] = [
  'ready_clean',
  'ready_clean_fast',
  'partial_missing',
  'partial_stale',
  'partial_access_required',
  'partial_review_required',
  'unknown_no_sources',
  'blocked_license_expired',
  'blocked_dea_expired',
  'blocked_exclusion',
] as const;
const EVENT_MODES: readonly EventMode[] = ['clean', 'duplicate', 'delayed', 'out_of_order', 'replay_cycle'] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function floorToNearestFive(value: number): number {
  return Math.floor(value / 5) * 5;
}

function ceilToNearestFive(value: number): number {
  return Math.ceil(value / 5) * 5;
}

function estimatePilotTimeToStart(input: {
  readinessScore: number;
  missingSources: number;
  blockedStates: number;
  baselineDays?: number;
}): { estimatedDays: { minimumDays: number; maximumDays: number } } {
  const baselineDays = Math.max(Math.round(input.baselineDays ?? DEFAULT_PILOT_START_BASELINE_DAYS), 1);
  const readinessScore = clamp(Math.round(input.readinessScore), 0, 100);
  const missingSources = clamp(Math.max(Math.round(input.missingSources), 0), 0, MAX_MISSING_SOURCE_PENALTY);
  const blockedStates = clamp(Math.max(Math.round(input.blockedStates), 0), 0, MAX_BLOCKED_STATE_PENALTY);

  const fastestStartDays = clamp(
    baselineDays
      - readinessScore * 0.8
      + missingSources * 2.5
      + blockedStates * 5,
    MIN_ESTIMATED_START_DAYS,
    baselineDays,
  );
  const slowestStartDays = clamp(
    baselineDays
      - readinessScore * 0.7
      + missingSources * 4
      + blockedStates * 7,
    fastestStartDays,
    baselineDays,
  );

  return {
    estimatedDays: {
      minimumDays: clamp(
        floorToNearestFive(fastestStartDays),
        MIN_ESTIMATED_START_DAYS,
        baselineDays,
      ),
      maximumDays: clamp(
        ceilToNearestFive(slowestStartDays),
        MIN_ESTIMATED_START_DAYS,
        baselineDays,
      ),
    },
  };
}

function scenarioConfig(clinician: SyntheticClinician): ScenarioConfig {
  const roleLabel = clinician.role === 'MD' ? 'Physician' : clinician.role === 'NP' ? 'Nurse practitioner' : 'Physician assistant';
  const identityClaims = [
    { credentialType: 'NPI identity', issuer: 'CMS NPPES', status: 'VERIFIED' as const },
  ];
  const oigClaim = { credentialType: 'OIG / LEIE', issuer: 'OIG LEIE', status: 'VERIFIED' as const };
  const licenseClaim = {
    credentialType: `${roleLabel} license`,
    issuer: `${clinician.state} state board`,
    status: 'ACTIVE' as const,
  };
  const deaClaim = { credentialType: 'DEA registration', issuer: 'DEA', status: 'ACTIVE' as const };

  switch (clinician.scenario) {
    case 'ready_clean':
      return {
        status: 'ready',
        claims: [...identityClaims, oigClaim, licenseClaim],
        limitations: [],
        readinessScore: 88,
        missingSources: 1,
        blockedStates: 0,
        expectedAction: 'accept',
      };
    case 'ready_clean_fast':
      return {
        status: 'ready',
        claims: [...identityClaims, oigClaim, licenseClaim, deaClaim],
        limitations: [],
        readinessScore: 94,
        missingSources: 0,
        blockedStates: 0,
        expectedAction: 'accept',
      };
    case 'partial_missing':
      return {
        status: 'partial',
        claims: [...identityClaims, oigClaim],
        limitations: [
          {
            state: 'pending',
            label: `${clinician.state} license check still pending`,
            detail: `${clinician.state} board result has not returned yet.`,
          },
        ],
        readinessScore: 58,
        missingSources: 2,
        blockedStates: 0,
        expectedAction: 'refresh',
      };
    case 'partial_stale':
      return {
        status: 'partial',
        claims: [...identityClaims, oigClaim, licenseClaim],
        limitations: [
          {
            state: 'stale',
            label: 'State license check is stale',
            detail: 'The source-backed license check is older than the allowed window.',
          },
        ],
        readinessScore: 63,
        missingSources: 1,
        blockedStates: 1,
        expectedAction: 'refresh',
      };
    case 'partial_access_required':
      return {
        status: 'partial',
        claims: [...identityClaims, oigClaim],
        limitations: [
          {
            state: 'access_required',
            label: 'State board access required',
            detail: `${clinician.state} requires an institutional source agreement before license verification can run.`,
          },
        ],
        readinessScore: 52,
        missingSources: 2,
        blockedStates: 0,
        expectedAction: 'review',
      };
    case 'partial_review_required':
      return {
        status: 'partial',
        claims: [...identityClaims, oigClaim, licenseClaim],
        limitations: [
          {
            state: 'review_required',
            label: 'Conflicting authority record',
            detail: 'License status and board order details need manual credentialing review.',
          },
        ],
        blockers: [],
        readinessScore: 55,
        missingSources: 1,
        blockedStates: 0,
        expectedAction: 'review',
      };
    case 'unknown_no_sources':
      return {
        status: 'unknown',
        claims: [],
        limitations: [
          {
            state: 'unavailable',
            label: 'No verified source evidence attached',
            detail: 'The clinician has not completed the first verified source step yet.',
          },
        ],
        readinessScore: 0,
        missingSources: 3,
        blockedStates: 0,
        expectedAction: 'refresh',
      };
    case 'blocked_license_expired':
      return {
        status: 'blocked',
        claims: [...identityClaims, oigClaim],
        limitations: [
          {
            state: 'expired',
            label: `${clinician.state} license expired`,
            detail: 'The active state license is expired and cannot support start.',
          },
        ],
        standing: { licenseStatus: 'expired' },
        readinessScore: 22,
        missingSources: 2,
        blockedStates: 1,
        expectedAction: 'review',
      };
    case 'blocked_dea_expired':
      return {
        status: 'blocked',
        claims: [...identityClaims, oigClaim, licenseClaim],
        limitations: [
          {
            state: 'expired',
            label: 'DEA registration expired',
            detail: 'Controlled-substance authority is expired.',
          },
        ],
        standing: { deaStatus: 'expired' },
        readinessScore: 31,
        missingSources: 1,
        blockedStates: 1,
        expectedAction: 'review',
      };
    case 'blocked_exclusion':
    default:
      return {
        status: 'blocked',
        claims: [...identityClaims, licenseClaim],
        limitations: [
          {
            state: 'review_required',
            label: 'Federal exclusion found',
            detail: 'An exclusion hit must be resolved before start.',
          },
        ],
        standing: { exclusionStatus: 'excluded' },
        readinessScore: 5,
        missingSources: 1,
        blockedStates: 1,
        expectedAction: 'review',
      };
  }
}

function buildCohort(): SyntheticClinician[] {
  const clinicians: SyntheticClinician[] = [];
  for (let index = 0; index < 50; index += 1) {
    clinicians.push({
      caseId: `case-${String(index + 1).padStart(2, '0')}`,
      npi: `950000${String(index + 1).padStart(4, '0')}`,
      role: ROLES[index % ROLES.length]!,
      state: STATES[index % STATES.length]!,
      scenario: SCENARIOS[index % SCENARIOS.length]!,
      eventMode: EVENT_MODES[index % EVENT_MODES.length]!,
    });
  }
  return clinicians;
}

function determineAction(summary: ReturnType<typeof getDecisionSummary>, config: ScenarioConfig): ExecutedAction {
  if (summary.state === 'ready') {
    return 'accept';
  }

  if (config.limitations.some((limitation) => limitation.state === 'access_required' || limitation.state === 'review_required')) {
    return 'review';
  }

  if (summary.state === 'blocked') {
    return 'review';
  }

  return 'refresh';
}

function mapToTrustContractState(result: ReturnType<typeof summarizeDeterministicDecision>, config: ScenarioConfig): TrustStateSnapshot {
  const lanes: SourceLane[] = [];
  const now = '2026-04-22T12:00:00.000Z';

  if (config.claims.length === 0) {
    lanes.push({ name: 'npi_identity', status: SourceStatus.UNAVAILABLE, errorClass: 'NO_VERIFIED_DATA' });
  } else {
    lanes.push({ name: 'npi_identity', status: SourceStatus.CHECKED, checkedAt: now });
  }

  for (const limitation of config.limitations) {
    const mappedStatus =
      limitation.state === 'pending'
        ? SourceStatus.PENDING
        : limitation.state === 'stale' || limitation.state === 'expired'
          ? SourceStatus.STALE
          : limitation.state === 'access_required'
            ? SourceStatus.ACCESS_REQUIRED
            : limitation.state === 'unavailable'
              ? SourceStatus.UNAVAILABLE
              : SourceStatus.REVIEW_REQUIRED;
    lanes.push({
      name: limitation.label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      status: mappedStatus,
      ...(mappedStatus === SourceStatus.UNAVAILABLE ? { errorClass: 'SOURCE_UNAVAILABLE' } : {}),
    });
  }

  for (const blocker of result.blockers) {
    lanes.push({
      name: blocker.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      status: SourceStatus.BLOCKED_SIGNAL,
    });
  }

  const posture =
    result.state === 'blocked'
      ? ReadinessPosture.BLOCKED
      : result.state === 'ready'
        ? ReadinessPosture.DECISION_GRADE
        : result.state === 'unknown'
          ? ReadinessPosture.PARTIAL
          : ReadinessPosture.PARTIAL;

  return {
    lanes,
    posture,
    proofAvailability: result.proofAllowed
      ? result.state === 'ready'
        ? ProofAvailability.DECISION_GRADE
        : ProofAvailability.PARTIAL
      : ProofAvailability.NONE,
    readinessScore: config.readinessScore > 0 ? config.readinessScore : null,
    blockerCount: result.blockers.length,
  };
}

async function verifyEventIntegrity(caseId: string, mode: EventMode): Promise<boolean> {
  resetEventBusForTests();

  const primary = await publish({
    type: 'PROVIDER_UPDATED',
    id: `${caseId}-primary`,
    timestamp: '2026-04-22T12:05:00.000Z',
    payload: {
      providerId: caseId,
      npi: caseId,
      providerLabel: caseId,
      operation: 'updated',
    },
  });

  if (mode === 'duplicate') {
    const before = listRecentEvents({ limit: 10 });
    const beforeHealth = getEventBusHealthSnapshot();
    try {
      await publish({
        type: 'PROVIDER_UPDATED',
        id: `${caseId}-primary`,
        timestamp: '2026-04-22T12:06:00.000Z',
        payload: {
          providerId: `${caseId}-mutated`,
          npi: `${caseId}-mutated`,
          providerLabel: `${caseId}-mutated`,
          operation: 'updated',
        },
      });
      return false;
    } catch {
      return JSON.stringify(listRecentEvents({ limit: 10 })) === JSON.stringify(before)
        && JSON.stringify(getEventBusHealthSnapshot()) === JSON.stringify(beforeHealth);
    }
  }

  if (mode === 'delayed') {
    await publish({
      type: 'PROVIDER_UPDATED',
      id: `${caseId}-delayed`,
      timestamp: '2026-04-22T11:55:00.000Z',
      payload: {
        providerId: `${caseId}-older`,
        npi: `${caseId}-older`,
        providerLabel: `${caseId}-older`,
        operation: 'updated',
      },
    });
    return getLatestEventTimestamp() === primary.timestamp
      && getEventBusHealthSnapshot().latestEventId === primary.id;
  }

  if (mode === 'out_of_order') {
    resetEventBusForTests();
    await publish({
      type: 'PROVIDER_UPDATED',
      id: `${caseId}-late-arrival`,
      timestamp: '2026-04-22T12:00:00.000Z',
      payload: {
        providerId: `${caseId}-older`,
        npi: `${caseId}-older`,
        providerLabel: `${caseId}-older`,
        operation: 'updated',
      },
    });
    await publish({
      type: 'PROVIDER_UPDATED',
      id: `${caseId}-newest`,
      timestamp: '2026-04-22T12:10:00.000Z',
      payload: {
        providerId: `${caseId}-newer`,
        npi: `${caseId}-newer`,
        providerLabel: `${caseId}-newer`,
        operation: 'updated',
      },
    });
    const events = listRecentEvents({ limit: 2 });
    return events[0]?.id === `${caseId}-newest`
      && events[1]?.id === `${caseId}-late-arrival`;
  }

  if (mode === 'replay_cycle') {
    const first = JSON.stringify(listRecentEvents({ limit: 10 }));
    const second = JSON.stringify(listRecentEvents({ limit: 10 }));
    const third = JSON.stringify(listRecentEvents({ limit: 10 }));
    return first === second && second === third;
  }

  return getEventBusHealthSnapshot().latestEventId === primary.id;
}

function simulateOutcome(
  clinician: SyntheticClinician,
  config: ScenarioConfig,
  action: ExecutedAction,
): { timeToStartDays: number | null; finalOutcome: FinalOutcome; estimatedStartDays: number | null } {
  const applicationCreatedAt = new Date(`2026-04-${String((Number.parseInt(clinician.caseId.slice(-2), 10) % 20) + 1).padStart(2, '0')}T09:00:00.000Z`);
  const reviewOpenedAt = new Date(applicationCreatedAt.getTime() + (2 + (Number.parseInt(clinician.caseId.slice(-2), 10) % 3)) * 86_400_000);

  if (action === 'review' && config.expectedAction === 'review' && config.status === 'blocked') {
    return {
      timeToStartDays: null,
      finalOutcome: 'blocked',
      estimatedStartDays: null,
    };
  }

  if (action === 'review') {
    return {
      timeToStartDays: null,
      finalOutcome: 'manual_review',
      estimatedStartDays: null,
    };
  }

  if (action === 'refresh') {
    return {
      timeToStartDays: null,
      finalOutcome: 'refresh_pending',
      estimatedStartDays: null,
    };
  }

  const estimate = estimatePilotTimeToStart({
    readinessScore: config.readinessScore,
    missingSources: config.missingSources,
    blockedStates: config.blockedStates,
  });

  const estimatedStartDays = estimate.estimatedDays.maximumDays;
  const startAt = new Date(reviewOpenedAt.getTime() + estimatedStartDays * 86_400_000);

  return {
    estimatedStartDays,
    timeToStartDays: calculateDeterministicElapsedDays(applicationCreatedAt, startAt),
    finalOutcome: 'started',
  };
}

function evaluateOutputRisks(
  config: ScenarioConfig,
  decision: ReturnType<typeof getDecisionSummary>,
  action: ExecutedAction,
  outcome: ReturnType<typeof simulateOutcome>,
): string[] {
  const issues: string[] = [];

  if (config.expectedAction !== action) {
    issues.push(`Next action drifted: expected ${config.expectedAction}, got ${action}.`);
  }

  if (config.limitations.some((limitation) => limitation.state === 'access_required')
    && /re-run incomplete sources/i.test(decision.nextAction)) {
    issues.push('Access-required case tells the employer to re-run sources instead of explaining institutional access is missing.');
  }

  if (config.limitations.some((limitation) => limitation.state === 'review_required')
    && /re-run incomplete sources/i.test(decision.nextAction)) {
    issues.push('Manual-review case still reads like a refresh workflow instead of a credentialing-review workflow.');
  }

  if (decision.state === 'blocked' && decision.blockers.length === 0) {
    issues.push('Blocked state surfaced without any blocker explanation.');
  }

  if (decision.state === 'unknown' && outcome.estimatedStartDays !== null) {
    issues.push('Unknown state still produced a start estimate.');
  }

  if (decision.state === 'ready' && outcome.timeToStartDays !== null && outcome.timeToStartDays < 10) {
    issues.push('Ready case produced an implausibly fast time-to-start under ten days.');
  }

  return issues;
}

async function runCase(clinician: SyntheticClinician): Promise<CaseResult> {
  const config = scenarioConfig(clinician);
  const decision = getDecisionSummary({
    status: config.status,
    blockers: config.blockers ?? [],
    nextAction: null,
    standing: config.standing,
    snapshot: {
      claims: config.claims,
      limitations: config.limitations,
    },
  });

  const deterministic = summarizeDeterministicDecision({
    verifiedEvidenceCount: decision.proven.length,
    limitationLabels: decision.missing,
    explicitBlockers: config.blockers ?? [],
    nextAction: decision.nextAction,
    deaStatus: config.standing?.deaStatus,
    licenseStatus: config.standing?.licenseStatus,
    exclusionStatus: config.standing?.exclusionStatus,
  });

  const contradictions = detectContradictions(mapToTrustContractState(deterministic, config));
  const executedAction = determineAction(decision, config);
  const outcome = simulateOutcome(clinician, config, executedAction);
  const eventIntegrityPassed = await verifyEventIntegrity(clinician.caseId, clinician.eventMode);
  const confusingOutputs = evaluateOutputRisks(config, decision, executedAction, outcome);
  const failures: string[] = [];

  if (decision.state !== deterministic.state) {
    failures.push(`Decision summary drifted from shared contract: ${decision.state} vs ${deterministic.state}.`);
  }
  if (contradictions.length > 0) {
    failures.push(...contradictions);
  }
  if (!eventIntegrityPassed) {
    failures.push(`Event integrity failed under ${clinician.eventMode} delivery.`);
  }
  if (decision.state === 'blocked' && outcome.finalOutcome === 'started') {
    failures.push('Blocked clinician still reached a started outcome.');
  }
  if (decision.state !== 'ready' && executedAction === 'accept') {
    failures.push('Non-ready clinician was accepted.');
  }
  if (!deterministic.proofAllowed && decision.proven.length > 0) {
    failures.push('Proof gate disabled despite verified evidence.');
  }

  return {
    clinician,
    decisionState: decision.state,
    blockers: decision.blockers,
    nextAction: decision.nextAction,
    proofAllowed: deterministic.proofAllowed,
    executedAction,
    estimatedStartDays: outcome.estimatedStartDays,
    timeToStartDays: outcome.timeToStartDays,
    finalOutcome: outcome.finalOutcome,
    contradictions,
    eventIntegrityPassed,
    failures,
    confusingOutputs,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Number((((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2).toFixed(1))
    : Number((sorted[mid] ?? 0).toFixed(1));
}

function buildReport(results: CaseResult[]): ValidationReport {
  const startedCases = results.filter((result) => result.finalOutcome === 'started' && result.timeToStartDays !== null);
  const timeToStartValues = startedCases.flatMap((result) => result.timeToStartDays ?? []);
  const avgTts = average(timeToStartValues);
  const medianTts = median(timeToStartValues);
  const avgSaved = avgTts === null ? null : Number((90 - avgTts).toFixed(1));

  return {
    totals: {
      clinicians: results.length,
      started: results.filter((result) => result.finalOutcome === 'started').length,
      blocked: results.filter((result) => result.finalOutcome === 'blocked').length,
      manualReview: results.filter((result) => result.finalOutcome === 'manual_review').length,
      refreshPending: results.filter((result) => result.finalOutcome === 'refresh_pending').length,
      failedCases: results.filter((result) => result.failures.length > 0).length,
      confusingCases: results.filter((result) => result.confusingOutputs.length > 0).length,
    },
    summary: {
      averageTimeToStartDays: avgTts,
      medianTimeToStartDays: medianTts,
      averageDaysSavedVs90DayBaseline: avgSaved,
      realismAssessment:
        avgTts !== null && avgTts >= 20 && avgTts <= 60
          ? 'Believable wedge outcome: started cases land in a hospital-plausible 20–60 day band.'
          : 'Unclear realism: started-case time-to-start fell outside the hospital-plausible 20–60 day band.',
    },
    failures: results
      .filter((result) => result.failures.length > 0)
      .map((result) => ({
        clinician: result.clinician,
        failures: result.failures,
        decisionState: result.decisionState,
        executedAction: result.executedAction,
        finalOutcome: result.finalOutcome,
      })),
    logicBreaks: results
      .filter((result) => result.failures.length > 0)
      .map((result) => ({
        clinician: result.clinician,
        failures: result.failures,
        blockers: result.blockers,
        nextAction: result.nextAction,
      })),
    outputRisks: results
      .filter((result) => result.confusingOutputs.length > 0)
      .map((result) => ({
        clinician: result.clinician,
        confusingOutputs: result.confusingOutputs,
        decisionState: result.decisionState,
        nextAction: result.nextAction,
      })),
    uxRisks: results
      .filter((result) => result.confusingOutputs.length > 0)
      .map((result) => ({
        clinician: result.clinician,
        confusingOutputs: result.confusingOutputs,
        executedAction: result.executedAction,
        finalOutcome: result.finalOutcome,
      })),
  };
}

async function main() {
  const cohort = buildCohort();
  const results: CaseResult[] = [];

  for (const clinician of cohort) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runCase(clinician));
  }

  const report = buildReport(results);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
