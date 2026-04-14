jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    learningEvent: { findMany: jest.fn() },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { deriveNextBestAction } from '../nextBestAction';

const prismaMock = prisma as unknown as {
  learningEvent: { findMany: jest.Mock };
};

describe('deriveNextBestAction', () => {
  beforeEach(() => {
    prismaMock.learningEvent.findMany.mockReset();
  });

  it('returns the safe default when no learning rows exist', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([]);
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('REVIEW_MANUALLY');
    expect(nba.evidenceCount).toBe(0);
    expect(nba.confidence).toBe(0);
  });

  it('returns the safe default and logs warn when prisma throws', async () => {
    prismaMock.learningEvent.findMany.mockRejectedValue(new Error('db'));
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('REVIEW_MANUALLY');
  });

  it('escalates when 2+ drift outcomes dominate', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'DRIFT_OCCURRED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'DRIFT_OCCURRED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
    ]);
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('ESCALATE');
    expect(nba.evidenceCount).toBe(3);
    expect(nba.confidence).toBeGreaterThan(0);
  });

  it('reverifies when EMPLOYER_REQUESTED_INFO dominates accepts', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_REQUESTED_INFO', metadata: {} },
      { eventType: 'EMPLOYER_REQUESTED_INFO', metadata: {} },
      { eventType: 'EMPLOYER_REQUESTED_INFO', metadata: {} },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: {} },
    ]);
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('REVERIFY');
  });

  it('proceeds when accepts + activations dominate', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'START_ACTIVATED' } },
      { eventType: 'EMPLOYER_ACCEPTED', metadata: { outcome: 'PENDING' } },
    ]);
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('PROCEED');
    expect(nba.evidenceCount).toBe(3);
  });

  it('falls back to REVIEW_MANUALLY when history is mixed without dominance', async () => {
    prismaMock.learningEvent.findMany.mockResolvedValue([
      { eventType: 'EMPLOYER_ACCEPTED', metadata: {} },
      { eventType: 'EMPLOYER_REJECTED', metadata: {} },
    ]);
    const nba = await deriveNextBestAction('1234567890');
    expect(nba.action).toBe('REVIEW_MANUALLY');
    expect(nba.evidenceCount).toBe(2);
  });

  it('safe default when clinicianNpi is empty', async () => {
    const nba = await deriveNextBestAction('');
    expect(nba.action).toBe('REVIEW_MANUALLY');
    expect(prismaMock.learningEvent.findMany).not.toHaveBeenCalled();
  });
});
