import { normalizeNpi } from '@vitalcv/ingest';
import {
  NpiRegistryAdapter,
  type CredentialFactBatch,
} from '@vitalcv/psv-adapters';
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
  firstName?: string;
  lastName?: string;
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

export async function fetchNppesProviderRecord(npi: string): Promise<NppesProviderRecord> {
  const normalizedNpi = normalizeNpi(npi);
  const batch = await npiRegistryAdapter.lookupByNpi(normalizedNpi);
  const identityFact = extractNpiIdentityFact(batch);
  const parsed = parseRawNpiResponse(batch.rawResponse);
  const enumerationType =
    identityFact?.enumerationType === 'NPI-1' || identityFact?.enumerationType === 'NPI-2'
      ? identityFact.enumerationType
      : 'UNKNOWN';
  const providerType = enumerationType === 'NPI-2' ? 'ORGANIZATION' : 'INDIVIDUAL';
  const npiType = enumerationType === 'NPI-2' ? 'TYPE_2' : 'TYPE_1';
  const practiceStates = identityFact?.practiceStates ?? [];
  const stateOfPractice = practiceStates[0]?.trim().toUpperCase() ?? null;
  const fullName =
    identityFact?.fullName && identityFact.fullName.trim().length > 0
      ? identityFact.fullName.trim()
      : `Provider ${normalizedNpi}`;

  return {
    npi: normalizedNpi,
    fullName,
    providerType,
    npiType,
    enumerationType,
    taxonomyCode: parsed.taxonomyCode,
    taxonomyDescriptions: identityFact?.taxonomies ?? [],
    ...(identityFact?.taxonomies[0] ? { taxonomyDescription: identityFact.taxonomies[0] } : {}),
    stateOfPractice,
    practiceStates,
    ...(identityFact?.firstName ? { firstName: identityFact.firstName } : {}),
    ...(identityFact?.lastName ? { lastName: identityFact.lastName } : {}),
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
