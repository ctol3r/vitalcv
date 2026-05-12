import {
  categorizeBlocker,
  blockersToStrings,
  derivePassportReadiness,
  deriveCanonicalTrustLevel,
  dedupeBlockers,
  hasGatingBlocker,
  hasHardBlocker,
  mapLevelToBand,
  stringsToBlockers,
  type CanonicalBlocker,
} from '../canonical';
import {
  createCanonicalSourceCoverage,
  type CanonicalSourceCoverage,
} from '@vitalcv/trust-state';

const ALL_FOUR_CHECKED: CanonicalSourceCoverage[] = [
  createCanonicalSourceCoverage({ sourceId: 'NPPES_API',    state: 'checked', reason: 'ok', checkedAt: '2026-01-01T00:00:00Z' }),
  createCanonicalSourceCoverage({ sourceId: 'OIG_LEIE',     state: 'checked', reason: 'ok', checkedAt: '2026-01-01T00:00:00Z' }),
  createCanonicalSourceCoverage({ sourceId: 'PECOS_PUBLIC', state: 'checked', reason: 'ok', checkedAt: '2026-01-01T00:00:00Z' }),
  createCanonicalSourceCoverage({ sourceId: 'STATE_BOARD',  state: 'checked', reason: 'ok', checkedAt: '2026-01-01T00:00:00Z' }),
];

const TWO_CHECKED_TWO_PENDING: CanonicalSourceCoverage[] = [
  createCanonicalSourceCoverage({ sourceId: 'NPPES_API',    state: 'checked', reason: 'ok', checkedAt: '2026-01-01T00:00:00Z' }),
  createCanonicalSourceCoverage({ sourceId: 'OIG_LEIE',     state: 'checked', reason: 'ok', checkedAt: '2026-01-01T00:00:00Z' }),
  createCanonicalSourceCoverage({ sourceId: 'PECOS_PUBLIC', state: 'pending', reason: 'not yet checked' }),
  createCanonicalSourceCoverage({ sourceId: 'STATE_BOARD',  state: 'pending', reason: 'not yet checked' }),
];

const HARD_LICENSE: CanonicalBlocker = categorizeBlocker('License expired in NC')!;
const SOFT_PECOS: CanonicalBlocker = categorizeBlocker('PECOS enrollment not found')!;

describe('categorizeBlocker', () => {
  it('returns null for empty / whitespace strings', () => {
    expect(categorizeBlocker('')).toBeNull();
    expect(categorizeBlocker('   ')).toBeNull();
  });

  it('classifies license-expiry / revocation / suspension as HARD/LICENSURE', () => {
    for (const msg of ['License expired', 'Revoked', 'Suspended', 'Discipline on file']) {
      const result = categorizeBlocker(msg)!;
      expect(result.severity).toBe('HARD');
      expect(result.category).toBe('LICENSURE');
    }
  });

  it('classifies OIG/LEIE/sanction/exclusion as HARD/EXCLUSION', () => {
    const result = categorizeBlocker('OIG exclusion match')!;
    expect(result.severity).toBe('HARD');
    expect(result.category).toBe('EXCLUSION');
  });

  it('classifies PECOS / enrollment-not-found as SOFT/ENROLLMENT', () => {
    const result = categorizeBlocker('PECOS enrollment not found')!;
    expect(result.severity).toBe('SOFT');
    expect(result.category).toBe('ENROLLMENT');
  });

  it('classifies unknown text as SOFT/OTHER', () => {
    const result = categorizeBlocker('something unexpected')!;
    expect(result.severity).toBe('SOFT');
    expect(result.category).toBe('OTHER');
  });

  it('produces deterministic ids', () => {
    expect(categorizeBlocker('License expired')?.id).toBe(
      categorizeBlocker('License expired')?.id,
    );
    expect(categorizeBlocker('License expired in NC')?.id).not.toBe(
      categorizeBlocker('License expired in CA')?.id,
    );
  });
});

describe('stringsToBlockers / blockersToStrings round-trip', () => {
  it('drops empty strings, preserves order', () => {
    const result = stringsToBlockers(['x', '', '   ', 'y']);
    expect(result.map((b) => b.message)).toEqual(['x', 'y']);
  });

  it('projects message field', () => {
    expect(blockersToStrings([HARD_LICENSE, SOFT_PECOS])).toEqual([
      HARD_LICENSE.message,
      SOFT_PECOS.message,
    ]);
  });
});

describe('dedupeBlockers / hasHardBlocker / hasGatingBlocker', () => {
  it('dedupes by id', () => {
    const a = categorizeBlocker('License expired')!;
    const b = categorizeBlocker('License expired')!;
    expect(dedupeBlockers([a, b])).toHaveLength(1);
  });

  it('hasHardBlocker is true iff any HARD present', () => {
    expect(hasHardBlocker([])).toBe(false);
    expect(hasHardBlocker([SOFT_PECOS])).toBe(false);
    expect(hasHardBlocker([SOFT_PECOS, HARD_LICENSE])).toBe(true);
  });

  it('hasGatingBlocker is true for HARD or SOFT', () => {
    const info: CanonicalBlocker = { id: 'i', message: 'note', severity: 'INFO', category: 'OTHER' };
    expect(hasGatingBlocker([info])).toBe(false);
    expect(hasGatingBlocker([SOFT_PECOS])).toBe(true);
  });
});

describe('deriveCanonicalTrustLevel', () => {
  it('hard blocker → L0 regardless of score/status', () => {
    expect(deriveCanonicalTrustLevel({ score: 100, status: 'DECISION_GRADE', blockers: [HARD_LICENSE] })).toBe('L0');
  });
  it('status BLOCKED → L0', () => {
    expect(deriveCanonicalTrustLevel({ score: 100, status: 'BLOCKED', blockers: [] })).toBe('L0');
  });
  it('score ≥ 80 + DECISION_GRADE → L3', () => {
    expect(deriveCanonicalTrustLevel({ score: 80, status: 'DECISION_GRADE', blockers: [] })).toBe('L3');
  });
  it('score 60-79 → L2', () => {
    expect(deriveCanonicalTrustLevel({ score: 60, status: 'DECISION_GRADE', blockers: [] })).toBe('L2');
    expect(deriveCanonicalTrustLevel({ score: 75, status: 'PARTIAL', blockers: [] })).toBe('L2');
  });
  it('score 1-59 → L1', () => {
    expect(deriveCanonicalTrustLevel({ score: 20, status: 'CHECKING', blockers: [] })).toBe('L1');
  });
  it('score 0 + no hard blocker → L0', () => {
    expect(deriveCanonicalTrustLevel({ score: 0, status: 'CHECKING', blockers: [] })).toBe('L0');
  });
  it('SOFT-only blocker does NOT force L0; follows score', () => {
    expect(deriveCanonicalTrustLevel({ score: 20, status: 'PARTIAL', blockers: [SOFT_PECOS] })).toBe('L1');
  });
});

describe('mapLevelToBand', () => {
  it('L3 → GREEN', () => expect(mapLevelToBand('L3')).toBe('GREEN'));
  it('L2 → GREEN', () => expect(mapLevelToBand('L2')).toBe('GREEN'));
  it('L1 → YELLOW', () => expect(mapLevelToBand('L1')).toBe('YELLOW'));
  it('L0 → RED', () => expect(mapLevelToBand('L0')).toBe('RED'));
});

describe('derivePassportReadiness', () => {
  it('all four spine sources checked → score 100 / L3 / GREEN', () => {
    const r = derivePassportReadiness({
      sourceCoverage: ALL_FOUR_CHECKED,
      blockers: [],
      gaps: [],
      readinessStatus: 'DECISION_GRADE',
    });
    expect(r.score).toBe(100);
    expect(r.level).toBe('L3');
    expect(r.band).toBe('GREEN');
    expect(r.checkedSpineCount).toBe(4);
  });

  it('two of four checked → score 50 / L1 / YELLOW', () => {
    const r = derivePassportReadiness({
      sourceCoverage: TWO_CHECKED_TWO_PENDING,
      blockers: [],
      readinessStatus: 'PARTIAL',
    });
    expect(r.score).toBe(50);
    expect(r.level).toBe('L1');
    expect(r.band).toBe('YELLOW');
  });

  it('HARD blocker zeroes score even with full coverage', () => {
    const r = derivePassportReadiness({
      sourceCoverage: ALL_FOUR_CHECKED,
      blockers: [HARD_LICENSE],
      readinessStatus: 'DECISION_GRADE',
    });
    expect(r.score).toBe(0);
    expect(r.level).toBe('L0');
    expect(r.band).toBe('RED');
  });

  it('SOFT blocker caps score at 20 (PECOS not-found scenario)', () => {
    const r = derivePassportReadiness({
      sourceCoverage: ALL_FOUR_CHECKED,
      blockers: [SOFT_PECOS],
      readinessStatus: 'PARTIAL',
    });
    expect(r.score).toBe(20);
    expect(r.level).toBe('L1');
    expect(r.band).toBe('YELLOW');
  });

  it('gap-only caps score at 75', () => {
    const r = derivePassportReadiness({
      sourceCoverage: ALL_FOUR_CHECKED,
      blockers: [],
      gaps: ['Board certification not yet checked'],
      readinessStatus: 'PARTIAL',
    });
    expect(r.score).toBe(75);
    expect(r.level).toBe('L2');
    expect(r.band).toBe('GREEN');
  });

  it('divergence penalty subtracts from capped score, floor at 0', () => {
    const r = derivePassportReadiness({
      sourceCoverage: ALL_FOUR_CHECKED,
      blockers: [],
      divergencePenalty: 30,
      readinessStatus: 'DECISION_GRADE',
    });
    expect(r.score).toBe(70);
    expect(r.level).toBe('L2');
  });

  it('divergence penalty cannot drive score below 0', () => {
    const r = derivePassportReadiness({
      sourceCoverage: TWO_CHECKED_TWO_PENDING,
      blockers: [],
      divergencePenalty: 200,
      readinessStatus: 'PARTIAL',
    });
    expect(r.score).toBe(0);
    expect(r.level).toBe('L0');
  });

  it('blockerStrings projection mirrors blocker messages', () => {
    const r = derivePassportReadiness({
      sourceCoverage: ALL_FOUR_CHECKED,
      blockers: [HARD_LICENSE, SOFT_PECOS],
      readinessStatus: 'PARTIAL',
    });
    expect(r.blockerStrings).toEqual([HARD_LICENSE.message, SOFT_PECOS.message]);
  });
});
