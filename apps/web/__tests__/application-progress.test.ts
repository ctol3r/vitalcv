import { describe, expect, it } from 'vitest';
import {
  APPLICATION_PROGRESS_SPINE,
  getApplicationProgressDescription,
  getApplicationProgressLabel,
  getApplicationProgressMeta,
  resolveApplicationProgress,
  type ApplicationProgressStage,
} from '@/lib/apply/application-progress';
import { ACTION_OWNER } from '@/lib/trust/action-owner';

const ALL_STAGES: ApplicationProgressStage[] = [
  'submitted',
  'viewed',
  'in_review',
  'waiting_on_refresh',
  'waiting_on_manual_review',
  'advanced',
  'credentialing',
  'approved',
  'start_ready',
  'started',
];

describe('application-progress meta', () => {
  it('exposes non-empty label + description for every stage', () => {
    for (const stage of ALL_STAGES) {
      expect(getApplicationProgressLabel(stage).trim().length).toBeGreaterThan(0);
      expect(getApplicationProgressDescription(stage).trim().length).toBeGreaterThan(0);
    }
  });

  it('marks waiting states as waiting AND side-state', () => {
    expect(getApplicationProgressMeta('waiting_on_refresh').isWaiting).toBe(true);
    expect(getApplicationProgressMeta('waiting_on_refresh').isSideState).toBe(true);
    expect(getApplicationProgressMeta('waiting_on_manual_review').isWaiting).toBe(true);
    expect(getApplicationProgressMeta('waiting_on_manual_review').isSideState).toBe(true);
  });

  it('never returns an ownerless waiting state', () => {
    expect(getApplicationProgressMeta('waiting_on_refresh').ownerNext).toBe(ACTION_OWNER.VITALCV);
    expect(getApplicationProgressMeta('waiting_on_manual_review').ownerNext).toBe(
      ACTION_OWNER.REVIEWER,
    );
  });

  it('spine omits waiting states', () => {
    const spine = [...APPLICATION_PROGRESS_SPINE];
    expect(spine).not.toContain('waiting_on_refresh');
    expect(spine).not.toContain('waiting_on_manual_review');
  });
});

describe('resolveApplicationProgress', () => {
  const base = {
    proofTier: 'partial_proof_pack' as const,
    submittedAt: '2026-04-18T14:22:00Z',
  };

  it('returns `submitted` when only the seal timestamp exists', () => {
    expect(resolveApplicationProgress(base)).toBe('submitted');
  });

  it('advances through viewed → in_review → advanced on timestamp', () => {
    expect(resolveApplicationProgress({ ...base, viewedAt: '2026-04-18T14:25:00Z' })).toBe(
      'viewed',
    );
    expect(
      resolveApplicationProgress({
        ...base,
        viewedAt: '2026-04-18T14:25:00Z',
        inReviewAt: '2026-04-18T14:30:00Z',
      }),
    ).toBe('in_review');
    expect(
      resolveApplicationProgress({
        ...base,
        viewedAt: '2026-04-18T14:25:00Z',
        inReviewAt: '2026-04-18T14:30:00Z',
        advancedAt: '2026-04-18T14:40:00Z',
      }),
    ).toBe('advanced');
  });

  it('waiting side-states take precedence over in_review', () => {
    expect(
      resolveApplicationProgress({
        ...base,
        inReviewAt: '2026-04-18T14:30:00Z',
        refreshRequestedAt: '2026-04-18T14:35:00Z',
      }),
    ).toBe('waiting_on_refresh');
    expect(
      resolveApplicationProgress({
        ...base,
        inReviewAt: '2026-04-18T14:30:00Z',
        manualReviewOpenedAt: '2026-04-18T14:35:00Z',
      }),
    ).toBe('waiting_on_manual_review');
  });

  it('never upgrades a draft_snapshot past in_review — no silent upgrade', () => {
    const draft = {
      ...base,
      proofTier: 'draft_snapshot' as const,
      viewedAt: '2026-04-18T14:25:00Z',
      inReviewAt: '2026-04-18T14:30:00Z',
      advancedAt: '2026-04-18T14:40:00Z',
    };
    // advancedAt is IGNORED because the packet has no anchor; we must
    // not claim the employer accepted head-start on an empty shell.
    expect(resolveApplicationProgress(draft)).toBe('in_review');
  });

  it('reports later main-spine events in timestamp-priority order', () => {
    const now = '2026-04-18T15:00:00Z';
    expect(
      resolveApplicationProgress({
        ...base,
        advancedAt: now,
        credentialingStartedAt: now,
      }),
    ).toBe('credentialing');
    expect(
      resolveApplicationProgress({
        ...base,
        advancedAt: now,
        credentialingStartedAt: now,
        approvedAt: now,
      }),
    ).toBe('approved');
    expect(
      resolveApplicationProgress({
        ...base,
        advancedAt: now,
        credentialingStartedAt: now,
        approvedAt: now,
        startReadyAt: now,
      }),
    ).toBe('start_ready');
    expect(
      resolveApplicationProgress({
        ...base,
        advancedAt: now,
        credentialingStartedAt: now,
        approvedAt: now,
        startReadyAt: now,
        startedAt: now,
      }),
    ).toBe('started');
  });
});
