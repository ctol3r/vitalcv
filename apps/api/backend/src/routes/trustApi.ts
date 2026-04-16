import type { Express, NextFunction, Request, Response } from 'express';
import {
  matchActivationRequirements,
  matchRecognitionRequirements,
  scoreDeterministicBestAction,
  type ActionScoringBlockerInput,
  type ActivationAcceptanceOutputInput,
  type ActivationMatchingOutput,
  type ActivationRequirement,
  type DeterministicBestAction,
  type RecognitionResolvedFactInput,
  type RecognitionResolvedInput,
  type RequirementMatchingOutput,
} from '../services/trust-state';
import {
  evaluatePilotReadiness,
  parseOrganizationRequirementsEnvelope,
  type PilotReadinessEvaluation,
} from '../services/employers/pilotPolicy';
import type { EmployerRequirementSpec } from '../services/employers/employerCatalog';
import type { ClinicianTrustState } from '../services/trust/trustStateEngine';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';

type MinimalClinicianTrustState = Pick<
  ClinicianTrustState,
  'readiness_level' | 'readiness_score' | 'gap_summary'
>;

type AcceptanceResult = {
  evaluation: PilotReadinessEvaluation;
  blockers: Array<{
    blockerId: string;
    label: string;
    detail: string;
  }>;
};

type FullTrustResult = {
  recognition: RequirementMatchingOutput;
  acceptance: AcceptanceResult;
  startability: ActivationMatchingOutput;
  best_action_status: 'action_required' | 'all_clear';
  best_action: DeterministicBestAction | null;
};

type TrustEnvelope<T> = {
  ok: true;
  schema: string;
  result: T;
};

const READINESS_LEVELS = new Set(['L0', 'L1', 'L2', 'L3']);
const VALID_FRESHNESS = new Set(['current', 'stale', 'expired', 'not_applicable']);
const VALID_PRIORITY = new Set(['required', 'preferred']);
const VALID_SCOPES = new Set(['pilot', 'full', 'partial']);
const VALID_ACTIVATION_UNITS = new Set([
  'acceptance_recorded',
  'audit_logged',
  'organization_bound',
  'accepted_timestamped',
  'trust_snapshot_captured',
  'start_ready',
  'readiness_score_at_least',
  'acceptance_scope_is',
]);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function sanitizeRecognitionResolved(body: Record<string, unknown>): RecognitionResolvedInput {
  if (!isRecord(body.recognition)) {
    throw new HttpError(400, 'recognition is required.');
  }

  const resolved = Array.isArray(body.recognition.resolved) ? body.recognition.resolved : [];
  const normalized = resolved.flatMap<RecognitionResolvedFactInput>((fact) => {
    if (!isRecord(fact)) {
      return [];
    }

    const resolvedLevel = asTrimmedString(fact.resolvedLevel);
    const freshness = asTrimmedString(fact.freshness);

    return [{
      canonicalArtifactKey: asTrimmedString(fact.canonicalArtifactKey),
      key: asTrimmedString(fact.key),
      requirementLabel: asTrimmedString(fact.requirementLabel),
      label: asTrimmedString(fact.label),
      status: asTrimmedString(fact.status),
      resolvedLevel: resolvedLevel && READINESS_LEVELS.has(resolvedLevel) ? resolvedLevel as RecognitionResolvedFactInput['resolvedLevel'] : null,
      freshness: freshness && VALID_FRESHNESS.has(freshness) ? freshness as RecognitionResolvedFactInput['freshness'] : null,
      revoked: fact.revoked === true,
      evidenceId: asTrimmedString(fact.evidenceId),
      source: asTrimmedString(fact.source),
      reason: asTrimmedString(fact.reason),
      state: asTrimmedString(fact.state),
      specialty: asTrimmedString(fact.specialty),
    }];
  });

  return { resolved: normalized };
}

function readEnvelopeSource(body: Record<string, unknown>): unknown {
  if ('org' in body) {
    return body.org;
  }
  if ('policy' in body) {
    return body.policy;
  }
  if ('organization' in body) {
    return body.organization;
  }
  if ('orgRequirements' in body) {
    return body.orgRequirements;
  }
  return undefined;
}

function sanitizeOrgRequirements(body: Record<string, unknown>): readonly EmployerRequirementSpec[] {
  const envelope = parseOrganizationRequirementsEnvelope(readEnvelopeSource(body));
  return envelope.requirements;
}

function sanitizeTrustState(body: Record<string, unknown>): MinimalClinicianTrustState {
  if (!isRecord(body.trustState)) {
    throw new HttpError(400, 'trustState is required.');
  }

  const readinessLevel = asTrimmedString(body.trustState.readiness_level);
  const readinessScore = asFiniteNumber(body.trustState.readiness_score);

  return {
    readiness_level: readinessLevel && READINESS_LEVELS.has(readinessLevel)
      ? readinessLevel as ClinicianTrustState['readiness_level']
      : 'L0',
    readiness_score: readinessScore === null ? 0 : readinessScore,
    gap_summary: asStringArray(body.trustState.gap_summary),
  };
}

function sanitizeAcceptanceOutput(body: Record<string, unknown>): ActivationAcceptanceOutputInput {
  if (!isRecord(body.acceptanceOutput)) {
    throw new HttpError(400, 'acceptanceOutput is required.');
  }

  const attribution = isRecord(body.acceptanceOutput.attribution)
    ? { organizationId: asTrimmedString(body.acceptanceOutput.attribution.organizationId) }
    : null;
  const persistence = isRecord(body.acceptanceOutput.persistence)
    ? { acceptanceId: asTrimmedString(body.acceptanceOutput.persistence.acceptanceId) }
    : null;
  const acceptance = isRecord(body.acceptanceOutput.acceptance)
    ? {
        acceptedByOrgId: asTrimmedString(body.acceptanceOutput.acceptance.acceptedByOrgId),
        acceptedAt: asTrimmedString(body.acceptanceOutput.acceptance.acceptedAt),
        acceptanceScope: asTrimmedString(body.acceptanceOutput.acceptance.acceptanceScope),
      }
    : null;
  const trustSnapshot = isRecord(body.acceptanceOutput.trustSnapshot)
    ? {
        readinessScore: asFiniteNumber(body.acceptanceOutput.trustSnapshot.readinessScore),
        blockerCount: asFiniteNumber(body.acceptanceOutput.trustSnapshot.blockerCount),
        topBlockers: asStringArray(body.acceptanceOutput.trustSnapshot.topBlockers),
      }
    : null;

  return {
    timestamp: asTrimmedString(body.acceptanceOutput.timestamp),
    auditEventId: asTrimmedString(body.acceptanceOutput.auditEventId),
    attribution,
    persistence,
    acceptance,
    trustSnapshot,
  };
}

function sanitizeActivationRequirements(body: Record<string, unknown>): readonly ActivationRequirement[] {
  const raw = Array.isArray(body.activationRequirements) ? body.activationRequirements : [];

  return raw.flatMap<ActivationRequirement>((requirement) => {
    if (!isRecord(requirement)) {
      return [];
    }

    const unit = asTrimmedString(requirement.unit);
    if (!unit || !VALID_ACTIVATION_UNITS.has(unit)) {
      return [];
    }

    const priority = asTrimmedString(requirement.priority);
    const expectedScope = asTrimmedString(requirement.expectedScope);

    return [{
      unit: unit as ActivationRequirement['unit'],
      label: asTrimmedString(requirement.label) ?? undefined,
      priority: priority && VALID_PRIORITY.has(priority)
        ? priority as ActivationRequirement['priority']
        : undefined,
      estimatedDays: asFiniteNumber(requirement.estimatedDays),
      minimumScore: asFiniteNumber(requirement.minimumScore),
      expectedScope: expectedScope && VALID_SCOPES.has(expectedScope)
        ? expectedScope as ActivationRequirement['expectedScope']
        : null,
    }];
  });
}

function evaluateAcceptance(body: Record<string, unknown>): AcceptanceResult {
  const trustState = sanitizeTrustState(body);
  const policy = parseOrganizationRequirementsEnvelope(readEnvelopeSource(body));
  const evaluation = evaluatePilotReadiness(trustState, policy);

  return {
    evaluation,
    blockers: evaluation.ready
      ? []
      : [{
          blockerId: 'acceptance_not_ready',
          label: 'Acceptance not ready',
          detail: evaluation.reason,
        }],
  };
}

function buildRecognitionScoringInputs(result: RequirementMatchingOutput): ActionScoringBlockerInput[] {
  return result.missingActions
    .filter((action) => action.blocking)
    .map((action) => ({
      domain: 'recognition',
      blockerId: action.id,
      label: action.requirementLabel,
      detail: action.detail,
      actionTitle: action.title,
      actionDetail: action.detail,
      effort_estimate: null,
    }));
}

function buildAcceptanceScoringInputs(result: AcceptanceResult): ActionScoringBlockerInput[] {
  if (result.evaluation.ready) {
    return [];
  }

  return result.blockers.map((blocker) => ({
    domain: 'acceptance',
    blockerId: blocker.blockerId,
    label: blocker.label,
    detail: blocker.detail,
    actionTitle: result.evaluation.psvRequired ? 'Resolve PSV gaps' : 'Complete acceptance review',
    actionDetail: blocker.detail,
    effort_estimate: null,
  }));
}

function buildStartabilityScoringInputs(result: ActivationMatchingOutput): ActionScoringBlockerInput[] {
  return result.blockers.map((blocker) => ({
    domain: 'activation',
    blockerId: blocker.unit,
    label: blocker.label,
    detail: blocker.detail,
    actionTitle: `Resolve ${blocker.label}`,
    actionDetail: blocker.detail,
    effort_estimate: blocker.estimatedDays,
  }));
}

function buildRecognitionResult(body: Record<string, unknown>): RequirementMatchingOutput {
  return matchRecognitionRequirements({
    recognition: sanitizeRecognitionResolved(body),
    orgRequirements: sanitizeOrgRequirements(body),
  });
}

function buildStartabilityResult(body: Record<string, unknown>): ActivationMatchingOutput {
  return matchActivationRequirements({
    acceptanceOutput: sanitizeAcceptanceOutput(body),
    activationRequirements: sanitizeActivationRequirements(body),
  });
}

function sendEnvelope<T>(res: Response, schema: string, result: T): void {
  const payload: TrustEnvelope<T> = {
    ok: true,
    schema,
    result,
  };

  res.status(200).json(payload);
}

export function registerTrustApiRoutes(app: Express): void {
  app.post(
    '/api/trust/recognition',
    asyncHandler(async (req, res) => {
      const result = buildRecognitionResult((req.body ?? {}) as Record<string, unknown>);
      sendEnvelope(res, 'vitalcv.trust.recognition.v1', result);
    }),
  );

  app.post(
    '/api/trust/acceptance',
    asyncHandler(async (req, res) => {
      const result = evaluateAcceptance((req.body ?? {}) as Record<string, unknown>);
      sendEnvelope(res, 'vitalcv.trust.acceptance.v1', result);
    }),
  );

  app.post(
    '/api/trust/startability',
    asyncHandler(async (req, res) => {
      const result = buildStartabilityResult((req.body ?? {}) as Record<string, unknown>);
      sendEnvelope(res, 'vitalcv.trust.startability.v1', result);
    }),
  );

  app.post(
    '/api/trust/full',
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const recognition = buildRecognitionResult(body);
      const acceptance = evaluateAcceptance(body);
      const startability = buildStartabilityResult(body);
      const bestAction = scoreDeterministicBestAction({
        blockers: [
          ...buildRecognitionScoringInputs(recognition),
          ...buildAcceptanceScoringInputs(acceptance),
          ...buildStartabilityScoringInputs(startability),
        ],
      });

      const result: FullTrustResult = {
        recognition,
        acceptance,
        startability,
        best_action_status: bestAction ? 'action_required' : 'all_clear',
        best_action: bestAction,
      };

      sendEnvelope(res, 'vitalcv.trust.full.v1', result);
    }),
  );

  log('info', 'trust_api_routes_registered', {
    routes: [
      'POST /api/trust/recognition',
      'POST /api/trust/acceptance',
      'POST /api/trust/startability',
      'POST /api/trust/full',
    ],
  });
}
