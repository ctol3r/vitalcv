jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import {
  lookupProvider,
  resetLeieCacheForTests,
} from '../leieCache';

describe('leieCache lookupProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetLeieCacheForTests();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-24T12:00:00.000Z'));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        'last-modified': 'Mon, 16 Mar 2026 00:00:00 GMT',
      }),
      text: async () => [
        'LASTNAME,FIRSTNAME,MIDNAME,BUSNAME,SPECIALTY,NPI,STATE,EXCLTYPE,EXCLDATE,REINDATE,WVRSTATE',
        'DOE,JANE,A,,INTERNAL MEDICINE,1234567890,CA,EXCLUSION,2024-01-01,,',
        'DOE,JANE,, ,HOSPITALIST,,CA,EXCLUSION,2024-02-01,,',
        'DOE,JANET,, ,FAMILY MEDICINE,,TX,EXCLUSION,2024-03-01,,',
      ].join('\n'),
    }) as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    resetLeieCacheForTests();
  });

  it('returns EXCLUDED for an exact NPI hit', async () => {
    const result = await lookupProvider({
      npi: '1234567890',
      firstName: 'Jane',
      middleName: 'A',
      lastName: 'Doe',
      state: 'CA',
      specialty: 'Internal Medicine',
    });

    expect(result.verdict).toBe('EXCLUDED');
    expect(result.matchType).toBe('EXACT');
    expect(result.matchConfidence).toBe('HIGH');
    expect(result.matchedFields).toEqual(['npi']);
  });

  it('returns HIGH confidence for a name+state+specialty exact possible match', async () => {
    const result = await lookupProvider({
      npi: '',
      firstName: 'Jane',
      middleName: 'A',
      lastName: 'Doe',
      state: 'CA',
      specialty: 'Internal Medicine',
    });

    expect(result.verdict).toBe('POSSIBLE_MATCH');
    expect(result.matchType).toBe('STRONG_FUZZY');
    expect(result.matchConfidence).toBe('HIGH');
    expect(result.matchedFields).toEqual(
      expect.arrayContaining(['last_name', 'first_name', 'middle_name', 'state', 'specialty']),
    );
  });

  it('returns MEDIUM confidence for a specialty-family match in the same state', async () => {
    const result = await lookupProvider({
      npi: '',
      firstName: 'Jane',
      lastName: 'Doe',
      state: 'CA',
      specialty: 'Internal Medicine',
    });

    expect(result.verdict).toBe('POSSIBLE_MATCH');
    expect(result.matchType).toBe('STRONG_FUZZY');
    expect(result.matchConfidence).toBe('MEDIUM');
    expect(result.matchedFields).toEqual(
      expect.arrayContaining(['last_name', 'first_name', 'state', 'specialty']),
    );
  });

  it('returns LOW confidence for a partial-name candidate', async () => {
    const result = await lookupProvider({
      npi: '',
      firstName: 'Jan',
      lastName: 'Doe',
      state: 'TX',
      specialty: 'Family Medicine',
    });

    expect(result.verdict).toBe('POSSIBLE_MATCH');
    expect(result.matchType).toBe('WEAK');
    expect(result.matchConfidence).toBe('LOW');
    expect(result.matchedFields).toEqual(
      expect.arrayContaining(['last_name', 'partial_name']),
    );
  });

  it('returns CLEAR when state and specialty do not align', async () => {
    const result = await lookupProvider({
      npi: '',
      firstName: 'Jane',
      lastName: 'Doe',
      state: 'NY',
      specialty: 'Dermatology',
    });

    expect(result.verdict).toBe('CLEAR');
    expect(result.matchType).toBe('NONE');
    expect(result.matchConfidence).toBe('HIGH');
  });

  it('does not allow a fuzzy possible-match to override a conflicting explicit NPI', async () => {
    const result = await lookupProvider({
      npi: '9999999999',
      firstName: 'Jane',
      middleName: 'A',
      lastName: 'Doe',
      state: 'CA',
      specialty: 'Internal Medicine',
    });

    expect(result.verdict).toBe('POSSIBLE_MATCH');
    expect(result.matchType).toBe('FUZZY_NAME_STATE');
    expect(result.matchConfidence).toBe('MEDIUM');
  });

  it('marks the cache stale when a refresh failure occurs after an initial successful load', async () => {
    await lookupProvider({
      npi: '1234567890',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as typeof fetch;
    jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    await lookupProvider({
      npi: '1234567890',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    await Promise.resolve();

    const result = await lookupProvider({
      npi: '1234567890',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(result.cacheAge).toBe('stale');
    expect(result.verdict).toBe('EXCLUDED');
    expect(result.matchType).toBe('EXACT');
  });
});
