import { ChainClient, type ChainReceipt } from '../chain/client';

export type KillSwitchScope = 'issuance' | 'verification';

export interface KillSwitchState {
  active: boolean;
  scopes: KillSwitchScope[];
  reason: string;
  initiatedBy: string;
  activatedAt: string | null;
  expiresAt: string | null;
  receipt?: ChainReceipt | null;
}

export interface ActivateKillSwitchInput {
  initiatedBy: string;
  reason: string;
  scopes?: KillSwitchScope[];
  ttlMinutes?: number;
  metadata?: Record<string, unknown>;
}

export interface DeactivateKillSwitchInput {
  initiatedBy: string;
  reason?: string;
}

export class KillSwitchError extends Error {
  constructor(message: string, public readonly state: KillSwitchState) {
    super(message);
    this.name = 'KillSwitchError';
  }
}

const chainClient = new ChainClient();
let currentState: KillSwitchState = {
  active: false,
  scopes: [],
  reason: '',
  initiatedBy: '',
  activatedAt: null,
  expiresAt: null,
  receipt: null,
};

export async function activateKillSwitch(
  input: ActivateKillSwitchInput,
): Promise<KillSwitchState> {
  const scopes = input.scopes && input.scopes.length ? input.scopes : ['issuance', 'verification'];
  const activatedAt = new Date().toISOString();
  const expiresAt =
    input.ttlMinutes && input.ttlMinutes > 0
      ? new Date(Date.now() + input.ttlMinutes * 60_000).toISOString()
      : null;

  currentState = {
    active: true,
    scopes,
    reason: input.reason,
    initiatedBy: input.initiatedBy,
    activatedAt,
    expiresAt,
    receipt: null,
  };

  currentState.receipt = await chainClient.submitAuditEvent({
    eventType: 'killSwitchActivated',
    payload: {
      clinicianScope: scopes,
      reason: input.reason,
      initiatedBy: input.initiatedBy,
      activatedAt,
      expiresAt,
      metadata: input.metadata ?? {},
    },
    tags: ['security', 'kill-switch'],
  });

  return currentState;
}

export async function deactivateKillSwitch(
  input: DeactivateKillSwitchInput,
): Promise<KillSwitchState> {
  const previousState = currentState;
  currentState = {
    active: false,
    scopes: [],
    reason: input.reason ?? 'manual_reset',
    initiatedBy: input.initiatedBy,
    activatedAt: previousState.activatedAt,
    expiresAt: previousState.expiresAt,
    receipt: null,
  };

  currentState.receipt = await chainClient.submitAuditEvent({
    eventType: 'killSwitchCleared',
    payload: {
      initiatedBy: input.initiatedBy,
      previousScopes: previousState.scopes,
      previousReason: previousState.reason,
      clearedAt: new Date().toISOString(),
    },
    tags: ['security', 'kill-switch'],
  });

  return currentState;
}

export function getKillSwitchState(): KillSwitchState {
  if (currentState.active && isExpired(currentState)) {
    currentState = {
      ...currentState,
      active: false,
    };
  }
  return currentState;
}

export function assertKillSwitchAllows(scope: KillSwitchScope) {
  const state = getKillSwitchState();
  if (state.active && state.scopes.includes(scope)) {
    throw new KillSwitchError(
      `Kill switch engaged for scope ${scope}. Admin override required.`,
      state,
    );
  }
}

function isExpired(state: KillSwitchState): boolean {
  if (!state.expiresAt) {
    return false;
  }
  return Date.now() > new Date(state.expiresAt).getTime();
}

