/**
 * W3-PR213A — buildPassportLineage pure-function lockdown.
 *
 * Tests the bridge between IngestEvent Prisma rows and the lineage
 * primitive from #313. Pure transform — runs without a DB. The live
 * wiring step (call site in passport.ts that queries Prisma + attaches
 * the lineage to the response) is documented as out-of-scope in the
 * PR body; it requires integration tests against the project's
 * Postgres fixture.
 */

import { buildPassportLineage, type IngestEventRow } from '../buildPassportLineage';
import { verifyReplayLineageDigest } from '../replayLineage';

const NOW = '2026-05-11T00:00:00Z';
const RUN_ID = 'run-1346053246-1715000000000';

function row(overrides: Partial<IngestEventRow> = {}): IngestEventRow {
  return {
    ingestRunId: RUN_ID,
    sequence: 0,
    eventType: 'source_start',
    sourceId: 'nppes',
    payload: {},
    createdAt: new Date('2026-05-11T00:00:01Z'),
    ...overrides,
  };
}

function basicRows(): IngestEventRow[] {
  return [
    row({ sequence: 0, eventType: 'source_start',    sourceId: 'nppes', createdAt: new Date('2026-05-11T00:00:01Z') }),
    row({ sequence: 1, eventType: 'source_complete', sourceId: 'nppes', createdAt: new Date('2026-05-11T00:00:02Z') }),
    row({ sequence: 2, eventType: 'source_start',    sourceId: 'oig',   createdAt: new Date('2026-05-11T00:00:03Z') }),
    row({ sequence: 3, eventType: 'source_complete', sourceId: 'oig',   createdAt: new Date('2026-05-11T00:00:04Z') }),
    row({ sequence: 4, eventType: 'passport_ready',  sourceId: null,    createdAt: new Date('2026-05-11T00:00:05Z') }),
  ];
}

describe('W3-PR213A — buildPassportLineage: structural null returns', () => {
  it('returns null when runId is missing', () => {
    expect(buildPassportLineage({ rows: basicRows(), runId: null, nowIso: NOW })).toBeNull();
    expect(buildPassportLineage({ rows: basicRows(), runId: '', nowIso: NOW })).toBeNull();
    expect(buildPassportLineage({ rows: basicRows(), runId: undefined, nowIso: NOW })).toBeNull();
  });

  it('returns null when rows is empty', () => {
    expect(buildPassportLineage({ rows: [], runId: RUN_ID, nowIso: NOW })).toBeNull();
  });

  it('returns null when rows is null/undefined', () => {
    expect(buildPassportLineage({ rows: null, runId: RUN_ID, nowIso: NOW })).toBeNull();
    expect(buildPassportLineage({ rows: undefined, runId: RUN_ID, nowIso: NOW })).toBeNull();
  });
});

describe('W3-PR213A — buildPassportLineage: ordering + determinism', () => {
  it('sorts events by sequence ASC regardless of input order', () => {
    // Shuffle the input rows.
    const shuffled = [...basicRows()].reverse();
    const lineage = buildPassportLineage({
      rows: shuffled,
      runId: RUN_ID,
      nowIso: NOW,
    });
    expect(lineage).not.toBeNull();
    const types = lineage!.events.map((e) => e.eventType);
    expect(types).toEqual([
      'source_start',
      'source_complete',
      'source_start',
      'source_complete',
      'passport_ready',
    ]);
  });

  it('produces the same digest regardless of input row order (sort-stable)', () => {
    const forward = buildPassportLineage({ rows: basicRows(),                runId: RUN_ID, nowIso: NOW });
    const reversed = buildPassportLineage({ rows: [...basicRows()].reverse(), runId: RUN_ID, nowIso: NOW });
    expect(forward!.eventDigest).toBe(reversed!.eventDigest);
  });

  it('verifyReplayLineageDigest passes on a freshly-built lineage', () => {
    const lineage = buildPassportLineage({ rows: basicRows(), runId: RUN_ID, nowIso: NOW });
    expect(verifyReplayLineageDigest(lineage!)).toBe(true);
  });
});

describe('W3-PR213A — buildPassportLineage: comprehensive flag', () => {
  it('comprehensive=true when every claimed source has a source_complete', () => {
    const lineage = buildPassportLineage({
      rows: basicRows(),
      runId: RUN_ID,
      claimedSources: ['nppes', 'oig'],
      nowIso: NOW,
    });
    expect(lineage!.comprehensive).toBe(true);
  });

  it('comprehensive=false when a claimed source is missing', () => {
    const lineage = buildPassportLineage({
      rows: basicRows(),
      runId: RUN_ID,
      claimedSources: ['nppes', 'oig', 'pecos'],
      nowIso: NOW,
    });
    expect(lineage!.comprehensive).toBe(false);
  });

  it('claimedSources omitted → comprehensive=true (caller waives check)', () => {
    const lineage = buildPassportLineage({
      rows: basicRows(),
      runId: RUN_ID,
      nowIso: NOW,
    });
    expect(lineage!.comprehensive).toBe(true);
  });
});

describe('W3-PR213A — buildPassportLineage: row → IngestEventLike mapping', () => {
  it('sourceId null is normalized to lineage event sourceId null', () => {
    const lineage = buildPassportLineage({
      rows: [
        row({ sequence: 0, eventType: 'passport_ready', sourceId: null }),
      ],
      runId: RUN_ID,
      nowIso: NOW,
    });
    expect(lineage!.events[0]!.sourceId).toBeNull();
  });

  it('createdAt Date is serialized to ISO string', () => {
    const lineage = buildPassportLineage({
      rows: [
        row({
          sequence: 0,
          eventType: 'source_complete',
          sourceId: 'nppes',
          createdAt: new Date('2026-05-11T12:34:56.789Z'),
        }),
      ],
      runId: RUN_ID,
      nowIso: NOW,
    });
    expect(lineage!.events[0]!.observedAt).toBe('2026-05-11T12:34:56.789Z');
  });

  it('createdAt ISO string is passed through unchanged', () => {
    const lineage = buildPassportLineage({
      rows: [
        row({
          sequence: 0,
          eventType: 'source_complete',
          sourceId: 'nppes',
          createdAt: '2026-05-11T08:00:00Z',
        }),
      ],
      runId: RUN_ID,
      nowIso: NOW,
    });
    expect(lineage!.events[0]!.observedAt).toBe('2026-05-11T08:00:00Z');
  });

  it('payload is passed through (used for eventId extraction if present)', () => {
    const lineage = buildPassportLineage({
      rows: [
        row({ sequence: 0, eventType: 'source_complete', sourceId: 'nppes', payload: { eventId: 'evt-canonical-1' } }),
      ],
      runId: RUN_ID,
      nowIso: NOW,
    });
    expect(lineage!.events[0]!.eventId).toBe('evt-canonical-1');
  });
});

describe('W3-PR213A — buildPassportLineage: output is frozen', () => {
  it('returned lineage is frozen', () => {
    const lineage = buildPassportLineage({ rows: basicRows(), runId: RUN_ID, nowIso: NOW });
    expect(Object.isFrozen(lineage)).toBe(true);
  });

  it('events array is frozen', () => {
    const lineage = buildPassportLineage({ rows: basicRows(), runId: RUN_ID, nowIso: NOW });
    expect(Object.isFrozen(lineage!.events)).toBe(true);
  });

  it('does not mutate the input rows array', () => {
    const rows = basicRows();
    const originalOrder = rows.map((r) => r.sequence);
    buildPassportLineage({ rows, runId: RUN_ID, nowIso: NOW });
    expect(rows.map((r) => r.sequence)).toEqual(originalOrder);
  });
});

describe('W3-PR213A — source-level pin: integration call site documented', () => {
  it('module documents the next-step call site shape', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(
      path.resolve(__dirname, '../buildPassportLineage.ts'),
      'utf8',
    ) as string;
    // The comment block documents the call site so future PRs can
    // wire it without re-deriving the contract.
    expect(src).toContain('await prisma.ingestEvent.findMany');
    expect(src).toContain('buildPassportLineage');
    expect(src).toContain('runId');
  });
});
