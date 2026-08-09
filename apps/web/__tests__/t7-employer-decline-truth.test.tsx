/**
 * t7-employer-decline-truth.test.tsx — T7 (no fabricated employer decision).
 *
 * The employer review surface used to declare a `reject` endpoint, catch the
 * 401/403 that came back from a route which never existed, and render
 * "Your rejection decision has been captured as audit-boundary metadata" —
 * a success message with no write behind it. Nothing was persisted, nothing
 * was auditable, and the employer was told their decision had been recorded.
 *
 * The contract pinned here is the outcome, not the mechanism: a success
 * affordance may only follow a decision this system actually persisted. A real
 * decline is allowed to exist later — but it has to arrive with a mounted
 * endpoint and an action intent the response contract recognizes, which is
 * exactly what these assertions require. Do not relax them to let a UI-only
 * decline through; that is the bug this file exists to catch.
 *
 * Employer decision semantics themselves stay blocked on the acceptance-model
 * reconciliation (CONQ-03) and the org-governance authz precondition (#1219).
 */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '@vitalcv/trust-state';
import type { PassportData } from '../lib/trust/passport-contract';

// ── Mocks: only the ambient surfaces ReviewClient needs to render ───────────
// `@/lib/employer-review-actions` is deliberately NOT mocked — it carries the
// action contract under test.

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'employer-user-id' })),
}));

vi.mock('@/components/auth/RoleContext', () => ({
  useRoleContext: () => ({ isLoaded: true, isSignedIn: true, isEmployer: true }),
}));

vi.mock('@/lib/auth/clerkConfig', () => ({
  CLERK_PROVIDER_ENABLED: true,
  CLERK_SIGN_IN_URL: '/sign-in',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => null,
  useRouter: () => ({ push: vi.fn() }),
  redirect: vi.fn(),
  usePathname: () => '/review/test-entity-id',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: Record<string, unknown> & { href?: string; children?: unknown }) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (<a href={href} {...(props as any)}>{children as any}</a>) as any,
}));

vi.mock('@/components/motion/ScrollMotion', () => ({
  SectionReveal: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/components/advisory/AdvisoryPanel', () => ({
  EmployerAdvisoryPanel: () => null,
}));

vi.mock('@/lib/learning/useTrackEvent', () => ({
  useTrackEvent: () => vi.fn(),
}));

vi.mock('@/lib/telemetry/ux-tracker', () => ({
  trackUxEvent: vi.fn(),
}));

// ── Contract regexes ───────────────────────────────────────────────────────

/** Any affordance that would let an employer decline from this surface. */
const DECLINE_AFFORDANCE = /\b(reject|decline|turn down|pass on (?:this )?candidate)\b/i;

/** Any claim that a rejection/decline outcome was recorded, captured or saved. */
const DECLINE_SUCCESS_CLAIM =
  /(rejection|decline[d]?|reject(?:ed|ion)?)[^.<>]{0,60}\b(recorded|captured|saved|stored|persisted|logged|submitted)\b/i;

// ── Fixture ────────────────────────────────────────────────────────────────

/**
 * A decision-grade passport, so the surface renders its full action panel —
 * the state in which a decline affordance would appear if one existed.
 * Mirrors the fixture in `passport-review-truth.test.ts`.
 */
function buildPassportFixture(): PassportData {
  const checks = [
    createCanonicalSourceCoverage({
      sourceId: 'NPPES_API',
      state: 'checked',
      reason: 'NPPES identity checked',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: 'checked',
      reason: 'OIG LEIE check clear',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'STATE_BOARD',
      state: 'checked',
      reason: 'Licensure checked',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state: 'checked',
      reason: 'CMS PECOS confirms enrolled status in the current quarterly release',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
  ] as const;

  return {
    entityId: 'test-entity-id',
    npi: '1234567890',
    identity: {
      displayName: 'Ada Lovelace',
      specialty: 'ICU',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: {
      credentials: [
        {
          id: 'cred-licensure',
          domain: 'LICENSURE',
          type: 'STATE_LICENSE',
          status: 'ACTIVE',
          verificationLevel: 'SOURCE_VERIFIED',
          issuerName: 'State Board',
          sourceId: 'STATE_BOARD',
          jurisdiction: 'OR',
          observedAt: '2026-03-20T00:00:00.000Z',
          verifiedAt: '2026-03-20T00:00:00.000Z',
          stale: false,
          confidenceLabel: 'HIGH',
          claimConfidenceLabel: 'HIGH',
          dataFreshness: 'Weekly',
          dataFreshnessLabel: 'Weekly',
          reviewRequired: false,
          authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
        },
      ],
      summary: { active: 1, expired: 0, stale: 0, missing: [] },
    },
    training: {
      records: [],
      hasDegree: true,
      degreeVerified: true,
      hasResidency: true,
      fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-20T00:00:00.000Z',
      exclusionConfidenceLabel: 'HIGH',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Medicare enrolled',
      enrollmentObservedAt: '2026-03-20T00:00:00.000Z',
      enrollmentDataVersion: 'Q1 2026',
      enrollmentFreshnessLabel: 'Quarterly',
      enrollmentConfidenceLabel: 'Quarterly release',
      negativeFindings: [],
    },
    readiness: {
      status: 'PARTIAL',
      score: 88,
      level: 'L2',
      blockers: ['DEA_REGISTRATION'],
      gaps: ['DEA registration not verified'],
      estimatedStartDays: 14,
      nextActions: [],
    },
    sources: {
      checked: ['NPPES', 'OIG'],
      lastFetch: {},
    },
    sourceCoverage: {
      checks: [...checks],
      summary: summarizeCanonicalSourceCoverage(checks),
    },
    truth: {
      identity: {
        kind: 'verification',
        status: 'VERIFIED',
        satisfied: true,
        decisionGrade: true,
        coverage: checks[0],
      },
      safety: {
        kind: 'clearance',
        status: 'CLEAR',
        satisfied: true,
        decisionGrade: true,
        coverage: checks[1],
      },
      authority: {
        kind: 'verification',
        status: 'VERIFIED',
        satisfied: true,
        decisionGrade: true,
        coverage: checks[2],
      },
      eligibility: {
        kind: 'enrollment',
        status: 'ENROLLED',
        satisfied: true,
        decisionGrade: true,
        coverage: checks[3],
      },
    },
    trustPosture: {
      band: 'L2',
      bandLabel: 'Moderate trust',
      score: 88,
      dimensions: [],
      freshness: {
        state: 'current',
        label: 'Current attached checks',
        items: [],
      },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: ['DEA_REGISTRATION'],
    },
    lastCheckedAt: '2026-03-20T00:00:00.000Z',
  };
}

async function renderReviewSurface(): Promise<string> {
  const ReviewClient = (await import('../components/review/ReviewClient')).default;
  return renderToStaticMarkup(
    <ReviewClient passport={buildPassportFixture()} contextId="ctx-1" />,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('the employer review surface offers no decline it cannot persist', () => {
  it('renders no decline or rejection affordance', async () => {
    const markup = await renderReviewSurface();

    // Sanity: we actually rendered the decision surface, so a clean pass below
    // means "no decline affordance", not "nothing rendered".
    expect(markup).toContain('Ada Lovelace');
    expect(markup).not.toMatch(DECLINE_AFFORDANCE);
  });

  it('renders no claim that a rejection was recorded', async () => {
    const markup = await renderReviewSurface();

    expect(markup).not.toMatch(DECLINE_SUCCESS_CLAIM);
  });
});

describe('no decline endpoint is dispatchable', () => {
  async function postAction(action: string) {
    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest(`http://localhost/api/employer-review/test-entity-id/${action}`, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    return POST(req, { params: Promise.resolve({ entityId: 'test-entity-id', action }) });
  }

  it('POST /reject and /decline are unsupported actions, not merely gated ones', async () => {
    for (const action of ['reject', 'decline']) {
      const res = await postAction(action);
      // 404 (unsupported) rather than 401/403 — there is no decline behind the
      // auth wall either. A 401 here would mean someone mounted the action.
      expect(res.status, `${action} must be unsupported`).toBe(404);
    }
  });

  it('a supported action is not 404 — proving the 404 above is about the action, not the harness', async () => {
    // Control. `accept` is mounted, so it must get past the action allowlist.
    // Its upstream fetch is stubbed so this asserts routing, not backend state.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const res = await postAction('accept');
      expect(res.status).not.toBe(404);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('the action contract cannot carry an unpersisted rejection', () => {
  it('refuses a rejection state, so no success card can be driven by one', async () => {
    const { isEmployerReviewActionState, normalizeEmployerReviewActionState } =
      await import('../lib/employer-review-actions');

    // A fully-formed state that differs from a valid one only in its action.
    const rejectionState = {
      action: 'reject',
      entityId: 'test-entity-id',
      clinicianNpi: '1234567890',
      auditEventId: 'audit-1',
      timestamp: '2026-08-09T00:00:00.000Z',
      persistence: {
        mode: 'audit_only',
        target: 'audit_event',
        acceptanceId: null,
        reviewItemId: null,
        reviewItemCreated: false,
      },
      summary: { title: 'Rejection recorded', description: 'Captured as metadata.' },
      details: { staleSources: [], missingDomains: [], reason: null, priority: null },
    };

    expect(isEmployerReviewActionState(rejectionState)).toBe(false);
    expect(normalizeEmployerReviewActionState(rejectionState)).toBeNull();

    // Control: the same shape with a persisted, recognized action is accepted,
    // so the rejection above fails on its action and not on the fixture.
    expect(
      normalizeEmployerReviewActionState({ ...rejectionState, action: 'review' }),
    ).not.toBeNull();
  });
});
