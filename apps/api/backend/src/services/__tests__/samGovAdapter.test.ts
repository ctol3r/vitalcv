import {
  buildSamGovConnectorSnapshot,
  computeSamGovArtifactChecksum,
  isSamGovApiKeyConfigured,
  isSamGovEnabled,
  normalizeSamGovResult,
  querySamGovExclusions,
  SAM_GOV_EXCLUSIONS_API_BASE,
  type SamGovExclusionQuery,
  type SamGovExclusionRecord,
  type SamGovExclusionResult,
} from '../samGovAdapter';
import { sha256ForPayload } from '../../utils/deterministic';

const QUERY = { npi: '1234567890', firstName: 'Jane', lastName: 'Doe' } as const;

const SAMPLE_RECORD: SamGovExclusionRecord = {
  classificationType: 'Individual',
  exclusionType: 'Ineligible (Proceedings Completed)',
  exclusionProgram: 'Reciprocal',
  excludingAgencyCode: 'HHS',
  activeDate: '2024-01-15',
  terminationDate: null,
};

function liveResult(overrides: Partial<SamGovExclusionResult> = {}): SamGovExclusionResult {
  return {
    checkStatus: 'NO_EXCLUSION_RECORDS_FOUND',
    matchType: 'NO_MATCH',
    totalRecords: 0,
    records: [],
    searchedNpi: QUERY.npi,
    searchedName: 'Jane Doe',
    sourceScope: 'SAM_GOV_EXCLUSIONS_API',
    sourceUrl: SAM_GOV_EXCLUSIONS_API_BASE,
    sourceQueriedAt: '2026-07-04T00:00:00.000Z',
    connectorState: 'configured',
    coverageState: 'checked',
    reviewRequired: false,
    ...overrides,
  };
}

describe('samGovAdapter', () => {
  const savedEnabled = process.env.SAM_GOV_ENABLED;
  const savedApiKey = process.env.SAM_GOV_API_KEY;

  beforeEach(() => {
    delete process.env.SAM_GOV_ENABLED;
    delete process.env.SAM_GOV_API_KEY;
  });

  afterAll(() => {
    if (savedEnabled === undefined) delete process.env.SAM_GOV_ENABLED;
    else process.env.SAM_GOV_ENABLED = savedEnabled;
    if (savedApiKey === undefined) delete process.env.SAM_GOV_API_KEY;
    else process.env.SAM_GOV_API_KEY = savedApiKey;
  });

  describe('gating helpers', () => {
    it('is disabled by default and only enabled by the literal "true"', () => {
      expect(isSamGovEnabled()).toBe(false);
      process.env.SAM_GOV_ENABLED = 'false';
      expect(isSamGovEnabled()).toBe(false);
      process.env.SAM_GOV_ENABLED = '1';
      expect(isSamGovEnabled()).toBe(false);
      process.env.SAM_GOV_ENABLED = 'true';
      expect(isSamGovEnabled()).toBe(true);
    });

    it('treats an unset, empty, or whitespace API key as not configured', () => {
      expect(isSamGovApiKeyConfigured()).toBe(false);
      process.env.SAM_GOV_API_KEY = '';
      expect(isSamGovApiKeyConfigured()).toBe(false);
      process.env.SAM_GOV_API_KEY = '   ';
      expect(isSamGovApiKeyConfigured()).toBe(false);
      process.env.SAM_GOV_API_KEY = 'real-key';
      expect(isSamGovApiKeyConfigured()).toBe(true);
    });
  });

  describe('buildSamGovConnectorSnapshot', () => {
    it('reports gated when the flag is off', () => {
      expect(buildSamGovConnectorSnapshot()).toEqual({
        source: 'SAM_GOV',
        enabled: false,
        apiKeyConfigured: false,
        state: 'unavailable',
        coverageState: 'gated',
      });
    });

    it('stays gated when only the API key is present (flag off dominates)', () => {
      process.env.SAM_GOV_API_KEY = 'real-key';
      const snapshot = buildSamGovConnectorSnapshot();
      expect(snapshot.coverageState).toBe('gated');
      expect(snapshot.state).toBe('unavailable');
    });

    it('reports accessRequired when enabled without an API key', () => {
      process.env.SAM_GOV_ENABLED = 'true';
      const snapshot = buildSamGovConnectorSnapshot();
      expect(snapshot.coverageState).toBe('accessRequired');
      expect(snapshot.state).toBe('unavailable');
    });

    it('reports configured + pending when enabled with an API key', () => {
      process.env.SAM_GOV_ENABLED = 'true';
      process.env.SAM_GOV_API_KEY = 'real-key';
      const snapshot = buildSamGovConnectorSnapshot();
      expect(snapshot.state).toBe('configured');
      expect(snapshot.coverageState).toBe('pending');
    });
  });

  describe('querySamGovExclusions — honest stub', () => {
    it('returns EXCLUSION_CHECK_NOT_AVAILABLE by default and never fabricates an outcome', async () => {
      const result = await querySamGovExclusions(QUERY);
      expect(result.checkStatus).toBe('EXCLUSION_CHECK_NOT_AVAILABLE');
      expect(result.matchType).toBe('NOT_ATTEMPTED');
      expect(result.totalRecords).toBe(0);
      expect(result.records).toEqual([]);
      expect(result.coverageState).toBe('gated');
      expect(result.reviewRequired).toBe(false);
      expect(result.searchedNpi).toBe(QUERY.npi);
      expect(result.searchedName).toBe('Jane Doe');
      expect(result.unavailableReason).toContain('SAM_GOV_ENABLED');
    });

    it('does not call a fetcher while the flag is off', async () => {
      const fetcher = jest.fn<Promise<SamGovExclusionResult>, [SamGovExclusionQuery]>();
      const result = await querySamGovExclusions(QUERY, fetcher);
      expect(fetcher).not.toHaveBeenCalled();
      expect(result.checkStatus).toBe('EXCLUSION_CHECK_NOT_AVAILABLE');
      expect(result.coverageState).toBe('gated');
    });

    it('does not call a fetcher when enabled without an API key', async () => {
      process.env.SAM_GOV_ENABLED = 'true';
      const fetcher = jest.fn<Promise<SamGovExclusionResult>, [SamGovExclusionQuery]>();
      const result = await querySamGovExclusions(QUERY, fetcher);
      expect(fetcher).not.toHaveBeenCalled();
      expect(result.coverageState).toBe('accessRequired');
      expect(result.unavailableReason).toContain('SAM_GOV_API_KEY');
    });

    it('stays pending when enabled with a key but no fetcher is wired', async () => {
      process.env.SAM_GOV_ENABLED = 'true';
      process.env.SAM_GOV_API_KEY = 'real-key';
      const result = await querySamGovExclusions(QUERY);
      expect(result.checkStatus).toBe('EXCLUSION_CHECK_NOT_AVAILABLE');
      expect(result.coverageState).toBe('pending');
      expect(result.unavailableReason).toContain('fetcher not wired');
    });

    it('never reports a completed check from any gated combination', async () => {
      const combos: Array<[string | undefined, string | undefined]> = [
        [undefined, undefined],
        ['true', undefined],
        [undefined, 'real-key'],
      ];
      for (const [enabled, key] of combos) {
        delete process.env.SAM_GOV_ENABLED;
        delete process.env.SAM_GOV_API_KEY;
        if (enabled !== undefined) process.env.SAM_GOV_ENABLED = enabled;
        if (key !== undefined) process.env.SAM_GOV_API_KEY = key;
        const result = await querySamGovExclusions(QUERY);
        expect(result.checkStatus).toBe('EXCLUSION_CHECK_NOT_AVAILABLE');
        expect(result.coverageState).not.toBe('checked');
        expect(result.coverageState).not.toBe('reviewRequired');
      }
    });

    it('delegates to the fetcher when enabled with a key', async () => {
      process.env.SAM_GOV_ENABLED = 'true';
      process.env.SAM_GOV_API_KEY = 'real-key';
      const fetcher = jest.fn().mockResolvedValue(liveResult());
      const result = await querySamGovExclusions(QUERY, fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledWith(QUERY);
      expect(result.checkStatus).toBe('NO_EXCLUSION_RECORDS_FOUND');
      expect(result.coverageState).toBe('checked');
      expect(result.matchType).toBe('NO_MATCH');
    });
  });

  describe('normalizeSamGovResult — fail closed', () => {
    it('forces review on found records even when the fetcher under-reports them', () => {
      const dishonest = liveResult({
        checkStatus: 'NO_EXCLUSION_RECORDS_FOUND',
        matchType: 'NO_MATCH',
        totalRecords: 0,
        records: [SAMPLE_RECORD],
        coverageState: 'checked',
        reviewRequired: false,
      });
      const normalized = normalizeSamGovResult(dishonest);
      expect(normalized.checkStatus).toBe('EXCLUSION_RECORDS_FOUND');
      expect(normalized.matchType).toBe('NAME_MATCH');
      expect(normalized.totalRecords).toBe(1);
      expect(normalized.coverageState).toBe('reviewRequired');
      expect(normalized.reviewRequired).toBe(true);
    });

    it('treats a positive totalRecords as records found even with an empty records array', () => {
      const normalized = normalizeSamGovResult(liveResult({ totalRecords: 3 }));
      expect(normalized.checkStatus).toBe('EXCLUSION_RECORDS_FOUND');
      expect(normalized.reviewRequired).toBe(true);
      expect(normalized.coverageState).toBe('reviewRequired');
      expect(normalized.totalRecords).toBe(3);
    });

    it('downgrades an incomplete check that claims checked coverage to unavailable', () => {
      const normalized = normalizeSamGovResult(liveResult({
        checkStatus: 'EXCLUSION_CHECK_NOT_AVAILABLE',
        coverageState: 'checked',
      }));
      expect(normalized.coverageState).toBe('unavailable');
      expect(normalized.matchType).toBe('NOT_ATTEMPTED');
    });

    it('passes an honest clear result through unchanged apart from the match type pin', () => {
      const clear = liveResult({ matchType: 'NAME_MATCH' });
      const normalized = normalizeSamGovResult(clear);
      expect(normalized.checkStatus).toBe('NO_EXCLUSION_RECORDS_FOUND');
      expect(normalized.coverageState).toBe('checked');
      expect(normalized.matchType).toBe('NO_MATCH');
      expect(normalized.reviewRequired).toBe(false);
    });

    it('applies fail-closed normalization to live fetcher results end to end', async () => {
      process.env.SAM_GOV_ENABLED = 'true';
      process.env.SAM_GOV_API_KEY = 'real-key';
      const fetcher = jest.fn().mockResolvedValue(liveResult({
        records: [SAMPLE_RECORD],
        reviewRequired: false,
        coverageState: 'checked',
      }));
      const result = await querySamGovExclusions(QUERY, fetcher);
      expect(result.checkStatus).toBe('EXCLUSION_RECORDS_FOUND');
      expect(result.reviewRequired).toBe(true);
      expect(result.coverageState).toBe('reviewRequired');
    });
  });

  describe('computeSamGovArtifactChecksum', () => {
    it('is deterministic across key ordering and matches sha256ForPayload', () => {
      const a = computeSamGovArtifactChecksum({ npi: QUERY.npi, totalRecords: 0 });
      const b = computeSamGovArtifactChecksum({ totalRecords: 0, npi: QUERY.npi });
      expect(a).toBe(b);
      expect(a).toBe(sha256ForPayload({ npi: QUERY.npi, totalRecords: 0 }));
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different checksums for different payloads', () => {
      const a = computeSamGovArtifactChecksum({ npi: QUERY.npi, totalRecords: 0 });
      const b = computeSamGovArtifactChecksum({ npi: QUERY.npi, totalRecords: 1 });
      expect(a).not.toBe(b);
    });
  });
});
