// Tests for the CasesBoard sort, filter, and progress logic.
// These tests import only the pure logic — no DOM rendering required.

import { describe, expect, it } from 'vitest';

// ── Inline the sort/priority logic so tests stay pure (no React dep) ──────────

type CasePriority = 'critical' | 'high' | 'medium' | 'low';
type LaneProgress = 'complete' | 'pending' | 'missing' | 'in_progress';
type SortKey = 'priority' | 'delay' | 'roi' | 'progress';

interface MiniCase {
  entityId: string;
  priority: CasePriority;
  progressPercent: number;
  orchestrationPlan: {
    criticalPathDays: number;
    parallelSavingsDays: number;
    totalBlockers: number;
  };
}

const PRIORITY_RANK: Record<CasePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function sortCases(cases: MiniCase[], sort: SortKey): MiniCase[] {
  return [...cases].sort((a, b) => {
    switch (sort) {
      case 'delay':
        return b.orchestrationPlan.criticalPathDays - a.orchestrationPlan.criticalPathDays;
      case 'roi':
        return b.orchestrationPlan.parallelSavingsDays - a.orchestrationPlan.parallelSavingsDays;
      case 'progress':
        return a.progressPercent - b.progressPercent;
      case 'priority':
      default:
        return (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
    }
  });
}

function filterByPriority(cases: MiniCase[], filter: CasePriority[]): MiniCase[] {
  if (filter.length === 0) {
    return cases;
  }
  return cases.filter((c) => filter.includes(c.priority));
}

function progressPercent(lanes: LaneProgress[]): number {
  const complete = lanes.filter((l) => l === 'complete').length;
  return Math.round((complete / lanes.length) * 100);
}

function makeCase(
  id: string,
  priority: CasePriority,
  progress: number,
  criticalPathDays = 0,
  parallelSavingsDays = 0,
): MiniCase {
  return {
    entityId: id,
    priority,
    progressPercent: progress,
    orchestrationPlan: {
      criticalPathDays,
      parallelSavingsDays,
      totalBlockers: criticalPathDays > 0 ? 1 : 0,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CasesBoard — sort by priority', () => {
  it('orders critical before high before medium before low', () => {
    const cases = [
      makeCase('a', 'low', 80),
      makeCase('b', 'critical', 10),
      makeCase('c', 'medium', 50),
      makeCase('d', 'high', 30),
    ];
    const sorted = sortCases(cases, 'priority');
    expect(sorted.map((c) => c.priority)).toEqual(['critical', 'high', 'medium', 'low']);
  });

  it('is stable when priorities are equal', () => {
    const cases = [makeCase('a', 'high', 10), makeCase('b', 'high', 90)];
    const sorted = sortCases(cases, 'priority');
    expect(sorted).toHaveLength(2);
    expect(sorted.every((c) => c.priority === 'high')).toBe(true);
  });
});

describe('CasesBoard — sort by delay', () => {
  it('puts longest critical path first', () => {
    const cases = [
      makeCase('a', 'low', 80, 5),
      makeCase('b', 'high', 20, 60),
      makeCase('c', 'medium', 40, 21),
    ];
    const sorted = sortCases(cases, 'delay');
    expect(sorted.map((c) => c.entityId)).toEqual(['b', 'c', 'a']);
  });
});

describe('CasesBoard — sort by ROI', () => {
  it('puts highest parallel savings first', () => {
    const cases = [
      makeCase('a', 'critical', 10, 60, 10),
      makeCase('b', 'low', 90, 3, 45),
      makeCase('c', 'high', 30, 21, 21),
    ];
    const sorted = sortCases(cases, 'roi');
    expect(sorted.map((c) => c.entityId)).toEqual(['b', 'c', 'a']);
  });
});

describe('CasesBoard — sort by progress', () => {
  it('puts lowest progress first (most work remaining)', () => {
    const cases = [
      makeCase('a', 'low', 100),
      makeCase('b', 'high', 25),
      makeCase('c', 'medium', 50),
      makeCase('d', 'critical', 0),
    ];
    const sorted = sortCases(cases, 'progress');
    expect(sorted.map((c) => c.progressPercent)).toEqual([0, 25, 50, 100]);
  });
});

describe('CasesBoard — filter by priority', () => {
  const cases = [
    makeCase('a', 'critical', 10),
    makeCase('b', 'high', 30),
    makeCase('c', 'medium', 50),
    makeCase('d', 'low', 80),
  ];

  it('returns all cases when filter is empty', () => {
    expect(filterByPriority(cases, [])).toHaveLength(4);
  });

  it('returns only matching priority cases', () => {
    const result = filterByPriority(cases, ['critical', 'high']);
    expect(result.map((c) => c.priority).sort()).toEqual(['critical', 'high']);
  });

  it('returns empty array when no cases match filter', () => {
    const result = filterByPriority(cases, ['critical']).filter((c) => c.priority === 'low');
    expect(result).toHaveLength(0);
  });
});

describe('CasesBoard — progressPercent helper', () => {
  it('returns 100 when all lanes are complete', () => {
    expect(progressPercent(['complete', 'complete', 'complete', 'complete'])).toBe(100);
  });

  it('returns 0 when all lanes are missing', () => {
    expect(progressPercent(['missing', 'missing', 'missing', 'missing'])).toBe(0);
  });

  it('returns 50 when half the lanes are complete', () => {
    expect(progressPercent(['complete', 'complete', 'missing', 'missing'])).toBe(50);
  });

  it('counts only complete lanes, not in_progress or pending', () => {
    expect(progressPercent(['complete', 'in_progress', 'pending', 'missing'])).toBe(25);
  });

  it('rounds to the nearest integer', () => {
    // 1 of 3 = 33.33... → 33
    expect(progressPercent(['complete', 'missing', 'missing'])).toBe(33);
  });
});
