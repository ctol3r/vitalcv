import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApplicationSnapshotCard } from '@/components/apply/ApplicationSnapshotCard';
import {
  buildApplicationSnapshotSummary,
} from '@/lib/apply/application-snapshot';
import { resolveProofTier } from '@/lib/trust/employer-action-consequence';

const partialMeta = resolveProofTier({
  hasAnchor: true,
  allRequiredLanesResolved: false,
  hasUnresolvedBlockers: false,
  anyLanePending: true,
  anyLaneReviewRequired: false,
  anyLaneAccessRequired: true,
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

const decisionMeta = resolveProofTier({
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

describe('ApplicationSnapshotCard', () => {
  it('renders tier label + progress badge + included/omitted lane groups', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'bundle_abc',
      proofTier: 'partial_proof_pack',
      proofTierMeta: partialMeta,
      includedLanes: [{ label: 'NPI Identity' }],
      omittedLanes: [{ label: 'State License', qualifier: 'Access required' }],
      blockerKeys: ['State board access required'],
      progressStage: 'submitted',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    const html = renderToStaticMarkup(<ApplicationSnapshotCard summary={summary} />);
    expect(html).toContain('Partial proof pack');
    expect(html).toContain('Submitted');
    expect(html).toContain('NPI Identity');
    expect(html).toContain('State License');
    expect(html).toContain('Access required');
    // Blocker ownership copy is surfaced.
    expect(html).toMatch(/Clinician-owned|VitalCV-owned|Source-owned|Employer-owned|Institution-owned|Reviewer-owned|Ownership pending/);
  });

  it('shows the acceptBlockedReason for a draft_snapshot (no fake certainty)', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'bundle_draft',
      proofTier: 'draft_snapshot',
      proofTierMeta: draftMeta,
      includedLanes: [],
      omittedLanes: [],
      progressStage: 'submitted',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    const html = renderToStaticMarkup(<ApplicationSnapshotCard summary={summary} />);
    expect(html).toContain('Draft snapshot');
    expect(html).toMatch(/no passport anchor/i);
  });

  it('omits the limitation note when tier is decision-grade and nothing is omitted', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'bundle_dg',
      proofTier: 'decision_grade_proof_pack',
      proofTierMeta: decisionMeta,
      includedLanes: [{ label: 'NPI Identity' }, { label: 'OIG / LEIE clear' }],
      omittedLanes: [],
      progressStage: 'advanced',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    const html = renderToStaticMarkup(<ApplicationSnapshotCard summary={summary} />);
    expect(html).toContain('Decision-grade proof pack');
    expect(html).toContain('Advanced');
    expect(html).not.toMatch(/data-testid="limitation-note"/);
  });

  it('progress spine marks the active stage', () => {
    const summary = buildApplicationSnapshotSummary({
      applicationId: 'b',
      proofTier: 'partial_proof_pack',
      proofTierMeta: partialMeta,
      includedLanes: [],
      omittedLanes: [],
      progressStage: 'in_review',
      submittedAt: '2026-04-18T14:22:00Z',
    });
    const html = renderToStaticMarkup(<ApplicationSnapshotCard summary={summary} />);
    expect(html).toMatch(/data-stage="in_review"[^>]*data-state="active"/);
    expect(html).toMatch(/data-stage="submitted"[^>]*data-state="done"/);
  });
});
