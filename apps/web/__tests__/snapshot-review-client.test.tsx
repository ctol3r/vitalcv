import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SnapshotReviewClient from '@/components/review/SnapshotReviewClient';
import type { ApplyBundle } from '@/components/apply/ApplyBundleView';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/auth/RoleContext', () => ({
  useRoleContext: () => ({
    isLoaded: true,
    isSignedIn: true,
    isEmployer: true,
  }),
}));

function buildBundle(overrides: Partial<ApplyBundle> = {}): ApplyBundle {
  return {
    applicationId: 'bundle-1',
    bundleId: 'bundle-1',
    entityId: 'entity-1',
    npi: '1234567890',
    clinicianName: 'Ada Lovelace, MD',
    trustState: {
      readiness_level: 'L2',
      readiness_score: 72,
      readiness_status: 'Partial source-backed evidence available',
      computed_at: '2026-04-21T00:00:00.000Z',
    },
    status: 'partial',
    proofTier: 'partial',
    snapshotHash: 'snapshot_hash_123456',
    includedSources: ['NPPES_API'],
    includedClaims: ['claim-1'],
    completeness: {
      verifiedSources: 1,
      totalSources: 3,
      includedClaims: 1,
      missingSources: 2,
    },
    blockers: ['DEA registration review required'],
    nextAction: {
      id: 'next-1',
      title: 'Request refresh',
      detail: 'Re-run incomplete sources before relying on this snapshot.',
      priority: 'HIGH',
    },
    snapshot: {
      sourceCoverage: {
        checks: [],
        summary: {
          checked: ['NPPES_API'],
          stale: [],
          pending: [],
          gated: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: ['DEA_REGISTRATION'],
          notDecisionGrade: [],
          previewOnly: [],
        },
      },
      claims: [
        {
          claimId: 'claim-1',
          domain: 'IDENTITY',
          credentialType: 'NPPES_IDENTITY',
          status: 'VERIFIED',
          issuer: 'CMS NPPES',
          observedAt: '2026-04-21T00:00:00.000Z',
          expiresAt: null,
          artifactIds: ['artifact-1'],
          receiptIds: ['receipt-1'],
        },
      ],
      freshness: {
        state: 'partial',
        label: 'Only part of the required source spine is attached in this snapshot.',
        checkedAt: '2026-04-21T00:00:00.000Z',
      },
      limitations: [
        {
          id: 'review-required',
          state: 'review_required',
          label: 'DEA registration review required',
          detail: 'DEA registration remains unresolved in this snapshot.',
        },
      ],
      observedAt: '2026-04-21T00:00:00.000Z',
      rawHash: 'raw_hash_123456',
    },
    credentials: [],
    issuerProvenance: [],
    monitoringStatus: 'partial',
    profileUrl: '/p/1234567890',
    generatedAt: '2026-04-21T00:00:00.000Z',
    expiresAt: '2026-04-22T00:00:00.000Z',
    signature: 'sig_123',
    ...overrides,
  };
}

describe('SnapshotReviewClient', () => {
  it('surfaces immediate decision posture, blockers, and next step from the frozen snapshot', () => {
    const markup = renderToStaticMarkup(
      <SnapshotReviewClient
        bundle={buildBundle()}
        entityId="entity-1"
        applicationId="bundle-1"
        bundleId="bundle-1"
      />,
    );

    expect(markup).toContain('Can this clinician move forward?');
    expect(markup).toContain('Not ready yet');
    expect(markup).toContain('Verified now');
    expect(markup).toContain('Still missing');
    expect(markup).toContain('Blocks start');
    expect(markup).toContain('What to do next');
    expect(markup).toContain('Re-run incomplete sources before relying on this snapshot.');
    expect(markup).toContain('This review uses the exact evidence that was shared here.');
    expect(markup).toContain('This records a head start, not final clearance.');
    expect(markup).toContain('manual credentialing review');
  });
});
