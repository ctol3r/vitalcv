import {
  LAUNCH_SPINE_SOURCE_IDS,
  deriveReadinessState,
  type CanonicalSourceCoverage,
  type CanonicalSourceCoverageState,
  type LaunchSpineSourceId,
  type ReadinessState,
} from '@vitalcv/trust-state';
import type { PassportData } from '@/lib/trust/passport-contract';

export type ExportGateStatus = 'allowed' | 'blocked';
export type ExportGateAmbiguityLevel = 'none' | 'partial' | 'blocked';

export type ExportGateBlockerCode =
  | 'INVALID_NPI'
  | 'READINESS_NOT_DECISION_GRADE'
  | 'READINESS_COVERAGE_MISMATCH'
  | 'READINESS_BLOCKERS_PRESENT'
  | 'TRUST_BLOCKERS_PRESENT'
  | 'SOURCE_MISSING'
  | 'SOURCE_NOT_DECISION_GRADE'
  | 'SOURCE_STALE'
  | 'SOURCE_GATED'
  | 'SOURCE_REVIEW_REQUIRED'
  | 'SOURCE_PREVIEW_ONLY'
  | 'SOURCE_UNAVAILABLE';

export interface ExportGateBlocker {
  code: ExportGateBlockerCode;
  sourceId?: LaunchSpineSourceId;
  state?: CanonicalSourceCoverageState | 'missing';
  message: string;
}

export interface ExportGateReplayAttribution {
  entityId: string;
  clinicianNpi: string;
  readinessStatus: ReadinessState;
  derivedReadinessStatus: ReadinessState;
  lastCheckedAt: string;
  sourceStates: Array<{
    sourceId: LaunchSpineSourceId;
    state: CanonicalSourceCoverageState | 'missing';
    checkedAt: string | null;
  }>;
  lineageKey: string;
}

export interface ExportGateEvaluation {
  schema: 'vitalcv.export-gating.v1';
  status: ExportGateStatus;
  allowed: boolean;
  readinessStatus: ReadinessState;
  derivedReadinessStatus: ReadinessState;
  ambiguityLevel: ExportGateAmbiguityLevel;
  survivabilityScore: number;
  blockers: ExportGateBlocker[];
  warnings: string[];
  replayAttribution: ExportGateReplayAttribution;
  summary: string;
}

const NON_EXPORTABLE_SOURCE_BLOCKERS: Record<
  Exclude<CanonicalSourceCoverageState, 'checked'>,
  ExportGateBlockerCode
> = {
  pending: 'SOURCE_NOT_DECISION_GRADE',
  stale: 'SOURCE_STALE',
  gated: 'SOURCE_GATED',
  unavailable: 'SOURCE_UNAVAILABLE',
  accessRequired: 'SOURCE_GATED',
  reviewRequired: 'SOURCE_REVIEW_REQUIRED',
  notDecisionGrade: 'SOURCE_NOT_DECISION_GRADE',
  previewOnly: 'SOURCE_PREVIEW_ONLY',
};

function nonExportableSourceBlocker(
  state: Exclude<CanonicalSourceCoverageState, 'checked'>,
): ExportGateBlockerCode {
  return NON_EXPORTABLE_SOURCE_BLOCKERS[state];
}

function normalizeSourceId(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function findLaunchSpineCheck(
  checks: readonly CanonicalSourceCoverage[],
  sourceId: LaunchSpineSourceId,
): CanonicalSourceCoverage | null {
  const normalizedTarget = normalizeSourceId(sourceId);
  return checks.find((check) => normalizeSourceId(check.sourceId) === normalizedTarget) ?? null;
}

function stableReplayLineageKey(parts: readonly string[]): string {
  return parts.join('|');
}

function sourceBlockerMessage(
  sourceId: LaunchSpineSourceId,
  state: CanonicalSourceCoverageState | 'missing',
): string {
  if (state === 'missing') {
    return `${sourceId} coverage is missing from the export payload.`;
  }

  switch (state) {
    case 'stale':
      return `${sourceId} evidence is stale and cannot support an export.`;
    case 'gated':
    case 'accessRequired':
      return `${sourceId} evidence requires institutional access before export.`;
    case 'reviewRequired':
      return `${sourceId} evidence requires review before export.`;
    case 'previewOnly':
      return `${sourceId} is preview-only; export would imply fake readiness.`;
    case 'unavailable':
      return `${sourceId} is unavailable, so export fails closed.`;
    case 'pending':
    case 'notDecisionGrade':
      return `${sourceId} is not decision-grade for export.`;
    case 'checked':
      return `${sourceId} is export-ready.`;
  }
}

export function resolveEmployerPacketExportGate(passport: PassportData): ExportGateEvaluation {
  const npi = passport.identity.npi ?? passport.npi ?? '';
  const checks = passport.sourceCoverage.checks;
  const readinessStatus = passport.readiness.status;
  const derivedReadinessStatus = deriveReadinessState(checks);
  const blockers: ExportGateBlocker[] = [];

  if (!/^\d{10}$/.test(npi)) {
    blockers.push({
      code: 'INVALID_NPI',
      message: 'A valid 10-digit clinician NPI is required before export.',
    });
  }

  const sourceStates: ExportGateReplayAttribution['sourceStates'] = LAUNCH_SPINE_SOURCE_IDS.map((sourceId) => {
    const check = findLaunchSpineCheck(checks, sourceId);
    const state = check?.state ?? 'missing';
    return {
      sourceId,
      state,
      checkedAt: check?.checkedAt ?? null,
    };
  });

  for (const source of sourceStates) {
    if (source.state === 'missing') {
      blockers.push({
        code: 'SOURCE_MISSING',
        sourceId: source.sourceId,
        state: 'missing',
        message: sourceBlockerMessage(source.sourceId, 'missing'),
      });
      continue;
    }

    if (source.state !== 'checked') {
      const blockedState = source.state as Exclude<CanonicalSourceCoverageState, 'checked'>;
      blockers.push({
        code: nonExportableSourceBlocker(blockedState),
        sourceId: source.sourceId,
        state: blockedState,
        message: sourceBlockerMessage(source.sourceId, blockedState),
      });
    }
  }

  if (readinessStatus !== 'DECISION_GRADE') {
    blockers.push({
      code: 'READINESS_NOT_DECISION_GRADE',
      message: `Passport readiness is ${readinessStatus}; export requires DECISION_GRADE.`,
    });
  }

  if (derivedReadinessStatus !== readinessStatus) {
    blockers.push({
      code: 'READINESS_COVERAGE_MISMATCH',
      message: `Declared readiness ${readinessStatus} does not match source-derived readiness ${derivedReadinessStatus}.`,
    });
  }

  if (passport.readiness.blockers.length > 0) {
    blockers.push({
      code: 'READINESS_BLOCKERS_PRESENT',
      message: `Readiness has ${passport.readiness.blockers.length} unresolved blocker${passport.readiness.blockers.length === 1 ? '' : 's'}.`,
    });
  }

  if (passport.trustPosture.blockers.length > 0) {
    blockers.push({
      code: 'TRUST_BLOCKERS_PRESENT',
      message: `Trust posture has ${passport.trustPosture.blockers.length} unresolved blocker${passport.trustPosture.blockers.length === 1 ? '' : 's'}.`,
    });
  }

  const status: ExportGateStatus = blockers.length === 0 ? 'allowed' : 'blocked';
  const warnings = sourceStates
    .filter((source) => source.state !== 'checked')
    .map((source) => sourceBlockerMessage(source.sourceId, source.state));
  const checkedSources = sourceStates.filter((source) => source.state === 'checked').length;
  const survivabilityScore = Math.round((checkedSources / LAUNCH_SPINE_SOURCE_IDS.length) * 100);
  const ambiguityLevel: ExportGateAmbiguityLevel =
    blockers.length === 0 ? 'none' : checkedSources > 0 ? 'partial' : 'blocked';
  const replayAttribution: ExportGateReplayAttribution = {
    entityId: passport.entityId,
    clinicianNpi: npi || 'unknown',
    readinessStatus,
    derivedReadinessStatus,
    lastCheckedAt: passport.lastCheckedAt,
    sourceStates,
    lineageKey: stableReplayLineageKey([
      'vitalcv.export-gating.v1',
      passport.entityId,
      npi || 'unknown',
      readinessStatus,
      derivedReadinessStatus,
      passport.lastCheckedAt,
      ...sourceStates.map((source) => `${source.sourceId}:${source.state}:${source.checkedAt ?? 'unchecked'}`),
    ]),
  };

  return {
    schema: 'vitalcv.export-gating.v1',
    status,
    allowed: status === 'allowed',
    readinessStatus,
    derivedReadinessStatus,
    ambiguityLevel,
    survivabilityScore,
    blockers,
    warnings,
    replayAttribution,
    summary: status === 'allowed'
      ? 'Export gate passed with decision-grade launch-spine evidence.'
      : blockers[0]?.message ?? 'Export gate failed closed.',
  };
}
