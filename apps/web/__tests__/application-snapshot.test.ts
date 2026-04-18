import { describe, expect, it } from 'vitest';
import {
  buildApplicationSnapshotSummary,
  summarizeSnapshotOneLine,
} from '@/lib/apply/application-snapshot';
import { resolveProofTier } from '@/lib/trust/employer-action-consequence';

const decisionGradeMeta = resolveProofTier({
  hasAnchor: true,
  allRequiredLanesResolved: true,
  hasUnresolvedBlockers: false,
  anyLanePending: false,
  anyLaneReviewRequired: false,
  anyLaneAccessRequired: false,
  anyLaneUnavailable: false,
  anyLaneStale: false,
  anyLaneNoRecord: false,
});

const partialMeta = resolveProofTier({
  hasAnchor: true,
  allRequiredLanesResolved: false,
  hasUnresolvedBlockers: false,
  anyLanePending: true,
  anyLaneReviewRequired: false,
  anyLaneAccessRequired: false,
  anyLaneUnavailable: false,
  anyLaneStale: false,
  anyLaneNoRecord: false,
});

const draftMeta = resolveProofTier({
  hasAnchor: false,
  allRequiredLanesResolved: false,
  hasUnresolvedBlockers: false,
  anyLanePending: false,
  anyLaneReviewRequired: false,
  anyLaneAccessRequired: false,
  anyLaneUnavailable: false,
  anyLaneStale: false,
  anyLaneNoRecord: false,
});

describe('buildApplicationSnapshotSummary', () => {
  it('returns null limitation only when tier is decision-grade AND no omitted lanes', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'bundle_abc',
      proofTier: 'decision_grade_proof_pack',
      proofTierMeta: decisionGradeMeta,
      includedLanes: [{ label: 'NPI Identity' }, { label: 'OIG / LEIE clear' }],
      omittedLanes: [],
      progressStage: 'submitted',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    expect(summary.limitationNote).toBeNull();
  });

  it('always surfaces a limitation note when the tier is partial', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'bundle_abc',
      proofTier: 'partial_proof_pack',
      proofTierMeta: partialMeta,
      includedLanes: [{ label: 'NPI Identity' }],
      omittedLanes: [{ label: 'State License', qualifier: 'Access required' }],
      progressStage: 'submitted',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    expect(summary.limitationNote).toBeTruthy();
    expect(summary.limitationNote).toContain('Partial proof pack');
    expect(summary.limitationNote).toMatch(/State License/);
  });

  it('carries proof-tier acceptBlockedReason through unchanged', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'bundle_xyz',
      proofTier: 'draft_snapshot',
      proofTierMeta: draftMeta,
      includedLanes: [],
      omittedLanes: [],
      progressStage: 'submitted',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    expect(summary.proofTier.acceptAllowed).toBe(false);
    expect(summary.proofTier.acceptBlockedReason).toBe(draftMeta.acceptBlockedReason);
  });

  it('describes blockers with employer-facing ownership copy', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'bundle_xyz',
      proofTier: 'partial_proof_pack',
      proofTierMeta: partialMeta,
      includedLanes: [],
      omittedLanes: [{ label: 'State License', qualifier: 'Access required' }],
      blockerKeys: ['State board access required'],
      progressStage: 'submitted',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    expect(summary.blockers).toHaveLength(1);
    expect(summary.blockers[0].ownerLabel.length).toBeGreaterThan(0);
    expect(summary.blockers[0].detail.length).toBeGreaterThan(0);
  });

  it('progress meta matches the requested stage', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'bundle_p',
      proofTier: 'partial_proof_pack',
      proofTierMeta: partialMeta,
      includedLanes: [],
      omittedLanes: [],
      progressStage: 'viewed',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    expect(summary.progress.stage).toBe('viewed');
    expect(summary.progress.label).toBe('Viewed');
  });

  it('summarizeSnapshotOneLine composes tier and stage labels', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'bundle_p',
      proofTier: 'partial_proof_pack',
      proofTierMeta: partialMeta,
      includedLanes: [],
      omittedLanes: [],
      progressStage: 'in_review',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    expect(summarizeSnapshotOneLine(summary)).toMatch(/Partial proof pack/);
    expect(summarizeSnapshotOneLine(summary)).toMatch(/In review/);
  });
});
