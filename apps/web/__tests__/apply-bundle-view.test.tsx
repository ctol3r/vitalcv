import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplyBundleView, type ApplyBundle } from '@/components/apply/ApplyBundleView';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string | { pathname?: string };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname ?? '#'} {...props}>
      {children}
    </a>
  ),
}));

function buildBundle(overrides: Partial<ApplyBundle> = {}): ApplyBundle {
  return {
    bundleId: 'bundle-1',
    entityId: 'entity-1',
    npi: '1234567890',
    clinicianName: 'Dr. Jane Doe',
    trustState: {
      readiness_level: 'L2',
      readiness_score: 84,
      readiness_status: 'Source-backed readiness available',
      computed_at: '2026-04-06T17:00:00.000Z',
    },
    credentials: [],
    issuerProvenance: [],
    monitoringStatus: 'active',
    profileUrl: '/passport/entity-1',
    generatedAt: '2026-04-06T17:00:00.000Z',
    expiresAt: '2026-04-13T17:00:00.000Z',
    signature: 'sig_123',
    ...overrides,
  };
}

describe('ApplyBundleView', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves bundle review context in the sign-in redirect', () => {
    const markup = renderToStaticMarkup(
      <ApplyBundleView bundle={buildBundle()} />,
    );

    expect(markup).toContain(
      '/sign-in?redirect_url=%2Freview%2Fentity-1%3FbundleId%3Dbundle-1',
    );
  });
});
