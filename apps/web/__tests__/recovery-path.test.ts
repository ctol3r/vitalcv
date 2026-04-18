import { describe, expect, it } from 'vitest';
import { ACTION_OWNER } from '@/lib/trust/action-owner';
import {
  getLaneLabel,
  resolvePassportContinuation,
  resolveRecoveryPath,
  type SourceLane,
  type SourceLaneState,
} from '@/lib/trust/recovery-path';

const LANES: SourceLane[] = ['nppes', 'oig', 'pecos', 'state_board'];
const STATES: SourceLaneState[] = [
  'pending',
  'checked',
  'review_required',
  'unavailable',
  'access_required',
  'stale',
  'no_record',
];

describe('resolveRecoveryPath', () => {
  it('returns a non-empty laneLabel and statusLabel for every (lane, state) pair', () => {
    for (const lane of LANES) {
      for (const state of STATES) {
        const path = resolveRecoveryPath(lane, state);
        expect(path.laneLabel.length).toBeGreaterThan(0);
        expect(path.statusLabel.length).toBeGreaterThan(0);
      }
    }
  });

  it('never relabels an unavailable lane as "Checking…" or any progress phrase', () => {
    for (const lane of LANES) {
      const path = resolveRecoveryPath(lane, 'unavailable');
      expect(path.statusLabel.toLowerCase()).not.toContain('checking');
      expect(path.statusLabel.toLowerCase()).not.toContain('loading');
      expect(path.statusLabel.toLowerCase()).not.toContain('verifying');
      // The honest posture is "unavailable" or "source unavailable"
      expect(path.statusLabel.toLowerCase()).toContain('unavailable');
    }
  });

  it('never assigns an unavailable lane to USER — recovery is VitalCV-owned', () => {
    for (const lane of LANES) {
      const path = resolveRecoveryPath(lane, 'unavailable');
      expect(path.owner).not.toBe(ACTION_OWNER.USER);
      expect(path.owner).toBe(ACTION_OWNER.VITALCV);
    }
  });

  it('never assigns access_required to USER — institutional gates are not clinician defects', () => {
    for (const lane of LANES) {
      const path = resolveRecoveryPath(lane, 'access_required');
      expect(path.owner).not.toBe(ACTION_OWNER.USER);
    }
  });

  it('state_board access_required is routed through the institution-owned contract', () => {
    const path = resolveRecoveryPath('state_board', 'access_required');
    expect(path.owner).toBe(ACTION_OWNER.INSTITUTION);
    expect(path.canContinuePartial).toBe(true);
  });

  it('pending never renders a retry CTA (nothing has failed yet)', () => {
    for (const lane of LANES) {
      const path = resolveRecoveryPath(lane, 'pending');
      expect(path.actionType).toBe('none');
      expect(path.ctaLabel).toBeNull();
    }
  });

  it('review_required never permits partial continuation — a reviewer must see it', () => {
    for (const lane of LANES) {
      const path = resolveRecoveryPath(lane, 'review_required');
      expect(path.canContinuePartial).toBe(false);
    }
  });

  it('no_record on NPPES blocks partial continuation; on other lanes permits upload', () => {
    const nppes = resolveRecoveryPath('nppes', 'no_record');
    expect(nppes.canContinuePartial).toBe(false);
    expect(nppes.ctaLabel).toMatch(/NPI/i);

    const pecos = resolveRecoveryPath('pecos', 'no_record');
    expect(pecos.canContinuePartial).toBe(true);
  });
});

describe('getLaneLabel', () => {
  it('returns a plain-language label for every lane (no internal jargon)', () => {
    for (const lane of LANES) {
      const label = getLaneLabel(lane);
      expect(label.length).toBeGreaterThan(0);
      expect(label.toLowerCase()).not.toContain('lane');
      expect(label.toLowerCase()).not.toContain('configured');
    }
  });
});

describe('resolvePassportContinuation', () => {
  // Default "all clean" input — a fully resolved passport with no
  // outstanding lane state. Individual tests flip one flag at a time.
  const cleanInput = {
    hasAnchor: true,
    allRequiredLanesResolved: true,
    hasUnresolvedBlockers: false,
    anyLanePending: false,
    anyLaneReviewRequired: false,
    anyLaneAccessRequired: false,
    anyLaneUnavailable: false,
    anyLaneStale: false,
    anyLaneNoRecord: false,
  };

  it('returns decision_grade only when every lane is fully resolved with no open gates', () => {
    const continuation = resolvePassportContinuation(cleanInput);
    expect(continuation.state).toBe('decision_grade');
    expect(continuation.provisionalNotice).toBeNull();
  });

  it('never returns decision_grade when a lane is unavailable', () => {
    const continuation = resolvePassportContinuation({
      ...cleanInput,
      anyLaneUnavailable: true,
    });
    expect(continuation.state).not.toBe('decision_grade');
    expect(continuation.provisionalNotice).not.toBeNull();
  });

  it('never returns decision_grade when any lane is access_required', () => {
    const continuation = resolvePassportContinuation({
      ...cleanInput,
      anyLaneAccessRequired: true,
    });
    expect(continuation.state).not.toBe('decision_grade');
  });

  it('never returns decision_grade when any lane is stale or missing a record', () => {
    const staleContinuation = resolvePassportContinuation({
      ...cleanInput,
      anyLaneStale: true,
    });
    expect(staleContinuation.state).not.toBe('decision_grade');

    const noRecordContinuation = resolvePassportContinuation({
      ...cleanInput,
      anyLaneNoRecord: true,
    });
    expect(noRecordContinuation.state).not.toBe('decision_grade');
  });

  it('partial passport never labels the CTA or headline as "ready"', () => {
    const continuation = resolvePassportContinuation({
      ...cleanInput,
      allRequiredLanesResolved: false,
      hasUnresolvedBlockers: true,
    });
    expect(continuation.state).toBe('partial_passport');
    expect(continuation.ctaLabel.toLowerCase()).not.toContain('ready');
    expect(continuation.headline.toLowerCase()).not.toContain('ready');
  });

  it('no anchor collapses to draft_snapshot (nothing decision-grade exists)', () => {
    const continuation = resolvePassportContinuation({
      ...cleanInput,
      hasAnchor: false,
    });
    expect(continuation.state).toBe('draft_snapshot');
    expect(continuation.provisionalNotice).not.toBeNull();
  });

  it('decision_grade continuation has the "view full passport" framing', () => {
    const continuation = resolvePassportContinuation(cleanInput);
    expect(continuation.ctaLabel.toLowerCase()).toContain('view');
  });
});
