import { log } from '../../obs/logger';

export const EVENT_BUS_MAX_BUFFER = 500;

export type VitalEventType =
  | 'PROVIDER_UPDATED'
  | 'FINDING_CREATED'
  | 'STORYLINE_UPDATED'
  | 'INVESTIGATOR_RUN_COMPLETE';

export interface ProviderUpdatedPayload {
  providerId: string;
  npi: string | null;
  providerLabel?: string | null;
  operation: 'created' | 'updated';
}

export interface FindingCreatedPayload {
  runId: string | null;
  findingId: string;
  investigatorId: string;
  severity: string;
  status: string;
  entityIds: string[];
  storylineKey: string;
  operation: 'created' | 'updated';
}

export interface StorylineUpdatedPayload {
  storylineId: string;
  storylineType: string;
  status: string;
  severity: string;
  entityIds: string[];
  findingIds: string[];
  operation: 'created' | 'updated' | 'status_changed';
}

export interface InvestigatorRunCompletePayload {
  runId: string;
  investigatorId: string;
  trigger: string;
  status: 'succeeded' | 'failed';
  entityType: string | null;
  targetEntityIds: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  entitiesScanned: number;
  findingsGenerated: number;
  findingsCreated: number;
  findingsUpdated: number;
  findingsResolved: number;
  findingsSuppressed: number;
  storylinesMerged: number;
  errorMessage: string | null;
}

export interface VitalEventPayloadMap {
  PROVIDER_UPDATED: ProviderUpdatedPayload;
  FINDING_CREATED: FindingCreatedPayload;
  STORYLINE_UPDATED: StorylineUpdatedPayload;
  INVESTIGATOR_RUN_COMPLETE: InvestigatorRunCompletePayload;
}

export type EventEnvelope<TType extends VitalEventType = VitalEventType> = {
  id: string;
  type: TType;
  timestamp: string;
  payload: VitalEventPayloadMap[TType];
};

export type VitalEvent = {
  [TType in VitalEventType]: EventEnvelope<TType>;
}[VitalEventType];

type EventHandler<TType extends VitalEventType> = (event: EventEnvelope<TType>) => void | Promise<void>;

const subscriptions = new Map<VitalEventType, Set<EventHandler<VitalEventType>>>();
const replayBuffer: VitalEvent[] = [];
const recentEventIndex = new Map<string, VitalEvent>();
const inFlightEventIds = new Set<string>();

let eventCounter = 0;

function nextEventId(): string {
  eventCounter += 1;
  return `evt_${Date.now().toString(36)}_${eventCounter.toString(36)}`;
}

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByTimestampDesc<TEvent extends { id: string; timestamp: string }>(events: TEvent[]): TEvent[] {
  return [...events].sort((left, right) => (
    timestampValue(right.timestamp) - timestampValue(left.timestamp)
    || right.id.localeCompare(left.id)
  ));
}

function appendToReplayBuffer(event: VitalEvent): void {
  replayBuffer.push(event);
  recentEventIndex.set(event.id, event);

  if (replayBuffer.length > EVENT_BUS_MAX_BUFFER) {
    const removed = replayBuffer.splice(0, replayBuffer.length - EVENT_BUS_MAX_BUFFER);
    for (const item of removed) {
      recentEventIndex.delete(item.id);
    }
  }
}

async function dispatchEvent<TType extends VitalEventType>(event: EventEnvelope<TType>): Promise<void> {
  if (inFlightEventIds.has(event.id)) {
    log('warn', 'event_bus_duplicate_ignored', {
      eventId: event.id,
      eventType: event.type,
      reason: 'in_flight',
    });
    return;
  }

  inFlightEventIds.add(event.id);

  try {
    const handlers = [...(subscriptions.get(event.type) ?? [])] as EventHandler<TType>[];
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await Promise.resolve().then(() => handler(event));
        } catch (error) {
          log('warn', 'event_bus_handler_failed', {
            eventId: event.id,
            eventType: event.type,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );
  } finally {
    inFlightEventIds.delete(event.id);
  }
}

export async function publish<TType extends VitalEventType>(input: {
  type: TType;
  payload: VitalEventPayloadMap[TType];
  id?: string;
  timestamp?: string;
}): Promise<EventEnvelope<TType>> {
  const event: EventEnvelope<TType> = {
    id: input.id ?? nextEventId(),
    type: input.type,
    timestamp: input.timestamp ?? new Date().toISOString(),
    payload: input.payload,
  };

  const existing = recentEventIndex.get(event.id);
  if (existing) {
    log('warn', 'event_bus_duplicate_ignored', {
      eventId: event.id,
      eventType: event.type,
      reason: 'duplicate_id',
    });
    return existing as EventEnvelope<TType>;
  }

  appendToReplayBuffer(event as VitalEvent);
  queueMicrotask(() => {
    void dispatchEvent(event).catch((error) => {
      log('error', 'event_bus_dispatch_failed', {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });

  return event;
}

export function subscribe<TType extends VitalEventType>(
  type: TType,
  handler: EventHandler<TType>,
): () => void {
  const currentHandlers = subscriptions.get(type) ?? new Set<EventHandler<VitalEventType>>();
  const typedHandler = handler as EventHandler<VitalEventType>;
  currentHandlers.add(typedHandler);
  subscriptions.set(type, currentHandlers);

  return () => {
    const registeredHandlers = subscriptions.get(type);
    if (!registeredHandlers) {
      return;
    }

    registeredHandlers.delete(typedHandler);
    if (registeredHandlers.size === 0) {
      subscriptions.delete(type);
    }
  };
}

export function listRecentEvents(options?: {
  limit?: number;
  types?: VitalEventType[];
}): VitalEvent[] {
  const limit = Math.max(1, Math.min(options?.limit ?? 100, EVENT_BUS_MAX_BUFFER));
  const typeSet = options?.types ? new Set(options.types) : null;
  const filtered = typeSet
    ? replayBuffer.filter((event) => typeSet.has(event.type))
    : replayBuffer;

  return sortByTimestampDesc(filtered).slice(0, limit);
}

export function getLatestEventTimestamp(types?: VitalEventType[]): string | null {
  return listRecentEvents({ limit: 1, types })[0]?.timestamp ?? null;
}

export function resetEventBusForTests(): void {
  subscriptions.clear();
  replayBuffer.splice(0, replayBuffer.length);
  recentEventIndex.clear();
  inFlightEventIds.clear();
  eventCounter = 0;
}
