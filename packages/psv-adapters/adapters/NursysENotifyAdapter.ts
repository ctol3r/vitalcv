import { normalizeNpi } from '@vitalcv/ingest';

import {
  assertFactsAllowedByPolicy,
  getSourcePolicy,
} from '../policies/SourcePolicy';
import {
  InMemoryMonitoringSubscriptionState,
  buildReplayKey,
  type MonitoringSubscriptionState,
} from '../core/MonitoringSubscription';
import {
  buildDeterministicId,
  createCredentialFactBatch,
  createFactEnvelope,
  type CredentialFactBatch,
  type CredentialFactEnvelope,
  type LicenseFact,
  type MonitoringSubscriptionFact,
} from '../core/CredentialFactMapper';
import {
  createEvidencePointer,
  createProvenanceMetadata,
  hashRawResponse,
  hashSensitiveInput,
} from '../core/ProvenanceTracker';
import {
  createJsonHttpTransport,
  type AdapterDescriptor,
  type AdapterRequestContext,
  type JsonHttpTransport,
  type MonitoringSourceAdapter,
} from '../core/AdapterInterface';
import {
  buildCredentialFactIngestedEvents,
  buildMonitoringSubscriptionChangedEvent,
  buildTrustSignalRaisedEvent,
  type CredentialFactEvent,
  type DisciplineAddedEvent,
  type LicenseExpiredEvent,
  type LicenseUpdatedEvent,
} from '../events/CredentialFactEvents';

export type NursysENotifyAdapterOptions = Readonly<{
  baseUrl?: string;
  apiKey?: string;
  institutionId?: string;
  pollPath?: string;
  transport?: JsonHttpTransport;
  subscriptionState?: MonitoringSubscriptionState;
  version?: string;
}>;

export type NursysEnrollInput = Readonly<{
  npi: string;
  institutionId?: string;
  deliveryMethod: 'POLLING' | 'WEBHOOK';
  webhookTarget?: string;
  cursor?: string;
}>;

export type NursysPollInput = Readonly<{
  npi: string;
  subscriptionId?: string;
  cursor?: string;
}>;

export type NursysWebhookInput = Readonly<{
  subscriptionId: string;
  payload: unknown;
}>;

type NormalizedNursysEvent = Readonly<{
  eventId: string;
  npi: string;
  licenseNumber: string;
  state: string;
  licenseStatus: string;
  eventType: 'LICENSE_UPDATED' | 'LICENSE_EXPIRED' | 'DISCIPLINE_ADDED';
  discipline: readonly string[];
  expiresAt?: string;
  occurredAt: string;
  rawEvent: Record<string, unknown>;
}>;

const DEFAULT_BASE_URL = 'https://api.nursys.com';
const DEFAULT_POLL_PATH = '/api/v1/license-status';
const DEFAULT_VERSION = '1.0.0';

function freezeBatchWithEvents(
  batch: CredentialFactBatch,
  events: readonly CredentialFactEvent[],
): CredentialFactBatch {
  return Object.freeze({
    ...batch,
    events: Object.freeze([...events]),
  });
}

function toLicenseEvents(batch: CredentialFactBatch, fact: LicenseFact): readonly CredentialFactEvent[] {
  if (fact.status === 'EXPIRED') {
    const event: LicenseExpiredEvent = Object.freeze({
      eventId: buildDeterministicId('license_expired', {
        batchId: batch.batchId,
        license: fact.licenseNumber,
      }),
      eventType: 'LicenseExpired',
      subjectId: batch.subjectId,
      source: batch.source,
      occurredAt: batch.retrievalTime,
      batchId: batch.batchId,
      licenseNumber: fact.licenseNumber,
      jurisdiction: fact.jurisdiction,
      ...(fact.expiresAt ? { expiresAt: fact.expiresAt } : {}),
    });
    return Object.freeze([event]);
  }

  if (fact.discipline.length > 0) {
    const updated: LicenseUpdatedEvent = Object.freeze({
      eventId: buildDeterministicId('license_updated', {
        batchId: batch.batchId,
        license: fact.licenseNumber,
      }),
      eventType: 'LicenseUpdated',
      subjectId: batch.subjectId,
      source: batch.source,
      occurredAt: batch.retrievalTime,
      batchId: batch.batchId,
      licenseNumber: fact.licenseNumber,
      jurisdiction: fact.jurisdiction,
      status: fact.status,
    });
    const discipline: DisciplineAddedEvent = Object.freeze({
      eventId: buildDeterministicId('discipline_added', {
        batchId: batch.batchId,
        license: fact.licenseNumber,
        discipline: fact.discipline,
      }),
      eventType: 'DisciplineAdded',
      subjectId: batch.subjectId,
      source: batch.source,
      occurredAt: batch.retrievalTime,
      batchId: batch.batchId,
      licenseNumber: fact.licenseNumber,
      jurisdiction: fact.jurisdiction,
      discipline: fact.discipline,
    });
    return Object.freeze([updated, discipline]);
  }

  const event: LicenseUpdatedEvent = Object.freeze({
    eventId: buildDeterministicId('license_updated', {
      batchId: batch.batchId,
      license: fact.licenseNumber,
      status: fact.status,
    }),
    eventType: 'LicenseUpdated',
    subjectId: batch.subjectId,
    source: batch.source,
    occurredAt: batch.retrievalTime,
    batchId: batch.batchId,
    licenseNumber: fact.licenseNumber,
    jurisdiction: fact.jurisdiction,
    status: fact.status,
  });
  return Object.freeze([event]);
}

function normalizeLicenseStatus(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (['ACTIVE', 'CLEAR', 'CURRENT'].includes(normalized)) {
    return 'ACTIVE';
  }
  if (['EXPIRED', 'INACTIVE', 'LAPSED'].includes(normalized)) {
    return 'EXPIRED';
  }
  return normalized || 'UNKNOWN';
}

function normalizeDiscipline(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return Object.freeze(
      value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
        .filter((entry): entry is string => Boolean(entry)),
    );
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return Object.freeze([value.trim()]);
  }

  return Object.freeze([]);
}

function normalizeNursysEvent(rawEvent: Record<string, unknown>): NormalizedNursysEvent {
  const npi = normalizeNpi(String(rawEvent.npi ?? ''));
  const licenseNumber = String(
    rawEvent.licenseNumber ?? rawEvent.license_number ?? rawEvent.license ?? '',
  ).trim();
  const state = String(rawEvent.state ?? rawEvent.jurisdiction ?? '').trim().toUpperCase();

  if (!licenseNumber || !state) {
    throw new Error('Nursys event is missing licenseNumber or state');
  }

  const discipline = normalizeDiscipline(rawEvent.discipline);
  const licenseStatus = normalizeLicenseStatus(rawEvent.licenseStatus ?? rawEvent.status);
  const expiresAtCandidate = rawEvent.expirationDate ?? rawEvent.expiresAt ?? rawEvent.expires_at;
  const expiresAt =
    typeof expiresAtCandidate === 'string' && expiresAtCandidate.trim().length > 0
      ? expiresAtCandidate.trim()
      : undefined;
  const occurredAtCandidate =
    rawEvent.eventTimestamp ?? rawEvent.receivedAt ?? rawEvent.updatedAt ?? new Date().toISOString();
  const occurredAt =
    typeof occurredAtCandidate === 'string' && occurredAtCandidate.trim().length > 0
      ? occurredAtCandidate.trim()
      : new Date().toISOString();

  const requestedEventType = String(rawEvent.eventType ?? rawEvent.type ?? '').trim().toUpperCase();
  const eventType: NormalizedNursysEvent['eventType'] =
    requestedEventType === 'DISCIPLINE_ADDED' || discipline.length > 0
      ? 'DISCIPLINE_ADDED'
      : requestedEventType === 'LICENSE_EXPIRED' || licenseStatus === 'EXPIRED'
        ? 'LICENSE_EXPIRED'
        : 'LICENSE_UPDATED';
  const eventId = String(rawEvent.eventId ?? rawEvent.id ?? buildReplayKey(rawEvent));

  return Object.freeze({
    eventId,
    npi,
    licenseNumber,
    state,
    licenseStatus,
    eventType,
    discipline,
    ...(expiresAt ? { expiresAt } : {}),
    occurredAt,
    rawEvent,
  });
}

export class NursysENotifyAdapter implements MonitoringSourceAdapter {
  public readonly descriptor: AdapterDescriptor;
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly institutionId?: string;
  private readonly pollPath: string;
  private readonly transport: JsonHttpTransport;
  private readonly subscriptionState: MonitoringSubscriptionState;

  constructor(options: NursysENotifyAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = options.apiKey;
    this.institutionId = options.institutionId;
    this.pollPath = options.pollPath ?? DEFAULT_POLL_PATH;
    this.transport = options.transport ?? createJsonHttpTransport();
    this.subscriptionState = options.subscriptionState ?? new InMemoryMonitoringSubscriptionState();

    this.descriptor = Object.freeze({
      sourceId: 'nursys-enotify',
      displayName: 'Nursys e-Notify',
      sourceMode: 'LICENSED_API',
      version: options.version ?? DEFAULT_VERSION,
      operational: Boolean(options.transport || (this.baseUrl && this.apiKey)),
      supportsPolling: true,
      supportsWebhook: true,
      supportsEnrollment: true,
    });
  }

  async enrollMonitoring(
    input: Record<string, unknown>,
    _context?: AdapterRequestContext,
  ): Promise<CredentialFactBatch> {
    const normalized = input as NursysEnrollInput;
    const npi = normalizeNpi(normalized.npi);
    const institutionId = normalized.institutionId ?? this.institutionId;
    if (!institutionId) {
      throw new Error('institutionId is required for Nursys enrollment');
    }

    const retrievalTime = new Date().toISOString();
    const policy = getSourcePolicy(this.descriptor.sourceId);
    const subscription = this.subscriptionState.register({
      source: this.descriptor.sourceId,
      monitoredSubject: npi,
      institutionId,
      status: 'ACTIVE',
      deliveryMethod: normalized.deliveryMethod,
      ...(normalized.cursor ? { cursor: normalized.cursor } : {}),
      ...(normalized.webhookTarget ? { webhookTarget: normalized.webhookTarget } : {}),
      createdAt: retrievalTime,
      updatedAt: retrievalTime,
    });
    const rawResponse = {
      subscription,
    };
    const rawResponseHash = hashRawResponse(rawResponse);
    const evidencePointer = createEvidencePointer({
      source: this.descriptor.sourceId,
      retrievalTime,
      rawResponseHash,
      subjectId: npi,
    });
    const provenance = createProvenanceMetadata({
      source: this.descriptor.sourceId,
      retrievalTime,
      retrievalMethod: 'portal',
      rawResponse,
      subjectId: npi,
      endpoint: `${this.baseUrl}/enrollment`,
      sourceRecordId: subscription.subscriptionId,
    });

    const subscriptionFact: MonitoringSubscriptionFact = Object.freeze({
      factId: buildDeterministicId('monitoring_subscription', {
        source: this.descriptor.sourceId,
        subscriptionId: subscription.subscriptionId,
      }),
      factType: 'MonitoringSubscription',
      subjectId: npi,
      source: this.descriptor.sourceId,
      observedAt: retrievalTime,
      subscriptionId: subscription.subscriptionId,
      monitoredSubject: npi,
      status: subscription.status,
      deliveryMethod: subscription.deliveryMethod,
      ...(subscription.cursor ? { cursor: subscription.cursor } : {}),
      ...(subscription.webhookTarget ? { webhookTarget: subscription.webhookTarget } : {}),
      institutionId: subscription.institutionId,
    });

    const envelopes = this.createCommonEnvelopes({
      subjectId: npi,
      retrievalTime,
      sourceUrl: `${this.baseUrl}/enrollment`,
      rawResponseHash,
      evidencePointer,
      provenance,
      additionalFacts: [subscriptionFact],
    });

    assertFactsAllowedByPolicy(
      this.descriptor.sourceId,
      envelopes.map((entry) => entry.fact.factType),
    );

    const baseBatch = createCredentialFactBatch({
      subjectId: npi,
      source: this.descriptor.sourceId,
      sourceMode: this.descriptor.sourceMode,
      adapterVersion: this.descriptor.version,
      retrievalTime,
      queryKind: 'enrollMonitoring',
      queryHash: hashSensitiveInput({
        npi,
        institutionId,
        deliveryMethod: normalized.deliveryMethod,
      }),
      rawResponse,
      rawResponseHash,
      evidencePointer,
      facts: envelopes,
      summary: {
        status: 'ACTIVE',
        sourceUrl: `${this.baseUrl}/enrollment`,
        factCount: envelopes.length,
        monitoringEnabled: true,
      },
    });

    return freezeBatchWithEvents(baseBatch, [
      ...buildCredentialFactIngestedEvents(baseBatch, envelopes),
      buildMonitoringSubscriptionChangedEvent({
        batch: baseBatch,
        subscriptionId: subscription.subscriptionId,
        status: subscription.status,
      }),
      buildTrustSignalRaisedEvent({
        batch: baseBatch,
        signal: 'continuous_monitoring_enabled',
        status: 'ACTIVE',
      }),
    ]);
  }

  async pollUpdates(
    input: Record<string, unknown>,
    context?: AdapterRequestContext,
  ): Promise<CredentialFactBatch> {
    if (!this.descriptor.operational) {
      throw new Error('Nursys adapter is not operational');
    }

    const normalized = input as NursysPollInput;
    const npi = normalizeNpi(normalized.npi);
    const existingSubscription = normalized.subscriptionId
      ? this.subscriptionState.get(normalized.subscriptionId)
      : null;
    const subscription = existingSubscription ?? this.ensurePollingSubscription(npi);

    const url = new URL(this.pollPath, this.baseUrl);
    url.searchParams.set('npi', npi);
    if (normalized.cursor ?? subscription.cursor) {
      url.searchParams.set('cursor', normalized.cursor ?? subscription.cursor ?? '');
    }

    const response = await this.transport.execute(
      {
        key: `${this.descriptor.sourceId}:poll:${npi}`,
        url: url.toString(),
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
      },
      context,
    );

    return this.batchFromFeed({
      subscriptionId: subscription.subscriptionId,
      subjectId: npi,
      retrievalMethod: 'polling',
      sourceUrl: url.toString(),
      responseBody: response.body,
      queryKind: 'pollUpdates',
      queryHash: hashSensitiveInput({
        npi,
        cursor: normalized.cursor ?? subscription.cursor ?? null,
      }),
      updateCursor: true,
    });
  }

  async ingestWebhook(
    input: Record<string, unknown>,
    _context?: AdapterRequestContext,
  ): Promise<CredentialFactBatch> {
    const normalized = input as NursysWebhookInput;
    const subscription = this.subscriptionState.get(normalized.subscriptionId);
    if (!subscription) {
      throw new Error(`Unknown Nursys subscription ${normalized.subscriptionId}`);
    }

    return this.batchFromFeed({
      subscriptionId: normalized.subscriptionId,
      subjectId: subscription.monitoredSubject,
      retrievalMethod: 'webhook',
      sourceUrl: `${this.baseUrl}/webhooks/nursys`,
      responseBody: normalized.payload,
      queryKind: 'ingestWebhook',
      queryHash: hashSensitiveInput({
        subscriptionId: normalized.subscriptionId,
        payload: normalized.payload,
      }),
      updateCursor: false,
    });
  }

  private ensurePollingSubscription(npi: string) {
    const institutionId = this.institutionId;
    if (!institutionId) {
      throw new Error('institutionId is required to poll Nursys updates');
    }

    return this.subscriptionState.register({
      source: this.descriptor.sourceId,
      monitoredSubject: npi,
      institutionId,
      status: 'ACTIVE',
      deliveryMethod: 'POLLING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  private batchFromFeed(input: {
    subscriptionId: string;
    subjectId: string;
    retrievalMethod: 'polling' | 'webhook';
    sourceUrl: string;
    responseBody: unknown;
    queryKind: 'pollUpdates' | 'ingestWebhook';
    queryHash: string;
    updateCursor: boolean;
  }): CredentialFactBatch {
    const retrievalTime = new Date().toISOString();
    const rawResponseHash = hashRawResponse(input.responseBody);
    const evidencePointer = createEvidencePointer({
      source: this.descriptor.sourceId,
      retrievalTime,
      rawResponseHash,
      subjectId: input.subjectId,
    });
    const provenance = createProvenanceMetadata({
      source: this.descriptor.sourceId,
      retrievalTime,
      retrievalMethod: input.retrievalMethod,
      rawResponse: input.responseBody,
      subjectId: input.subjectId,
      endpoint: input.sourceUrl,
      sourceRecordId: input.subscriptionId,
    });

    const eventsRaw = this.extractEvents(input.responseBody);
    const normalizedEvents = eventsRaw.map((entry) => normalizeNursysEvent(entry));
    const subscription = this.subscriptionState.get(input.subscriptionId);
    if (!subscription) {
      throw new Error(`Unknown Nursys subscription ${input.subscriptionId}`);
    }

    const newReplayEvents = normalizedEvents.filter((event) => {
      const replayKey = buildReplayKey({
        subscriptionId: input.subscriptionId,
        eventId: event.eventId,
        eventType: event.eventType,
      });

      if (this.subscriptionState.hasReplayKey(input.subscriptionId, replayKey)) {
        return false;
      }

      this.subscriptionState.markReplayKey(input.subscriptionId, replayKey);
      return true;
    });

    if (input.updateCursor) {
      const nextCursor = this.extractNextCursor(input.responseBody) ?? subscription.cursor;
      if (nextCursor) {
        this.subscriptionState.advanceCursor(input.subscriptionId, nextCursor, retrievalTime);
      }
    }

    const licenseFacts = newReplayEvents.map((event) => this.toLicenseFact(event, retrievalTime));
    const monitoringFact: MonitoringSubscriptionFact = Object.freeze({
      factId: buildDeterministicId('monitoring_subscription', {
        source: this.descriptor.sourceId,
        subscriptionId: subscription.subscriptionId,
      }),
      factType: 'MonitoringSubscription',
      subjectId: subscription.monitoredSubject,
      source: this.descriptor.sourceId,
      observedAt: retrievalTime,
      subscriptionId: subscription.subscriptionId,
      monitoredSubject: subscription.monitoredSubject,
      status: subscription.status,
      deliveryMethod: subscription.deliveryMethod,
      ...(subscription.cursor ? { cursor: subscription.cursor } : {}),
      ...(subscription.webhookTarget ? { webhookTarget: subscription.webhookTarget } : {}),
      institutionId: subscription.institutionId,
    });

    const envelopes = this.createCommonEnvelopes({
      subjectId: input.subjectId,
      retrievalTime,
      sourceUrl: input.sourceUrl,
      rawResponseHash,
      evidencePointer,
      provenance,
      additionalFacts: [monitoringFact, ...licenseFacts],
    });

    assertFactsAllowedByPolicy(
      this.descriptor.sourceId,
      envelopes.map((entry) => entry.fact.factType),
    );

    const primaryLicense = licenseFacts[0];
    const summaryStatus =
      primaryLicense?.status === 'EXPIRED'
        ? 'EXPIRED'
        : licenseFacts.length > 0
          ? 'ACTIVE'
          : 'PENDING';
    const baseBatch = createCredentialFactBatch({
      subjectId: input.subjectId,
      source: this.descriptor.sourceId,
      sourceMode: this.descriptor.sourceMode,
      adapterVersion: this.descriptor.version,
      retrievalTime,
      queryKind: input.queryKind,
      queryHash: input.queryHash,
      rawResponse: input.responseBody,
      rawResponseHash,
      evidencePointer,
      facts: envelopes,
      summary: {
        status: summaryStatus,
        sourceUrl: input.sourceUrl,
        factCount: envelopes.length,
        ...(primaryLicense ? { licenseNumber: primaryLicense.licenseNumber } : {}),
        ...(primaryLicense ? { state: primaryLicense.jurisdiction } : {}),
        ...(primaryLicense?.expiresAt ? { expiresAt: primaryLicense.expiresAt } : {}),
        monitoringEnabled: true,
      },
    });

    const deltaEvents = newReplayEvents.flatMap((event, index) =>
      licenseFacts[index] ? toLicenseEvents(baseBatch, licenseFacts[index]) : [],
    );
    const signal =
      primaryLicense?.status === 'EXPIRED'
        ? 'license_expired'
        : primaryLicense
          ? 'license_updated'
          : 'license_no_delta';

    return freezeBatchWithEvents(baseBatch, [
      ...buildCredentialFactIngestedEvents(baseBatch, envelopes),
      ...deltaEvents,
      buildTrustSignalRaisedEvent({
        batch: baseBatch,
        signal,
        status: summaryStatus,
      }),
    ]);
  }

  private createCommonEnvelopes(input: {
    subjectId: string;
    retrievalTime: string;
    sourceUrl: string;
    rawResponseHash: string;
    evidencePointer: string;
    provenance: ReturnType<typeof createProvenanceMetadata>;
    additionalFacts: readonly (MonitoringSubscriptionFact | LicenseFact)[];
  }): readonly CredentialFactEnvelope[] {
    const policy = getSourcePolicy(this.descriptor.sourceId);
    const evidenceFact = Object.freeze({
      factId: buildDeterministicId('evidence_artifact', {
        source: this.descriptor.sourceId,
        rawResponseHash: input.rawResponseHash,
      }),
      factType: 'EvidenceArtifact',
      subjectId: input.subjectId,
      source: this.descriptor.sourceId,
      observedAt: input.retrievalTime,
      artifactType: 'RAW_RESPONSE',
      mimeType: 'application/json',
      location: input.evidencePointer,
      contentHash: input.rawResponseHash,
      redacted: false,
    } as const);
    const provenanceFact = Object.freeze({
      factId: buildDeterministicId('source_provenance', {
        source: this.descriptor.sourceId,
        endpoint: input.sourceUrl,
        rawResponseHash: input.rawResponseHash,
      }),
      factType: 'SourceProvenance',
      subjectId: input.subjectId,
      source: this.descriptor.sourceId,
      observedAt: input.retrievalTime,
      ...(input.provenance.source_record_id
        ? { sourceRecordId: input.provenance.source_record_id }
        : {}),
      endpoint: input.sourceUrl,
      sourceDisplayName: this.descriptor.displayName,
      sourceMode: this.descriptor.sourceMode,
      retrievalMethod: input.provenance.retrieval_method,
    } as const);

    const allFacts = [evidenceFact, provenanceFact, ...input.additionalFacts];
    return Object.freeze(
      allFacts.map((fact) =>
        createFactEnvelope({
          fact,
          provenance: input.provenance,
          policy: {
            sourcePolicyId: policy.id,
            retentionDays: policy.retentionDays.facts,
            allowedConsumers: policy.allowedConsumers,
          },
        }),
      ),
    );
  }

  private toLicenseFact(event: NormalizedNursysEvent, retrievalTime: string): LicenseFact {
    return Object.freeze({
      factId: buildDeterministicId('license_fact', {
        source: this.descriptor.sourceId,
        licenseNumber: event.licenseNumber,
        state: event.state,
        eventType: event.eventType,
      }),
      factType: 'License',
      subjectId: event.npi,
      source: this.descriptor.sourceId,
      observedAt: retrievalTime,
      ...(event.expiresAt ? { expiresAt: event.expiresAt } : {}),
      licenseNumber: event.licenseNumber,
      licenseNumberLast4: event.licenseNumber.slice(-4),
      jurisdiction: event.state,
      status: event.licenseStatus,
      issuingBody: 'Nursys',
      discipline: event.discipline,
    });
  }

  private extractEvents(responseBody: unknown): readonly Record<string, unknown>[] {
    if (!responseBody || typeof responseBody !== 'object') {
      throw new Error('Nursys response must be an object');
    }

    const record = responseBody as Record<string, unknown>;
    if (Array.isArray(record.events)) {
      return record.events.filter(
        (entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'),
      );
    }

    if (Array.isArray(record.data)) {
      return record.data.filter(
        (entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'),
      );
    }

    if (record.event && typeof record.event === 'object') {
      return [record.event as Record<string, unknown>];
    }

    if (record.licenseNumber || record.license_number) {
      return [record];
    }

    return [];
  }

  private extractNextCursor(responseBody: unknown): string | undefined {
    if (!responseBody || typeof responseBody !== 'object') {
      return undefined;
    }

    const value = (responseBody as Record<string, unknown>).nextCursor;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
  }
}
