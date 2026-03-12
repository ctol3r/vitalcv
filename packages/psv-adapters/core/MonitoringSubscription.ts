import { buildDeterministicId } from './CredentialFactMapper';
import { sha256Hex, stableSerialize } from './ProvenanceTracker';

export type MonitoringDeliveryMethod = 'POLLING' | 'WEBHOOK';

export type MonitoringSubscriptionRecord = Readonly<{
  subscriptionId: string;
  source: string;
  monitoredSubject: string;
  institutionId: string;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  deliveryMethod: MonitoringDeliveryMethod;
  cursor?: string;
  webhookTarget?: string;
  createdAt: string;
  updatedAt: string;
}>;

export interface MonitoringSubscriptionState {
  register(input: Omit<MonitoringSubscriptionRecord, 'subscriptionId'> & { subscriptionId?: string }): MonitoringSubscriptionRecord;
  get(subscriptionId: string): MonitoringSubscriptionRecord | null;
  markReplayKey(subscriptionId: string, replayKey: string): void;
  hasReplayKey(subscriptionId: string, replayKey: string): boolean;
  advanceCursor(subscriptionId: string, cursor: string, updatedAt: string): MonitoringSubscriptionRecord;
  list(): readonly MonitoringSubscriptionRecord[];
}

export function buildReplayKey(value: unknown): string {
  return sha256Hex(stableSerialize(value));
}

export class InMemoryMonitoringSubscriptionState implements MonitoringSubscriptionState {
  private readonly subscriptions = new Map<string, MonitoringSubscriptionRecord>();
  private readonly replayKeys = new Map<string, Set<string>>();

  register(
    input: Omit<MonitoringSubscriptionRecord, 'subscriptionId'> & { subscriptionId?: string },
  ): MonitoringSubscriptionRecord {
    const subscriptionId =
      input.subscriptionId ??
      buildDeterministicId('subscription', {
        source: input.source,
        monitoredSubject: input.monitoredSubject,
        institutionId: input.institutionId,
        deliveryMethod: input.deliveryMethod,
      });

    const record = Object.freeze({
      ...input,
      subscriptionId,
    });

    this.subscriptions.set(subscriptionId, record);
    if (!this.replayKeys.has(subscriptionId)) {
      this.replayKeys.set(subscriptionId, new Set());
    }
    return record;
  }

  get(subscriptionId: string): MonitoringSubscriptionRecord | null {
    return this.subscriptions.get(subscriptionId) ?? null;
  }

  markReplayKey(subscriptionId: string, replayKey: string): void {
    if (!this.replayKeys.has(subscriptionId)) {
      this.replayKeys.set(subscriptionId, new Set());
    }
    this.replayKeys.get(subscriptionId)?.add(replayKey);
  }

  hasReplayKey(subscriptionId: string, replayKey: string): boolean {
    return this.replayKeys.get(subscriptionId)?.has(replayKey) ?? false;
  }

  advanceCursor(subscriptionId: string, cursor: string, updatedAt: string): MonitoringSubscriptionRecord {
    const current = this.subscriptions.get(subscriptionId);
    if (!current) {
      throw new Error(`Unknown monitoring subscription: ${subscriptionId}`);
    }

    const next = Object.freeze({
      ...current,
      cursor,
      updatedAt,
    });

    this.subscriptions.set(subscriptionId, next);
    return next;
  }

  list(): readonly MonitoringSubscriptionRecord[] {
    return Object.freeze([...this.subscriptions.values()]);
  }
}
