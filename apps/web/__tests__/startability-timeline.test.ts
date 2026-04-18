import { describe, expect, it } from 'vitest';
import {
  createApplicationSnapshot,
  refreshApplicationSnapshot,
  requestApplicationAction,
  submitApplicationSnapshot,
  transitionApplicationStatus,
} from '@/lib/apply/application-snapshot';
import {
  deriveBlockerDurationTotals,
  deriveStartabilityMetrics,
  deriveStartabilityTimeline,
} from '@/lib/proof/startability-timeline';

function freshDraft(overrides: { createdAt?: string } = {}) {
  return createApplicationSnapshot({
    applicationId: 'app_1',
    subjectId: 's1',
    employerId: 'e1',
    roleId: 'r1',
    includedLanes: ['nppes', 'oig', 'pecos'],
    includedClaims: [],
    proofTier: 'partial_proof_pack',
    completeness: 70,
    createdAt: overrides.createdAt ?? '2026-04-01T00:00:00Z',
  });
}

// Build a snapshot that's traversed submitted -> viewed -> in_review ->
// advanced -> credentialing -> approved -> start_ready -> started, with
// fixed timestamps on each transition so we can verify deltas exactly.
function fullyProgressedSnapshot() {
  let snap = freshDraft();
  snap = submitApplicationSnapshot(snap, '2026-04-01T12:00:00Z');
  snap = transitionApplicationStatus(snap, 'viewed', {
    actor: 'employer',
    at: '2026-04-01T13:00:00Z',
  });
  snap = transitionApplicationStatus(snap, 'in_review', {
    actor: 'employer',
    at: '2026-04-01T14:00:00Z',
  });
  snap = transitionApplicationStatus(snap, 'advanced', {
    actor: 'employer',
    at: '2026-04-02T10:00:00Z',
  });
  snap = transitionApplicationStatus(snap, 'credentialing', {
    actor: 'employer',
    at: '2026-04-03T10:00:00Z',
  });
  snap = transitionApplicationStatus(snap, 'approved', {
    actor: 'employer',
    at: '2026-04-10T10:00:00Z',
  });
  snap = transitionApplicationStatus(snap, 'start_ready', {
    actor: 'employer',
    at: '2026-04-14T10:00:00Z',
  });
  snap = transitionApplicationStatus(snap, 'started', {
    actor: 'employer',
    at: '2026-04-15T08:00:00Z',
  });
  return snap;
}

describe('deriveStartabilityTimeline', () => {
  it('returns all-null timeline for a freshly created draft', () => {
    const snap = freshDraft();
    const t = deriveStartabilityTimeline(snap);
    expect(t.applicationSubmittedAt).toBeNull();
    expect(t.firstViewedAt).toBeNull();
    expect(t.firstActionAt).toBeNull();
    expect(t.reviewAdvancedAt).toBeNull();
    expect(t.startReadyAt).toBeNull();
    expect(t.startedAt).toBeNull();
  });

  it('captures the submission timestamp from the audit log', () => {
    const snap = submitApplicationSnapshot(freshDraft(), '2026-04-05T09:30:00Z');
    const t = deriveStartabilityTimeline(snap);
    expect(t.applicationSubmittedAt).toBe('2026-04-05T09:30:00Z');
  });

  it('respects caller-provided readinessAt', () => {
    const snap = submitApplicationSnapshot(freshDraft());
    const t = deriveStartabilityTimeline(snap, {
      readinessAt: '2026-03-30T00:00:00Z',
    });
    expect(t.readinessAt).toBe('2026-03-30T00:00:00Z');
  });

  it('captures the FIRST view and FIRST action (not a later one)', () => {
    let snap = submitApplicationSnapshot(freshDraft(), '2026-04-01T00:00:00Z');
    snap = transitionApplicationStatus(snap, 'viewed', {
      actor: 'employer',
      at: '2026-04-01T03:00:00Z',
    });
    snap = transitionApplicationStatus(snap, 'in_review', {
      actor: 'employer',
      at: '2026-04-01T04:00:00Z',
    });
    snap = requestApplicationAction(snap, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-01T05:00:00Z',
    });
    const t = deriveStartabilityTimeline(snap);
    expect(t.firstViewedAt).toBe('2026-04-01T03:00:00Z');
    // firstActionAt is the earliest employer-mutation entry.
    expect(t.firstActionAt).toBe('2026-04-01T03:00:00Z');
  });

  it('captures reviewAdvancedAt, startReadyAt, and startedAt on a full chain', () => {
    const snap = fullyProgressedSnapshot();
    const t = deriveStartabilityTimeline(snap, {
      readinessAt: '2026-03-31T00:00:00Z',
    });
    expect(t.reviewAdvancedAt).toBe('2026-04-02T10:00:00Z');
    expect(t.startReadyAt).toBe('2026-04-14T10:00:00Z');
    expect(t.startedAt).toBe('2026-04-15T08:00:00Z');
  });

  it('NEVER fabricates timestamps — missing readinessAt stays null', () => {
    const snap = submitApplicationSnapshot(freshDraft());
    const t = deriveStartabilityTimeline(snap);
    expect(t.readinessAt).toBeNull();
  });
});

describe('deriveStartabilityMetrics', () => {
  it('returns all-null metrics and chainComplete=false for an empty timeline', () => {
    const t = deriveStartabilityTimeline(freshDraft());
    const m = deriveStartabilityMetrics(t);
    expect(m.minutesToSubmit).toBeNull();
    expect(m.minutesToFirstView).toBeNull();
    expect(m.minutesToFirstAction).toBeNull();
    expect(m.minutesToReviewAdvanced).toBeNull();
    expect(m.daysToStartReady).toBeNull();
    expect(m.daysToStarted).toBeNull();
    expect(m.chainComplete).toBe(false);
    expect(m.missingTimestamps.length).toBeGreaterThan(0);
  });

  it('computes minutesToFirstView exactly for a submitted-then-viewed chain', () => {
    let snap = submitApplicationSnapshot(freshDraft(), '2026-04-01T12:00:00Z');
    snap = transitionApplicationStatus(snap, 'viewed', {
      actor: 'employer',
      at: '2026-04-01T14:30:00Z',
    });
    const metrics = deriveStartabilityMetrics(deriveStartabilityTimeline(snap));
    expect(metrics.minutesToFirstView).toBe(150);
  });

  it('computes daysToStarted with one-decimal precision', () => {
    const snap = fullyProgressedSnapshot();
    const metrics = deriveStartabilityMetrics(deriveStartabilityTimeline(snap));
    // submit 2026-04-01T12:00:00Z -> started 2026-04-15T08:00:00Z = 13.83 days
    expect(metrics.daysToStarted).toBeCloseTo(13.8, 1);
  });

  it('chainComplete becomes true only when every timestamp is populated', () => {
    const snap = fullyProgressedSnapshot();
    const t = deriveStartabilityTimeline(snap, { readinessAt: '2026-03-31T00:00:00Z' });
    const metrics = deriveStartabilityMetrics(t);
    expect(metrics.chainComplete).toBe(true);
    expect(metrics.missingTimestamps).toEqual([]);
  });

  it('missingTimestamps names the exact gaps when partial', () => {
    const snap = submitApplicationSnapshot(freshDraft());
    const t = deriveStartabilityTimeline(snap);
    const metrics = deriveStartabilityMetrics(t);
    expect(metrics.missingTimestamps).toContain('readinessAt');
    expect(metrics.missingTimestamps).toContain('firstViewedAt');
    expect(metrics.missingTimestamps).toContain('startedAt');
  });

  it('never returns a negative delta (rejects inverted timestamps)', () => {
    // Invent an inverted timeline — start BEFORE submit.
    const t = deriveStartabilityTimeline(
      submitApplicationSnapshot(freshDraft({ createdAt: '2026-04-10T00:00:00Z' }), '2026-04-10T12:00:00Z'),
      { readinessAt: '2026-04-20T00:00:00Z' }, // readiness AFTER submit, impossible
    );
    const metrics = deriveStartabilityMetrics(t);
    expect(metrics.minutesToSubmit).toBeNull();
  });
});

describe('deriveBlockerDurationTotals', () => {
  it('counts refresh requests across the application lifetime', () => {
    let snap = submitApplicationSnapshot(freshDraft());
    snap = requestApplicationAction(snap, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-02T00:00:00Z',
    });
    snap = refreshApplicationSnapshot(snap, {}, { at: '2026-04-02T06:00:00Z' });
    snap = requestApplicationAction(snap, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-03T00:00:00Z',
    });
    const totals = deriveBlockerDurationTotals(snap);
    expect(totals.refreshRequestCount).toBe(2);
  });

  it('sums closed refresh-wait intervals and leaves open waits null', () => {
    let snap = submitApplicationSnapshot(freshDraft());
    snap = requestApplicationAction(snap, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-02T00:00:00Z',
    });
    snap = refreshApplicationSnapshot(snap, {}, { at: '2026-04-02T06:00:00Z' });
    // First wait closed: 6 hours = 360 minutes
    const afterClosed = deriveBlockerDurationTotals(snap);
    expect(afterClosed.minutesInRefreshWait).toBe(360);
    expect(afterClosed.hasOpenWait).toBe(false);

    // Open a second wait — should keep the 360 accumulated and mark open
    snap = requestApplicationAction(snap, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-03T00:00:00Z',
    });
    const afterOpen = deriveBlockerDurationTotals(snap);
    expect(afterOpen.minutesInRefreshWait).toBe(360); // unchanged
    expect(afterOpen.hasOpenWait).toBe(true);
  });

  it('returns null minutesInRefreshWait when no wait has ever closed', () => {
    let snap = submitApplicationSnapshot(freshDraft());
    snap = requestApplicationAction(snap, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-02T00:00:00Z',
    });
    const totals = deriveBlockerDurationTotals(snap);
    expect(totals.minutesInRefreshWait).toBeNull();
    expect(totals.hasOpenWait).toBe(true);
  });
});
