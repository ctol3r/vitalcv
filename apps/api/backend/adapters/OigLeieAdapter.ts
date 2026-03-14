import { checkExclusion } from '../src/services/psv/oigLeieChecker';
import type { ProviderType } from '../types/psv';
import type { NormalizedCredentialPayload, PsvAdapter } from './types';

const OIG_ENDPOINT = 'https://oig.hhs.gov/exclusions/search.asp';

const ALL_PROVIDER_TYPES: ProviderType[] = [
  'NP',
  'RN',
  'MD',
  'DO',
  'PA',
  'CRNA',
  'Psychologist',
  'Dentist',
  'PT',
  'OT',
  'Pharmacist',
  'Other',
];

function buildPayload(
  npi: string,
  status: NormalizedCredentialPayload['credential']['status'],
  rawPayload: unknown,
): NormalizedCredentialPayload {
  return {
    provider: {
      npi,
      taxonomyCode: '',
      providerType: 'Other',
      fullName: '',
      stateOfPractice: '',
    },
    credential: {
      credentialType: 'Registration',
      credentialIdentifier: npi,
      issuingStateOrBody: 'OIG LEIE',
      status,
    },
    source: {
      sourceName: 'OIG_LEIE',
      sourceType: 'OfficialRegistry',
      sourceEndpoint: OIG_ENDPOINT,
      sourceRecognition: 'PrimarySource',
    },
    retrieval: {
      retrievedAtUtc: new Date().toISOString(),
      retrievalMethod: 'API',
      rawPayload,
    },
  };
}

export const OigLeieAdapter: PsvAdapter = {
  adapterName: 'OIG_LEIE',
  supportedProviderTypes: ALL_PROVIDER_TYPES,
  supportedCredentialTypes: ['Registration'],

  async verify({ npi }): Promise<NormalizedCredentialPayload> {
    try {
      const result = await checkExclusion({
        npi,
        firstName: '',
        lastName: '',
      });

      return buildPayload(
        npi,
        result.matchType === 'NONE' ? 'Active' : 'Suspended',
        {
          ...result,
          mode: process.env.OIG_LEIE_ENABLED === 'true' ? 'live' : 'stub',
        },
      );
    } catch (error) {
      return buildPayload(npi, 'Unknown', {
        mode: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
