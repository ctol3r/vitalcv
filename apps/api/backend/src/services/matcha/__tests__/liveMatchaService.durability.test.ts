/**
 * C6 — the live MATCHA path's durability and isolation invariants.
 *
 * Kept as a permanent regression test rather than a throwaway probe: without
 * it, "this path is DB-backed, never the in-memory registry" and "every
 * returned opportunity declares durability" are protected only by comments.
 * A future edit that reintroduces a fallback, or drops the durable stamp,
 * fails here instead of shipping quietly.
 */
const findMany = jest.fn();
const findUnique = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    opportunity: { findMany: (...a: unknown[]) => findMany(...a), findUnique: (...a: unknown[]) => findUnique(...a) },
    candidateCredential: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

import { getLiveMatchesForNpi, scoreOpportunityForNpi } from '../liveMatchaService';

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  title: 'Locums Hospitalist',
  specialty: 'Internal Medicine',
  hiringType: 'locums',
  state: 'CA',
  payRange: '$200/hr',
  payMin: 200,
  payMax: 300,
  employerType: 'hospital',
  startUrgency: 'immediate',
  requirementLevel: 'L1',
  description: null,
  remote: false,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  listingSource: 'employer_posted',
  sourceFeed: null,
  sourceRef: null,
  sourceUrl: null,
  fetchedAt: null,
  organization: { id: '22222222-2222-4222-8222-222222222222', name: 'Bay General' },
};

beforeEach(() => {
  jest.clearAllMocks();
  // NPPES unreachable -> exercises the narrowed-parse catch path.
  global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
});

it('stamps DB-backed opportunities durable + status', async () => {
  findMany.mockResolvedValue([ROW]);
  const result = await getLiveMatchesForNpi('1003000126');

  expect(result.opportunitySource).toBe('database');
  expect(result.matches).toHaveLength(1);
  const m = result.matches[0];
  expect(m.durable).toBe(true);
  expect(m.status).toBe('ACTIVE');
  expect(m.opportunity.durable).toBe(true);
  expect(m.opportunity.status).toBe('ACTIVE');
  // backwards compatibility: pre-existing fields still present & unchanged
  expect(m.opportunity.active).toBe(true);
  expect(m.opportunityId).toBe(ROW.id);
  expect(typeof m.score).toBe('number');
  expect(Array.isArray(m.blockers)).toBe(true);
});

it('queries only ACTIVE rows from the Opportunity table', async () => {
  findMany.mockResolvedValue([]);
  const result = await getLiveMatchesForNpi('1003000126');
  expect(findMany).toHaveBeenCalledTimes(1);
  expect(findMany.mock.calls[0][0].where.status).toBe('ACTIVE');
  // No registry fallback: empty DB => empty feed, never phantom roles.
  expect(result.matches).toEqual([]);
});

it('propagates DB failure instead of falling back to the in-memory registry', async () => {
  findMany.mockRejectedValue(new Error('db down'));
  await expect(getLiveMatchesForNpi('1003000126')).rejects.toThrow('db down');
});

it('returns null for a non-uuid opportunityId without hitting the driver', async () => {
  const r = await scoreOpportunityForNpi('1003000126', 'not-a-uuid');
  expect(r).toBeNull();
  expect(findUnique).not.toHaveBeenCalled();
});

it('scores a real row and reports durable + status', async () => {
  findUnique.mockResolvedValue(ROW);
  const r = await scoreOpportunityForNpi('1003000126', ROW.id);
  expect(r?.durable).toBe(true);
  expect(r?.status).toBe('ACTIVE');
});
