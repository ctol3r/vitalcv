import { createHash } from 'node:crypto';
import type { ActionType, ActionTargetEntity } from './actionEngine';

export type ActionStatus = 'OPEN' | 'SAVED' | 'DISMISSED' | 'EXECUTED';

export interface ActionHistoryEvent {
  fromStatus: ActionStatus | null;
  toStatus: ActionStatus;
  actorId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}

function hashSeed(seed: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(seed)).digest('hex');
}

export function buildActionId(input: {
  actionType: ActionType;
  targetEntity: ActionTargetEntity;
  storylineKey?: string | null;
  predictionIds?: readonly string[];
}): string {
  return `action_${hashSeed({
    actionType: input.actionType,
    targetEntity: input.targetEntity,
    storylineKey: input.storylineKey ?? null,
    predictionIds: [...(input.predictionIds ?? [])].sort(),
  }).slice(0, 24)}`;
}

export function canTransitionActionStatus(
  fromStatus: ActionStatus,
  toStatus: ActionStatus,
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }

  const validTransitions: Record<ActionStatus, ActionStatus[]> = {
    OPEN: ['SAVED', 'DISMISSED', 'EXECUTED'],
    SAVED: ['OPEN', 'DISMISSED', 'EXECUTED'],
    DISMISSED: ['OPEN', 'SAVED'],
    EXECUTED: ['OPEN', 'SAVED'],
  };

  return validTransitions[fromStatus].includes(toStatus);
}

export function buildActionHistoryEvent(input: {
  fromStatus: ActionStatus | null;
  toStatus: ActionStatus;
  actorId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): ActionHistoryEvent {
  return {
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus,
    actorId: input.actorId ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
