import { log } from '../../obs/logger';
import { z } from 'zod';

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
const replayBufferIds = new Set<string>();

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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const target = value as Record<string, unknown>;
  for (const key of Object.keys(target)) {
    deepFreeze(target[key]);
  }

  return Object.freeze(value);
}

const isoTimestampSchema = z.string().datetime({ offset: true });

const providerUpdatedPayloadSchema = z.object({
  providerId: z.string().min(1),
  npi: z.string().nullable(),
  providerLabel: z.string().nullable().optional(),
  operation: z.enum(['created', 'updated']),
}).strict();

const findingCreatedPayloadSchema = z.object({
  runId: z.string().nullable(),
  findingId: z.string().min(1),
  investigatorId: z.string().min(1),
  severity: z.string().min(1),
  status: z.string().min(1),
  entityIds: z.array(z.string().min(1)),
  storylineKey: z.string().min(1),
  operation: z.enum(['created', 'updated']),
}).strict();

const storylineUpdatedPayloadSchema = z.object({
  storylineId: z.string().min(1),
  storylineType: z.string().min(1),
  status: z.string().min(1),
  severity: z.string().min(1),
  entityIds: z.array(z.string().min(1)),
  findingIds: z.array(z.string().min(1)),
  operation: z.enum(['created', 'updated', 'status_changed']),
}).strict();

const investigatorRunCompletePayloadSchema = z.object({
  runId: z.string().min(1),
  investigatorId: z.string().min(1),
  trigger: z.string().min(1),
  status: z.enum(['succeeded', 'failed']),
  entityType: z.string().nullable(),
  targetEntityIds: z.array(z.string().min(1)),
  startedAt: isoTimestampSchema,
  completedAt: isoTimestampSchema,
  durationMs: z.number().finite(),
  entitiesScanned: z.number().finite(),
  findingsGenerated: z.number().finite(),
  findingsCreated: z.number().finite(),
  findingsUpdated: z.number().finite(),
  findingsResolved: z.number().finite(),
  findingsSuppressed: z.number().finite(),
  storylinesMerged: z.number().finite(),
  errorMessage: z.string().nullable(),
}).strict();

const payloadSchemaByType = {
  PROVIDER_UPDATED: providerUpdatedPayloadSchema,
  FINDING_CREATED: findingCreatedPayloadSchema,
  STORYLINE_UPDATED: storylineUpdatedPayloadSchema,
  INVESTIGATOR_RUN_COMPLETE: investigatorRunCompletePayloadSchema,
} satisfies {
  [TType in VitalEventType]: z.ZodType<VitalEventPayloadMap[TType]>;
};

function validateEventInput<TType extends VitalEventType>(input: {
  type: TType;
  payload: VitalEventPayloadMap[TType];
  id?: string;
  timestamp?: string;
}): void {
  if (input.id !== undefined) {
    z.string().min(1).parse(input.id);
  }
  if (input.timestamp !== undefined) {
    isoTimestampSchema.parse(input.timestamp);
  }

  payloadSchemaByType[input.type].parse(input.payload);
}

export function getEventBusHealthSnapshot(): {
  bufferDepth: number;
  latestEventTimestamp: string | null;
  latestEventId: string | null;
} {
  const latestEvent = listRecentEvents({ limit: 1 })[0] ?? null;

  return {
    bufferDepth: replayBuffer.length,
    latestEventTimestamp: latestEvent?.timestamp ?? null,
    latestEventId: latestEvent?.id ?? null,
  };
}

export async function publish<TType extends VitalEventType>(input: {
  type: TType;
  payload: VitalEventPayloadMap[TType];
  id?: string;
  timestamp?: string;
}): Promise<EventEnvelope<TType>> {
  try {
    validateEventInput(input);
  } catch (error) {
    log('warn', 'event_bus_rejected', {
      eventType: input.type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const eventId = input.id ?? nextEventId();
  if (replayBufferIds.has(eventId)) {
    throw new Error(`Event already exists: ${eventId}`);
  }

  const event: EventEnvelope<TType> = {
    id: eventId,
    type: input.type,
    timestamp: input.timestamp ?? new Date().toISOString(),
    payload: cloneJson(input.payload),
  };
  deepFreeze(event);

  replayBuffer.push(event as VitalEvent);
  replayBufferIds.add(event.id);
  if (replayBuffer.length > EVENT_BUS_MAX_BUFFER) {
    const dropped = replayBuffer.splice(0, replayBuffer.length - EVENT_BUS_MAX_BUFFER);
    for (const staleEvent of dropped) {
      replayBufferIds.delete(staleEvent.id);
    }
  }

  const handlers = [...(subscriptions.get(event.type) ?? [])] as EventHandler<TType>[];
  const results = await Promise.allSettled(
    handlers.map((handler) => Promise.resolve().then(() => handler(event))),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      log('warn', 'event_bus_handler_failed', {
        eventType: event.type,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

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
  replayBufferIds.clear();
  eventCounter = 0;
}
