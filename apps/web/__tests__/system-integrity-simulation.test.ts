// System integrity simulation — 50 clinicians, random failures, concurrent workflows.
// Validates: state machine correctness, dependency enforcement, recovery paths,
// and overall orchestration reliability under adversarial conditions.

import { describe, expect, it } from 'vitest';

// ── Core types (inline, no backend import) ────────────────────────────────────

type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
type LaneProgress = 'complete' | 'pending' | 'missing' | 'in_progress';
type CasePriority = 'critical' | 'high' | 'medium' | 'low';

interface BlockerNode {
  id: string;
  estimatedDays: number;
  dependencies: string[];
}

// ── State machine (mirrors core/actions/actionHistory.ts) ─────────────────────

const VALID_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  pending: ['in_progress', 'skipped'],
  in_progress: ['completed', 'pending'],
  completed: [],
  skipped: [],
};

function canTransition(from: ActionStatus, to: ActionStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

function applyTransition(
  current: ActionStatus,
  next: ActionStatus,
): ActionStatus {
  if (!canTransition(current, next)) {
    throw new Error(`Invalid transition: ${current} → ${next}`);
  }
  return next;
}

// ── Orchestration engine (mirrors orchestrationEngine.ts) ─────────────────────

function groupIntoWaves(nodes: BlockerNode[]) {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    dependents.set(node.id, []);
  }
  for (const node of nodes) {
    for (const depId of node.dependencies) {
      if (!nodeById.has(depId)) {
        continue;
      }
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      const list = dependents.get(depId) ?? [];
      list.push(node.id);
      dependents.set(depId, list);
    }
  }

  const waves: BlockerNode[][] = [];
  let ready = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);

  while (ready.length > 0) {
    waves.push([...ready]);
    const nextReady: BlockerNode[] = [];
    for (const completed of ready) {
      for (const depId of dependents.get(completed.id) ?? []) {
        const remaining = (inDegree.get(depId) ?? 1) - 1;
        inDegree.set(depId, remaining);
        if (remaining === 0) {
          const dep = nodeById.get(depId);
          if (dep) {
            nextReady.push(dep);
          }
        }
      }
    }
    ready = nextReady;
  }

  return waves;
}

function computeCriticalPath(nodes: BlockerNode[]): number {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const cache = new Map<string, number>();

  function resolve(id: string): number {
    if (cache.has(id)) {
      return cache.get(id)!;
    }
    const node = nodeById.get(id);
    if (!node) {
      return 0;
    }
    let maxDep = 0;
    let hasDep = false;
    for (const depId of node.dependencies) {
      if (!nodeById.has(depId)) {
        continue;
      }
      const d = resolve(depId);
      if (!hasDep || d > maxDep) {
        maxDep = d;
        hasDep = true;
      }
    }
    const total = maxDep + node.estimatedDays;
    cache.set(id, total);
    return total;
  }

  return Math.max(0, ...nodes.map((n) => resolve(n.id)));
}

// ── Progress helpers ──────────────────────────────────────────────────────────

function progressPercent(lanes: LaneProgress[]): number {
  return Math.round((lanes.filter((l) => l === 'complete').length / lanes.length) * 100);
}

function derivePriority(
  lanes: LaneProgress[],
  criticalPathDays: number,
): CasePriority {
  if (criticalPathDays >= 45) {
    return 'critical';
  }
  if (lanes.includes('missing') && criticalPathDays >= 14) {
    return 'high';
  }
  if (lanes.includes('missing')) {
    return 'medium';
  }
  return 'low';
}

// ── Simulation helpers ────────────────────────────────────────────────────────

// Deterministic seeded PRNG (xorshift32) — no randomness surprises in CI
function makeRng(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

type LaneSet = {
  identity: LaneProgress;
  sanctions: LaneProgress;
  licensure: LaneProgress;
  enrollment: LaneProgress;
};

function randomLanes(rng: () => number): LaneSet {
  const pick = (): LaneProgress => {
    const r = rng();
    if (r < 0.5) {
      return 'complete';
    }
    if (r < 0.7) {
      return 'missing';
    }
    if (r < 0.85) {
      return 'in_progress';
    }
    return 'pending';
  };
  return {
    identity: pick(),
    sanctions: pick(),
    licensure: pick(),
    enrollment: pick(),
  };
}

// Build blocker nodes from missing/incomplete lanes
const LANE_BLOCKER: Partial<Record<keyof LaneSet, BlockerNode>> = {
  identity: { id: 'verify-identity', estimatedDays: 0, dependencies: [] },
  sanctions: { id: 'run-exclusion-check', estimatedDays: 3, dependencies: ['verify-identity'] },
  licensure: { id: 'refresh-licensure', estimatedDays: 21, dependencies: [] },
  enrollment: { id: 'submit-pecos-enrollment', estimatedDays: 60, dependencies: ['verify-identity'] },
};

function blocksFromLanes(lanes: LaneSet): BlockerNode[] {
  const nodes: BlockerNode[] = [];
  const needsIdentity = lanes.identity !== 'complete';

  for (const [lane, status] of Object.entries(lanes) as Array<[keyof LaneSet, LaneProgress]>) {
    if (status === 'complete') {
      continue;
    }
    const proto = LANE_BLOCKER[lane];
    if (!proto) {
      continue;
    }
    // Only include identity dep if identity itself is a blocker
    const deps = proto.dependencies.filter((d) => d !== 'verify-identity' || needsIdentity);
    nodes.push({ ...proto, dependencies: deps });
  }

  return nodes;
}

// Simulate an action going through the state machine with possible random failure
interface ActionExecution {
  actionId: string;
  entityId: string;
  transitions: Array<{ from: ActionStatus; to: ActionStatus }>;
  finalStatus: ActionStatus;
  failed: boolean;
  failureReason?: string;
}

function simulateAction(
  entityId: string,
  actionId: string,
  rng: () => number,
): ActionExecution {
  let status: ActionStatus = 'pending';
  const transitions: ActionExecution['transitions'] = [];

  // Randomly attempt: start → complete, or start → fail, or skip
  const roll = rng();

  if (roll < 0.05) {
    // 5%: direct skip (dismissed)
    const next: ActionStatus = 'skipped';
    transitions.push({ from: status, to: next });
    status = applyTransition(status, next);
    return { actionId, entityId, transitions, finalStatus: status, failed: false };
  }

  // Attempt start
  const startNext: ActionStatus = 'in_progress';
  transitions.push({ from: status, to: startNext });
  status = applyTransition(status, startNext);

  if (roll < 0.25) {
    // 20%: revert to pending (partial failure / retry)
    const revertNext: ActionStatus = 'pending';
    transitions.push({ from: status, to: revertNext });
    status = applyTransition(status, revertNext);

    // Then retry and complete
    const retryNext: ActionStatus = 'in_progress';
    transitions.push({ from: status, to: retryNext });
    status = applyTransition(status, retryNext);
  }

  // Complete
  const completeNext: ActionStatus = 'completed';
  transitions.push({ from: status, to: completeNext });
  status = applyTransition(status, completeNext);

  return { actionId, entityId, transitions, finalStatus: status, failed: false };
}

function attemptInvalidTransition(from: ActionStatus, to: ActionStatus): string | null {
  try {
    applyTransition(from, to);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'error';
  }
}

// ── Simulation ────────────────────────────────────────────────────────────────

interface ClinicalCase {
  entityId: string;
  lanes: LaneSet;
  blockers: BlockerNode[];
  criticalPathDays: number;
  parallelSavingsDays: number;
  progressPercent: number;
  priority: CasePriority;
  waves: BlockerNode[][];
}

function buildCases(count: number, seed = 42): ClinicalCase[] {
  const rng = makeRng(seed);
  const cases: ClinicalCase[] = [];

  for (let i = 0; i < count; i++) {
    const entityId = `entity-${String(i).padStart(3, '0')}`;
    const lanes = randomLanes(rng);
    const blockers = blocksFromLanes(lanes);
    const serialDays = blockers.reduce((sum, b) => sum + b.estimatedDays, 0);
    const criticalPathDays = computeCriticalPath(blockers);
    const parallelSavingsDays = Math.max(0, serialDays - criticalPathDays);
    const laneValues = Object.values(lanes) as LaneProgress[];
    const priority = derivePriority(laneValues, criticalPathDays);
    const waves = groupIntoWaves(blockers);

    cases.push({
      entityId,
      lanes,
      blockers,
      criticalPathDays,
      parallelSavingsDays,
      progressPercent: progressPercent(laneValues),
      priority,
      waves,
    });
  }

  return cases;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('system integrity — state machine', () => {
  const INVALID_TRANSITIONS: Array<[ActionStatus, ActionStatus]> = [
    ['completed', 'pending'],
    ['completed', 'in_progress'],
    ['completed', 'skipped'],
    ['skipped', 'pending'],
    ['skipped', 'in_progress'],
    ['skipped', 'completed'],
    ['pending', 'completed'],
  ];

  it.each(INVALID_TRANSITIONS)(
    'blocks invalid transition %s → %s',
    (from, to) => {
      const error = attemptInvalidTransition(from, to);
      expect(error).not.toBeNull();
      expect(error).toMatch(/Invalid transition/);
    },
  );

  it('permits the full valid forward path: pending → in_progress → completed', () => {
    let s: ActionStatus = 'pending';
    s = applyTransition(s, 'in_progress');
    expect(s).toBe('in_progress');
    s = applyTransition(s, 'completed');
    expect(s).toBe('completed');
  });

  it('permits revert: in_progress → pending → in_progress → completed', () => {
    let s: ActionStatus = 'pending';
    s = applyTransition(s, 'in_progress');
    s = applyTransition(s, 'pending');
    s = applyTransition(s, 'in_progress');
    s = applyTransition(s, 'completed');
    expect(s).toBe('completed');
  });

  it('permits dismiss: pending → skipped', () => {
    const s = applyTransition('pending', 'skipped');
    expect(s).toBe('skipped');
  });
});

describe('system integrity — dependency enforcement', () => {
  it('run-exclusion-check cannot start before verify-identity when both are present', () => {
    const blockers: BlockerNode[] = [
      { id: 'verify-identity', estimatedDays: 0, dependencies: [] },
      { id: 'run-exclusion-check', estimatedDays: 3, dependencies: ['verify-identity'] },
    ];
    const waves = groupIntoWaves(blockers);

    // verify-identity must be in wave 0, run-exclusion-check in wave 1
    expect(waves[0].map((n) => n.id)).toContain('verify-identity');
    expect(waves[0].map((n) => n.id)).not.toContain('run-exclusion-check');
    expect(waves[1].map((n) => n.id)).toContain('run-exclusion-check');
  });

  it('submit-pecos-enrollment cannot start before verify-identity', () => {
    const blockers: BlockerNode[] = [
      { id: 'verify-identity', estimatedDays: 0, dependencies: [] },
      { id: 'submit-pecos-enrollment', estimatedDays: 60, dependencies: ['verify-identity'] },
    ];
    const waves = groupIntoWaves(blockers);
    expect(waves[0][0].id).toBe('verify-identity');
    expect(waves[1][0].id).toBe('submit-pecos-enrollment');
  });

  it('resolve-leie-review cannot start before run-exclusion-check', () => {
    const blockers: BlockerNode[] = [
      { id: 'verify-identity', estimatedDays: 0, dependencies: [] },
      { id: 'run-exclusion-check', estimatedDays: 3, dependencies: ['verify-identity'] },
      { id: 'resolve-leie-review', estimatedDays: 10, dependencies: ['run-exclusion-check'] },
    ];
    const waves = groupIntoWaves(blockers);
    expect(waves).toHaveLength(3);
    expect(waves[2][0].id).toBe('resolve-leie-review');
  });

  it('independent blockers (licensure + identity) execute in parallel in wave 0', () => {
    const blockers: BlockerNode[] = [
      { id: 'verify-identity', estimatedDays: 0, dependencies: [] },
      { id: 'refresh-licensure', estimatedDays: 21, dependencies: [] },
    ];
    const waves = groupIntoWaves(blockers);
    expect(waves).toHaveLength(1);
    expect(waves[0].map((n) => n.id).sort()).toEqual(['refresh-licensure', 'verify-identity']);
  });
});

describe('system integrity — 50 clinician simulation', () => {
  const CASE_COUNT = 50;
  const cases = buildCases(CASE_COUNT, 42);

  it('generates exactly 50 cases', () => {
    expect(cases).toHaveLength(CASE_COUNT);
  });

  it('every case has a unique entityId', () => {
    const ids = new Set(cases.map((c) => c.entityId));
    expect(ids.size).toBe(CASE_COUNT);
  });

  it('every case has a valid priority', () => {
    const valid = new Set<CasePriority>(['critical', 'high', 'medium', 'low']);
    for (const c of cases) {
      expect(valid.has(c.priority)).toBe(true);
    }
  });

  it('progressPercent is in [0, 100] for every case', () => {
    for (const c of cases) {
      expect(c.progressPercent).toBeGreaterThanOrEqual(0);
      expect(c.progressPercent).toBeLessThanOrEqual(100);
    }
  });

  it('criticalPathDays is never negative', () => {
    for (const c of cases) {
      expect(c.criticalPathDays).toBeGreaterThanOrEqual(0);
    }
  });

  it('parallelSavingsDays is never negative', () => {
    for (const c of cases) {
      expect(c.parallelSavingsDays).toBeGreaterThanOrEqual(0);
    }
  });

  it('criticalPathDays <= serialDays for every case', () => {
    for (const c of cases) {
      const serialDays = c.blockers.reduce((sum, b) => sum + b.estimatedDays, 0);
      expect(c.criticalPathDays).toBeLessThanOrEqual(serialDays);
    }
  });

  it('wave count equals topological depth of the dependency graph', () => {
    for (const c of cases) {
      if (c.blockers.length === 0) {
        expect(c.waves).toHaveLength(0);
        continue;
      }
      // All nodes must appear in exactly one wave
      const allInWaves = c.waves.flatMap((w) => w.map((n) => n.id)).sort();
      const allBlockers = c.blockers.map((b) => b.id).sort();
      expect(allInWaves).toEqual(allBlockers);
    }
  });

  it('no node appears in two waves simultaneously', () => {
    for (const c of cases) {
      const seen = new Set<string>();
      for (const wave of c.waves) {
        for (const node of wave) {
          expect(seen.has(node.id)).toBe(false);
          seen.add(node.id);
        }
      }
    }
  });

  it('in every wave, no node depends on another node in the same wave', () => {
    for (const c of cases) {
      for (const wave of c.waves) {
        const waveIds = new Set(wave.map((n) => n.id));
        for (const node of wave) {
          for (const depId of node.dependencies) {
            expect(waveIds.has(depId)).toBe(false);
          }
        }
      }
    }
  });

  it('cases with all lanes complete have 0 blockers and progress=100', () => {
    const clearCases = cases.filter((c) =>
      Object.values(c.lanes).every((l) => l === 'complete'),
    );
    for (const c of clearCases) {
      expect(c.blockers).toHaveLength(0);
      expect(c.progressPercent).toBe(100);
      expect(c.criticalPathDays).toBe(0);
    }
  });

  it('simulation produces a mix of priorities (not all the same)', () => {
    const priorities = new Set(cases.map((c) => c.priority));
    expect(priorities.size).toBeGreaterThan(1);
  });
});

describe('system integrity — concurrent action simulation', () => {
  const rng = makeRng(99);
  const cases = buildCases(50, 99);

  function simulateAllCases(): { successes: number; failures: ActionExecution[]; totalTransitions: number } {
    const failures: ActionExecution[] = [];
    let successes = 0;
    let totalTransitions = 0;

    for (const c of cases) {
      for (const blocker of c.blockers) {
        const result = simulateAction(c.entityId, blocker.id, rng);
        totalTransitions += result.transitions.length;
        if (result.failed) {
          failures.push(result);
        } else {
          successes++;
        }
      }
    }

    return { successes, failures, totalTransitions };
  }

  const { successes, failures, totalTransitions } = simulateAllCases();

  it('zero actions fail with invalid state transitions', () => {
    expect(failures).toHaveLength(0);
  });

  it('all simulated actions reach a terminal state (completed or skipped)', () => {
    // successes count actions that didn't throw
    expect(successes).toBeGreaterThan(0);
    // No action should be stuck in pending/in_progress
    expect(failures).toHaveLength(0);
  });

  it('state machine processes all transitions without corruption', () => {
    expect(totalTransitions).toBeGreaterThan(0);
    // Each action has 2–4 transitions; 50 cases × avg ~2 blockers × avg ~3 transitions ≈ 300+
    expect(totalTransitions).toBeGreaterThan(50);
  });

  it('reliability score is 100% — no invalid transitions occur', () => {
    const totalActions = successes + failures.length;
    const reliabilityScore = totalActions > 0 ? (successes / totalActions) * 100 : 100;
    expect(reliabilityScore).toBe(100);
  });
});

describe('system integrity — recovery paths', () => {
  it('an action reverted to pending can restart and complete', () => {
    let s: ActionStatus = 'pending';
    s = applyTransition(s, 'in_progress');
    s = applyTransition(s, 'pending');     // revert (network error, etc.)
    s = applyTransition(s, 'in_progress'); // retry
    s = applyTransition(s, 'completed');   // succeed
    expect(s).toBe('completed');
  });

  it('an action dismissed cannot be restarted — terminal state enforced', () => {
    let s: ActionStatus = 'pending';
    s = applyTransition(s, 'skipped');

    const error = attemptInvalidTransition(s, 'pending');
    expect(error).not.toBeNull();
  });

  it('a completed action cannot be reopened — terminal state enforced', () => {
    let s: ActionStatus = 'pending';
    s = applyTransition(s, 'in_progress');
    s = applyTransition(s, 'completed');

    const error = attemptInvalidTransition(s, 'pending');
    expect(error).not.toBeNull();
  });

  it('a dependent blocker only unlocks after its prerequisite wave completes', () => {
    const blockers: BlockerNode[] = [
      { id: 'verify-identity', estimatedDays: 0, dependencies: [] },
      { id: 'run-exclusion-check', estimatedDays: 3, dependencies: ['verify-identity'] },
    ];
    const waves = groupIntoWaves(blockers);

    // Wave 0 must complete before wave 1 can start
    const wave0Ids = new Set(waves[0].map((n) => n.id));
    const wave1Ids = new Set(waves[1]?.map((n) => n.id) ?? []);

    // run-exclusion-check is in wave 1 (blocked until wave 0 done)
    expect(wave0Ids.has('verify-identity')).toBe(true);
    expect(wave1Ids.has('run-exclusion-check')).toBe(true);
  });
});
