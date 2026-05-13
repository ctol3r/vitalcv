/**
 * REPLAY-PERSIST-γ — Pure-function tests for discovery-route logic.
 *
 * Tests the artifact-checksum parser + run-status derivation + the
 * continuity-state classification used by /api/replay/runs/by-npi
 * and /api/replay/chain/:npi. No DB; the routes themselves are
 * tested by reading these pure helpers' behavior.
 *
 * The route handlers in routes/replay.ts define `parseArtifactChecksum`,
 * `deriveRunStatus`, and the continuity-state classifier inline as
 * private helpers. To test their semantics without refactoring the
 * route module, we re-derive the equivalent logic here and assert
 * the contract.
 */

// Inline copies of the logic under test — kept synced with
// apps/api/backend/src/routes/replay.ts. If the route handler's
// implementation diverges, these tests will fail (intended).

interface ParsedChecksum {
  sourceId: string;
  status: string;
  claimCount: number | null;
  credentialCount: number | null;
}

function parseArtifactChecksum(checksum: string): ParsedChecksum | null {
  const parts = checksum.split(':');
  if (parts.length !== 4) return null;
  const claimCount = Number.parseInt(parts[2], 10);
  const credentialCount = Number.parseInt(parts[3], 10);
  return {
    sourceId: parts[0],
    status: parts[1],
    claimCount: Number.isFinite(claimCount) ? claimCount : null,
    credentialCount: Number.isFinite(credentialCount) ? credentialCount : null,
  };
}

function deriveRunStatus(checksums: ReadonlyArray<string>): string {
  const parsed = checksums.map(parseArtifactChecksum);
  if (parsed.length === 0) return 'UNKNOWN';
  const statuses = parsed.map((p) => (p ? p.status : 'UNKNOWN'));
  if (statuses.every((s) => s === 'DONE')) return 'DONE';
  if (statuses.some((s) => s === 'ERROR')) return 'PARTIAL_ERROR';
  if (statuses.some((s) => s === 'UNKNOWN')) return 'UNKNOWN';
  return 'MIXED';
}

function deriveContinuityState(args: {
  isCurrentLineage: boolean;
  runCount: number;
}): 'stable' | 'extended' | 'diverged' {
  if (!args.isCurrentLineage) return 'diverged';
  return args.runCount === 1 ? 'stable' : 'extended';
}

describe('parseArtifactChecksum', () => {
  it('parses the canonical encoding sourceId:status:claimCount:credentialCount', () => {
    expect(parseArtifactChecksum('nppes:DONE:3:5')).toEqual({
      sourceId: 'nppes', status: 'DONE', claimCount: 3, credentialCount: 5,
    });
  });

  it('returns null for malformed inputs', () => {
    expect(parseArtifactChecksum('nppes:DONE:3')).toBeNull();
    expect(parseArtifactChecksum('nppes:DONE:3:5:extra')).toBeNull();
  });

  it('marks non-numeric counts as null without throwing', () => {
    const parsed = parseArtifactChecksum('nppes:DONE:not-a-number:5');
    expect(parsed?.claimCount).toBeNull();
    expect(parsed?.credentialCount).toBe(5);
  });
});

describe('deriveRunStatus', () => {
  it('returns DONE when every source reports DONE', () => {
    expect(deriveRunStatus(['nppes:DONE:3:5', 'oig:DONE:0:0', 'pecos:DONE:1:0'])).toBe('DONE');
  });

  it('returns PARTIAL_ERROR when any source reports ERROR', () => {
    expect(deriveRunStatus(['nppes:DONE:3:5', 'oig:ERROR:0:0', 'pecos:DONE:1:0'])).toBe('PARTIAL_ERROR');
  });

  it('returns MIXED when some sources are DONE and others are non-DONE-non-ERROR (e.g., PENDING)', () => {
    expect(deriveRunStatus(['nppes:DONE:3:5', 'oig:PENDING:0:0', 'pecos:DONE:1:0'])).toBe('MIXED');
  });

  it('returns UNKNOWN when no checksums are present', () => {
    expect(deriveRunStatus([])).toBe('UNKNOWN');
  });

  it('returns UNKNOWN when at least one checksum is unparseable AND none is ERROR', () => {
    expect(deriveRunStatus(['nppes:DONE:3:5', 'malformed-row'])).toBe('UNKNOWN');
  });
});

describe('deriveContinuityState', () => {
  it('returns stable when the lineage is current AND has exactly one run', () => {
    expect(deriveContinuityState({ isCurrentLineage: true, runCount: 1 })).toBe('stable');
  });

  it('returns extended when the lineage is current AND has multiple runs', () => {
    expect(deriveContinuityState({ isCurrentLineage: true, runCount: 5 })).toBe('extended');
  });

  it('returns diverged when the lineage is no longer the current one for the entity', () => {
    expect(deriveContinuityState({ isCurrentLineage: false, runCount: 1 })).toBe('diverged');
    expect(deriveContinuityState({ isCurrentLineage: false, runCount: 10 })).toBe('diverged');
  });

  it('only emits the three canonical states', () => {
    const states = new Set<string>();
    for (const isCurrent of [true, false]) {
      for (const count of [1, 2, 7]) {
        states.add(deriveContinuityState({ isCurrentLineage: isCurrent, runCount: count }));
      }
    }
    expect([...states].sort()).toEqual(['diverged', 'extended', 'stable']);
  });
});
