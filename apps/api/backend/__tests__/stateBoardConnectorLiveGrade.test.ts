/**
 * stateBoardConnectorLiveGrade.test.ts — the connector must never stamp
 * decisionGrade:true over a degraded live adapter result.
 *
 * Before this wave the live branch unconditionally rewrote
 * decisionGrade:true / degradationReason:null onto whatever the liveLookup
 * returned, which would have graded parser failures and outages as
 * decision-grade the moment a live adapter existed.
 */

const mockCaLiveLookup = jest.fn();

jest.mock('../src/services/providers/connectors/caBreezeLiveLookup', () => ({
  __esModule: true,
  CA_BREEZE_SEARCH_URL: 'https://search.dca.ca.gov/results',
  createCaBreezeLiveLookup: () => mockCaLiveLookup,
}));

jest.mock('../src/services/providers/providerSourceProvenance', () => ({
  __esModule: true,
  recordProvenance: jest.fn(),
}));

import {
  lookupStateBoard,
  type StateBoardResult,
} from '../src/services/providers/connectors/stateBoardConnector';

function liveResult(overrides: Partial<StateBoardResult>): StateBoardResult {
  return {
    npi: '1003000126',
    state: 'CA',
    licenseNumber: null,
    licenseStatus: 'NOT_AVAILABLE',
    licensee: null,
    expirationDate: null,
    boardName: 'Medical Board of California',
    lastVerifiedAt: new Date().toISOString(),
    sourceUrl: 'https://search.dca.ca.gov/results',
    sourceMode: 'live',
    decisionGrade: false,
    degradationReason: null,
    sourceDisclaimer: null,
    ...overrides,
  };
}

describe('lookupStateBoard live-mode decision grading', () => {
  const originalMode = process.env.STATE_BOARD_MODE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STATE_BOARD_MODE = 'live';
  });

  afterAll(() => {
    if (originalMode === undefined) {
      delete process.env.STATE_BOARD_MODE;
    } else {
      process.env.STATE_BOARD_MODE = originalMode;
    }
  });

  test('a degraded live result stays non-decision-grade with its degradation reason intact', async () => {
    mockCaLiveLookup.mockResolvedValue(
      liveResult({
        degradationReason: 'PARSER_FAILURE',
        sourceDisclaimer: 'DCA BreEZe returned a page the parser does not recognize.',
      }),
    );

    const result = await lookupStateBoard('1003000126', 'CA');

    expect(result.sourceMode).toBe('live');
    expect(result.decisionGrade).toBe(false);
    expect(result.degradationReason).toBe('PARSER_FAILURE');
  });

  test('a NOT_AVAILABLE live result (no-match cascade) is never decision-grade', async () => {
    mockCaLiveLookup.mockResolvedValue(liveResult({ licenseStatus: 'NOT_AVAILABLE' }));

    const result = await lookupStateBoard('1003000126', 'CA');

    expect(result.decisionGrade).toBe(false);
    expect(result.licenseStatus).toBe('NOT_AVAILABLE');
  });

  test('a definitive live result is decision-grade', async () => {
    mockCaLiveLookup.mockResolvedValue(
      liveResult({
        licenseStatus: 'ACTIVE',
        licenseNumber: 'A123456',
        licensee: 'SARAH CHEN',
        decisionGrade: true,
      }),
    );

    const result = await lookupStateBoard('1003000126', 'CA');

    expect(result.decisionGrade).toBe(true);
    expect(result.licenseStatus).toBe('ACTIVE');
    expect(result.degradationReason).toBeNull();
  });
});
