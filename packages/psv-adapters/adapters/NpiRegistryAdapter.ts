import { normalizeNpi } from '@vitalcv/ingest';

import {
  assertFactsAllowedByPolicy,
  getSourcePolicy,
} from '../policies/SourcePolicy';
import {
  createJsonHttpTransport,
  type AdapterRequestContext,
  type AdapterDescriptor,
  type IdentityLookupAdapter,
  type JsonHttpTransport,
} from '../core/AdapterInterface';
import {
  buildDeterministicId,
  createCredentialFactBatch,
  createFactEnvelope,
  type CredentialFactBatch,
  type CredentialFactEnvelope,
  type IdentityClaimFact,
} from '../core/CredentialFactMapper';
import {
  createEvidencePointer,
  createProvenanceMetadata,
  hashRawResponse,
  hashSensitiveInput,
} from '../core/ProvenanceTracker';
import {
  buildCredentialFactIngestedEvents,
  buildTrustSignalRaisedEvent,
} from '../events/CredentialFactEvents';

export type NpiRegistryAdapterOptions = Readonly<{
  baseUrl?: string;
  transport?: JsonHttpTransport;
  version?: string;
}>;

export type NpiLookupByNameStateInput = Readonly<{
  name: string;
  state: string;
}>;

type NpiRegistryResponse = Readonly<{
  result_count?: number;
  results?: ReadonlyArray<Record<string, unknown>>;
}>;

const DEFAULT_BASE_URL = 'https://npiregistry.cms.hhs.gov/api/';
const DEFAULT_VERSION = '1.0.0';

function normalizeState(state: string): string {
  const normalized = state.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error('state must be a two-letter abbreviation');
  }
  return normalized;
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((entry) => entry.length > 0);

  if (parts.length < 2) {
    throw new Error('name must include at least first and last name');
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function freezeBatchWithEvents(
  batch: CredentialFactBatch,
  events: CredentialFactBatch['events'],
): CredentialFactBatch {
  return Object.freeze({
    ...batch,
    events: Object.freeze([...events]),
  });
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export class NpiRegistryAdapter implements IdentityLookupAdapter {
  public readonly descriptor: AdapterDescriptor;
  private readonly baseUrl: string;
  private readonly transport: JsonHttpTransport;

  constructor(options: NpiRegistryAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.transport = options.transport ?? createJsonHttpTransport();
    this.descriptor = Object.freeze({
      sourceId: 'npi-registry',
      displayName: 'CMS NPI Registry',
      sourceMode: 'PUBLIC_API',
      version: options.version ?? DEFAULT_VERSION,
      operational: true,
      supportsPolling: false,
      supportsWebhook: false,
      supportsEnrollment: false,
    });
  }

  async lookupByNpi(npi: string, context?: AdapterRequestContext): Promise<CredentialFactBatch> {
    const normalizedNpi = normalizeNpi(npi);
    const url = new URL(this.baseUrl);
    url.searchParams.set('version', '2.1');
    url.searchParams.set('number', normalizedNpi);

    const response = await this.transport.execute(
      {
        key: `${this.descriptor.sourceId}:lookupByNpi:${normalizedNpi}`,
        url: url.toString(),
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      context,
    );

    return this.toBatch({
      response: response.body,
      sourceUrl: url.toString(),
      queryKind: 'lookupByNpi',
      subjectId: normalizedNpi,
      queryHash: hashSensitiveInput({ npi: normalizedNpi }),
    });
  }

  async lookupByNameState(
    name: string,
    state: string,
    context?: AdapterRequestContext,
  ): Promise<CredentialFactBatch> {
    const { firstName, lastName } = splitName(name);
    const normalizedState = normalizeState(state);
    const url = new URL(this.baseUrl);
    url.searchParams.set('version', '2.1');
    url.searchParams.set('first_name', firstName);
    url.searchParams.set('last_name', lastName);
    url.searchParams.set('state', normalizedState);

    const response = await this.transport.execute(
      {
        key: `${this.descriptor.sourceId}:lookupByNameState:${normalizedState}:${lastName}`,
        url: url.toString(),
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
      },
      context,
    );

    return this.toBatch({
      response: response.body,
      sourceUrl: url.toString(),
      queryKind: 'lookupByNameState',
      subjectId: `${normalizedState}:${lastName.toUpperCase()}`,
      queryHash: hashSensitiveInput({
        firstName,
        lastName,
        state: normalizedState,
      }),
    });
  }

  private toBatch(input: {
    response: unknown;
    sourceUrl: string;
    queryKind: 'lookupByNpi' | 'lookupByNameState';
    subjectId: string;
    queryHash: string;
  }): CredentialFactBatch {
    const retrievalTime = new Date().toISOString();
    const policy = getSourcePolicy(this.descriptor.sourceId);
    const rawResponseHash = hashRawResponse(input.response);
    const evidencePointer = createEvidencePointer({
      source: this.descriptor.sourceId,
      retrievalTime,
      rawResponseHash,
      subjectId: input.subjectId,
    });
    const provenance = createProvenanceMetadata({
      source: this.descriptor.sourceId,
      retrievalTime,
      retrievalMethod: 'api',
      rawResponse: input.response,
      subjectId: input.subjectId,
      endpoint: input.sourceUrl,
      sourceRecordId: input.queryKind === 'lookupByNpi' ? input.subjectId : undefined,
    });
    const body = input.response as NpiRegistryResponse;
    const results = Array.isArray(body.results) ? body.results : [];

    if (results.length === 0) {
      const envelopes = this.createCommonEnvelopes({
        subjectId: input.subjectId,
        retrievalTime,
        provenance,
        evidencePointer,
        rawResponseHash,
        sourceUrl: input.sourceUrl,
      });

      assertFactsAllowedByPolicy(
        this.descriptor.sourceId,
        envelopes.map((entry) => entry.fact.factType),
      );

      return createCredentialFactBatch({
        subjectId: input.subjectId,
        source: this.descriptor.sourceId,
        sourceMode: this.descriptor.sourceMode,
        adapterVersion: this.descriptor.version,
        retrievalTime,
        queryKind: input.queryKind,
        queryHash: input.queryHash,
        rawResponse: input.response,
        rawResponseHash,
        evidencePointer,
        facts: envelopes,
        summary: {
          status: 'NOT_FOUND',
          sourceUrl: input.sourceUrl,
          factCount: envelopes.length,
        },
      });
    }

    const primary = results[0];
    if (!primary || typeof primary !== 'object' || Array.isArray(primary)) {
      const envelopes = this.createCommonEnvelopes({
        subjectId: input.subjectId,
        retrievalTime,
        provenance,
        evidencePointer,
        rawResponseHash,
        sourceUrl: input.sourceUrl,
      });

      return createCredentialFactBatch({
        subjectId: input.subjectId,
        source: this.descriptor.sourceId,
        sourceMode: this.descriptor.sourceMode,
        adapterVersion: this.descriptor.version,
        retrievalTime,
        queryKind: input.queryKind,
        queryHash: input.queryHash,
        rawResponse: input.response,
        rawResponseHash,
        evidencePointer,
        facts: envelopes,
        summary: {
          status: 'ERROR',
          sourceUrl: input.sourceUrl,
          factCount: envelopes.length,
        },
      });
    }

    const npi = String(primary.number ?? primary?.['number'] ?? input.subjectId);
    const basic =
      primary.basic && typeof primary.basic === 'object'
        ? (primary.basic as Record<string, unknown>)
        : {};
    const enumerationType = String(primary.enumeration_type ?? 'UNKNOWN');
    const firstName = typeof basic.first_name === 'string' ? basic.first_name.trim() : '';
    const lastName = typeof basic.last_name === 'string' ? basic.last_name.trim() : '';
    const organizationName =
      typeof basic.organization_name === 'string' ? basic.organization_name.trim() : '';
    const fullName =
      organizationName ||
      [firstName, lastName].filter((entry) => entry.length > 0).join(' ') ||
      npi;
    const taxonomyEntries: readonly unknown[] = Array.isArray(primary.taxonomies)
      ? primary.taxonomies
      : [];
    const addressEntries: readonly unknown[] = Array.isArray(primary.addresses)
      ? primary.addresses
      : [];
    const practiceLocationEntries: readonly unknown[] = Array.isArray(primary.practiceLocations)
      ? primary.practiceLocations
      : [];
    const endpointEntries: readonly unknown[] = Array.isArray(primary.endpoints)
      ? primary.endpoints
      : [];
    const otherNamesEntries: readonly unknown[] = Array.isArray(primary.other_names)
      ? primary.other_names
      : [];

    const otherNames: readonly string[] = Object.freeze(
      otherNamesEntries
        .map((entry: unknown) => {
          if (!entry || typeof entry !== 'object') return null;
          const record = entry as Record<string, unknown>;
          return typeof record.organization_name === 'string'
            ? record.organization_name.trim()
            : [record.first_name, record.last_name]
                .filter((part) => typeof part === 'string' && part.trim().length > 0)
                .join(' ') || null;
        })
        .filter((entry: string | null): entry is string => Boolean(entry))
    );

    const endpoints: readonly string[] = Object.freeze(
      endpointEntries
        .map((entry: unknown) => {
          if (!entry || typeof entry !== 'object') return null;
          const record = entry as Record<string, unknown>;
          return stringField(record.endpoint)
            ?? stringField(record.endpointUrl)
            ?? stringField(record.url);
        })
        .filter((entry: string | null): entry is string => Boolean(entry))
    );

    const taxonomies: readonly string[] = Object.freeze([
      ...new Set(
        taxonomyEntries
          .map((entry: unknown) => {
            if (!entry || typeof entry !== 'object') {
              return null;
            }
            const record = entry as Record<string, unknown>;
            return typeof record.desc === 'string'
              ? record.desc.trim()
              : typeof record.code === 'string'
                ? record.code.trim()
                : null;
          })
          .filter((entry: string | null): entry is string => Boolean(entry)),
      ),
    ]);
    const practiceStates: readonly string[] = Object.freeze([
      ...new Set(
        [...addressEntries, ...practiceLocationEntries]
          .map((entry: unknown) => {
            if (!entry || typeof entry !== 'object') {
              return null;
            }
            const value = (entry as Record<string, unknown>).state;
            return typeof value === 'string' ? value.trim().toUpperCase() : null;
          })
          .filter((entry: string | null): entry is string => Boolean(entry)),
      ),
    ]);
    const practiceLocations: readonly string[] = Object.freeze(
      [...addressEntries, ...practiceLocationEntries]
        .map((entry: unknown) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const record = entry as Record<string, unknown>;
          const address1 = stringField(record.address_1);
          const city = stringField(record.city);
          const state = stringField(record.state)?.toUpperCase();
          const postalCode = stringField(record.postal_code);
          const location = [address1, city, state, postalCode].filter(Boolean).join(', ');
          return location || null;
        })
        .filter((entry: string | null): entry is string => Boolean(entry)),
    );

    const identityFact: IdentityClaimFact = Object.freeze({
      factId: buildDeterministicId('identity_claim', {
        source: this.descriptor.sourceId,
        npi,
        fullName,
      }),
      factType: 'IdentityClaim',
      subjectId: npi,
      source: this.descriptor.sourceId,
      observedAt: retrievalTime,
      npi,
      fullName,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(organizationName ? { organizationName } : {}),
      ...(otherNames.length > 0 ? { otherNames } : {}),
      ...(endpoints.length > 0 ? { endpoints } : {}),
      ...(practiceLocations.length > 0 ? { practiceLocations } : {}),
      enumerationType,
      taxonomies,
      practiceStates,
    });

    const envelopes = [
      createFactEnvelope({
        fact: identityFact,
        provenance,
        policy: {
          sourcePolicyId: policy.id,
          retentionDays: policy.retentionDays.facts,
          allowedConsumers: policy.allowedConsumers,
        },
      }),
      ...this.createCommonEnvelopes({
        subjectId: npi,
        retrievalTime,
        provenance,
        evidencePointer,
        rawResponseHash,
        sourceUrl: input.sourceUrl,
      }),
    ];

    assertFactsAllowedByPolicy(
      this.descriptor.sourceId,
      envelopes.map((entry) => entry.fact.factType),
    );

    const status = basic.status === 'A' ? 'ACTIVE' : 'PENDING';
    const baseBatch = createCredentialFactBatch({
      subjectId: npi,
      source: this.descriptor.sourceId,
      sourceMode: this.descriptor.sourceMode,
      adapterVersion: this.descriptor.version,
      retrievalTime,
      queryKind: input.queryKind,
      queryHash: input.queryHash,
      rawResponse: input.response,
      rawResponseHash,
      evidencePointer,
      facts: envelopes,
      summary: {
        status,
        sourceUrl: input.sourceUrl,
        factCount: envelopes.length,
      },
    });

    return freezeBatchWithEvents(baseBatch, [
      ...buildCredentialFactIngestedEvents(baseBatch, envelopes),
      buildTrustSignalRaisedEvent({
        batch: baseBatch,
        signal: 'identity_bootstrapped',
        status,
      }),
    ]);
  }

  private createCommonEnvelopes(input: {
    subjectId: string;
    retrievalTime: string;
    provenance: ReturnType<typeof createProvenanceMetadata>;
    evidencePointer: string;
    rawResponseHash: string;
    sourceUrl: string;
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

    return Object.freeze([
      createFactEnvelope({
        fact: evidenceFact,
        provenance: input.provenance,
        policy: {
          sourcePolicyId: policy.id,
          retentionDays: policy.retentionDays.facts,
          allowedConsumers: policy.allowedConsumers,
        },
      }),
      createFactEnvelope({
        fact: provenanceFact,
        provenance: input.provenance,
        policy: {
          sourcePolicyId: policy.id,
          retentionDays: policy.retentionDays.facts,
          allowedConsumers: policy.allowedConsumers,
        },
      }),
    ]);
  }
}
