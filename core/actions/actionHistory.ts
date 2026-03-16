import { createHash } from 'node:crypto';
import type { ActionType, ActionTargetEntity } from './actionEngine';

export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type ActionStatusInput = ActionStatus | 'OPEN' | 'SAVED' | 'DISMISSED' | 'EXECUTED';

export interface ActionHistoryEvent {
  fromStatus: ActionStatus | null;
  toStatus: ActionStatus;
  actorId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function normalizeActionStatus(status: string | null | undefined): ActionStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'saved':
    case 'in_progress':
      return 'in_progress';
    case 'executed':
    case 'completed':
      return 'completed';
    case 'dismissed':
    case 'skipped':
      return 'skipped';
    case 'open':
    case 'pending':
    default:
      return 'pending';
  }
}

export function isActionStatus(status: string | null | undefined): status is ActionStatusInput {
  return ['pending', 'in_progress', 'completed', 'skipped', 'open', 'saved', 'executed', 'dismissed'].includes(
    (status ?? '').toLowerCase(),
  );
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
  fromStatus: ActionStatusInput,
  toStatus: ActionStatusInput,
): boolean {
  const from = normalizeActionStatus(fromStatus);
  const to = normalizeActionStatus(toStatus);

  if (from === to) {
    return true;
  }

  const validTransitions: Record<ActionStatus, ActionStatus[]> = {
    pending: ['in_progress', 'completed', 'skipped'],
    in_progress: ['pending', 'completed', 'skipped'],
    completed: ['pending', 'in_progress'],
    skipped: ['pending', 'in_progress'],
  };

  return validTransitions[from].includes(to);
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
    fromStatus: input.fromStatus ? normalizeActionStatus(input.fromStatus) : null,
    toStatus: normalizeActionStatus(input.toStatus),
    actorId: input.actorId ?? null,
    note: input.note ?? null,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
