import { predictAcceptance, __testing__ } from '../acceptanceGraph';
import prisma from '../../../graphql/prisma_client';

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    decisionLearningCapsule: {
      findMany: jest.fn(),
    },
  },
}));

const EMPLOYER = '11111111-1111-4111-a111-111111111111';

const basePassport = {
  readinessBand: 'L2' as const,
  credentialTypes: ['STATE_BOARD_LICENSE', 'DEA'],
  state: 'CA',
  specialty: 'Family Medicine',
};

describe('predictAcceptance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('short-circuits to BLOCKER when a mandatory credential is missing', async () => {
    const result = await predictAcceptance(
      { ...basePassport, credentialTypes: ['DEA'] },  // no STATE_BOARD_LICENSE
      EMPLOYER,
    );
    expect(result.confidence).toBe('BLOCKER');
    expect(result.acceptanceRate).toBeNull();
    expect(result.reasons[0]).toContain('STATE_BOARD_LICENSE');
    // Should not even touch the DB
    expect(prisma.decisionLearningCapsule.findMany).not.toHaveBeenCalled();
  });

  it('emits HIGH when the same employer accepted ≥70% of identical states', async () => {
    (prisma.decisionLearningCapsule.findMany as jest.Mock).mockImplementation((args) => {
      // Employer-level query
      if (args?.where?.employerId === EMPLOYER) {
        return Promise.resolve([
          { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
          { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
          { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
          { passportSnapshot: basePassport, decisionOutcome: 'ROUTED_MANUAL' },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await predictAcceptance(basePassport, EMPLOYER);
    expect(result.confidence).toBe('HIGH');
    expect(result.acceptanceRate).toBeCloseTo(0.75, 2);
    expect(result.basedOn.employerHistoryCount).toBe(4);
  });

  it('falls back to MEDIUM when only network neighbors have sufficient history', async () => {
    (prisma.decisionLearningCapsule.findMany as jest.Mock).mockImplementation((args) => {
      // Employer history — empty
      if (args?.where?.employerId === EMPLOYER) return Promise.resolve([]);
      // Network history — 6 neighbors, 4 accepted
      return Promise.resolve([
        { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
        { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
        { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
        { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
        { passportSnapshot: basePassport, decisionOutcome: 'ROUTED_MANUAL' },
        { passportSnapshot: basePassport, decisionOutcome: 'REJECTED' },
      ]);
    });

    const result = await predictAcceptance(basePassport, EMPLOYER);
    expect(result.confidence).toBe('MEDIUM');
    expect(result.acceptanceRate).toBeCloseTo(4 / 6, 2);
    expect(result.basedOn.networkNeighborsCount).toBe(6);
  });

  it('ignores unresolved REQUESTED_INFO decisions when computing acceptance history', async () => {
    (prisma.decisionLearningCapsule.findMany as jest.Mock).mockImplementation((args) => {
      if (args?.where?.employerId === EMPLOYER) {
        return Promise.resolve([
          { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
          { passportSnapshot: basePassport, decisionOutcome: 'REQUESTED_INFO' },
          { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
          { passportSnapshot: basePassport, decisionOutcome: 'ROUTED_MANUAL' },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await predictAcceptance(basePassport, EMPLOYER);
    expect(result.confidence).toBe('LOW');
    expect(result.acceptanceRate).toBeCloseTo(2 / 3, 2);
    expect(result.basedOn.employerHistoryCount).toBe(3);
    expect(result.reasons[0]).toMatch(/accepted 2\/3/i);
  });

  it('returns the same prediction regardless of historical row order', async () => {
    const employerHistory = [
      { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
      { passportSnapshot: basePassport, decisionOutcome: 'ROUTED_MANUAL' },
      { passportSnapshot: basePassport, decisionOutcome: 'ACCEPTED_HEAD_START' },
      { passportSnapshot: basePassport, decisionOutcome: 'REQUESTED_INFO' },
    ];
    let employerRequestCount = 0;

    (prisma.decisionLearningCapsule.findMany as jest.Mock).mockImplementation((args) => {
      if (args?.where?.employerId === EMPLOYER) {
        employerRequestCount += 1;
        return Promise.resolve(employerRequestCount === 1 ? employerHistory : [...employerHistory].reverse());
      }
      return Promise.resolve([]);
    });

    const first = await predictAcceptance(basePassport, EMPLOYER);
    const second = await predictAcceptance(basePassport, EMPLOYER);

    expect(second).toEqual(first);
  });

  it('emits LOW with null rate when there is no history anywhere', async () => {
    (prisma.decisionLearningCapsule.findMany as jest.Mock).mockResolvedValue([]);
    const result = await predictAcceptance(basePassport, EMPLOYER);
    expect(result.confidence).toBe('LOW');
    expect(result.acceptanceRate).toBeNull();
    expect(result.reasons[0]).toMatch(/Insufficient/);
  });

  it('surfaces the top gap boost when evidence is strong enough', async () => {
    // 6 network rows, all accepted, all with DEA present — the clinician lacks DEA
    const snap = { ...basePassport, credentialTypes: ['STATE_BOARD_LICENSE', 'DEA'] };
    (prisma.decisionLearningCapsule.findMany as jest.Mock).mockImplementation((args) => {
      if (args?.where?.employerId === EMPLOYER) return Promise.resolve([]);
      return Promise.resolve(Array.from({ length: 6 }, () => ({
        passportSnapshot: snap,
        decisionOutcome: 'ACCEPTED_HEAD_START',
      })));
    });

    const clinicianPassport = { ...basePassport, credentialTypes: ['STATE_BOARD_LICENSE'] };
    const result = await predictAcceptance(clinicianPassport, EMPLOYER);

    // Note: the signature won't match (clinician has {STATE_BOARD_LICENSE}, neighbors
    // have {STATE_BOARD_LICENSE,DEA}), so network sample is 0 → LOW.
    // But gap boosts are computed across ALL network history regardless of signature.
    expect(result.gapBoosts.length).toBeGreaterThan(0);
    expect(result.gapBoosts[0].credential).toBe('DEA');
    expect(result.gapBoosts[0].boostPct).toBe(100);
  });
});

describe('signatureOf (internal)', () => {
  const { signatureOf } = __testing__;

  it('is credential-order invariant', () => {
    const a = signatureOf({ readinessBand: 'L2', credentialTypes: ['A', 'B', 'C'] });
    const b = signatureOf({ readinessBand: 'L2', credentialTypes: ['C', 'A', 'B'] });
    expect(a).toBe(b);
  });

  it('differentiates on band', () => {
    const a = signatureOf({ readinessBand: 'L2', credentialTypes: ['X'] });
    const b = signatureOf({ readinessBand: 'L3', credentialTypes: ['X'] });
    expect(a).not.toBe(b);
  });

  it('treats null/undefined safely', () => {
    expect(__testing__.signatureOf(null)).toBe('EMPTY');
    expect(__testing__.signatureOf(undefined)).toBe('EMPTY');
  });

  it('treats only terminal decision outcomes as resolved learning history', () => {
    expect(__testing__.isResolvedLearningOutcome('ACCEPTED_HEAD_START')).toBe(true);
    expect(__testing__.isResolvedLearningOutcome('ROUTED_MANUAL')).toBe(true);
    expect(__testing__.isResolvedLearningOutcome('REJECTED')).toBe(true);
    expect(__testing__.isResolvedLearningOutcome('REQUESTED_INFO')).toBe(false);
  });
});
