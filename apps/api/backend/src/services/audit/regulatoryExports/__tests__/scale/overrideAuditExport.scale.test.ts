/**
 * overrideAuditExport scale gate (W2-PR40A)
 *
 * Asserts override audit exports:
 *   - Filter by entityId / clinicianNpi when supplied (cross-tenant safety).
 *   - Surface readonly-token attempts as a first-class metric.
 *   - Produce deterministic exportHashes.
 *   - Order entries by occurredAt ascending.
 */
import {
  buildOverrideAuditExport,
  type OverrideAuditInputEntry,
} from '../../overrideAuditExport';

function makeEntry(overrides: Partial<OverrideAuditInputEntry> = {}): OverrideAuditInputEntry {
  return {
    auditEventId: overrides.auditEventId ?? 'audit-1',
    auditEventType: overrides.auditEventType ?? 'EMPLOYER_REVIEW_ACCEPTED',
    occurredAt: overrides.occurredAt ?? '2026-05-01T12:00:00.000Z',
    actorId: overrides.actorId ?? 'user_employer_1',
    actorType: overrides.actorType ?? 'human',
    attributionSource: overrides.attributionSource ?? 'x-clerk-user-id',
    entityId: overrides.entityId ?? 'entity-1',
    clinicianNpi: overrides.clinicianNpi ?? '1234567890',
    reason: overrides.reason ?? null,
    outcome: overrides.outcome ?? 'allowed',
    mutationClassification: overrides.mutationClassification ?? 'TRUST_ACCEPTANCE',
    replayCategory: overrides.replayCategory ?? 'R-CAT-1',
    mutationFingerprint: overrides.mutationFingerprint ?? 'a'.repeat(64),
    payloadHash: overrides.payloadHash ?? 'b'.repeat(64),
    correlationId: overrides.correlationId ?? 'corr-1',
    attemptedByReadonly: overrides.attemptedByReadonly ?? false,
  };
}

describe('overrideAuditExport scale gate', () => {
  it('filters out cross-tenant entries by entityId', () => {
    const entries = [
      makeEntry({ auditEventId: 'a-1', entityId: 'entity-A' }),
      makeEntry({ auditEventId: 'a-2', entityId: 'entity-B' }),
      makeEntry({ auditEventId: 'a-3', entityId: 'entity-A' }),
    ];
    const exp = buildOverrideAuditExport({
      exportId: 'exp-1',
      generatedAt: '2026-05-09T00:00:00.000Z',
      filter: { entityId: 'entity-A' },
      entries,
    });
    expect(exp.summary.totalOverrides).toBe(2);
    expect(exp.entries.every((e) => e.entityId === 'entity-A')).toBe(true);
  });

  it('counts each override by type and produces an actor breakdown', () => {
    const entries = [
      makeEntry({ auditEventId: 'a-1', auditEventType: 'EMPLOYER_REVIEW_ACCEPTED' }),
      makeEntry({
        auditEventId: 'a-2',
        auditEventType: 'EMPLOYER_REVIEW_REFRESH_REQUESTED',
        actorId: 'user_employer_2',
      }),
      makeEntry({
        auditEventId: 'a-3',
        auditEventType: 'EMPLOYER_REVIEW_ROUTED_TO_REVIEW',
        actorId: 'user_employer_2',
      }),
      makeEntry({
        auditEventId: 'a-4',
        auditEventType: 'EMPLOYER_PACKET_SHARED',
        actorId: 'user_employer_1',
      }),
      makeEntry({
        auditEventId: 'a-5',
        auditEventType: 'EMPLOYER_REVIEW_MUTATION_DENIED',
        actorId: 'user_employer_1',
        outcome: 'denied',
      }),
    ];
    const exp = buildOverrideAuditExport({
      exportId: 'exp-summary',
      generatedAt: '2026-05-09T00:00:00.000Z',
      entries,
    });
    expect(exp.summary.acceptedCount).toBe(1);
    expect(exp.summary.refreshRequestCount).toBe(1);
    expect(exp.summary.routedToReviewCount).toBe(1);
    expect(exp.summary.packetSharedCount).toBe(1);
    expect(exp.summary.deniedCount).toBe(1);
    expect(exp.summary.allowedCount).toBe(4);
    // Actor breakdown sorted by count desc — both have count 2, then 1
    expect(exp.summary.actorBreakdown[0].count).toBe(3); // user_employer_1 has 3 entries
  });

  it('flags readonly-token attempts in the summary', () => {
    const entries = [
      makeEntry({ auditEventId: 'a-1' }),
      makeEntry({ auditEventId: 'a-2', attemptedByReadonly: true }),
      makeEntry({ auditEventId: 'a-3', attemptedByReadonly: true }),
    ];
    const exp = buildOverrideAuditExport({
      exportId: 'exp-readonly',
      generatedAt: '2026-05-09T00:00:00.000Z',
      entries,
    });
    expect(exp.summary.readonlyAttempts).toBe(2);
    const flagged = exp.entries.filter((e) => e.attemptedByReadonly);
    expect(flagged.length).toBe(2);
    expect(
      flagged.every((e) => e.rationale.toLowerCase().includes('read-only')),
    ).toBe(true);
  });

  it('orders entries by occurredAt ascending and produces a deterministic exportHash', () => {
    const entries = [
      makeEntry({ auditEventId: 'a-3', occurredAt: '2026-05-03T12:00:00.000Z' }),
      makeEntry({ auditEventId: 'a-1', occurredAt: '2026-05-01T12:00:00.000Z' }),
      makeEntry({ auditEventId: 'a-2', occurredAt: '2026-05-02T12:00:00.000Z' }),
    ];
    const exp = buildOverrideAuditExport({
      exportId: 'exp-order',
      generatedAt: '2026-05-09T00:00:00.000Z',
      entries,
    });
    expect(exp.entries.map((e) => e.auditEventId)).toEqual(['a-1', 'a-2', 'a-3']);

    const exp2 = buildOverrideAuditExport({
      exportId: 'exp-order',
      generatedAt: '2026-05-09T00:00:00.000Z',
      entries,
    });
    expect(exp2.exportHash).toBe(exp.exportHash);
    // eslint-disable-next-line no-console
    console.log(`[scale-board] override-export-hash=${exp.exportHash.slice(0, 16)}...`);
  });

  it('reports an empty range when there are no entries', () => {
    const exp = buildOverrideAuditExport({
      exportId: 'exp-empty',
      generatedAt: '2026-05-09T00:00:00.000Z',
      entries: [],
    });
    expect(exp.range).toEqual({ from: null, to: null });
    expect(exp.summary.totalOverrides).toBe(0);
  });
});
