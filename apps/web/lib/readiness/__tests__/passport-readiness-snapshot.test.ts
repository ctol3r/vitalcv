import { describe, expect, it } from 'vitest';
import type { PassportData } from '@/lib/trust/passport-contract';
import {
  buildReadinessLimitations,
  buildReadinessSnapshotFromPassport,
} from '@/lib/readiness/passport-readiness-snapshot';

function passport(checks: Array<{ sourceId: string; state: string; reason?: string; checkedAt?: string | null }>, score = 62): PassportData {
  return {
    sourceCoverage: {
      checks: checks.map((c) => ({
        sourceId: c.sourceId,
        state: c.state,
        reason: c.reason ?? 'reason',
        checkedAt: c.checkedAt ?? null,
      })),
    },
    readiness: { score, gaps: ['Resolve OIG access'] },
  } as unknown as PassportData;
}

describe('buildReadinessSnapshotFromPassport', () => {
  it('maps real source coverage to lanes conservatively (only checked → verified)', () => {
    const snap = buildReadinessSnapshotFromPassport(
      passport([
        { sourceId: 'NPPES_API', state: 'checked', checkedAt: '2026-06-01T00:00:00.000Z' },
        { sourceId: 'OIG_LEIE', state: 'accessRequired' },
        { sourceId: 'STATE_BOARD', state: 'stale' },
        { sourceId: 'PECOS_PUBLIC', state: 'reviewRequired' },
      ]),
      { npi: '1234567890', name: 'Dr. Test Clinician' },
    );

    const byLane = Object.fromEntries(snap.lanes.map((l) => [l.laneId, l.status]));
    expect(byLane.nppes_identity).toBe('verified');
    expect(byLane.oig_exclusions).toBe('access_required');
    expect(byLane.state_license).toBe('stale');
    expect(byLane.pecos_enrollment).toBe('review_required');
    // sources with no check stay honestly not_checked
    expect(byLane.employment_history).toBe('not_checked');
    expect(byLane.board_cert).toBe('not_checked');

    expect(snap.npi).toBe('1234567890');
    expect(snap.score).toBe(62);
    // required lanes (nppes/oig/state_license) not all verified → partial; stale present → degraded
    expect(snap.proofTier).toBe('partial');
    expect(snap.posture).toBe('degraded');
    expect(snap.nextStep).toBe('Resolve OIG access');
  });

  it('never lets previewOnly/synthetic states read as verified', () => {
    const snap = buildReadinessSnapshotFromPassport(
      passport([{ sourceId: 'NPPES_API', state: 'previewOnly' }]),
      { npi: '1', name: 'x' },
    );
    expect(snap.lanes.find((l) => l.laneId === 'nppes_identity')?.status).toBe('not_checked');
    expect(snap.proofTier).toBe('none');
    expect(snap.posture).toBe('unchecked');
  });

  it('reaches decision_grade only when all required lanes are checked', () => {
    const snap = buildReadinessSnapshotFromPassport(
      passport([
        { sourceId: 'NPPES_API', state: 'checked' },
        { sourceId: 'OIG_LEIE', state: 'checked' },
        { sourceId: 'STATE_BOARD', state: 'checked' },
      ]),
      { npi: '1', name: 'x' },
    );
    expect(snap.proofTier).toBe('decision_grade');
    expect(snap.posture).toBe('decision_grade');
  });

  it('derives honest limitations from non-verified lanes only', () => {
    const snap = buildReadinessSnapshotFromPassport(
      passport([{ sourceId: 'NPPES_API', state: 'checked' }]),
      { npi: '1', name: 'x' },
    );
    const limitations = buildReadinessLimitations(snap);
    expect(limitations.some((l) => l.startsWith('NPPES Identity'))).toBe(false);
    expect(limitations.some((l) => l.startsWith('OIG Exclusions'))).toBe(true);
  });
});
