import type { ProviderType } from '../types/psv';
import type { NormalizedCredentialPayload, PsvAdapter } from './types';

const DEA_HELP_URL = 'https://www.deadiversion.usdoj.gov/';
const NPPES_ENDPOINT = 'https://npiregistry.cms.hhs.gov/api/?version=2.1&number=';
const DEA_NOTE = `DEA verification requires manual confirmation via ${DEA_HELP_URL}`;

const ALL_PROVIDER_TYPES: ProviderType[] = [
  'MD',
  'DO',
  'NP',
  'PA',
  'CRNA',
  'Dentist',
];

interface NppesOtherProviderIdentifier {
  identifier?: string;
  provider_identifier?: string;
  identifier_type_code?: string;
}

interface NppesLookupResult {
  other_provider_identifiers?: NppesOtherProviderIdentifier[];
}

interface NppesLookupResponse {
  results?: NppesLookupResult[];
}

function findDeaNumber(payload: NppesLookupResponse): string | null {
  const identifiers = payload.results?.[0]?.other_provider_identifiers ?? [];

  for (const identifier of identifiers) {
    if (identifier.identifier_type_code === '01') {
      const value = identifier.identifier ?? identifier.provider_identifier ?? null;
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function buildPayload(
  npi: string,
  state: string | undefined,
  credentialIdentifier: string,
  status: NormalizedCredentialPayload['credential']['status'],
  rawPayload: unknown,
): NormalizedCredentialPayload {
  return {
    provider: {
      npi,
      taxonomyCode: '',
      providerType: 'Other',
      fullName: '',
      stateOfPractice: state ?? '',
    },
    credential: {
      credentialType: 'DEA',
      credentialIdentifier,
      issuingStateOrBody: 'DEA',
      status,
    },
    source: {
      sourceName: 'DEA',
      sourceType: 'OfficialRegistry',
      sourceEndpoint:
        process.env.DEA_LOOKUP_ENABLED === 'true'
          ? 'https://npiregistry.cms.hhs.gov/api/?version=2.1'
          : DEA_HELP_URL,
      sourceRecognition: 'PrimarySource',
    },
    retrieval: {
      retrievedAtUtc: new Date().toISOString(),
      retrievalMethod: 'API',
      rawPayload,
    },
  };
}

export const DeaAdapter: PsvAdapter = {
  adapterName: 'DEA',
  supportedProviderTypes: ALL_PROVIDER_TYPES,
  supportedCredentialTypes: ['DEA'],

  async verify({ npi, state, licenseNumber }): Promise<NormalizedCredentialPayload> {
    const fallbackIdentifier = licenseNumber ?? npi;

    if (process.env.DEA_LOOKUP_ENABLED !== 'true') {
      return buildPayload(npi, state, fallbackIdentifier, 'Unknown', {
        mode: 'stub',
        note: DEA_NOTE,
      });
    }

    try {
      const response = await fetch(`${NPPES_ENDPOINT}${encodeURIComponent(npi)}`, {
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return buildPayload(npi, state, fallbackIdentifier, 'Unknown', {
          mode: 'live_probe',
          note: DEA_NOTE,
          responseStatus: response.status,
        });
      }

      const body = (await response.json()) as NppesLookupResponse;
      const deaNumber = findDeaNumber(body);

      if (deaNumber) {
        return buildPayload(npi, state, deaNumber, 'Active', {
          mode: 'live_probe',
          note: 'DEA registration inferred from NPPES other_provider_identifiers',
          body,
        });
      }

      return buildPayload(npi, state, fallbackIdentifier, 'Unknown', {
        mode: 'live_probe',
        note: DEA_NOTE,
        body,
      });
    } catch (error) {
      return buildPayload(npi, state, fallbackIdentifier, 'Unknown', {
        mode: 'live_probe',
        note: DEA_NOTE,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
