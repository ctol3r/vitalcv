import { normalizeNpi } from '@vitalcv/ingest';
import {
  NpiRegistryAdapter,
  type CredentialFactBatch,
} from '@vitalcv/psv-adapters';
import { normalizeProvider } from '../../modules/identity/nppes.validator';
import type { NormalizedAddress } from '../../modules/identity/types';
import prisma from '../../graphql/prisma_client';

const npiRegistryAdapter = new NpiRegistryAdapter();

type NppesSourceStatus = 'ACTIVE' | 'DEACTIVATED' | 'NOT_FOUND';

type NpiRegistryIdentityFact = {
  fullName: string;
  enumerationType: string;
  taxonomies: readonly string[];
  practiceStates: readonly string[];
  firstName?: string;
  lastName?: string;
};

export interface NppesProviderRecord {
  npi: string;
  fullName: string;
  providerType: 'INDIVIDUAL' | 'ORGANIZATION';
  npiType: 'TYPE_1' | 'TYPE_2';
  enumerationType: 'NPI-1' | 'NPI-2' | 'UNKNOWN';
  taxonomyCode: string;
  taxonomyDescriptions: readonly string[];
  taxonomyDescription?: string;
  stateOfPractice: string | null;
  practiceStates: readonly string[];
  practiceAddress: NormalizedAddress | null;
  mailingAddress: NormalizedAddress | null;
  otherNames: readonly string[];
  endpoints: readonly string[];
  identifiers: readonly Readonly<{
    code: string;
    identifier: string;
    desc?: string;
    issuer?: string;
    state?: string;
  }>[];
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  credential?: string;
  sourceStatus: NppesSourceStatus;
  retrievedAt: string;
  sourceUrl: string;
  factCount: number;
  rawResponseHash: string;
  rawResponse: unknown;
}

type PersistedNppesProviderRecord = NppesProviderRecord & {
  providerId: string;
};

function extractNpiIdentityFact(batch: CredentialFactBatch): NpiRegistryIdentityFact | null {
  const envelope = batch.facts.find((entry) => entry.fact.factType === 'IdentityClaim');
  if (!envelope) {
    return null;
  }

  const fact = envelope.fact as Record<string, unknown>;
  return {
    fullName: typeof fact.fullName === 'string' ? fact.fullName : '',
    enumerationType:
      typeof fact.enumerationType === 'string' ? fact.enumerationType : 'UNKNOWN',
    taxonomies: Array.isArray(fact.taxonomies)
      ? fact.taxonomies.filter((value): value is string => typeof value === 'string')
      : [],
    practiceStates: Array.isArray(fact.practiceStates)
      ? fact.practiceStates.filter((value): value is string => typeof value === 'string')
      : [],
    ...(typeof fact.firstName === 'string' ? { firstName: fact.firstName } : {}),
    ...(typeof fact.lastName === 'string' ? { lastName: fact.lastName } : {}),
  };
}

function parseRawNpiResponse(rawResponse: unknown): {
  taxonomyCode: string;
  status: NppesSourceStatus;
} {
  if (typeof rawResponse !== 'object' || rawResponse === null || Array.isArray(rawResponse)) {
    return {
      taxonomyCode: 'UNKNOWN',
      status: 'NOT_FOUND',
    };
  }

  const response = rawResponse as Record<string, unknown>;
  const results = Array.isArray(response.results) ? response.results : [];
  const firstResult =
    results.length > 0 && typeof results[0] === 'object' && results[0] !== null
      ? (results[0] as Record<string, unknown>)
      : null;

  const basic =
    firstResult?.basic && typeof firstResult.basic === 'object' && firstResult.basic !== null
      ? (firstResult.basic as Record<string, unknown>)
      : null;
  const taxonomies = Array.isArray(firstResult?.taxonomies) ? firstResult.taxonomies : [];
  const firstTaxonomy =
    taxonomies.length > 0 && typeof taxonomies[0] === 'object' && taxonomies[0] !== null
      ? (taxonomies[0] as Record<string, unknown>)
      : null;

  const status = basic?.status === 'A'
    ? 'ACTIVE'
    : results.length > 0
      ? 'DEACTIVATED'
      : 'NOT_FOUND';

  return {
    taxonomyCode:
      typeof firstTaxonomy?.code === 'string' && firstTaxonomy.code.trim().length > 0
        ? firstTaxonomy.code.trim()
        : 'UNKNOWN',
    status,
  };
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return Object.freeze(
    [...new Set(values.map((value) => value.trim()).filter(Boolean))],
  );
}

function normalizeStateValue(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().toUpperCase()
    : null;
}

function fallbackPracticeStates(rawResponse: unknown): readonly string[] {
  if (typeof rawResponse !== 'object' || rawResponse === null || Array.isArray(rawResponse)) {
    return Object.freeze([]);
  }

  const response = rawResponse as Record<string, unknown>;
  const results = Array.isArray(response.results) ? response.results : [];
  const firstResult =
    results[0] && typeof results[0] === 'object' && results[0] !== null
      ? (results[0] as Record<string, unknown>)
      : null;
  const addresses = Array.isArray(firstResult?.addresses) ? firstResult.addresses : [];

  return dedupeStrings(
    addresses
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        return normalizeStateValue((entry as Record<string, unknown>).state as string | null | undefined);
      })
      .filter((value): value is string => Boolean(value)),
  );
}

export async function fetchNppesProviderRecord(npi: string): Promise<NppesProviderRecord> {
  const normalizedNpi = normalizeNpi(npi);
  const batch = await npiRegistryAdapter.lookupByNpi(normalizedNpi);
  const identityFact = extractNpiIdentityFact(batch);
  const parsed = parseRawNpiResponse(batch.rawResponse);
  const normalizedProvider = parsed.status === 'NOT_FOUND'
    ? null
    : normalizeProvider(batch.rawResponse as Parameters<typeof normalizeProvider>[0]);
  const enumerationType =
    normalizedProvider?.enumeration_type === 'NPI-1' || normalizedProvider?.enumeration_type === 'NPI-2'
      ? normalizedProvider.enumeration_type
      : identityFact?.enumerationType === 'NPI-1' || identityFact?.enumerationType === 'NPI-2'
      ? identityFact.enumerationType
      : 'UNKNOWN';
  const providerType = enumerationType === 'NPI-2' ? 'ORGANIZATION' : 'INDIVIDUAL';
  const npiType = enumerationType === 'NPI-2' ? 'TYPE_2' : 'TYPE_1';
  const practiceStates = dedupeStrings([
    ...(normalizedProvider?.addresses
      .map((address) => normalizeStateValue(address.state))
      .filter((value): value is string => Boolean(value)) ?? []),
    ...(identityFact?.practiceStates
      .map((state) => normalizeStateValue(state))
      .filter((value): value is string => Boolean(value)) ?? []),
    ...fallbackPracticeStates(batch.rawResponse),
  ]);
  const stateOfPractice =
    normalizeStateValue(normalizedProvider?.practice_address?.state)
    ?? practiceStates[0]
    ?? null;
  const fullName =
    normalizedProvider?.display_name && normalizedProvider.display_name.trim().length > 0
      ? normalizedProvider.display_name.trim()
      : identityFact?.fullName && identityFact.fullName.trim().length > 0
        ? identityFact.fullName.trim()
      : `Provider ${normalizedNpi}`;
  const endpoints = dedupeStrings([
    ...(normalizedProvider?.endpoints.map((endpoint) => endpoint.endpoint) ?? []),
    ...((identityFact as Record<string, unknown> | null)?.endpoints as string[] | undefined ?? []),
  ]);
  const otherNames = dedupeStrings([
    ...(normalizedProvider?.other_names.map((entry) => entry.display_name) ?? []),
    ...((identityFact as Record<string, unknown> | null)?.otherNames as string[] | undefined ?? []),
  ]);

  return {
    npi: normalizedNpi,
    fullName,
    providerType,
    npiType,
    enumerationType,
    taxonomyCode: parsed.taxonomyCode,
    taxonomyDescriptions: normalizedProvider?.taxonomies.map((taxonomy) => taxonomy.desc)
      ?? identityFact?.taxonomies
      ?? [],
    ...((normalizedProvider?.primary_taxonomy || identityFact?.taxonomies[0])
      ? { taxonomyDescription: normalizedProvider?.primary_taxonomy ?? identityFact?.taxonomies[0] }
      : {}),
    stateOfPractice,
    practiceStates,
    practiceAddress: normalizedProvider?.practice_address ?? null,
    mailingAddress: normalizedProvider?.mailing_address ?? null,
    otherNames,
    endpoints,
    identifiers: Object.freeze(
      (normalizedProvider?.identifiers ?? []).map((identifier) => Object.freeze({
        code: identifier.code,
        identifier: identifier.identifier,
        ...(identifier.desc ? { desc: identifier.desc } : {}),
        ...(identifier.issuer ? { issuer: identifier.issuer } : {}),
        ...(identifier.state ? { state: identifier.state } : {}),
      })),
    ),
    ...(normalizedProvider?.first_name || identityFact?.firstName
      ? { firstName: normalizedProvider?.first_name || identityFact?.firstName }
      : {}),
    ...(normalizedProvider?.last_name || identityFact?.lastName
      ? { lastName: normalizedProvider?.last_name || identityFact?.lastName }
      : {}),
    ...(normalizedProvider?.organization_name
      ? { organizationName: normalizedProvider.organization_name }
      : {}),
    ...(normalizedProvider?.credential ? { credential: normalizedProvider.credential } : {}),
    sourceStatus: parsed.status,
    retrievedAt: batch.retrievalTime,
    sourceUrl: batch.summary.sourceUrl,
    factCount: batch.summary.factCount,
    rawResponseHash: batch.rawResponseHash,
    rawResponse: batch.rawResponse,
  };
}

export async function persistNppesProviderRecord(
  record: NppesProviderRecord,
): Promise<PersistedNppesProviderRecord> {
  if (record.sourceStatus === 'NOT_FOUND') {
    throw new Error(`NPPES_NOT_FOUND:${record.npi}`);
  }

  const provider = await prisma.provider.upsert({
    where: {
      npi: record.npi,
    },
    create: {
      npi: record.npi,
      fullName: record.fullName,
      providerType: record.providerType,
      taxonomyCode: record.taxonomyCode,
      stateOfPractice: record.stateOfPractice ?? 'UNKNOWN',
    },
    update: {
      fullName: record.fullName,
      providerType: record.providerType,
      taxonomyCode: record.taxonomyCode,
      stateOfPractice: record.stateOfPractice ?? 'UNKNOWN',
    },
    select: {
      id: true,
    },
  });

  return {
    ...record,
    providerId: provider.id,
  };
}

export async function fetchAndPersistNppesProviderRecord(
  npi: string,
): Promise<PersistedNppesProviderRecord> {
  const record = await fetchNppesProviderRecord(npi);
  return persistNppesProviderRecord(record);
}
