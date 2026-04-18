import { describe, expect, it } from 'vitest';
import {
  createApplicationSnapshot,
  refreshApplicationSnapshot,
  requestApplicationAction,
  submitApplicationSnapshot,
  transitionApplicationStatus,
  type ApplicationSnapshot,
} from '@/lib/apply/application-snapshot';
import {
  buildPilotProofPack,
  serializePilotProofPack,
} from '@/lib/proof/pilot-proof-pack';

function mkSnap(
  id: string,
  overrides: {
    tier?: 'partial_proof_pack' | 'decision_grade_proof_pack' | 'draft_snapshot';
    createdAt?: string;
  } = {},
): ApplicationSnapshot {
  return createApplicationSnapshot({
    applicationId: id,
    subjectId: `subj_${id}`,
    employerId: 'emp_1',
    roleId: 'role_1',
    includedLanes: ['nppes', 'oig', 'pecos'],
    includedClaims: [],
    proofTier: overrides.tier ?? 'partial_proof_pack',
    completeness: 70,
    createdAt: overrides.createdAt ?? '2026-04-01T00:00:00Z',
  });
}

describe('buildPilotProofPack — empty input', () => {
  it('returns zeroed counts and explicit limitation when no applications exist', () => {
    const { pack } = buildPilotProofPack({ applications: [] });
    expect(pack.applicationCount).toBe(0);
    expect(pack.counts.applicationsSubmitted).toBe(0);
    expect(pack.counts.startedCount).toBe(0);
    expect(pack.partialDataNotice).not.toBeNull();
    expect(pack.limitations.some((l) => l.toLowerCase().includes('no applications')))
      .toBe(true);
  });

  it('all medians are null when no applications are in the set', () => {
    const { pack } = buildPilotProofPack({ applications: [] });
    expect(pack.medians.medianMinutesToFirstView).toBeNull();
    expect(pack.medians.medianDaysToStarted).toBeNull();
  });
});

describe('buildPilotProofPack — partial data honesty', () => {
  it('surfaces partialDataNotice whenever any application is missing any timeline', () => {
    const snap = submitApplicationSnapshot(mkSnap('a1'));
    const { pack } = buildPilotProofPack({ applications: [snap] });
    expect(pack.partialDataNotice).not.toBeNull();
  });

  it('never fabricates medians — only uses applications with both endpoints present', () => {
    let snap1 = submitApplicationSnapshot(mkSnap('a1'), '2026-04-01T12:00:00Z');
    snap1 = transitionApplicationStatus(snap1, 'viewed', {
      actor: 'employer',
      at: '2026-04-01T14:00:00Z',
    });
    const snap2 = submitApplicationSnapshot(mkSnap('a2'), '2026-04-02T00:00:00Z');
    // snap2 has no viewed event — should not participate in first-view median.
    const { pack } = buildPilotProofPack({ applications: [snap1, snap2] });
    // Median comes from snap1 only: 120 minutes.
    expect(pack.medians.medianMinutesToFirstView).toBe(120);
    expect(pack.counts.applicationsSubmitted).toBe(2);
    expect(pack.counts.reviewsOpened).toBe(1);
    expect(pack.limitations.some((l) => l.toLowerCase().includes('not been opened')))
      .toBe(true);
  });

  it('counts decision-grade vs partial vs draft tiers separately in tierContext', () => {
    const partial = submitApplicationSnapshot(mkSnap('p1'));
    const decisionGrade = submitApplicationSnapshot(
      mkSnap('dg1', { tier: 'decision_grade_proof_pack' }),
    );
    const { pack } = buildPilotProofPack({
      applications: [partial, decisionGrade],
    });
    expect(pack.tierContext.decisionGradeAtSubmit).toBe(1);
    expect(pack.tierContext.partialAtSubmit).toBe(1);
    expect(pack.tierContext.draftAtSubmit).toBe(0);
  });

  it('surfaces limitation line when ANY application submitted at partial tier', () => {
    const partial = submitApplicationSnapshot(mkSnap('p1'));
    const { pack } = buildPilotProofPack({ applications: [partial] });
    expect(pack.limitations.some((l) => l.toLowerCase().includes('partial'))).toBe(true);
  });
});

describe('buildPilotProofPack — open wait honesty', () => {
  it('flags applications currently in open waiting states', () => {
    let snap = submitApplicationSnapshot(mkSnap('a1'));
    snap = requestApplicationAction(snap, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-02T00:00:00Z',
    });
    const { pack } = buildPilotProofPack({ applications: [snap] });
    expect(pack.blockers.applicationsWithOpenWait).toBe(1);
    expect(pack.limitations.some((l) => l.toLowerCase().includes('open waiting'))).toBe(true);
  });

  it('medianMinutesInRefreshWait is null when no wait has closed yet', () => {
    let snap = submitApplicationSnapshot(mkSnap('a1'));
    snap = requestApplicationAction(snap, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-02T00:00:00Z',
    });
    const { pack } = buildPilotProofPack({ applications: [snap] });
    expect(pack.blockers.medianMinutesInRefreshWait).toBeNull();
  });

  it('computes medianMinutesInRefreshWait from closed waits only', () => {
    let snap1 = submitApplicationSnapshot(mkSnap('a1'));
    snap1 = requestApplicationAction(snap1, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-02T00:00:00Z',
    });
    snap1 = refreshApplicationSnapshot(snap1, {}, { at: '2026-04-02T02:00:00Z' });
    // Closed wait: 120 minutes.

    let snap2 = submitApplicationSnapshot(mkSnap('a2'));
    snap2 = requestApplicationAction(snap2, 'request_refresh', {
      actor: 'employer',
      at: '2026-04-03T00:00:00Z',
    });
    snap2 = refreshApplicationSnapshot(snap2, {}, { at: '2026-04-03T04:00:00Z' });
    // Closed wait: 240 minutes.

    const { pack } = buildPilotProofPack({ applications: [snap1, snap2] });
    expect(pack.blockers.medianMinutesInRefreshWait).toBe(180);
  });
});

describe('buildPilotProofPack — full-chain counts', () => {
  it('counts advanced / start_ready / started ONLY from real status events', () => {
    let snap = submitApplicationSnapshot(mkSnap('a1'), '2026-04-01T12:00:00Z');
    snap = transitionApplicationStatus(snap, 'viewed', { actor: 'employer', at: '2026-04-01T13:00:00Z' });
    snap = transitionApplicationStatus(snap, 'in_review', { actor: 'employer', at: '2026-04-01T14:00:00Z' });
    snap = transitionApplicationStatus(snap, 'advanced', { actor: 'employer', at: '2026-04-02T10:00:00Z' });
    snap = transitionApplicationStatus(snap, 'credentialing', { actor: 'employer', at: '2026-04-03T10:00:00Z' });
    snap = transitionApplicationStatus(snap, 'approved', { actor: 'employer', at: '2026-04-10T10:00:00Z' });
    snap = transitionApplicationStatus(snap, 'start_ready', { actor: 'employer', at: '2026-04-14T10:00:00Z' });
    snap = transitionApplicationStatus(snap, 'started', { actor: 'employer', at: '2026-04-15T08:00:00Z' });

    const { pack } = buildPilotProofPack({ applications: [snap] });
    expect(pack.counts.advancedCount).toBe(1);
    expect(pack.counts.startReadyCount).toBe(1);
    expect(pack.counts.startedCount).toBe(1);
    expect(pack.medians.medianDaysToStarted).not.toBeNull();
  });

  it('does not count a draft-only application as submitted', () => {
    const draftOnly = mkSnap('a1'); // draft, never submitted
    const { pack } = buildPilotProofPack({ applications: [draftOnly] });
    expect(pack.counts.applicationsSubmitted).toBe(0);
  });

  it('startedCount never exceeds applicationsSubmitted', () => {
    // Property: the proof pack cannot claim more started events than
    // submitted applications.
    const snap1 = submitApplicationSnapshot(mkSnap('a1'));
    const snap2 = mkSnap('a2'); // draft only
    const { pack } = buildPilotProofPack({ applications: [snap1, snap2] });
    expect(pack.counts.startedCount).toBeLessThanOrEqual(pack.counts.applicationsSubmitted);
  });
});

describe('serializePilotProofPack', () => {
  it('produces deterministic JSON for the same input', () => {
    const snap = submitApplicationSnapshot(mkSnap('a1'));
    const { pack } = buildPilotProofPack({
      applications: [snap],
      generatedAt: '2026-04-15T00:00:00Z',
    });
    const first = serializePilotProofPack(pack);
    const second = serializePilotProofPack(pack);
    expect(first).toBe(second);
  });

  it('serialized pack is valid JSON and includes limitation lines', () => {
    const snap = submitApplicationSnapshot(mkSnap('a1'));
    const { pack } = buildPilotProofPack({ applications: [snap] });
    const json = serializePilotProofPack(pack);
    const parsed = JSON.parse(json);
    expect(parsed.limitations).toBeInstanceOf(Array);
    expect(parsed.partialDataNotice).not.toBeNull();
  });
});
