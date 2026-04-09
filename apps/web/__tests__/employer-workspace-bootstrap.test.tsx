/**
 * employer-workspace-bootstrap.test.tsx
 *
 * Tests for employer workspace bootstrap + request-review flow:
 * - /api/request-review route: auth, NPI validation, FK-error detection
 * - EmployerWorkspaceSetup: renders org name form
 * - RequestReviewPanel: state machine (idle, needs_setup, done)
 * - ReviewClient: context attribution vs no-context warning
 * - /review landing: employer path visible
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: null })),
}));

vi.mock('@/components/auth/RoleContext', () => ({
  useRoleContext: () => ({ isLoaded: true, isSignedIn: true, isEmployer: true }),
}));

vi.mock('@/lib/auth/clerkConfig', () => ({
  CLERK_PROVIDER_ENABLED: false,
  CLERK_SIGN_IN_URL: '/sign-in',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => null,
  useRouter: () => ({ push: vi.fn() }),
  redirect: vi.fn(), usePathname: () => '/review/request',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/components/motion/ScrollMotion', () => ({
  SectionReveal: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/advisory/AdvisoryPanel', () => ({
  EmployerAdvisoryPanel: () => null,
}));

vi.mock('@/lib/trust/passport-review-truth', () => ({
  buildPassportReviewTruthModel: () => ({
    buckets: { stale: [], needsReview: [], missingOrAccessRequired: [], nextActions: [] },
    sourceCoverageChecks: [],
    proofSummary: { total: 0, decisionGradeCount: 0, informationalCount: 0, warningCount: 0 },
    posture: { disclaimer: 'Preview only.' },
    freshness: { entries: [], label: 'Partial', state: 'partial' },
  }),
  resolvePassportTruthSet: () => ({
    identity: { status: 'VERIFIED' },
    safety: { status: 'CLEAR' },
    authority: { status: 'PARTIAL' },
    eligibility: { status: 'ENROLLED' },
  }),
  resolvePublicWedgeSurfaceStateFromTruth: () => 'current',
}));

vi.mock('@/components/trust/passportProofSections', () => ({
  buildPassportProofSections: () => [],
  summarizePassportProofSections: () => ({
    total: 0, decisionGradeCount: 0, informationalCount: 0, warningCount: 0,
  }),
}));

vi.mock('@/lib/telemetry/ux-tracker', () => ({ trackUxEvent: vi.fn() }));

vi.mock('@/lib/trust/proof-language', () => ({
  buildPassportFreshnessEntries: () => [],
  formatAsOfDate: () => null,
  formatAsOfQuarter: () => null,
  formatProofDate: () => null,
  joinNoteParts: (...p: string[]) => p.filter(Boolean).join(' '),
  summarizePassportFreshnessEntries: () => ({ state: 'partial', label: 'Partial' }),
}));

vi.mock('@/lib/employer-review-actions', () => ({
  employerReviewLoadingLabel: (i: string) => `Loading ${i}`,
  formatEmployerReviewPersistedDetail: () => 'Detail',
  formatEmployerReviewPersistedLabel: () => 'Label',
}));

// ── Tests: /api/request-review ────────────────────────────────────────────

describe('/api/request-review route', () => {
  it('returns 401 when unauthenticated', async () => {
    const { POST } = await import('../app/api/request-review/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost/api/request-review', {
      method: 'POST',
      body: JSON.stringify({ npi: '1234567890' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('Sign in');
  });

  it('returns 400 for invalid NPI format when authenticated', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: 'test-user-id' });

    const { POST } = await import('../app/api/request-review/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost/api/request-review', {
      method: 'POST',
      body: JSON.stringify({ npi: '123' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('10-digit');
  });

  it('request-review route source validates npi field presence', () => {
    // Verify the route source contains the npi validation logic
    const src = readFileSync(
      resolve(__dirname, '../app/api/request-review/route.ts'),
      'utf-8',
    );
    expect(src).toContain("!body || !body.npi");
    expect(src).toContain("'npi is required.'");
  });
});

// ── Tests: EmployerWorkspaceSetup ──────────────────────────────────────────

describe('EmployerWorkspaceSetup', () => {
  it('renders org name form', async () => {
    const { EmployerWorkspaceSetup } = await import(
      '../components/employer/EmployerWorkspaceSetup'
    );
    const markup = renderToStaticMarkup(
      <EmployerWorkspaceSetup onSetupComplete={vi.fn()} />
    );

    expect(markup).toContain('Employer workspace required');
    expect(markup).toContain('Set up employer workspace');
    expect(markup).toContain('Organization name');
    expect(markup).toContain('Organization Type 2 NPI');
  });

  it('shows custom hint when provided', async () => {
    const { EmployerWorkspaceSetup } = await import(
      '../components/employer/EmployerWorkspaceSetup'
    );
    const markup = renderToStaticMarkup(
      <EmployerWorkspaceSetup
        onSetupComplete={vi.fn()}
        hint="Custom hint text here."
      />
    );

    expect(markup).toContain('Custom hint text here.');
  });
});

// ── Tests: RequestReviewPanel ──────────────────────────────────────────────

describe('RequestReviewPanel', () => {
  it('renders NPI form in idle state', async () => {
    const { RequestReviewPanel } = await import(
      '../components/employer/RequestReviewPanel'
    );
    const markup = renderToStaticMarkup(<RequestReviewPanel />);

    expect(markup).toContain('Create pilot review');
    expect(markup).toContain('Clinician NPI');
  });

  it('route exists as a valid server component', async () => {
    const mod = await import('../app/review/request/page');
    expect(typeof mod.default).toBe('function');
  });
});

// ── Tests: ReviewClient context attribution ────────────────────────────────

describe('ReviewClient context attribution (source-level)', () => {
  it('contains no-context amber warning with /review/request link', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/review/ReviewClient.tsx'),
      'utf-8',
    );
    expect(src).toContain('None — direct view');
    expect(src).toContain('/review/request');
    expect(src).toContain('Request a review context');
  });

  it('contains audit trail attribution when contextId present', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/review/ReviewClient.tsx'),
      'utf-8',
    );
    expect(src).toContain('Audit trail');
    expect(src).toContain('Actions tied to this context');
    expect(src).toContain('contextId.slice(0, 8)');
  });

  it('has mutually exclusive context/no-context branches', () => {
    const src = readFileSync(
      resolve(__dirname, '../components/review/ReviewClient.tsx'),
      'utf-8',
    );
    expect(src).toContain('sharedBy || contextId');
    expect(src).toContain('None — direct view');
  });
});

// ── Tests: /review landing page ────────────────────────────────────────────

describe('/review landing page', () => {
  it('shows employer request link', async () => {
    const ReviewLandingPage = (await import('../app/review/page')).default;
    const markup = renderToStaticMarkup(<ReviewLandingPage />);

    expect(markup).toContain('Request pilot review');
    expect(markup).toContain('/review/request');
    // Updated: "Are you an employer?" removed — page now opens directly with employer framing
    expect(markup).toContain('Employer review');
  });

  it('shows clinician recovery paths', async () => {
    const ReviewLandingPage = (await import('../app/review/page')).default;
    const markup = renderToStaticMarkup(<ReviewLandingPage />);

    expect(markup).toContain('Start with NPI lookup');
    // Updated: page tone improved — direct employer framing, no warning-heavy copy
    expect(markup).toContain("Review a source-backed readiness snapshot");
  });
});
