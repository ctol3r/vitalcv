/** @deprecated Use identityIngestionPipeline.handlers.NURSYS for production ingestion. */
import type { ProviderType } from '../types/psv';
import type { NormalizedCredentialPayload, PsvAdapter } from './types';

const NURSYS_ENDPOINT = 'https://api.nursys.com/v1/license/';
const NURSYS_NOTE = 'Nursys E-Notify integration pending';

const ALL_PROVIDER_TYPES: ProviderType[] = ['RN', 'NP', 'CRNA'];

function buildPayload(
  npi: string,
  state: string | undefined,
  licenseNumber: string | undefined,
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
      credentialType: 'License',
      credentialIdentifier: licenseNumber ?? npi,
      issuingStateOrBody: state ?? 'Nursys',
      status: 'Unknown',
    },
    source: {
      sourceName: 'NURSYS',
      sourceType: 'OfficialRegistry',
      sourceEndpoint: NURSYS_ENDPOINT,
      sourceRecognition: 'ContractedAgent',
    },
    retrieval: {
      retrievedAtUtc: new Date().toISOString(),
      retrievalMethod: 'API',
      rawPayload,
    },
  };
}

export const NursysAdapter: PsvAdapter = {
  adapterName: 'NURSYS',
  supportedProviderTypes: ALL_PROVIDER_TYPES,
  supportedCredentialTypes: ['License', 'CompactPrivilege'],

  async verify({ npi, state, licenseNumber }): Promise<NormalizedCredentialPayload> {
    const apiKey = process.env.NURSYS_API_KEY;

    if (!apiKey) {
      return buildPayload(npi, state, licenseNumber, {
        mode: 'stub',
        note: NURSYS_NOTE,
      });
    }

    try {
      const response = await fetch(`${NURSYS_ENDPOINT}${encodeURIComponent(npi)}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return buildPayload(npi, state, licenseNumber, {
          mode: 'live_probe',
          note: NURSYS_NOTE,
          responseStatus: response.status,
        });
      }

      return buildPayload(npi, state, licenseNumber, {
        mode: 'live_probe',
        note: NURSYS_NOTE,
        responseStatus: response.status,
        body: (await response.json()) as unknown,
      });
    } catch (error) {
      return buildPayload(npi, state, licenseNumber, {
        mode: 'live_probe',
        note: NURSYS_NOTE,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
