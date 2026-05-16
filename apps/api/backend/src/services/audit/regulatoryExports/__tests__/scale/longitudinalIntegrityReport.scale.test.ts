/**
 * longitudinalIntegrityReport scale gate (W2-PR40A)
 *
 * Asserts the longitudinal hash chain:
 *   - Identical input produces identical chainHead.
 *   - Inserting an event in an earlier window invalidates every chainHash
 *     from that window forward.
 *   - Empty windows are preserved (regulator-visible gaps).
 *   - 1000 events bucket cleanly under DAY granularity with stable hashing.
 */
import {
  buildLongitudinalIntegrityReport,
  verifyLongitudinalIntegrityReport,
  type LongitudinalEventInput,
} from '../../longitudinalIntegrityReport';

function event(
  id: string,
  occurredAt: string,
  type: LongitudinalEventInput['auditEventType'] = 'VERIFICATION_COMPLETED',
  severity: LongitudinalEventInput['severity'] = 'INFO',
  source: string | null = 'NPPES',
): LongitudinalEventInput {
  return {
    eventId: id,
    auditEventType: type,
    occurredAt,
    receiptHash: id.padEnd(64, '0'),
    source,
    severity,
  };
}

const RANGE = { from: '2026-04-01T00:00:00.000Z', to: '2026-05-01T00:00:00.000Z' };

describe('longitudinalIntegrityReport scale gate', () => {
  it('produces a deterministic chainHead for identical input', () => {
    const events = [
      event('e1', '2026-04-02T10:00:00.000Z'),
      event('e2', '2026-04-05T11:00:00.000Z'),
      event('e3', '2026-04-12T12:00:00.000Z'),
    ];
    const a = buildLongitudinalIntegrityReport({
      reportId: 'r-1',
      generatedAt: '2026-05-09T00:00:00.000Z',
      events,
      range: RANGE,
      granularity: 'DAY',
    });
    const b = buildLongitudinalIntegrityReport({
      reportId: 'r-1',
      generatedAt: '2026-05-09T00:00:00.000Z',
      events,
      range: RANGE,
      granularity: 'DAY',
    });
    expect(a.chainHead).toBe(b.chainHead);
    expect(a.reportHash).toBe(b.reportHash);
    const verdict = verifyLongitudinalIntegrityReport(a, b);
    expect(verdict.ok).toBe(true);
    expect(verdict.windowMismatchCount).toBe(0);
  });

  it('invalidates chainHash from the inserted window forward when an event is retroactively inserted', () => {
    const baseEvents = [
      event('e1', '2026-04-02T10:00:00.000Z'),
      event('e2', '2026-04-05T11:00:00.000Z'),
      event('e3', '2026-04-12T12:00:00.000Z'),
    ];
    const original = buildLongitudinalIntegrityReport({
      reportId: 'r-base',
      generatedAt: '2026-05-09T00:00:00.000Z',
      events: baseEvents,
      range: RANGE,
      granularity: 'DAY',
    });

    // Insert an event into the day of e1 (April 2). Window e1's window MUST
    // change, and every chainHash from there forward MUST diverge.
    const tampered = buildLongitudinalIntegrityReport({
      reportId: 'r-base',
      generatedAt: '2026-05-09T00:00:00.000Z',
      events: [...baseEvents, event('retro', '2026-04-02T13:00:00.000Z')],
      range: RANGE,
      granularity: 'DAY',
    });

    // Find the window containing 2026-04-02
    const dayIndex = original.windows.findIndex((w) => w.windowStart === '2026-04-02T00:00:00.000Z');
    expect(dayIndex).toBeGreaterThanOrEqual(0);
    expect(tampered.windows[dayIndex].windowHash).not.toBe(original.windows[dayIndex].windowHash);
    // Every chainHash from dayIndex onward must diverge.
    for (let i = dayIndex; i < original.windows.length; i += 1) {
      expect(tampered.windows[i].chainHash).not.toBe(original.windows[i].chainHash);
    }
    expect(tampered.chainHead).not.toBe(original.chainHead);
  });

  it('preserves empty windows so regulators see gaps', () => {
    // Only one event; the rest of April is empty.
    const events = [event('e1', '2026-04-15T12:00:00.000Z')];
    const report = buildLongitudinalIntegrityReport({
      reportId: 'r-gaps',
      generatedAt: '2026-05-09T00:00:00.000Z',
      events,
      range: RANGE,
      granularity: 'DAY',
    });
    expect(report.windows.length).toBe(30); // April has 30 days
    expect(report.totals.nonEmptyWindowCount).toBe(1);
    const empty = report.windows.filter((w) => w.eventCount === 0);
    expect(empty.length).toBe(29);
    expect(empty.every((w) => typeof w.windowHash === 'string' && w.windowHash.length === 64)).toBe(true);
  });

  it('rolls up severity counts and surfaces critical/emergency volume', () => {
    const events = [
      event('e1', '2026-04-02T10:00:00.000Z', 'VERIFICATION_COMPLETED', 'INFO'),
      event('e2', '2026-04-02T11:00:00.000Z', 'VERIFICATION_FAILED', 'WARNING'),
      event('e3', '2026-04-03T12:00:00.000Z', 'EMPLOYER_REVIEW_MUTATION_DENIED', 'CRITICAL'),
      event('e4', '2026-04-04T13:00:00.000Z', 'EMPLOYER_REVIEW_MUTATION_DENIED', 'EMERGENCY'),
    ];
    const report = buildLongitudinalIntegrityReport({
      reportId: 'r-sev',
      generatedAt: '2026-05-09T00:00:00.000Z',
      events,
      range: RANGE,
      granularity: 'DAY',
    });
    expect(report.totals.criticalOrEmergencyCount).toBe(2);
  });

  it('scales to 1000 events under DAY granularity without hash drift across runs', () => {
    const events: LongitudinalEventInput[] = Array.from({ length: 1000 }, (_, i) => {
      const dayOffset = i % 28;
      const hour = i % 24;
      const minute = i % 60;
      const ts = `2026-04-${String(dayOffset + 1).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
      return event(`evt-${i}`, ts);
    });
    const a = buildLongitudinalIntegrityReport({
      reportId: 'r-scale',
      generatedAt: '2026-05-09T00:00:00.000Z',
      events,
      range: RANGE,
      granularity: 'DAY',
    });
    const b = buildLongitudinalIntegrityReport({
      reportId: 'r-scale',
      generatedAt: '2026-05-09T00:00:00.000Z',
      events,
      range: RANGE,
      granularity: 'DAY',
    });
    expect(a.totals.eventsConsidered).toBe(1000);
    expect(b.totals.eventsConsidered).toBe(1000);
    expect(a.chainHead).toBe(b.chainHead);
    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] longitudinal-1000-events chainHead=${a.chainHead.slice(0, 16)}...`,
    );
  });

  it('throws when range.from is not strictly before range.to', () => {
    expect(() =>
      buildLongitudinalIntegrityReport({
        reportId: 'r-bad',
        generatedAt: '2026-05-09T00:00:00.000Z',
        events: [],
        range: { from: '2026-05-01T00:00:00.000Z', to: '2026-04-01T00:00:00.000Z' },
        granularity: 'DAY',
      }),
    ).toThrow(/range\.from must precede range\.to/);
  });
});
