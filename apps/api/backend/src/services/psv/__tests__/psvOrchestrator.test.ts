jest.mock('../oigLeieChecker', () => ({
  checkExclusion: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { AdapterRegistry } from '../../../../adapters/AdapterRegistry';
import { NursysAdapter } from '../../../../adapters/NursysAdapter';
import { OigLeieAdapter } from '../../../../adapters/OigLeieAdapter';
import type { NormalizedCredentialPayload, PsvAdapter } from '../../../../adapters/types';
import { checkExclusion } from '../oigLeieChecker';
import { PsvOrchestrator } from '../PsvOrchestrator';
import { PsvVerificationCache } from '../PsvVerificationCache';

const checkExclusionMock = checkExclusion as jest.MockedFunction<typeof checkExclusion>;

const ORIGINAL_NURSYS_API_KEY = process.env.NURSYS_API_KEY;
const ORIGINAL_OIG_LEIE_ENABLED = process.env.OIG_LEIE_ENABLED;

function buildPayload(params: {
  npi?: string;
  credentialType?: NormalizedCredentialPayload['credential']['credentialType'];
  credentialStatus?: NormalizedCredentialPayload['credential']['status'];
  sourceName?: string;
}): NormalizedCredentialPayload {
  const npi = params.npi ?? '1234567890';
  const credentialType = params.credentialType ?? 'License';
  const credentialStatus = params.credentialStatus ?? 'Active';
  const sourceName = params.sourceName ?? 'NPPES';

  return {
    provider: {
      npi,
      taxonomyCode: '',
      providerType: 'Other',
      fullName: 'Test Provider',
      stateOfPractice: 'CA',
    },
    credential: {
      credentialType,
      credentialIdentifier: npi,
      issuingStateOrBody: 'Test Board',
      status: credentialStatus,
    },
    source: {
      sourceName,
      sourceType: 'API',
      sourceRecognition: 'PrimarySource',
    },
    retrieval: {
      retrievedAtUtc: '2026-01-01T00:00:00.000Z',
      retrievalMethod: 'API',
      rawPayload: { sourceName },
    },
  };
}

function registerAdapters(...adapters: PsvAdapter[]): AdapterRegistry {
  const registry = new AdapterRegistry();
  for (const adapter of adapters) {
    registry.register(adapter);
  }
  return registry;
}

describe('PSV orchestrator stack', () => {
  beforeEach(() => {
    checkExclusionMock.mockReset();
    delete process.env.NURSYS_API_KEY;
    delete process.env.OIG_LEIE_ENABLED;
  });

  afterAll(() => {
    process.env.NURSYS_API_KEY = ORIGINAL_NURSYS_API_KEY;
    process.env.OIG_LEIE_ENABLED = ORIGINAL_OIG_LEIE_ENABLED;
  });

  it('PsvVerificationCache set/get returns entry', () => {
    const cache = new PsvVerificationCache();
    const key = '1234567890:NPPES:License';
    const entry = cache.createEntry({
      npi: '1234567890',
      source: 'NPPES',
      credentialType: 'License',
      payload: buildPayload({}),
    });

    cache.set(key, entry);

    expect(cache.get(key)).toEqual(entry);
  });

  it('PsvVerificationCache expired entry returns null', () => {
    const cache = new PsvVerificationCache();
    const key = '1234567890:NPPES:License';

    cache.set(key, {
      npi: '1234567890',
      source: 'NPPES',
      credentialType: 'License',
      payload: buildPayload({}),
      fetchedAt: '2025-01-01T00:00:00.000Z',
      expiresAt: '2025-01-02T00:00:00.000Z',
    });

    expect(cache.get(key)).toBeNull();
  });

  it('PsvVerificationCache invalidate purges all NPI entries', () => {
    const cache = new PsvVerificationCache();

    cache.set(
      '1234567890:NPPES:License',
      cache.createEntry({
        npi: '1234567890',
        source: 'NPPES',
        credentialType: 'License',
        payload: buildPayload({}),
      }),
    );
    cache.set(
      '1234567890:STATE_BOARD:License',
      cache.createEntry({
        npi: '1234567890',
        source: 'STATE_BOARD',
        credentialType: 'License',
        payload: buildPayload({ sourceName: 'STATE_BOARD_CA' }),
      }),
    );
    cache.set(
      '9999999999:NPPES:License',
      cache.createEntry({
        npi: '9999999999',
        source: 'NPPES',
        credentialType: 'License',
        payload: buildPayload({ npi: '9999999999' }),
      }),
    );

    expect(cache.invalidate('1234567890')).toBe(2);
    expect(cache.get('1234567890:NPPES:License')).toBeNull();
    expect(cache.get('1234567890:STATE_BOARD:License')).toBeNull();
    expect(cache.get('9999999999:NPPES:License')).not.toBeNull();
  });

  it('OigLeieAdapter maps NONE matchType to Active status', async () => {
    checkExclusionMock.mockResolvedValue({
      excluded: false,
      matchType: 'NONE',
      status: 'CLEAR',
      details: 'No match',
      checkedAt: '2026-01-01T00:00:00.000Z',
      source: 'OIG_LEIE',
    });

    const payload = await OigLeieAdapter.verify({ npi: '1234567890' });

    expect(checkExclusionMock).toHaveBeenCalledWith({
      npi: '1234567890',
      firstName: '',
      lastName: '',
    });
    expect(payload.credential.status).toBe('Active');
  });

  it('NursysAdapter stub mode never throws and returns Unknown', async () => {
    const payload = await NursysAdapter.verify({ npi: '1234567890' });

    expect(payload.credential.status).toBe('Unknown');
    expect(payload.retrieval.rawPayload).toMatchObject({
      mode: 'stub',
      note: 'Nursys E-Notify integration pending',
    });
  });

  it('PsvOrchestrator cache hit skips adapter verify() call', async () => {
    const verify = jest.fn(async () => buildPayload({}));
    const adapter: PsvAdapter = {
      adapterName: 'NPPES',
      supportedProviderTypes: ['Other'],
      supportedCredentialTypes: ['License'],
      verify,
    };
    const cache = new PsvVerificationCache();
    const registry = registerAdapters(adapter);
    const orchestrator = new PsvOrchestrator(registry, cache);

    cache.set(
      '1234567890:NPPES:License',
      cache.createEntry({
        npi: '1234567890',
        source: 'NPPES',
        credentialType: 'License',
        payload: buildPayload({}),
      }),
    );

    const response = await orchestrator.verify({
      npi: '1234567890',
      credentialType: 'License',
    });

    expect(verify).not.toHaveBeenCalled();
    expect(response.sources[0]?.status).toBe('cached');
  });

  it("PsvOrchestrator one adapter rejection doesn't block others", async () => {
    const failingAdapter: PsvAdapter = {
      adapterName: 'NPPES',
      supportedProviderTypes: ['Other'],
      supportedCredentialTypes: ['License'],
      verify: jest.fn(async () => {
        throw new Error('nppes failed');
      }),
    };
    const successfulAdapter: PsvAdapter = {
      adapterName: 'STATE_BOARD',
      supportedProviderTypes: ['Other'],
      supportedCredentialTypes: ['License'],
      verify: jest.fn(async () =>
        buildPayload({ sourceName: 'STATE_BOARD_CA' }),
      ),
    };

    const orchestrator = new PsvOrchestrator(
      registerAdapters(failingAdapter, successfulAdapter),
      new PsvVerificationCache(),
    );

    const response = await orchestrator.verify({
      npi: '1234567890',
      credentialType: 'License',
    });

    expect(response.sources).toHaveLength(2);
    expect(response.sources.some((source) => source.status === 'error')).toBe(true);
    expect(response.sources.some((source) => source.status === 'verified')).toBe(true);
    expect(response.overallStatus).toBe('PARTIAL');
  });

  it('PsvOrchestrator exclusionClear=false when OIG returns non-NONE matchType', async () => {
    checkExclusionMock.mockResolvedValue({
      excluded: true,
      matchType: 'NAME_MATCH',
      status: 'EXCLUDED',
      details: 'Potential match',
      checkedAt: '2026-01-01T00:00:00.000Z',
      source: 'OIG_LEIE',
    });

    const orchestrator = new PsvOrchestrator(
      registerAdapters(OigLeieAdapter),
      new PsvVerificationCache(),
    );

    const response = await orchestrator.verify({
      npi: '1234567890',
      credentialType: 'Registration',
    });

    expect(response.exclusionClear).toBe(false);
    expect(response.sources[0]?.status).toBe('unverified');
  });
});
