/**
 * W3-PR210A — passport replay lineage lockdown.
 *
 * Pins the truth-contract behavior of the replay-lineage primitives
 * and their round-trip through `normalizePassportData`. Closes the
 * gap audited in W3-PR209A (PR #306): PassportData now has a place
 * for the SSE event sequence and a verifier can prove provenance
 * from the artifact alone via `verifyReplayLineageDigest`.
 */

import { describe, expect, it } from 'vitest';

import {
  buildReplayLineage,
  computeEventDigest,
  normalizeReplayLineage,
  verifyReplayLineageDigest,
  type IngestEventLike,
  type ReplayLineage,
} from '../lib/trust/replay-lineage';
const NOW = '2026-05-11T00:00:00Z';
const RUN_ID = 'run-1346053246-1715000000000';

function basicEvents(): IngestEventLike[] {
  return [
    { type: 'source_start',    sourceId: 'nppes', timestamp: '2026-05-11T00:00:01Z', payload: {} },
    { type: 'source_complete', sourceId: 'nppes', timestamp: '2026-05-11T00:00:02Z', payload: {} },
    { type: 'source_start',    sourceId: 'oig',   timestamp: '2026-05-11T00:00:03Z', payload: {} },
    { type: 'source_complete', sourceId: 'oig',   timestamp: '2026-05-11T00:00:04Z', payload: {} },
    { type: 'passport_ready',  timestamp: '2026-05-11T00:00:05Z', payload: {} },
  ];
}

describe('W3-PR210A — buildReplayLineage: structural invariants', () => {
  it('returns null when runId is missing', () => {
    expect(buildReplayLineage({ runId: null, events: basicEvents(), nowIso: NOW })).toBeNull();
    expect(buildReplayLineage({ runId: '', events: basicEvents(), nowIso: NOW })).toBeNull();
    expect(buildReplayLineage({ runId: undefined, events: basicEvents(), nowIso: NOW })).toBeNull();
  });

  it('returns null when events array is empty', () => {
    expect(buildReplayLineage({ runId: RUN_ID, events: [], nowIso: NOW })).toBeNull();
  });

  it('skips malformed events but returns lineage if any survive', () => {
    const events = [
      { type: 'source_start', sourceId: 'nppes', timestamp: 'valid-ts', payload: {} },
      // malformed — missing timestamp
      { type: 'source_complete', sourceId: 'nppes' } as unknown as IngestEventLike,
      { type: 'done', timestamp: '2026-05-11T00:00:05Z', payload: {} },
    ];
    const lineage = buildReplayLineage({ runId: RUN_ID, events, nowIso: NOW });
    expect(lineage).not.toBeNull();
    expect(lineage!.events).toHaveLength(2);
  });

  it('returns null if every event is malformed', () => {
    const events = [
      { type: 'source_start' } as unknown as IngestEventLike,
      { sourceId: 'oig' } as unknown as IngestEventLike,
    ];
    expect(buildReplayLineage({ runId: RUN_ID, events, nowIso: NOW })).toBeNull();
  });

  it('returned lineage is frozen', () => {
    const lineage = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    expect(Object.isFrozen(lineage)).toBe(true);
    expect(Object.isFrozen(lineage!.events)).toBe(true);
  });

  it('events array preserves insertion order', () => {
    const lineage = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    const types = lineage!.events.map((e) => e.eventType);
    expect(types).toEqual([
      'source_start',
      'source_complete',
      'source_start',
      'source_complete',
      'passport_ready',
    ]);
  });
});

describe('W3-PR210A — eventDigest determinism', () => {
  it('produces the same digest for the same input', () => {
    const a = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    const b = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: '2026-05-11T00:01:00Z' });
    // sealedAt differs but digest does NOT depend on sealedAt
    expect(a!.eventDigest).toBe(b!.eventDigest);
  });

  it('produces a different digest when runId changes', () => {
    const a = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    const b = buildReplayLineage({ runId: 'different-run', events: basicEvents(), nowIso: NOW });
    expect(a!.eventDigest).not.toBe(b!.eventDigest);
  });

  it('produces a different digest when events change', () => {
    const a = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    const extra = [
      ...basicEvents(),
      { type: 'done', timestamp: '2026-05-11T00:00:06Z', payload: {} },
    ];
    const b = buildReplayLineage({ runId: RUN_ID, events: extra, nowIso: NOW });
    expect(a!.eventDigest).not.toBe(b!.eventDigest);
  });

  it('digest is a 64-char lowercase hex string (SHA-256 hex)', () => {
    const lineage = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    expect(lineage!.eventDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computeEventDigest matches the lineage digest exactly', () => {
    const lineage = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    expect(computeEventDigest(lineage!.runId, lineage!.events)).toBe(lineage!.eventDigest);
  });
});

describe('W3-PR210A — comprehensive flag derivation', () => {
  it('comprehensive=true when every claimed source has a source_complete event', () => {
    const lineage = buildReplayLineage({
      runId: RUN_ID,
      events: basicEvents(),
      claimedSources: ['nppes', 'oig'],
      nowIso: NOW,
    });
    expect(lineage!.comprehensive).toBe(true);
  });

  it('comprehensive=false when a claimed source has no source_complete event', () => {
    const lineage = buildReplayLineage({
      runId: RUN_ID,
      events: basicEvents(),
      claimedSources: ['nppes', 'oig', 'pecos'],
      nowIso: NOW,
    });
    expect(lineage!.comprehensive).toBe(false);
  });

  it('comprehensive=true by default when no claimedSources are pinned (caller waived check)', () => {
    const lineage = buildReplayLineage({
      runId: RUN_ID,
      events: basicEvents(),
      nowIso: NOW,
    });
    expect(lineage!.comprehensive).toBe(true);
  });

  it('comprehensive=false when a claimed source has only source_start (no complete)', () => {
    const events = [
      { type: 'source_start', sourceId: 'nppes', timestamp: '2026-05-11T00:00:01Z', payload: {} },
      // no source_complete for nppes
    ];
    const lineage = buildReplayLineage({
      runId: RUN_ID,
      events,
      claimedSources: ['nppes'],
      nowIso: NOW,
    });
    expect(lineage!.comprehensive).toBe(false);
  });
});

describe('W3-PR210A — verifyReplayLineageDigest', () => {
  it('returns true for a freshly built lineage', () => {
    const lineage = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    expect(verifyReplayLineageDigest(lineage!)).toBe(true);
  });

  it('returns false when the digest has been tampered with', () => {
    const lineage = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    const tampered = { ...lineage!, eventDigest: 'a'.repeat(64) };
    expect(verifyReplayLineageDigest(tampered as ReplayLineage)).toBe(false);
  });

  it('returns false when events have been swapped without re-digesting', () => {
    const lineage = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    const swapped: ReplayLineage = {
      ...lineage!,
      // Replace events but keep the original digest — verifier should catch this.
      events: lineage!.events.slice(0, 2),
    };
    expect(verifyReplayLineageDigest(swapped)).toBe(false);
  });
});

describe('W3-PR210A — normalizeReplayLineage', () => {
  it('null/undefined/non-object input → null', () => {
    expect(normalizeReplayLineage(null)).toBeNull();
    expect(normalizeReplayLineage(undefined)).toBeNull();
    expect(normalizeReplayLineage('not-an-object')).toBeNull();
    expect(normalizeReplayLineage(42)).toBeNull();
    expect(normalizeReplayLineage([])).toBeNull();
  });

  it('missing required fields → null (no synthesis)', () => {
    expect(normalizeReplayLineage({ runId: 'r1' })).toBeNull();
    expect(normalizeReplayLineage({ runId: 'r1', eventDigest: 'x' })).toBeNull();
    expect(normalizeReplayLineage({ runId: 'r1', sealedAt: NOW })).toBeNull();
  });

  it('round-trips a valid lineage', () => {
    const original = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    const roundtripped = normalizeReplayLineage(JSON.parse(JSON.stringify(original)));
    expect(roundtripped).not.toBeNull();
    expect(roundtripped!.runId).toBe(original!.runId);
    expect(roundtripped!.eventDigest).toBe(original!.eventDigest);
    expect(roundtripped!.events).toHaveLength(original!.events.length);
    expect(verifyReplayLineageDigest(roundtripped!)).toBe(true);
  });

  it('drops malformed event entries silently — surviving events still round-trip', () => {
    const original = buildReplayLineage({ runId: RUN_ID, events: basicEvents(), nowIso: NOW });
    const tampered = {
      ...original,
      events: [
        ...original!.events,
        { eventId: 'bad' }, // missing eventType + observedAt
        null,
      ],
    };
    const roundtripped = normalizeReplayLineage(tampered);
    expect(roundtripped).not.toBeNull();
    expect(roundtripped!.events).toHaveLength(original!.events.length);
  });
});

describe('W3-PR210A — passport-contract.ts integration (source-level audit)', () => {
  // Constructing a fixture that satisfies the 60+ field isPassportData
  // validator is brittle and would couple this test to unrelated
  // schema changes. Instead we assert at the source-text level that
  // the extension wires up the round-trip correctly. The actual
  // normalizer behavior is covered by the normalizeReplayLineage
  // tests above.
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const CONTRACT_SRC = fs.readFileSync(
    path.resolve(__dirname, '../lib/trust/passport-contract.ts'),
    'utf8',
  );

  it('PassportData type carries an optional replayLineage field', () => {
    expect(CONTRACT_SRC).toMatch(/replayLineage\?:\s*ReplayLineage\s*\|\s*null/);
  });

  it('passport-contract.ts imports normalizeReplayLineage', () => {
    expect(CONTRACT_SRC).toContain("import {\n  normalizeReplayLineage,\n  type ReplayLineage,\n} from '@/lib/trust/replay-lineage'");
  });

  it('normalizePassportData calls normalizeReplayLineage on the raw payload field', () => {
    expect(CONTRACT_SRC).toContain('normalizeReplayLineage(');
  });

  it('normalizer preserves replayLineage in the output when present', () => {
    // The conditional-spread shape: `...(typeof normalizedReplayLineage === 'undefined' ? {} : { replayLineage: normalizedReplayLineage })`.
    expect(CONTRACT_SRC).toMatch(
      /normalizedReplayLineage[\s\S]*replayLineage:\s*normalizedReplayLineage/,
    );
  });

  it('does not synthesize a lineage when input field is absent', () => {
    // When typeof passport.replayLineage === 'undefined', the
    // normalizer returns undefined; the spread above adds nothing
    // to the output. No synthesis path.
    expect(CONTRACT_SRC).toContain("typeof (passport as { replayLineage?: unknown }).replayLineage === 'undefined'");
  });
});

describe('W3-PR210A — banned-strings scan on touched files', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const LINEAGE_SRC = fs.readFileSync(
    path.resolve(__dirname, '../lib/trust/replay-lineage.ts'),
    'utf8',
  );
  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['complete', 'credentialing'].join(' '),
    ['instant', 'credentialing'].join(' '),
    ['legally', 'accepted'].join(' '),
    ['risk', 'transferred'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];
  it.each(BANNED)('replay-lineage.ts does not contain banned phrase: %s', (phrase) => {
    expect(LINEAGE_SRC).not.toContain(phrase);
  });
});
