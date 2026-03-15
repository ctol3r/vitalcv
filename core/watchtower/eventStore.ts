import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type WatchtowerAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type WatchtowerDeltaKind =
  | 'CLAIM_ADDED'
  | 'CLAIM_CHANGED'
  | 'CLAIM_REMOVED'
  | 'CLAIM_STATUS_CHANGED'
  | 'CLAIM_EXPIRED';
export type WatchtowerNotificationChannel = 'EVENT_SINK' | 'WEBHOOK' | 'EMAIL' | 'SLACK' | 'INTERNAL';
export type WatchtowerEventType =
  | 'SUBSCRIPTION_SAVED'
  | 'CHECK_SCHEDULED'
  | 'CHECK_COMPLETED'
  | 'CLAIM_CHANGE_DETECTED'
  | 'ALERT_EMITTED'
  | 'NOTIFICATION_TRIGGERED'
  | 'NOTIFICATION_FAILED';

export interface WatchtowerClaim {
  claimId: string;
  claimType: string;
  value: unknown;
  status?: string | null;
  observedAt?: string;
  expiresAt?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WatchtowerSnapshot {
  subjectId: string;
  checkedAt: string;
  claims: readonly WatchtowerClaim[];
  metadata?: Record<string, unknown>;
}

export interface WatchtowerClaimDelta {
  deltaId: string;
  subjectId: string;
  kind: WatchtowerDeltaKind;
  claimId: string;
  claimType: string;
  sourceId?: string | null;
  fieldPath?: string;
  detectedAt: string;
  previousValue?: unknown;
  currentValue?: unknown;
  previousStatus?: string | null;
  currentStatus?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WatchtowerAlert {
  alertId: string;
  subjectId: string;
  subscriptionId?: string | null;
  deltaId: string;
  deltaKind: WatchtowerDeltaKind;
  claimId: string;
  claimType: string;
  sourceId?: string | null;
  severity: WatchtowerAlertSeverity;
  title: string;
  description: string;
  recommendedAction: string;
  ruleId: string;
  observedAt: string;
  metadata?: Record<string, unknown>;
}

export interface WatchtowerNotificationTrigger {
  triggerId: string;
  channel: WatchtowerNotificationChannel;
  destination?: string | null;
  severityAtLeast: WatchtowerAlertSeverity;
  deltaKinds?: readonly WatchtowerDeltaKind[];
  cooldownMinutes: number;
  enabled: boolean;
}

export interface WatchtowerSubscription {
  subscriptionId: string;
  subjectId: string;
  active: boolean;
  checkIntervalMinutes: number;
  nextCheckAt: string;
  lastCheckedAt?: string | null;
  alertSeverityFloor: WatchtowerAlertSeverity;
  claimTypes?: readonly string[];
  triggers: readonly WatchtowerNotificationTrigger[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface WatchtowerNotificationRequest {
  notificationId: string;
  notificationKey: string;
  subscriptionId: string;
  subjectId: string;
  triggerId: string;
  alertId: string;
  channel: WatchtowerNotificationChannel;
  destination?: string | null;
  severity: WatchtowerAlertSeverity;
  deltaKind: WatchtowerDeltaKind;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface WatchtowerEvent {
  eventId: string;
  type: WatchtowerEventType;
  subjectId: string;
  occurredAt: string;
  subscriptionId?: string | null;
  payload: Record<string, unknown>;
}

export interface WatchtowerEventQuery {
  subjectId?: string;
  subscriptionId?: string;
  types?: readonly WatchtowerEventType[];
  limit?: number;
}

export interface WatchtowerSubscriptionQuery {
  subjectId?: string;
  activeOnly?: boolean;
  dueBefore?: string;
}

export interface WatchtowerEventStore {
  appendEvents(events: readonly WatchtowerEvent[]): Promise<void>;
  listEvents(query?: WatchtowerEventQuery): Promise<readonly WatchtowerEvent[]>;
  putSnapshot(snapshot: WatchtowerSnapshot): Promise<void>;
  getLatestSnapshot(subjectId: string): Promise<WatchtowerSnapshot | null>;
  saveSubscription(subscription: WatchtowerSubscription): Promise<WatchtowerSubscription>;
  getSubscription(subscriptionId: string): Promise<WatchtowerSubscription | null>;
  listSubscriptions(query?: WatchtowerSubscriptionQuery): Promise<readonly WatchtowerSubscription[]>;
}

type PersistedWatchtowerState = {
  events: WatchtowerEvent[];
  snapshots: Record<string, WatchtowerSnapshot>;
  subscriptions: Record<string, WatchtowerSubscription>;
};

export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }

  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.entries(record).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}

export function computeWatchtowerHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function alertSeverityRank(severity: WatchtowerAlertSeverity): number {
  switch (severity) {
    case 'LOW':
      return 0;
    case 'MEDIUM':
      return 1;
    case 'HIGH':
      return 2;
    case 'CRITICAL':
      return 3;
  }
}

function cloneJson<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function compareIsoStrings(left: string, right: string): number {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return leftTime - rightTime;
}

function compareEvents(left: WatchtowerEvent, right: WatchtowerEvent): number {
  const timeComparison = compareIsoStrings(left.occurredAt, right.occurredAt);
  if (timeComparison !== 0) {
    return timeComparison;
  }

  return left.eventId.localeCompare(right.eventId);
}

function createEmptyState(): PersistedWatchtowerState {
  return {
    events: [],
    snapshots: {},
    subscriptions: {},
  };
}

function normalizePersistedState(value: unknown): PersistedWatchtowerState {
  const candidate = value && typeof value === 'object' ? (value as Partial<PersistedWatchtowerState>) : undefined;
  return {
    events: Array.isArray(candidate?.events) ? candidate.events as WatchtowerEvent[] : [],
    snapshots: candidate?.snapshots && typeof candidate.snapshots === 'object'
      ? candidate.snapshots as Record<string, WatchtowerSnapshot>
      : {},
    subscriptions: candidate?.subscriptions && typeof candidate.subscriptions === 'object'
      ? candidate.subscriptions as Record<string, WatchtowerSubscription>
      : {},
  };
}

function filterEvents(state: PersistedWatchtowerState, query?: WatchtowerEventQuery): WatchtowerEvent[] {
  const filtered = state.events.filter((event) => {
    if (query?.subjectId && event.subjectId !== query.subjectId) {
      return false;
    }

    if (query?.subscriptionId && event.subscriptionId !== query.subscriptionId) {
      return false;
    }

    if (query?.types && query.types.length > 0 && !query.types.includes(event.type)) {
      return false;
    }

    return true;
  }).sort(compareEvents);

  if (!query?.limit || filtered.length <= query.limit) {
    return filtered;
  }

  return filtered.slice(filtered.length - query.limit);
}

function filterSubscriptions(
  state: PersistedWatchtowerState,
  query?: WatchtowerSubscriptionQuery,
): WatchtowerSubscription[] {
  const filtered = Object.values(state.subscriptions).filter((subscription) => {
    if (query?.subjectId && subscription.subjectId !== query.subjectId) {
      return false;
    }

    if (query?.activeOnly && !subscription.active) {
      return false;
    }

    if (query?.dueBefore && compareIsoStrings(subscription.nextCheckAt, query.dueBefore) > 0) {
      return false;
    }

    return true;
  });

  return filtered.sort((left, right) => compareIsoStrings(left.nextCheckAt, right.nextCheckAt));
}

export class InMemoryWatchtowerEventStore implements WatchtowerEventStore {
  private readonly state: PersistedWatchtowerState = createEmptyState();

  async appendEvents(events: readonly WatchtowerEvent[]): Promise<void> {
    this.state.events.push(...cloneJson(events));
    this.state.events.sort(compareEvents);
  }

  async listEvents(query?: WatchtowerEventQuery): Promise<readonly WatchtowerEvent[]> {
    return cloneJson(filterEvents(this.state, query));
  }

  async putSnapshot(snapshot: WatchtowerSnapshot): Promise<void> {
    this.state.snapshots[snapshot.subjectId] = cloneJson(snapshot);
  }

  async getLatestSnapshot(subjectId: string): Promise<WatchtowerSnapshot | null> {
    return cloneJson(this.state.snapshots[subjectId] ?? null);
  }

  async saveSubscription(subscription: WatchtowerSubscription): Promise<WatchtowerSubscription> {
    this.state.subscriptions[subscription.subscriptionId] = cloneJson(subscription);
    return cloneJson(subscription);
  }

  async getSubscription(subscriptionId: string): Promise<WatchtowerSubscription | null> {
    return cloneJson(this.state.subscriptions[subscriptionId] ?? null);
  }

  async listSubscriptions(query?: WatchtowerSubscriptionQuery): Promise<readonly WatchtowerSubscription[]> {
    return cloneJson(filterSubscriptions(this.state, query));
  }
}

export class FileWatchtowerEventStore implements WatchtowerEventStore {
  private state: PersistedWatchtowerState = createEmptyState();
  private loaded = false;

  constructor(private readonly filePath: string) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const body = await fs.readFile(this.filePath, 'utf8');
      this.state = normalizePersistedState(JSON.parse(body));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      this.state = createEmptyState();
    }

    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2));
    await fs.rename(tempPath, this.filePath);
  }

  async appendEvents(events: readonly WatchtowerEvent[]): Promise<void> {
    await this.ensureLoaded();
    this.state.events.push(...cloneJson(events));
    this.state.events.sort(compareEvents);
    await this.persist();
  }

  async listEvents(query?: WatchtowerEventQuery): Promise<readonly WatchtowerEvent[]> {
    await this.ensureLoaded();
    return cloneJson(filterEvents(this.state, query));
  }

  async putSnapshot(snapshot: WatchtowerSnapshot): Promise<void> {
    await this.ensureLoaded();
    this.state.snapshots[snapshot.subjectId] = cloneJson(snapshot);
    await this.persist();
  }

  async getLatestSnapshot(subjectId: string): Promise<WatchtowerSnapshot | null> {
    await this.ensureLoaded();
    return cloneJson(this.state.snapshots[subjectId] ?? null);
  }

  async saveSubscription(subscription: WatchtowerSubscription): Promise<WatchtowerSubscription> {
    await this.ensureLoaded();
    this.state.subscriptions[subscription.subscriptionId] = cloneJson(subscription);
    await this.persist();
    return cloneJson(subscription);
  }

  async getSubscription(subscriptionId: string): Promise<WatchtowerSubscription | null> {
    await this.ensureLoaded();
    return cloneJson(this.state.subscriptions[subscriptionId] ?? null);
  }

  async listSubscriptions(query?: WatchtowerSubscriptionQuery): Promise<readonly WatchtowerSubscription[]> {
    await this.ensureLoaded();
    return cloneJson(filterSubscriptions(this.state, query));
  }
}
