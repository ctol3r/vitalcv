/**
 * t7-employer-refresh-authz-truth.test.tsx — T7 (no fabricated employer outcome),
 * `request-refresh` instance.
 *
 * Sibling of `t7-employer-decline-truth.test.tsx`, and the more dangerous of
 * the two. That one guards a path that was dead in both directions — no UI
 * dispatched `reject` and no route served it, so its 401/403 could never
 * actually arrive. This path is live: `request-refresh` is in the proxy's
 * `AUTHENTICATED_MUTATION_ACTIONS` allowlist, the backend mounts it, and the
 * proxy passes upstream 401/403 through verbatim (`normalizeUpstreamError`).
 *
 * The bug: `postAction` caught 401/403 and threw a "PilotFallbackError" whose
 * message was "Request recorded — clinician will be notified during pilot".
 * `runEmployerAction` rendered that on a success-toned TrustStateCard reading
 * "Your request has been recorded. Clinicians will be notified through the
 * operations channel." and reported `employer_action_result: 'success'` to a
 * live funnel metric. No write had happened — the server had refused the
 * caller. On the RBAC path the backend writes a *denied-mutation* AuditEvent
 * before returning 403, so the audit log and the screen asserted opposite
 * things about the same request.
 *
 * Reachability is not hypothetical. `canPersistActions` is a client-side check
 * (Clerk signed-in + employer role); the server checks an active verifier-role
 * account and a registered employer organization. Any disagreement — backend
 * RBAC denial, missing org membership, identity headers not forwarded — lands
 * here with the action panel fully enabled, and the org-governance authz work
 * (#1219) makes that disagreement more likely as it lands, not less.
 *
 * The contract pinned here is the outcome, not the mechanism: an employer may
 * only be told a request was recorded when the server recorded one. A real
 * refresh request still works — the success card is driven by a normalized
 * action state from a 2xx response, and the control cases below prove that
 * path is untouched.
 *
 * Note the fix could not be "persist the record anyway": a 401/403 means the
 * server refused this caller, so writing on their behalf would convert a truth
 * bug into an authorization bypass.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '@vitalcv/trust-state';
import type { PassportData } from '../lib/trust/passport-contract';

// ── Mocks: only the ambient surfaces ReviewClient needs to render ───────────
// `@/lib/employer-review-actions` is deliberately NOT mocked — it carries the
// action contract under test.

const trackUxEventSpy = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'employer-user-id' })),
}));

// Signed in AND employer — precisely the state in which `canPersistActions` is
// true and the action panel is live. The denial under test comes from the
// server disagreeing with this client-side belief.
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
  default: ({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>{children}</a>
  ),
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
  trackUxEvent: (...args: unknown[]) => trackUxEventSpy(...args),
}));

// ── Contract regexes ───────────────────────────────────────────────────────

/**
 * Any claim that a refresh request was recorded/received/sent, or that the
 * clinician will be notified. Tolerant of intervening markup and newlines:
 * a phrase split across a line break is still the same claim on screen
 * (line-wrapped JSX has defeated string-matching proofs in this repo before).
 */
const REFRESH_SUCCESS_CLAIM =
  /(request|refresh)(?:[^.<>]|<[^>]*>|\s){0,80}\b(recorded|received|captured|saved|stored|persisted|logged|submitted|sent|on its way)\b/i;

/** Any claim the clinician has been or will be notified. */
const NOTIFICATION_CLAIM =
  /clinicians?(?:[^.<>]|<[^>]*>|\s){0,60}\b(notified|notification|alerted|contacted)\b/i;

// ── Fixture ────────────────────────────────────────────────────────────────

/**
 * A decision-grade passport, so the surface renders its full action panel.
 * Mirrors the fixture in `t7-employer-decline-truth.test.tsx`.
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

/**
 * The review client's source with comments stripped.
 *
 * Stripping matters: both this file and the component quote the fabricated
 * copy verbatim in order to explain why it is forbidden. A scan that reads
 * prose would flag that documentation and force whoever wrote it to describe
 * the bug in euphemism — which is how the explanation gets lost.
 */
async function readComponentCode(): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('../components/review/ReviewClient.tsx', import.meta.url),
    'utf8',
  );

  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

beforeEach(() => {
  trackUxEventSpy.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('a failed employer action has no path to a recorded-outcome claim', () => {
  // This is the closure, asserted on the contract itself rather than on the
  // component's source. The component's failure branch only mounts after a
  // failed POST, which `renderToStaticMarkup` never reaches — so pinning the
  // classifier is what makes the guarantee exhaustive instead of illustrative.

  it('classifies 401 and 403 as not_authorized, keeping the server’s remedy text', async () => {
    const { classifyEmployerActionFailure } = await import('../lib/employer-review-actions');

    for (const status of [401, 403]) {
      const failure = classifyEmployerActionFailure(
        status,
        'No employer organization is registered for this account. Complete employer setup first.',
      );

      expect(failure.kind).toBe('not_authorized');
      // The actionable server text survives — it is what the card shows.
      expect(failure.message).toMatch(/Complete employer setup first/);
      // ...and it is not replaced by a claim that anything happened.
      expect(failure.message).not.toMatch(REFRESH_SUCCESS_CLAIM);
      expect(failure.message).not.toMatch(NOTIFICATION_CLAIM);
    }
  });

  it('never resolves any failure status to a recorded or notified claim', async () => {
    const { classifyEmployerActionFailure } = await import('../lib/employer-review-actions');

    // Exhaustive over the failure space, with and without upstream text. The
    // shipped bug was one status (401/403) on one endpoint resolving to
    // "Request recorded"; nothing may reintroduce that for any status.
    for (let status = 400; status < 600; status += 1) {
      for (const described of [
        undefined,
        null,
        '',
        '   ',
        'Employer-review mutations require an active verifier-role account.',
      ]) {
        const failure = classifyEmployerActionFailure(status, described);

        expect(['not_authorized', 'failed']).toContain(failure.kind);
        expect(failure.message, `status ${status}`).not.toMatch(REFRESH_SUCCESS_CLAIM);
        expect(failure.message, `status ${status}`).not.toMatch(NOTIFICATION_CLAIM);
        expect(failure.message, `status ${status}`).not.toMatch(/\bpilot\b/i);
        // A failure message must never be empty — an empty card reads as
        // "nothing went wrong".
        expect(failure.message.trim().length, `status ${status}`).toBeGreaterThan(0);
      }
    }
  });

  it('classifies every non-authorization failure as failed, not as authorization', async () => {
    const { classifyEmployerActionFailure } = await import('../lib/employer-review-actions');

    // Control: the authorization state is specific to 401/403. If a 500 or a
    // 502 started rendering "complete employer setup", the card would be
    // misdirecting the employer just as confidently as the old success card.
    for (const status of [400, 404, 409, 422, 500, 502, 503]) {
      expect(classifyEmployerActionFailure(status, null).kind, `status ${status}`).toBe('failed');
    }
  });
});

describe('a refused refresh request is never rendered as a recorded one', () => {
  it('ships no success-toned copy claiming a refresh request was recorded', async () => {
    const markup = await renderReviewSurface();

    // Sanity: the decision surface really rendered, so a clean pass below
    // means "no such claim", not "nothing rendered".
    expect(markup).toContain('Ada Lovelace');
    expect(markup).not.toMatch(REFRESH_SUCCESS_CLAIM);
    expect(markup).not.toMatch(NOTIFICATION_CLAIM);
    // 20s, not the 5s default: this is the first import of ReviewClient and
    // its transitive tree, and under a full-suite run that cold import alone
    // has exceeded 5s. A truth gate that flakes under load is not a gate.
    // (Precedent: clinician-activate-proxy.test.ts.)
  }, 20_000);

  it('carries no fabricated-confirmation string in shipped code', async () => {
    // The markup assertions above cannot reach a branch that only mounts after
    // a failed POST, so this reads the shipped module. Comments are stripped
    // first: this file and the component both *quote* the old fabrication to
    // explain it, and a scan that reads prose flags its own documentation
    // (the golden-namespace sweep has been fooled this way before).
    const source = await readComponentCode();

    expect(source).not.toMatch(/Request\s+recorded/i);
    expect(source).not.toMatch(/clinicians?\s+will\s+be\s+notified/i);
    expect(source).not.toMatch(/Your\s+request\s+has\s+been\s+recorded/i);
    // And the mechanism that produced them.
    expect(source).not.toMatch(/PilotFallbackError/);
    expect(source).not.toMatch(/pilot_confirmation/);
  });

  it('maps an authorization refusal to the authorization state and an error metric', async () => {
    // `classifyEmployerActionFailure` proves 401/403 becomes `not_authorized`.
    // This proves the component then renders it as a refusal and reports it as
    // one — the second half of the shipped bug was the funnel event, which is
    // live (#1121), so a success here corrupts qualified-start measurement
    // whatever the screen says.
    const source = await readComponentCode();

    const catchBranch = source.match(
      /error\s+instanceof\s+EmployerActionNotAuthorizedError\s*\)\s*\{([\s\S]*?)\n\s{6}\}/,
    );
    expect(catchBranch, 'the authorization catch branch must exist').not.toBeNull();
    expect(catchBranch?.[1]).toMatch(/'authorization_required'/);
    expect(catchBranch?.[1]).toMatch(/trackEmployerActionResult\([\s\S]*?'error'/);
    expect(catchBranch?.[1]).not.toMatch(/'success'/);

    // No other caller may report a success for a caught failure. Matches call
    // sites passing `'success'` positionally, not the declaration's
    // `result: 'success' | 'error'` annotation.
    const successReports = source.match(/trackEmployerActionResult\(\s*[^,()]+,\s*'success'/g) ?? [];
    expect(successReports.length, 'exactly one success report, on the 2xx path').toBe(1);
  });

  it('gives the authorization state a non-success tone', async () => {
    const source = await readComponentCode();

    const card = source.match(
      /actionState\.phase\s*===\s*'authorization_required'[\s\S]*?<\/SectionReveal>/,
    );
    expect(card, 'the authorization_required card must exist').not.toBeNull();
    expect(card?.[0]).toMatch(/tone="warning"/);
    expect(card?.[0]).not.toMatch(/tone="success"/);
  });
});

describe('the refusal reaches the client as a refusal', () => {
  it('the proxy passes a backend 403 through as 403, not as a success payload', async () => {
    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const { NextRequest } = await import('next/server');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'forbidden',
          error_description:
            'No employer organization is registered for this account. Complete employer setup first.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    try {
      const req = new NextRequest(
        'http://localhost/api/employer-review/test-entity-id/request-refresh',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const res = await POST(req, {
        params: Promise.resolve({ entityId: 'test-entity-id', action: 'request-refresh' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json() as { error_description?: string };
      // The server's actionable text survives — it is what the card shows.
      expect(body.error_description).toMatch(/Complete employer setup first/);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('request-refresh is a mounted action, so its 401/403 is a real denial and not a 404', async () => {
    // Control, and the load-bearing difference from the `reject` path in
    // `t7-employer-decline-truth.test.tsx`. If this ever 404s, this whole file
    // is guarding a dead path and the reachability claim above is stale.
    const { POST } = await import('../app/api/employer-review/[entityId]/[action]/route');
    const { NextRequest } = await import('next/server');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      const req = new NextRequest(
        'http://localhost/api/employer-review/test-entity-id/request-refresh',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const res = await POST(req, {
        params: Promise.resolve({ entityId: 'test-entity-id', action: 'request-refresh' }),
      });

      expect(res.status).not.toBe(404);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('the honest refusal copy names a remedy the employer can actually reach', () => {
  it('titles the authorization state by capability, never by outcome', async () => {
    const { employerActionNotAuthorizedTitle } = await import('../lib/employer-review-actions');

    for (const intent of ['accept', 'refresh', 'review'] as const) {
      const title = employerActionNotAuthorizedTitle(intent);
      expect(title).not.toMatch(REFRESH_SUCCESS_CLAIM);
      expect(title).toMatch(/can't/i);
    }

    expect(employerActionNotAuthorizedTitle('refresh')).toBe(
      "Your workspace can't request a refresh yet",
    );
  });

  it('links to a route that actually performs employer org setup', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readComponentCode();

    const card = source.match(
      /actionState\.phase\s*===\s*'authorization_required'[\s\S]*?<\/SectionReveal>/,
    );
    expect(card?.[0]).toMatch(/href="\/employers\/request-access"/);

    // "Route resolves" is not "route helps" — assert the destination is the
    // page that posts the setup the denial asks for.
    const page = await readFile(
      new URL('../app/employers/request-access/page.tsx', import.meta.url),
      'utf8',
    );
    expect(page).toMatch(/EmployerGetStartedClient/);

    const client = await readFile(
      new URL('../app/employers/EmployerGetStartedClient.tsx', import.meta.url),
      'utf8',
    );
    expect(client).toMatch(/'\/api\/employer\/setup'/);
  });
});
