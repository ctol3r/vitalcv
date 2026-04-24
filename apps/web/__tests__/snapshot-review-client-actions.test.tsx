// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@/lib/auth/clerkConfig', () => ({
  CLERK_PROVIDER_ENABLED: true,
  CLERK_SIGN_IN_URL: '/sign-in',
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

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderNode(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(node);
  });
  await flush();

  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function clickByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find((node) => node.textContent?.includes(text));

  if (!button) {
    throw new Error(`Unable to find button containing "${text}"`);
  }

  await act(async () => {
    button.click();
  });
}

describe('SnapshotReviewClient action confirmations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('React', React);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('shows a self-explanatory confirmation after recording a head start', async () => {
    let resolveResponse: ((value: unknown) => void) | null = null;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      resolveResponse = resolve;
    })));

    const view = await renderNode(
      <SnapshotReviewClient
        bundle={buildBundle()}
        entityId="entity-1"
        applicationId="bundle-1"
        bundleId="bundle-1"
      />,
    );

    await clickByText(view.container, 'Accept as head start');
    expect(view.container.textContent).toContain('Recording a head-start decision against the shared evidence…');

    resolveResponse?.({
      ok: true,
      json: vi.fn(async () => ({
        ok: true,
        state: {
          summary: {
            description: 'Employer head start accepted from current evidence.',
          },
        },
      })),
    });
    await flush();

    expect(view.container.textContent).toContain('Head start recorded');
    expect(view.container.textContent).toContain('This employer decision was recorded against the exact evidence now on screen.');
    expect(view.container.textContent).toContain('Employer head start accepted from current evidence.');
    expect(view.container.textContent).toContain('Next: Proceed with the current evidence');
    expect(view.container.textContent).toContain('What just happened');

    await view.unmount();
  });

  it('shows a self-explanatory confirmation after requesting refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn(async () => ({
        ok: true,
        state: {
          summary: {
            description: 'Refresh request recorded for incomplete source checks.',
          },
        },
      })),
    }));

    const view = await renderNode(
      <SnapshotReviewClient
        bundle={buildBundle()}
        entityId="entity-1"
        applicationId="bundle-1"
        bundleId="bundle-1"
      />,
    );

    await clickByText(view.container, 'Request refresh');
    await flush();

    expect(view.container.textContent).toContain('Refresh requested');
    expect(view.container.textContent).toContain('Incomplete or stale checks were flagged for a new snapshot run.');
    expect(view.container.textContent).toContain('Refresh request recorded for incomplete source checks.');
    expect(view.container.textContent).toContain('Next: Wait for the refreshed snapshot before relying further on this application.');

    await view.unmount();
  });

  it('shows a self-explanatory confirmation after routing to manual review', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn(async () => ({
        ok: true,
        state: {
          summary: {
            description: 'Manual credentialing review has been queued.',
          },
        },
      })),
    }));

    const view = await renderNode(
      <SnapshotReviewClient
        bundle={buildBundle()}
        entityId="entity-1"
        applicationId="bundle-1"
        bundleId="bundle-1"
      />,
    );

    await clickByText(view.container, 'Route to review');
    await flush();

    expect(view.container.textContent).toContain('Manual review requested');
    expect(view.container.textContent).toContain('This application was escalated out of the self-serve decision path.');
    expect(view.container.textContent).toContain('Manual credentialing review has been queued.');
    expect(view.container.textContent).toContain('Next: Hand this case to credentialing review and wait for a reviewed outcome before proceeding.');

    await view.unmount();
  });
});
