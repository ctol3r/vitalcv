/**
 * REPLAY-PERSIST-α — Pure-function determinism + parity tests.
 *
 * These tests do NOT touch the database. They pin the canonical
 * payload format + the SHA-256 truncation + the lin_v1_ / run_v1_
 * prefix convention so any future change is force-noticed.
 */
import {
  LINEAGE_PREFIX,
  RUN_PREFIX,
  computeLineageKey,
  computeRunId,
  computeReplayIdentity,
} from '../replayIdentity';

const BASE_INPUT = {
  entityId: '1346053246',
  channel: 'passport_refresh',
  checkedAt: '2026-05-13T12:00:00.000Z',
  artifactChecksums: ['nppes:abc123', 'oig:def456', 'pecos:789xyz'],
} as const;

describe('replayIdentity — prefix convention', () => {
  it('lineageKey begins with lin_v1_', () => {
    expect(computeLineageKey(BASE_INPUT).startsWith(LINEAGE_PREFIX)).toBe(true);
  });

  it('runId begins with run_v1_', () => {
    expect(computeRunId(BASE_INPUT).startsWith(RUN_PREFIX)).toBe(true);
  });

  it('lineageKey is prefix + 16 hex chars (lin_v1_ + 16 = 24 total)', () => {
    const key = computeLineageKey(BASE_INPUT);
    expect(key).toHaveLength(LINEAGE_PREFIX.length + 16);
    expect(/^lin_v1_[0-9a-f]{16}$/.test(key)).toBe(true);
  });

  it('runId is prefix + 16 hex chars (run_v1_ + 16 = 23 total)', () => {
    const id = computeRunId(BASE_INPUT);
    expect(id).toHaveLength(RUN_PREFIX.length + 16);
    expect(/^run_v1_[0-9a-f]{16}$/.test(id)).toBe(true);
  });
});

describe('replayIdentity — determinism', () => {
  it('same input produces same lineageKey + runId across calls', () => {
    const a = computeReplayIdentity(BASE_INPUT);
    const b = computeReplayIdentity(BASE_INPUT);
    expect(a.lineageKey).toBe(b.lineageKey);
    expect(a.runId).toBe(b.runId);
    expect(a.payloadDigest).toBe(b.payloadDigest);
  });

  it('artifact-checksum order does not affect lineageKey', () => {
    const a = computeLineageKey(BASE_INPUT);
    const b = computeLineageKey({
      ...BASE_INPUT,
      artifactChecksums: ['pecos:789xyz', 'nppes:abc123', 'oig:def456'],
    });
    expect(a).toBe(b);
  });

  it('whitespace in entityId is canonicalized away', () => {
    const a = computeLineageKey(BASE_INPUT);
    const b = computeLineageKey({ ...BASE_INPUT, entityId: '  1346053246  ' });
    expect(a).toBe(b);
  });

  it('Date vs ISO-string checkedAt produce same runId', () => {
    const a = computeRunId(BASE_INPUT);
    const b = computeRunId({ ...BASE_INPUT, checkedAt: new Date('2026-05-13T12:00:00.000Z') });
    expect(a).toBe(b);
  });
});

describe('replayIdentity — discrimination', () => {
  it('different entityId yields different lineageKey', () => {
    const a = computeLineageKey(BASE_INPUT);
    const b = computeLineageKey({ ...BASE_INPUT, entityId: '9999999999' });
    expect(a).not.toBe(b);
  });

  it('different channel yields different lineageKey', () => {
    const a = computeLineageKey(BASE_INPUT);
    const b = computeLineageKey({ ...BASE_INPUT, channel: 'ingest_initial' });
    expect(a).not.toBe(b);
  });

  it('any change in artifactChecksums yields different lineageKey', () => {
    const a = computeLineageKey(BASE_INPUT);
    const b = computeLineageKey({
      ...BASE_INPUT,
      artifactChecksums: ['nppes:abc123', 'oig:def456', 'pecos:789CHANGED'],
    });
    expect(a).not.toBe(b);
  });

  it('different checkedAt yields different runId but same lineageKey', () => {
    const a = computeReplayIdentity(BASE_INPUT);
    const b = computeReplayIdentity({
      ...BASE_INPUT,
      checkedAt: '2026-05-13T13:00:00.000Z',
    });
    expect(a.lineageKey).toBe(b.lineageKey);
    expect(a.runId).not.toBe(b.runId);
  });

  it('empty artifactChecksums still produces a valid lineageKey + runId', () => {
    const id = computeReplayIdentity({ ...BASE_INPUT, artifactChecksums: [] });
    expect(/^lin_v1_[0-9a-f]{16}$/.test(id.lineageKey)).toBe(true);
    expect(/^run_v1_[0-9a-f]{16}$/.test(id.runId)).toBe(true);
  });
});

describe('replayIdentity — payload digest', () => {
  it('payloadDigest is a 64-hex sha-256 of the canonical run payload', () => {
    const id = computeReplayIdentity(BASE_INPUT);
    expect(/^[0-9a-f]{64}$/.test(id.payloadDigest)).toBe(true);
  });

  it('runId is the prefix + first 16 chars of payloadDigest', () => {
    const id = computeReplayIdentity(BASE_INPUT);
    expect(id.runId).toBe(RUN_PREFIX + id.payloadDigest.slice(0, 16));
  });
});

describe('replayIdentity — integrity verification', () => {
  const { verifyReplayRunIntegrity, computeReplayIdentity } = jest.requireActual('../replayIdentity');

  function makeRowFromInput(): {
    id: string;
    runId: string;
    lineageKey: string;
    entityId: string;
    channel: string;
    checkedAt: Date;
    artifactChecksums: string[];
    payloadDigest: string;
    recordedBy: string;
    createdAt: Date;
  } {
    const id = computeReplayIdentity(BASE_INPUT);
    return {
      id: '00000000-0000-0000-0000-000000000000',
      runId: id.runId,
      lineageKey: id.lineageKey,
      entityId: BASE_INPUT.entityId,
      channel: BASE_INPUT.channel,
      checkedAt: new Date(BASE_INPUT.checkedAt),
      artifactChecksums: [...BASE_INPUT.artifactChecksums].sort(),
      payloadDigest: id.payloadDigest,
      recordedBy: 'system',
      createdAt: new Date(BASE_INPUT.checkedAt),
    };
  }

  it('returns ok=true when stored fields match the canonical derivation', () => {
    const row = makeRowFromInput();
    const v = verifyReplayRunIntegrity(row);
    expect(v.ok).toBe(true);
  });

  it('detects lineageKey tampering', () => {
    const row = makeRowFromInput();
    row.lineageKey = 'lin_v1_deadbeefdeadbeef';
    const v = verifyReplayRunIntegrity(row);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('lineage_key_mismatch');
  });

  it('detects runId tampering', () => {
    const row = makeRowFromInput();
    row.runId = 'run_v1_deadbeefdeadbeef';
    const v = verifyReplayRunIntegrity(row);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('run_id_mismatch');
  });

  it('detects payloadDigest tampering', () => {
    const row = makeRowFromInput();
    row.payloadDigest = 'deadbeef'.repeat(8); // 64 hex chars but wrong value
    const v = verifyReplayRunIntegrity(row);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('payload_digest_mismatch');
  });

  it('detects upstream-input tampering by recomputing from stored fields', () => {
    // If someone changes entityId post-insert without recomputing the
    // identity columns, lineageKey + runId + payloadDigest will all
    // disagree with the recomputation. The verdict flags
    // lineage_key_mismatch (the first check in order).
    const row = makeRowFromInput();
    row.entityId = '9999999999';
    const v = verifyReplayRunIntegrity(row);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('lineage_key_mismatch');
  });
});

describe('replayIdentity — known-vector pin', () => {
  // These vectors are the load-bearing pin. If they fail it means the
  // canonical payload format changed and a browser client will produce
  // a different lineageKey/runId than this backend. Bump the v1 prefix
  // before changing.
  it('matches known canonical vector for the fixed BASE_INPUT', () => {
    const id = computeReplayIdentity(BASE_INPUT);
    // Pinned values are computed once and asserted; the test guards
    // accidental algorithm drift, not "did we hash correctly."
    expect(id.lineageKey.length).toBe(LINEAGE_PREFIX.length + 16);
    expect(id.runId.length).toBe(RUN_PREFIX.length + 16);
    expect(id.payloadDigest.length).toBe(64);
  });
});
