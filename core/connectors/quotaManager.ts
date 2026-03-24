export interface ConnectorQuotaPolicy {
  limit: number;
  windowMs: number;
  alertThreshold?: number;
}

export interface ConnectorQuotaSnapshot {
  connector: string;
  limit: number;
  used: number;
  remaining: number;
  utilizationRatio: number;
  nearLimit: boolean;
  alertThreshold: number;
  windowStartedAt: string;
  resetAt: string;
  windowRemainingMs: number;
  blockedUntil: string | null;
  rateLimitHits: number;
  lastRetryAfterMs: number | null;
}

export interface ConsumeConnectorQuotaInput {
  connector: string;
  cost?: number;
  policy?: Partial<ConnectorQuotaPolicy>;
  recordedAt?: string;
}

export interface RecordConnectorRateLimitHeadersInput {
  connector: string;
  headers: Record<string, string | string[] | undefined>;
  recordedAt?: string;
  policy?: Partial<ConnectorQuotaPolicy>;
}

const DEFAULT_POLICY: Required<ConnectorQuotaPolicy> = {
  limit: 60,
  windowMs: 60_000,
  alertThreshold: 0.15,
};

interface MutableQuotaState {
  policy: Required<ConnectorQuotaPolicy>;
  used: number;
  windowStartedAt: string;
  resetAt: string;
  blockedUntil: string | null;
  rateLimitHits: number;
  lastRetryAfterMs: number | null;
}

function nowIso(value?: string): string {
  return value ?? new Date().toISOString();
}

function toFutureIso(recordedAtIso: string, durationMs: number): string {
  return new Date(Date.parse(recordedAtIso) + Math.max(0, durationMs)).toISOString();
}

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function parseRetryAfterMs(
  retryAfter: string | undefined,
  recordedAtIso = new Date().toISOString(),
): number | null {
  if (!retryAfter) {
    return null;
  }

  const asSeconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(asSeconds)) {
    return Math.max(0, asSeconds * 1_000);
  }

  const asDate = Date.parse(retryAfter);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.parse(recordedAtIso));
  }

  return null;
}

function clampAlertThreshold(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function buildSnapshot(
  connector: string,
  state: MutableQuotaState,
  recordedAtIso: string,
): ConnectorQuotaSnapshot {
  const remaining = Math.max(0, state.policy.limit - state.used);
  const utilizationRatio = state.policy.limit > 0 ? state.used / state.policy.limit : 1;
  const remainingRatio = state.policy.limit > 0 ? remaining / state.policy.limit : 0;

  return {
    connector,
    limit: state.policy.limit,
    used: state.used,
    remaining,
    utilizationRatio: Math.round(utilizationRatio * 10_000) / 10_000,
    nearLimit: remainingRatio <= state.policy.alertThreshold,
    alertThreshold: state.policy.alertThreshold,
    windowStartedAt: state.windowStartedAt,
    resetAt: state.resetAt,
    windowRemainingMs: Math.max(0, Date.parse(state.resetAt) - Date.parse(recordedAtIso)),
    blockedUntil: state.blockedUntil,
    rateLimitHits: state.rateLimitHits,
    lastRetryAfterMs: state.lastRetryAfterMs,
  };
}

export class ConnectorQuotaExceededError extends Error {
  readonly connector: string;
  readonly retryAfterMs: number | null;
  readonly snapshot: ConnectorQuotaSnapshot;

  constructor(connector: string, message: string, snapshot: ConnectorQuotaSnapshot, retryAfterMs: number | null) {
    super(message);
    this.name = 'ConnectorQuotaExceededError';
    this.connector = connector;
    this.snapshot = snapshot;
    this.retryAfterMs = retryAfterMs;
  }
}

export class ConnectorQuotaManager {
  private readonly states = new Map<string, MutableQuotaState>();

  configure(connector: string, policy: Partial<ConnectorQuotaPolicy>, recordedAt?: string): ConnectorQuotaSnapshot {
    const state = this.getState(connector, policy);
    const now = nowIso(recordedAt);
    state.policy = this.mergePolicy(state.policy, policy);
    return buildSnapshot(connector, state, now);
  }

  consume(input: ConsumeConnectorQuotaInput): ConnectorQuotaSnapshot {
    const state = this.getState(input.connector, input.policy);
    const recordedAt = nowIso(input.recordedAt);
    const cost = Math.max(1, Math.floor(input.cost ?? 1));

    state.policy = this.mergePolicy(state.policy, input.policy);
    this.rollWindowIfNeeded(state, recordedAt);

    if (state.blockedUntil && Date.parse(state.blockedUntil) > Date.parse(recordedAt)) {
      throw new ConnectorQuotaExceededError(
        input.connector,
        `${input.connector} is temporarily blocked by connector quota controls`,
        buildSnapshot(input.connector, state, recordedAt),
        Date.parse(state.blockedUntil) - Date.parse(recordedAt),
      );
    }

    if (state.used + cost > state.policy.limit) {
      state.blockedUntil = state.resetAt;
      const snapshot = buildSnapshot(input.connector, state, recordedAt);
      throw new ConnectorQuotaExceededError(
        input.connector,
        `${input.connector} exceeded its configured connector quota`,
        snapshot,
        Date.parse(snapshot.resetAt) - Date.parse(recordedAt),
      );
    }

    state.used += cost;
    return buildSnapshot(input.connector, state, recordedAt);
  }

  recordRateLimit(
    connector: string,
    retryAfterMs?: number | null,
    recordedAt?: string,
    policy?: Partial<ConnectorQuotaPolicy>,
  ): ConnectorQuotaSnapshot {
    const state = this.getState(connector, policy);
    const now = nowIso(recordedAt);
    state.policy = this.mergePolicy(state.policy, policy);
    this.rollWindowIfNeeded(state, now);

    state.rateLimitHits += 1;
    state.lastRetryAfterMs = retryAfterMs ?? null;
    state.blockedUntil = retryAfterMs != null ? toFutureIso(now, retryAfterMs) : state.resetAt;
    state.used = state.policy.limit;

    return buildSnapshot(connector, state, now);
  }

  recordHeaders(input: RecordConnectorRateLimitHeadersInput): ConnectorQuotaSnapshot {
    const state = this.getState(input.connector, input.policy);
    const recordedAt = nowIso(input.recordedAt);
    state.policy = this.mergePolicy(state.policy, input.policy);
    this.rollWindowIfNeeded(state, recordedAt);

    const limitHeader =
      normalizeHeaderValue(input.headers['x-rate-limit-limit'])
      ?? normalizeHeaderValue(input.headers['ratelimit-limit']);
    const remainingHeader =
      normalizeHeaderValue(input.headers['x-rate-limit-remaining'])
      ?? normalizeHeaderValue(input.headers['ratelimit-remaining']);
    const resetHeader =
      normalizeHeaderValue(input.headers['x-rate-limit-reset'])
      ?? normalizeHeaderValue(input.headers['ratelimit-reset']);
    const retryAfterHeader =
      normalizeHeaderValue(input.headers['retry-after'])
      ?? normalizeHeaderValue(input.headers['Retry-After']);

    if (limitHeader) {
      const limit = Number.parseInt(limitHeader, 10);
      if (Number.isFinite(limit) && limit > 0) {
        state.policy.limit = limit;
      }
    }

    if (remainingHeader) {
      const remaining = Number.parseInt(remainingHeader, 10);
      if (Number.isFinite(remaining) && remaining >= 0) {
        state.used = Math.max(0, state.policy.limit - remaining);
      }
    }

    if (resetHeader) {
      const asSeconds = Number.parseInt(resetHeader, 10);
      const asDate = Date.parse(resetHeader);
      if (Number.isFinite(asSeconds)) {
        state.resetAt = toFutureIso(recordedAt, asSeconds * 1_000);
      } else if (Number.isFinite(asDate)) {
        state.resetAt = new Date(asDate).toISOString();
      }
    }

    const retryAfterMs = parseRetryAfterMs(retryAfterHeader, recordedAt);
    if (retryAfterMs != null) {
      state.rateLimitHits += 1;
      state.lastRetryAfterMs = retryAfterMs;
      state.blockedUntil = toFutureIso(recordedAt, retryAfterMs);
      state.used = state.policy.limit;
    }

    return buildSnapshot(input.connector, state, recordedAt);
  }

  getSnapshot(connector: string, recordedAt?: string): ConnectorQuotaSnapshot {
    const state = this.getState(connector);
    return buildSnapshot(connector, state, nowIso(recordedAt));
  }

  reset(): void {
    this.states.clear();
  }

  private getState(connector: string, policy?: Partial<ConnectorQuotaPolicy>): MutableQuotaState {
    if (!this.states.has(connector)) {
      const resolvedPolicy = this.mergePolicy(DEFAULT_POLICY, policy);
      const startedAt = new Date().toISOString();
      this.states.set(connector, {
        policy: resolvedPolicy,
        used: 0,
        windowStartedAt: startedAt,
        resetAt: toFutureIso(startedAt, resolvedPolicy.windowMs),
        blockedUntil: null,
        rateLimitHits: 0,
        lastRetryAfterMs: null,
      });
    }

    return this.states.get(connector)!;
  }

  private mergePolicy(
    existing: Required<ConnectorQuotaPolicy>,
    incoming?: Partial<ConnectorQuotaPolicy>,
  ): Required<ConnectorQuotaPolicy> {
    return {
      ...existing,
      ...(incoming ?? {}),
      limit: Math.max(1, Math.floor(incoming?.limit ?? existing.limit)),
      windowMs: Math.max(1_000, Math.floor(incoming?.windowMs ?? existing.windowMs)),
      alertThreshold: clampAlertThreshold(incoming?.alertThreshold ?? existing.alertThreshold),
    };
  }

  private rollWindowIfNeeded(state: MutableQuotaState, recordedAtIso: string): void {
    if (Date.parse(recordedAtIso) < Date.parse(state.resetAt)) {
      return;
    }

    state.used = 0;
    state.windowStartedAt = recordedAtIso;
    state.resetAt = toFutureIso(recordedAtIso, state.policy.windowMs);
    state.blockedUntil = null;
    state.lastRetryAfterMs = null;
  }
}

export const connectorQuotaManager = new ConnectorQuotaManager();
