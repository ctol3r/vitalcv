import { lookupStateBoard } from '../src/services/providers/connectors/stateBoardConnector';
import type { ProviderType } from '../types/psv';
import type { NormalizedCredentialPayload, PsvAdapter } from './types';

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

function mapLicenseStatus(
  status: string,
): NormalizedCredentialPayload['credential']['status'] {
  switch (status.toLowerCase()) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'suspended':
      return 'Suspended';
    default:
      return 'Unknown';
  }
}

function buildPayload(
  npi: string,
  state: string,
  licenseNumber: string | undefined,
  status: NormalizedCredentialPayload['credential']['status'],
  rawPayload: unknown,
  sourceEndpoint: string | undefined,
  fullName: string,
  issuingStateOrBody: string,
  expirationDate?: string,
): NormalizedCredentialPayload {
  return {
    provider: {
      npi,
      taxonomyCode: '',
      providerType: 'Other',
      fullName,
      stateOfPractice: state,
    },
    credential: {
      credentialType: 'License',
      credentialIdentifier: licenseNumber ?? npi,
      issuingStateOrBody,
      status,
      expirationDate,
    },
    source: {
      sourceName: `STATE_BOARD_${state}`,
      sourceType: 'OfficialRegistry',
      sourceEndpoint,
      sourceRecognition: 'PrimarySource',
    },
    retrieval: {
      retrievedAtUtc: new Date().toISOString(),
      retrievalMethod: 'DirectQuery',
      rawPayload,
    },
  };
}

export const StateBoardAdapter: PsvAdapter = {
  adapterName: 'STATE_BOARD',
  supportedProviderTypes: ALL_PROVIDER_TYPES,
  supportedCredentialTypes: ['License'],

  async verify({ npi, state, licenseNumber }): Promise<NormalizedCredentialPayload> {
    const normalizedState = (state ?? 'CA').toUpperCase();

    try {
      const result = await lookupStateBoard(
        npi,
        normalizedState,
        licenseNumber ?? 'live',
      );

      return buildPayload(
        npi,
        normalizedState,
        result.licenseNumber ?? licenseNumber,
        mapLicenseStatus(result.licenseStatus),
        result,
        result.sourceUrl || undefined,
        result.licensee ?? '',
        result.boardName,
        result.expirationDate ?? undefined,
      );
    } catch (error) {
      return buildPayload(
        npi,
        normalizedState,
        licenseNumber,
        'Unknown',
        {
          mode: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
        undefined,
        '',
        `${normalizedState} State Board`,
      );
    }
  },
};
