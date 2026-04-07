jest.mock('../../audit/auditLedger', () => ({
  appendAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../identity/leieCache', () => ({
  lookupProvider: jest.fn(),
}));

import { checkExclusion } from '../oigLeieChecker';
import { lookupProvider } from '../../identity/leieCache';

const mockLookupProvider = lookupProvider as jest.MockedFunction<typeof lookupProvider>;

describe('oigLeieChecker', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.OIG_LEIE_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.OIG_LEIE_ENABLED;
  });

  it('fails closed when the LEIE cache is stale', async () => {
    mockLookupProvider.mockResolvedValue({
      npi: '1234567890',
      excluded: false,
      entry: null,
      matchedEntries: [],
      source: 'LEIE_CSV',
      checkedAt: '2026-04-06T12:00:00.000Z',
      cacheAge: 'stale',
      verdict: 'CLEAR',
      matchType: 'NONE',
      matchConfidence: 'HIGH',
      matchScore: 0,
      matchedFields: [],
      dataVersion: '2026-03',
      leieVersionDate: '2026-03-10',
      sourceLatency: 'MONTHLY',
    });

    const result = await checkExclusion({
      firstName: 'Jane',
      lastName: 'Doe',
      npi: '1234567890',
    });

    expect(result.status).toBe('UNCHECKED');
    expect(result.matchType).toBe('UNCHECKED');
    expect(result.cacheAge).toBe('stale');
    expect(result.sourceLatency).toBe('MONTHLY');
    expect(result.details).toContain('stale');
  });

  it('states monthly-batch semantics explicitly for clear results', async () => {
    mockLookupProvider.mockResolvedValue({
      npi: '1234567890',
      excluded: false,
      entry: null,
      matchedEntries: [],
      source: 'LEIE_CSV',
      checkedAt: '2026-04-06T12:00:00.000Z',
      cacheAge: 'fresh',
      verdict: 'CLEAR',
      matchType: 'NONE',
      matchConfidence: 'HIGH',
      matchScore: 0,
      matchedFields: [],
      dataVersion: '2026-03',
      leieVersionDate: '2026-03-10',
      sourceLatency: 'MONTHLY',
    });

    const result = await checkExclusion({
      firstName: 'Jane',
      lastName: 'Doe',
      npi: '1234567890',
    });

    expect(result.status).toBe('CLEAR');
    expect(result.cacheAge).toBe('fresh');
    expect(result.sourceLatency).toBe('MONTHLY');
    expect(result.details).toContain('monthly');
    expect(result.details).toContain('not a real-time clearance feed');
  });
});
