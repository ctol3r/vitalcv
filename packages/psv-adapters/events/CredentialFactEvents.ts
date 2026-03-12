import type { CredentialFactBatch, CredentialFactEnvelope } from '../core/CredentialFactMapper';
import { buildDeterministicId } from '../core/CredentialFactMapper';

type BaseEvent = Readonly<{
  eventId: string;
  eventType: string;
  subjectId: string;
  source: string;
  occurredAt: string;
  batchId: string;
}>;

export type CredentialFactIngestedEvent = BaseEvent &
  Readonly<{
    eventType: 'CredentialFactIngested';
    factId: string;
    factType: string;
  }>;

export type MonitoringSubscriptionChangedEvent = BaseEvent &
  Readonly<{
    eventType: 'MonitoringSubscriptionChanged';
    subscriptionId: string;
    status: string;
  }>;

export type LicenseUpdatedEvent = BaseEvent &
  Readonly<{
    eventType: 'LicenseUpdated';
    licenseNumber: string;
    jurisdiction: string;
    status: string;
  }>;

export type LicenseExpiredEvent = BaseEvent &
  Readonly<{
    eventType: 'LicenseExpired';
    licenseNumber: string;
    jurisdiction: string;
    expiresAt?: string;
  }>;

export type DisciplineAddedEvent = BaseEvent &
  Readonly<{
    eventType: 'DisciplineAdded';
    licenseNumber: string;
    jurisdiction: string;
    discipline: readonly string[];
  }>;

export type TrustSignalRaisedEvent = BaseEvent &
  Readonly<{
    eventType: 'TrustSignalRaised';
    signal: string;
    status: string;
  }>;

export type CredentialFactEvent =
  | CredentialFactIngestedEvent
  | MonitoringSubscriptionChangedEvent
  | LicenseUpdatedEvent
  | LicenseExpiredEvent
  | DisciplineAddedEvent
  | TrustSignalRaisedEvent;

function buildEventId(type: string, batchId: string, naturalKey: unknown): string {
  return buildDeterministicId(type, {
    batchId,
    naturalKey,
  });
}

export function buildCredentialFactIngestedEvents(
  batch: CredentialFactBatch,
  facts: readonly CredentialFactEnvelope[],
): readonly CredentialFactIngestedEvent[] {
  return Object.freeze(
    facts.map((entry) =>
      Object.freeze({
        eventId: buildEventId('fact_ingested', batch.batchId, entry.fact.factId),
        eventType: 'CredentialFactIngested',
        subjectId: batch.subjectId,
        source: batch.source,
        occurredAt: batch.retrievalTime,
        batchId: batch.batchId,
        factId: entry.fact.factId,
        factType: entry.fact.factType,
      }),
    ),
  );
}

export function buildMonitoringSubscriptionChangedEvent(input: {
  batch: CredentialFactBatch;
  subscriptionId: string;
  status: string;
}): MonitoringSubscriptionChangedEvent {
  return Object.freeze({
    eventId: buildEventId('subscription_changed', input.batch.batchId, input.subscriptionId),
    eventType: 'MonitoringSubscriptionChanged',
    subjectId: input.batch.subjectId,
    source: input.batch.source,
    occurredAt: input.batch.retrievalTime,
    batchId: input.batch.batchId,
    subscriptionId: input.subscriptionId,
    status: input.status,
  });
}

export function buildTrustSignalRaisedEvent(input: {
  batch: CredentialFactBatch;
  signal: string;
  status: string;
}): TrustSignalRaisedEvent {
  return Object.freeze({
    eventId: buildEventId('trust_signal', input.batch.batchId, input.signal),
    eventType: 'TrustSignalRaised',
    subjectId: input.batch.subjectId,
    source: input.batch.source,
    occurredAt: input.batch.retrievalTime,
    batchId: input.batch.batchId,
    signal: input.signal,
    status: input.status,
  });
}
