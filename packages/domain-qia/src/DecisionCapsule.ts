/**
 * Decision capsule: replayable decision state with hash references.
 */

import type {
  CredentialRef,
  DecisionEvent,
  EvidenceRef,
  SignatureEnvelope,
} from './types';
import { DecisionEventType, QiaInvariantError } from './types';
import type { IntentBinding } from './IntentBinding';
import {
  assertNonEmptyString,
  assertValidDate,
  assertValidDecisionEvent,
  assertValidIntentBinding,
  assertValidSignatureEnvelope,
  assertValidStringArray,
} from './invariants';

export interface DecisionModelRef {
  readonly name: string;
  readonly version: string;
}

export interface DecisionCapsule {
  readonly capsule_id: string;
  readonly decision_at: Date;
  readonly intent: IntentBinding;
  readonly input_hash_refs: readonly string[];
  readonly model: DecisionModelRef;
  readonly rules_version: string;
  readonly ledger_root: string;
  readonly confidence: number;
  readonly credential_refs?: readonly CredentialRef[];
  readonly evidence_refs?: readonly EvidenceRef[];
  readonly event_log: readonly DecisionEvent[];
  readonly signature?: SignatureEnvelope;
}

export interface CreateDecisionCapsuleInput {
  readonly capsule_id: string;
  readonly decision_at: Date;
  readonly intent: IntentBinding;
  readonly input_hash_refs: readonly string[];
  readonly model: DecisionModelRef;
  readonly rules_version: string;
  readonly ledger_root: string;
  readonly confidence: number;
  readonly credential_refs?: readonly CredentialRef[];
  readonly evidence_refs?: readonly EvidenceRef[];
  readonly event_log?: readonly DecisionEvent[];
  readonly signature?: SignatureEnvelope;
}

function assertValidDecisionModel(model: DecisionModelRef): void {
  if (!model) {
    throw new QiaInvariantError('model is required');
  }
  assertNonEmptyString(model.name, 'model.name');
  assertNonEmptyString(model.version, 'model.version');
}

function assertValidDecisionCapsule(capsule: DecisionCapsule): void {
  if (!capsule) {
    throw new QiaInvariantError('decision capsule is required');
  }
  assertNonEmptyString(capsule.capsule_id, 'capsule.capsule_id');
  assertValidDate(capsule.decision_at, 'capsule.decision_at');
  assertValidIntentBinding(capsule.intent);
  assertValidStringArray(capsule.input_hash_refs, 'capsule.input_hash_refs');
  assertValidDecisionModel(capsule.model);
  assertNonEmptyString(capsule.rules_version, 'capsule.rules_version');
  assertNonEmptyString(capsule.ledger_root, 'capsule.ledger_root');
  if (!Number.isFinite(capsule.confidence) || capsule.confidence < 0 || capsule.confidence > 1) {
    throw new QiaInvariantError('capsule.confidence must be between 0 and 1');
  }
  if (capsule.credential_refs) {
    assertValidStringArray(capsule.credential_refs, 'capsule.credential_refs', QiaInvariantError, {
      allowEmpty: true,
    });
  }
  if (capsule.evidence_refs) {
    assertValidStringArray(capsule.evidence_refs, 'capsule.evidence_refs', QiaInvariantError, {
      allowEmpty: true,
    });
  }
  if (!Array.isArray(capsule.event_log) || capsule.event_log.length === 0) {
    throw new QiaInvariantError('capsule.event_log must be a non-empty array');
  }
  for (const event of capsule.event_log) {
    assertValidDecisionEvent(event);
    if (event.capsule_id !== capsule.capsule_id) {
      throw new QiaInvariantError(
        `Decision event ${event.event_id} capsule_id mismatch: expected ${capsule.capsule_id}, got ${event.capsule_id}`,
      );
    }
  }
  if (capsule.signature) {
    assertValidSignatureEnvelope(capsule.signature);
  }
}

function buildCreateEvent(capsuleId: string, decisionAt: Date): DecisionEvent {
  return {
    event_id: `${capsuleId}:create:${decisionAt.toISOString()}`,
    capsule_id: capsuleId,
    event_type: DecisionEventType.CREATE,
    occurred_at: decisionAt,
  };
}

export function createDecisionCapsule(input: CreateDecisionCapsuleInput): DecisionCapsule {
  if (!input) {
    throw new QiaInvariantError('input is required');
  }

  const decisionAt = assertValidDate(input.decision_at, 'decision_at');
  const eventLog =
    input.event_log && input.event_log.length > 0
      ? [...input.event_log]
      : [buildCreateEvent(input.capsule_id, decisionAt)];

  const capsule: DecisionCapsule = {
    capsule_id: input.capsule_id,
    decision_at: decisionAt,
    intent: input.intent,
    input_hash_refs: input.input_hash_refs,
    model: input.model,
    rules_version: input.rules_version,
    ledger_root: input.ledger_root,
    confidence: input.confidence,
    credential_refs: input.credential_refs,
    evidence_refs: input.evidence_refs,
    event_log: eventLog,
    signature: input.signature,
  };

  assertValidDecisionCapsule(capsule);

  return capsule;
}
