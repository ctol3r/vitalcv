import { describe, expect, it } from 'vitest';
import type { EmploymentClaim } from '../providerEmploymentContracts';
import {
  buildEmploymentGraph,
  composeConfidence,
  getCurrentEmployers,
  groupClaimsByEmployer,
  hasConflict,
} from '../providerEmploymentGraph';

const makeClaim = (overrides: Partial<EmploymentClaim> = {}): EmploymentClaim => ({
  claimId: 'claim-001',
  providerId: 'prov-001',
  employer: 'Alpha Medical Center',
  role: 'Registered Nurse',
  startDate: '2021-03-10',
  endDate: null,
  source: 'resume_parse',
  sourceConfidence: 'medium',
  observedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

// ───────────────────────── groupClaimsByEmployer ─────────────────────────

describe('groupClaimsByEmployer', () => {
  it('groups by employerId when present, ignoring display-name variance', () => {
    const claims = [
      makeClaim({ claimId: 'c1', employerId: 'org-1', employer: 'Alpha Med' }),
      makeClaim({ claimId: 'c2', employerId: 'org-1', employer: 'ALPHA MED CTR' }),
      makeClaim({ claimId: 'c3', employerId: 'org-2', employer: 'Beta' }),
    ];
    const groups = groupClaimsByEmployer(claims);
    expect(groups.size).toBe(2);
  });

  it('groups by normalized employer name when employerId absent', () => {
    const claims = [
      makeClaim({ claimId: 'c1', employer: 'Alpha Medical Center' }),
      makeClaim({ claimId: 'c2', employer: 'ALPHA MEDICAL CENTER!!' }),
      makeClaim({ claimId: 'c3', employer: 'Beta Clinic' }),
    ];
    const groups = groupClaimsByEmployer(claims);
    expect(groups.size).toBe(2);
  });

  it('normalizes punctuation and collapses whitespace', () => {
    const claims = [
      makeClaim({ claimId: 'c1', employer: "St. Mary's Hospital" }),
      makeClaim({ claimId: 'c2', employer: 'St Marys  Hospital' }),
    ];
    const groups = groupClaimsByEmployer(claims);
    expect(groups.size).toBe(1);
  });

  it('treats empty employerId string as "no id" and falls back to name key', () => {
    const claims = [
      makeClaim({ claimId: 'c1', employerId: '', employer: 'Alpha' }),
      makeClaim({ claimId: 'c2', employerId: undefined, employer: 'Alpha' }),
    ];
    const groups = groupClaimsByEmployer(claims);
    expect(groups.size).toBe(1);
  });

  it('returns an empty map for empty input', () => {
    expect(groupClaimsByEmployer([]).size).toBe(0);
  });
});

// ───────────────────────── hasConflict ─────────────────────────

describe('hasConflict', () => {
  it('returns false for a single claim', () => {
    expect(hasConflict([makeClaim()])).toBe(false);
  });

  it('returns false for an empty claim set', () => {
    expect(hasConflict([])).toBe(false);
  });

  it('returns false when start dates share year-month', () => {
    const claims = [
      makeClaim({ claimId: 'c1', startDate: '2021-03-01' }),
      makeClaim({ claimId: 'c2', startDate: '2021-03-28' }),
    ];
    expect(hasConflict(claims)).toBe(false);
  });

  it('returns true when start dates differ by year-month', () => {
    const claims = [
      makeClaim({ claimId: 'c1', startDate: '2021-03-01' }),
      makeClaim({ claimId: 'c2', startDate: '2021-05-01' }),
    ];
    expect(hasConflict(claims)).toBe(true);
  });

  it('returns true when one claim is active and another has an end date', () => {
    const claims = [
      makeClaim({ claimId: 'c1', endDate: null }),
      makeClaim({ claimId: 'c2', endDate: '2023-06-15' }),
    ];
    expect(hasConflict(claims)).toBe(true);
  });

  it('returns false when both claims are active', () => {
    const claims = [
      makeClaim({ claimId: 'c1', endDate: null }),
      makeClaim({ claimId: 'c2', endDate: null }),
    ];
    expect(hasConflict(claims)).toBe(false);
  });

  it('returns false when end dates share year-month', () => {
    const claims = [
      makeClaim({ claimId: 'c1', endDate: '2023-06-10' }),
      makeClaim({ claimId: 'c2', endDate: '2023-06-28' }),
    ];
    expect(hasConflict(claims)).toBe(false);
  });

  it('returns true when end dates differ by year-month', () => {
    const claims = [
      makeClaim({ claimId: 'c1', endDate: '2023-06-10' }),
      makeClaim({ claimId: 'c2', endDate: '2024-01-05' }),
    ];
    expect(hasConflict(claims)).toBe(true);
  });

  it('returns true when two present roles differ', () => {
    const claims = [
      makeClaim({ claimId: 'c1', role: 'Registered Nurse' }),
      makeClaim({ claimId: 'c2', role: 'Physician' }),
    ];
    expect(hasConflict(claims)).toBe(true);
  });

  it('does not conflict when one role is undefined', () => {
    const claims = [
      makeClaim({ claimId: 'c1', role: 'Registered Nurse' }),
      makeClaim({ claimId: 'c2', role: undefined }),
    ];
    expect(hasConflict(claims)).toBe(false);
  });
});

// ───────────────────────── composeConfidence ─────────────────────────

describe('composeConfidence', () => {
  it('throws when given zero claims', () => {
    expect(() => composeConfidence([])).toThrow(
      /at least one claim/,
    );
  });

  it('single verified_source → high / single', () => {
    const res = composeConfidence([makeClaim({ source: 'verified_source' })]);
    expect(res).toEqual({ confidence: 'high', agreement: 'single' });
  });

  it('single resume_parse → medium / single', () => {
    const res = composeConfidence([makeClaim({ source: 'resume_parse' })]);
    expect(res).toEqual({ confidence: 'medium', agreement: 'single' });
  });

  it('single user_input → medium / single', () => {
    const res = composeConfidence([makeClaim({ source: 'user_input' })]);
    expect(res).toEqual({ confidence: 'medium', agreement: 'single' });
  });

  it('resume_parse + user_input agreeing → high / agree', () => {
    const res = composeConfidence([
      makeClaim({ claimId: 'c1', source: 'resume_parse' }),
      makeClaim({ claimId: 'c2', source: 'user_input' }),
    ]);
    expect(res).toEqual({ confidence: 'high', agreement: 'agree' });
  });

  it('resume_parse + user_input conflicting → low / conflict', () => {
    const res = composeConfidence([
      makeClaim({ claimId: 'c1', source: 'resume_parse', startDate: '2020-01-15' }),
      makeClaim({ claimId: 'c2', source: 'user_input', startDate: '2022-06-01' }),
    ]);
    expect(res).toEqual({ confidence: 'low', agreement: 'conflict' });
  });

  it('two resume_parse claims in agreement → medium / single (one distinct source)', () => {
    const res = composeConfidence([
      makeClaim({ claimId: 'c1', source: 'resume_parse' }),
      makeClaim({ claimId: 'c2', source: 'resume_parse' }),
    ]);
    expect(res).toEqual({ confidence: 'medium', agreement: 'single' });
  });

  it('Q1: verified_source + conflicting resume_parse → high / conflict', () => {
    const res = composeConfidence([
      makeClaim({ claimId: 'c1', source: 'verified_source', startDate: '2020-03-01' }),
      makeClaim({ claimId: 'c2', source: 'resume_parse', startDate: '2019-01-01' }),
    ]);
    expect(res).toEqual({ confidence: 'high', agreement: 'conflict' });
  });

  it('verified_source + agreeing resume_parse → high / agree', () => {
    const res = composeConfidence([
      makeClaim({ claimId: 'c1', source: 'verified_source' }),
      makeClaim({ claimId: 'c2', source: 'resume_parse' }),
    ]);
    expect(res).toEqual({ confidence: 'high', agreement: 'agree' });
  });

  it('Q2: two verified_source rows in conflict → medium / conflict', () => {
    const res = composeConfidence([
      makeClaim({ claimId: 'c1', source: 'verified_source', startDate: '2020-03-01' }),
      makeClaim({ claimId: 'c2', source: 'verified_source', startDate: '2021-09-01' }),
    ]);
    expect(res).toEqual({ confidence: 'medium', agreement: 'conflict' });
  });

  it('two verified_source rows in agreement → high / single (one distinct source)', () => {
    const res = composeConfidence([
      makeClaim({ claimId: 'c1', source: 'verified_source' }),
      makeClaim({ claimId: 'c2', source: 'verified_source' }),
    ]);
    expect(res).toEqual({ confidence: 'high', agreement: 'single' });
  });
});

// ───────────────────────── buildEmploymentGraph ─────────────────────────

describe('buildEmploymentGraph', () => {
  it('returns an empty graph when no claims are supplied', () => {
    const graph = buildEmploymentGraph('prov-1', []);
    expect(graph.providerId).toBe('prov-1');
    expect(graph.nodes).toEqual([]);
    expect(graph.currentEmployers).toEqual([]);
  });

  it('filters out claims belonging to other providers', () => {
    const claims = [
      makeClaim({ providerId: 'prov-1', claimId: 'c1' }),
      makeClaim({ providerId: 'prov-2', claimId: 'c2', employer: 'Other Place' }),
    ];
    const graph = buildEmploymentGraph('prov-1', claims);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].employer).toBe('Alpha Medical Center');
  });

  it('groups claims by employer into distinct nodes', () => {
    const claims = [
      makeClaim({ claimId: 'c1', employer: 'Alpha Medical Center' }),
      makeClaim({ claimId: 'c2', employer: 'Alpha Medical Center', source: 'user_input' }),
      makeClaim({ claimId: 'c3', employer: 'Beta Clinic', startDate: '2018-01-10' }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(graph.nodes).toHaveLength(2);
  });

  it('sorts nodes by startDate DESC', () => {
    const claims = [
      makeClaim({ claimId: 'c1', employer: 'Alpha', startDate: '2015-01-01', endDate: '2017-12-31' }),
      makeClaim({ claimId: 'c2', employer: 'Beta', startDate: '2021-03-01' }),
      makeClaim({ claimId: 'c3', employer: 'Gamma', startDate: '2018-06-01', endDate: '2021-02-28' }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(graph.nodes.map((n) => n.employer)).toEqual(['Beta', 'Gamma', 'Alpha']);
  });

  it('uses the earliest startDate among grouped claims for the node', () => {
    const claims = [
      makeClaim({ claimId: 'c1', startDate: '2021-03-15', source: 'resume_parse' }),
      makeClaim({ claimId: 'c2', startDate: '2021-03-01', source: 'user_input' }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(graph.nodes[0].startDate).toBe('2021-03-01');
  });

  it('node endDate is null when any grouped claim is active, and flags the conflict', () => {
    const claims = [
      makeClaim({ claimId: 'c1', endDate: '2023-06-30', source: 'resume_parse' }),
      makeClaim({ claimId: 'c2', endDate: null, source: 'user_input' }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(graph.nodes[0].endDate).toBeNull();
    expect(graph.nodes[0].flagged).toBe(true);
    expect(graph.nodes[0].agreement).toBe('conflict');
  });

  it('node endDate is latest when all grouped claims are ended', () => {
    const claims = [
      makeClaim({ claimId: 'c1', endDate: '2023-06-15' }),
      makeClaim({ claimId: 'c2', endDate: '2023-06-28' }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(graph.nodes[0].endDate).toBe('2023-06-28');
  });

  it('node endDate resolution picks latest regardless of claim order', () => {
    // Exercises the reduce path where the accumulator is already the latest
    const claims = [
      makeClaim({ claimId: 'c1', endDate: '2023-06-28' }),
      makeClaim({ claimId: 'c2', endDate: '2023-06-15' }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(graph.nodes[0].endDate).toBe('2023-06-28');
  });

  it('picks the mode role across grouped claims', () => {
    const claims = [
      makeClaim({ claimId: 'c1', role: 'Registered Nurse' }),
      makeClaim({ claimId: 'c2', role: 'Registered Nurse' }),
      makeClaim({ claimId: 'c3', role: undefined }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(graph.nodes[0].role).toBe('Registered Nurse');
  });

  it('node role is undefined when no grouped claim carries a role', () => {
    const claims = [
      makeClaim({ claimId: 'c1', role: undefined }),
      makeClaim({ claimId: 'c2', role: undefined }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(graph.nodes[0].role).toBeUndefined();
  });

  it('preserves all underlying claims on the node (transparent graph)', () => {
    const claims = [
      makeClaim({ claimId: 'c1' }),
      makeClaim({ claimId: 'c2', source: 'user_input' }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(graph.nodes[0].claims).toHaveLength(2);
    expect(graph.nodes[0].claims.map((c) => c.claimId).sort()).toEqual(['c1', 'c2']);
  });
});

// ───────────────────────── getCurrentEmployers ─────────────────────────

describe('getCurrentEmployers', () => {
  it('returns all active employers, sorted by startDate DESC (locum reality)', () => {
    const claims = [
      makeClaim({ claimId: 'c1', employer: 'Hospital A', startDate: '2023-01-01', endDate: null }),
      makeClaim({ claimId: 'c2', employer: 'Clinic B', startDate: '2024-05-01', endDate: null }),
      makeClaim({ claimId: 'c3', employer: 'OldJob', startDate: '2018-01-01', endDate: '2022-12-31' }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    const active = getCurrentEmployers(graph);
    expect(active).toHaveLength(2);
    expect(active.map((n) => n.employer)).toEqual(['Clinic B', 'Hospital A']);
  });

  it('returns an empty list when no employers are active', () => {
    const claims = [
      makeClaim({ claimId: 'c1', endDate: '2022-12-31' }),
    ];
    const graph = buildEmploymentGraph('prov-001', claims);
    expect(getCurrentEmployers(graph)).toEqual([]);
  });
});
