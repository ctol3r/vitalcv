import { sha256ForPayload } from '../../utils/deterministic';

export type RecoveryState =
  | 'NORMAL'
  | 'DEGRADED_DETECTED'
  | 'CONTAINED'
  | 'RESTORING'
  | 'RESTORED_UNDER_OBSERVATION'
  | 'RESTORATION_BLOCKED'
  | 'FAILED_CLOSED';

export type RecoveryEventType =
  | 'replay_degradation_detected'
  | 'governance_corruption_detected'
  | 'trust_fragmentation_detected'
  | 'continuity_collapse_detected'
  | 'containment_started'
  | 'continuity_rebuilt'
  | 'restoration_requested'
  | 'restoration_verified'
  | 'observation_completed';

export type ReplayContinuityStatus = 'RESTORED' | 'DEGRADED' | 'BROKEN' | 'UNKNOWN';

export interface RecoveryEvent {
  id: string;
  type: RecoveryEventType;
  actor: string;
  recordedAt: string;
  evidenceRefs: string[];
  ambiguity: string | null;
}

export interface RecoveryConfidence {
  score: number;
  label: 'HIGH_EVIDENCE' | 'PARTIAL_EVIDENCE' | 'LOW_EVIDENCE' | 'BLOCKED';
  basis: string[];
}

export interface RecoveryReplayRestoration {
  status: ReplayContinuityStatus;
  replaySafe: boolean;
  continuityEvidenceRefs: string[];
}

export interface RecoveryStepResult {
  schema: 'vitalcv.constitutional-recovery-step.v1';
  previousState: RecoveryState;
  nextState: RecoveryState;
  event: RecoveryEvent;
  restorationAllowed: boolean;
  failClosed: boolean;
  blockers: string[];
  ambiguities: string[];
  replayRestoration: RecoveryReplayRestoration;
  confidence: RecoveryConfidence;
  stepHash: string;
}

export interface EvaluateRecoveryStepInput {
  currentState: RecoveryState;
  event: RecoveryEvent;
  replayContinuity: ReplayContinuityStatus;
  continuityEvidenceRefs: string[];
}

export interface RecoveryLineageEntry {
  position: number;
  eventId: string;
  type: RecoveryEventType;
  recordedAt: string;
  actor: string;
  evidenceRefs: string[];
  ambiguity: string | null;
  eventHash: string;
}

export interface RecoveryLineage {
  schema: 'vitalcv.constitutional-recovery-lineage.v1';
  incidentId: string;
  timeline: RecoveryLineageEntry[];
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  lineageHash: string;
}

export type RecoveryGateId =
  | 'state_machine_integrity'
  | 'replay_restoration_fidelity'
  | 'ambiguity_visible'
  | 'continuity_reconstructable'
  | 'fail_closed_restoration'
  | 'confidence_evidence_derived'
  | 'longitudinal_timeline_visible';

export interface RecoveryGate {
  id: RecoveryGateId;
  pass: boolean;
  reason: string;
}

export interface RecoveryGateVerdict {
  pass: boolean;
  gates: RecoveryGate[];
  failedGateIds: RecoveryGateId[];
}

export type RecoveryChaosScenario =
  | 'BASELINE'
  | 'REPLAY_DEGRADATION'
  | 'GOVERNANCE_CORRUPTION'
  | 'TRUST_FRAGMENTATION'
  | 'CONTINUITY_COLLAPSE';

export interface RecoveryChaosVerdict {
  scenario: RecoveryChaosScenario;
  signalSurfaced: boolean;
  signal: string;
  state: RecoveryState;
  failedGateIds: RecoveryGateId[];
}

export interface RecoveryChaosResult {
  verdicts: RecoveryChaosVerdict[];
  summary: {
    totalScenarios: number;
    surfacedCount: number;
    silentCount: number;
  };
}

const VALID_STATES: ReadonlySet<RecoveryState> = new Set([
  'NORMAL',
  'DEGRADED_DETECTED',
  'CONTAINED',
  'RESTORING',
  'RESTORED_UNDER_OBSERVATION',
  'RESTORATION_BLOCKED',
  'FAILED_CLOSED',
]);

function cleanRefs(refs: readonly string[]): string[] {
  return Array.from(
    new Set(
      refs
        .map((ref) => ref.trim())
        .filter((ref) => ref.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function hasEvidence(event: RecoveryEvent): boolean {
  return cleanRefs(event.evidenceRefs).length > 0;
}

function evidenceCountScore(count: number): number {
  if (count >= 3) return 25;
  if (count === 2) return 20;
  if (count === 1) return 8;
  return 0;
}

function continuityScore(count: number): number {
  if (count >= 3) return 25;
  if (count === 2) return 16;
  if (count === 1) return 7;
  return 0;
}

export function computeRecoveryConfidence(input: {
  state: RecoveryState;
  replayContinuity: ReplayContinuityStatus;
  evidenceRefs: string[];
  continuityEvidenceRefs: string[];
  ambiguityCount: number;
}): RecoveryConfidence {
  const evidenceRefs = cleanRefs(input.evidenceRefs);
  const continuityEvidenceRefs = cleanRefs(input.continuityEvidenceRefs);
  const basis: string[] = [];
  let score = 11;

  if (input.replayContinuity === 'RESTORED') {
    score += 30;
    basis.push('replay_continuity_restored');
  } else if (input.replayContinuity === 'DEGRADED') {
    score += 10;
    basis.push('replay_continuity_degraded');
  } else {
    basis.push('replay_continuity_not_restored');
  }

  const continuityPoints = continuityScore(continuityEvidenceRefs.length);
  score += continuityPoints;
  if (continuityEvidenceRefs.length >= 2) {
    basis.push('continuity_lineage_reconstructable');
  } else if (continuityEvidenceRefs.length === 1) {
    basis.push('continuity_lineage_partial');
  } else {
    basis.push('continuity_lineage_missing');
  }

  const evidencePoints = evidenceCountScore(evidenceRefs.length);
  score += evidencePoints;
  if (evidenceRefs.length >= 2) {
    basis.push('restoration_evidence_present');
  } else if (evidenceRefs.length === 1) {
    basis.push('restoration_evidence_partial');
  } else {
    basis.push('restoration_evidence_missing');
  }

  if (input.state === 'RESTORED_UNDER_OBSERVATION') {
    basis.push('restored_under_observation');
  }

  if (input.ambiguityCount > 0) {
    score -= Math.min(24, input.ambiguityCount * 6);
    basis.push('ambiguity_preserved_with_penalty');
  }

  const finalScore = Math.max(0, Math.min(100, score));
  const label: RecoveryConfidence['label'] =
    input.replayContinuity === 'BROKEN' || input.state === 'RESTORATION_BLOCKED'
      ? 'BLOCKED'
      : finalScore >= 80
        ? 'HIGH_EVIDENCE'
        : finalScore >= 50
          ? 'PARTIAL_EVIDENCE'
          : 'LOW_EVIDENCE';

  return {
    score: finalScore,
    label,
    basis,
  };
}

function restorationBlockers(input: EvaluateRecoveryStepInput): string[] {
  const blockers: string[] = [];
  if (input.replayContinuity !== 'RESTORED') {
    blockers.push(`Replay continuity is ${input.replayContinuity}; restoration cannot be declared.`);
  }
  if (cleanRefs(input.continuityEvidenceRefs).length < 2) {
    blockers.push('Institutional continuity lineage is not reconstructable across before/during/after recovery.');
  }
  if (cleanRefs(input.event.evidenceRefs).length < 2) {
    blockers.push('Restoration requires at least two independent evidence references.');
  }
  return blockers;
}

function recoveryAmbiguities(input: EvaluateRecoveryStepInput, blockers: readonly string[]): string[] {
  const ambiguities = [
    input.event.ambiguity?.trim() || null,
    input.replayContinuity === 'DEGRADED'
      ? 'Replay continuity is degraded; recovered state must remain under observation.'
      : null,
    input.replayContinuity === 'BROKEN'
      ? 'Replay continuity is broken; restored state is not claimable.'
      : null,
    ...blockers.map((blocker) => `Recovery blocker: ${blocker}`),
  ].filter((item): item is string => Boolean(item));

  return Array.from(new Set(ambiguities));
}

function nextStateFor(input: EvaluateRecoveryStepInput, blockers: readonly string[]): RecoveryState {
  if (input.event.type === 'containment_started') {
    return hasEvidence(input.event) ? 'CONTAINED' : 'FAILED_CLOSED';
  }

  if (input.event.type === 'continuity_rebuilt') {
    return cleanRefs(input.continuityEvidenceRefs).length >= 2 ? 'RESTORING' : 'RESTORATION_BLOCKED';
  }

  if (input.event.type === 'restoration_requested' || input.event.type === 'restoration_verified') {
    return blockers.length === 0 ? 'RESTORED_UNDER_OBSERVATION' : 'RESTORATION_BLOCKED';
  }

  if (
    input.event.type === 'replay_degradation_detected'
    || input.event.type === 'governance_corruption_detected'
    || input.event.type === 'trust_fragmentation_detected'
    || input.event.type === 'continuity_collapse_detected'
  ) {
    return 'DEGRADED_DETECTED';
  }

  if (input.event.type === 'observation_completed') {
    return input.currentState === 'RESTORED_UNDER_OBSERVATION' ? 'NORMAL' : 'FAILED_CLOSED';
  }

  return 'FAILED_CLOSED';
}

export function evaluateRecoveryStep(input: EvaluateRecoveryStepInput): RecoveryStepResult {
  const blockers = restorationBlockers(input);
  const nextState = nextStateFor(input, blockers);
  const restorationAllowed =
    nextState === 'RESTORED_UNDER_OBSERVATION'
    && input.replayContinuity === 'RESTORED'
    && blockers.length === 0;
  const failClosed = !restorationAllowed;
  const ambiguities = recoveryAmbiguities(input, blockers);
  const replayRestoration: RecoveryReplayRestoration = {
    status: input.replayContinuity,
    replaySafe: input.replayContinuity === 'RESTORED' && cleanRefs(input.event.evidenceRefs).length > 0,
    continuityEvidenceRefs: cleanRefs(input.continuityEvidenceRefs),
  };
  const confidence = computeRecoveryConfidence({
    state: nextState,
    replayContinuity: input.replayContinuity,
    evidenceRefs: input.event.evidenceRefs,
    continuityEvidenceRefs: input.continuityEvidenceRefs,
    ambiguityCount: ambiguities.length,
  });

  const body = {
    schema: 'vitalcv.constitutional-recovery-step.v1' as const,
    previousState: input.currentState,
    nextState,
    event: {
      ...input.event,
      evidenceRefs: cleanRefs(input.event.evidenceRefs),
    },
    restorationAllowed,
    failClosed,
    blockers,
    ambiguities,
    replayRestoration,
    confidence,
  };

  return {
    ...body,
    stepHash: sha256ForPayload(body),
  };
}

export function buildConstitutionalRecoveryLineage(input: {
  incidentId: string;
  events: RecoveryEvent[];
}): RecoveryLineage {
  const timeline = [...input.events]
    .sort((left, right) => (
      Date.parse(left.recordedAt) - Date.parse(right.recordedAt)
      || left.id.localeCompare(right.id)
    ))
    .map((entry, position): RecoveryLineageEntry => {
      const body = {
        eventId: entry.id,
        type: entry.type,
        recordedAt: entry.recordedAt,
        actor: entry.actor,
        evidenceRefs: cleanRefs(entry.evidenceRefs),
        ambiguity: entry.ambiguity,
      };
      return {
        position,
        ...body,
        eventHash: sha256ForPayload(body),
      };
    });

  const body = {
    schema: 'vitalcv.constitutional-recovery-lineage.v1' as const,
    incidentId: input.incidentId,
    timeline,
    firstRecordedAt: timeline[0]?.recordedAt ?? null,
    lastRecordedAt: timeline[timeline.length - 1]?.recordedAt ?? null,
  };

  return {
    ...body,
    lineageHash: sha256ForPayload(body),
  };
}

export function evaluateRecoveryGate(input: { result: RecoveryStepResult }): RecoveryGateVerdict {
  const { result } = input;
  const gates: RecoveryGate[] = [
    {
      id: 'state_machine_integrity',
      pass: VALID_STATES.has(result.previousState) && VALID_STATES.has(result.nextState),
      reason: 'Recovery state transitions must remain within the canonical state machine.',
    },
    {
      id: 'replay_restoration_fidelity',
      pass: result.restorationAllowed && result.replayRestoration.status === 'RESTORED' && result.replayRestoration.replaySafe,
      reason: 'Restoration must be replay-safe and backed by restored replay continuity.',
    },
    {
      id: 'ambiguity_visible',
      pass: result.ambiguities.length > 0 || result.restorationAllowed,
      reason: 'Degraded recovery ambiguity must remain visible unless restoration is cleanly evidenced.',
    },
    {
      id: 'continuity_reconstructable',
      pass: result.replayRestoration.continuityEvidenceRefs.length >= 2,
      reason: 'Institutional continuity must be reconstructable from recovery lineage.',
    },
    {
      id: 'fail_closed_restoration',
      pass: result.restorationAllowed && !result.failClosed && result.nextState === 'RESTORED_UNDER_OBSERVATION',
      reason: 'CI only passes when restoration is allowed by evidence; unsafe attempts must block release.',
    },
    {
      id: 'confidence_evidence_derived',
      pass:
        result.confidence.score >= 80
        && result.confidence.basis.includes('restoration_evidence_present')
        && !result.confidence.basis.includes('operator_asserted'),
      reason: 'Recovery confidence must be derived from replay, continuity, and restoration evidence.',
    },
    {
      id: 'longitudinal_timeline_visible',
      pass: Boolean(result.event.recordedAt) && result.replayRestoration.continuityEvidenceRefs.length >= 2,
      reason: 'Recovery timeline must preserve longitudinal before/during/after visibility.',
    },
  ];
  const failedGateIds = gates.filter((gate) => !gate.pass).map((gate) => gate.id);

  return {
    pass: failedGateIds.length === 0,
    gates,
    failedGateIds,
  };
}

function chaosEvent(type: RecoveryEventType, evidenceRefs: string[], ambiguity: string | null): RecoveryEvent {
  return {
    id: `chaos-${type}`,
    type,
    actor: 'constitutional-recovery-simulation',
    recordedAt: '2026-05-09T20:00:00.000Z',
    evidenceRefs,
    ambiguity,
  };
}

export function runRecoveryChaosSimulations(input: {
  incidentId: string;
  baselineEvidenceRefs: string[];
  baselineContinuityEvidenceRefs: string[];
}): RecoveryChaosResult {
  const scenarios: RecoveryChaosScenario[] = [
    'BASELINE',
    'REPLAY_DEGRADATION',
    'GOVERNANCE_CORRUPTION',
    'TRUST_FRAGMENTATION',
    'CONTINUITY_COLLAPSE',
  ];

  const verdicts = scenarios.map((scenario): RecoveryChaosVerdict => {
    const stepInput: EvaluateRecoveryStepInput = (() => {
      if (scenario === 'BASELINE') {
        return {
          currentState: 'RESTORING',
          event: chaosEvent('restoration_verified', input.baselineEvidenceRefs, null),
          replayContinuity: 'RESTORED',
          continuityEvidenceRefs: input.baselineContinuityEvidenceRefs,
        };
      }
      if (scenario === 'REPLAY_DEGRADATION') {
        return {
          currentState: 'RESTORING',
          event: chaosEvent('restoration_verified', input.baselineEvidenceRefs, 'Replay degradation during restoration.'),
          replayContinuity: 'BROKEN',
          continuityEvidenceRefs: input.baselineContinuityEvidenceRefs,
        };
      }
      if (scenario === 'GOVERNANCE_CORRUPTION') {
        return {
          currentState: 'RESTORING',
          event: chaosEvent('governance_corruption_detected', [], 'Governance attestation missing or corrupted.'),
          replayContinuity: 'RESTORED',
          continuityEvidenceRefs: input.baselineContinuityEvidenceRefs,
        };
      }
      if (scenario === 'TRUST_FRAGMENTATION') {
        return {
          currentState: 'RESTORING',
          event: chaosEvent('trust_fragmentation_detected', ['fragmented-authority-chain'], 'Trust lineage has conflicting chain fragments.'),
          replayContinuity: 'DEGRADED',
          continuityEvidenceRefs: ['timeline-before'],
        };
      }
      return {
        currentState: 'RESTORING',
        event: chaosEvent('continuity_collapse_detected', ['collapsed-runtime-window'], 'Continuity collapsed across recovery window.'),
        replayContinuity: 'BROKEN',
        continuityEvidenceRefs: [],
      };
    })();

    const result = evaluateRecoveryStep(stepInput);
    const gate = evaluateRecoveryGate({ result });
    const signalSurfaced = scenario === 'BASELINE' ? gate.pass : !gate.pass && result.failClosed;

    return {
      scenario,
      signalSurfaced,
      signal: signalSurfaced
        ? `${scenario} produced an operator-visible recovery signal.`
        : `${scenario} did not surface a recovery signal.`,
      state: result.nextState,
      failedGateIds: gate.failedGateIds,
    };
  });

  const surfacedCount = verdicts.filter((verdict) => verdict.signalSurfaced).length;

  return {
    verdicts,
    summary: {
      totalScenarios: verdicts.length,
      surfacedCount,
      silentCount: verdicts.length - surfacedCount,
    },
  };
}
