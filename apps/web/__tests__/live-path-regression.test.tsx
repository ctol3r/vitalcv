// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PassportData } from '@/app/passport/[id]/page';
import type { RoleContextValue } from '@/components/auth/RoleContext';
import { LiveTrustConsole } from '@/components/hero/LiveTrustConsole';
import InterviewClient from '@/app/interview/InterviewClient';
import ReviewClient from '@/components/review/ReviewClient';

const {
  buildPassportProofSectionsMock,
  routerPushMock,
  summarizePassportProofSectionsMock,
  trackUxEventMock,
} = vi.hoisted(() => ({
  buildPassportProofSectionsMock: vi.fn(),
  routerPushMock: vi.fn(),
  summarizePassportProofSectionsMock: vi.fn(),
  trackUxEventMock: vi.fn(),
}));

let roleContextValue: RoleContextValue = {
  isLoaded: true,
  isSignedIn: false,
  clerkRole: null,
  persona: null,
  role: 'guest',
  landingRoute: '/sign-in',
  isClinician: false,
  isEmployer: false,
  clinicianNpi: null,
  employerOrgId: null,
  workspace: null,
  refresh: async () => undefined,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string | { pathname?: string };
    children: React.ReactNode;
  }) => (
    <a
      href={typeof href === 'string' ? href : href.pathname ?? '#'}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock('@/components/auth/RoleContext', () => ({
  useRoleContext: () => roleContextValue,
}));

vi.mock('@/lib/telemetry/ux-tracker', () => ({
  trackUxEvent: trackUxEventMock,
}));

vi.mock('@/lib/auth/clerkConfig', () => ({
  CLERK_PROVIDER_ENABLED: true,
  CLERK_SIGN_IN_URL: '/sign-in',
}));

vi.mock('@/components/advisory/AdvisoryPanel', () => ({
  EmployerAdvisoryPanel: () => null,
}));

vi.mock('@/components/trust/ProofDetailsList', () => ({
  ProofDetailsList: ({
    rows,
  }: {
    rows: Array<{ id: string; label: string; value: React.ReactNode }>;
  }) => (
    <dl>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  ),
}));

vi.mock('@/components/ui/vcv-accordion', () => ({
  Accordion: ({
    items,
  }: {
    items: Array<{
      id: string;
      trigger: React.ReactNode;
      content: React.ReactNode;
    }>;
  }) => (
    <div data-testid="accordion">
      {items.map((item) => (
        <section key={item.id} data-item-id={item.id}>
          <button type="button">{item.trigger}</button>
          <div>{item.content}</div>
        </section>
      ))}
    </div>
  ),
}));

vi.mock('@/components/trust/passportProofSections', () => ({
  buildPassportProofSections: buildPassportProofSectionsMock,
  summarizePassportProofSections: summarizePassportProofSectionsMock,
}));

vi.mock('@/components/vds/primitives', () => ({
  VStatusPill: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock('@/components/ui/trust-label', () => ({
  TrustLabel: ({
    label,
    note,
    explanation,
  }: {
    label: string;
    note?: string;
    explanation?: string;
  }) => (
    <div>
      <p>{label}</p>
      {note ? <p>{note}</p> : null}
      {explanation ? <p>{explanation}</p> : null}
    </div>
  ),
}));

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
    blob: vi.fn(async () => new Blob([JSON.stringify(body)], { type: 'application/json' })),
  };
}

function buildCredential(
  overrides: Partial<PassportData['authority']['credentials'][number]> = {},
): PassportData['authority']['credentials'][number] {
  return {
    id: 'cred_1',
    domain: 'LICENSURE',
    type: 'LICENSE',
    status: 'ACTIVE',
    verificationLevel: 'PRIMARY_SOURCE',
    issuerName: 'Oregon Board of Nursing',
    sourceId: 'oregon-board',
    jurisdiction: 'OR',
    issuedAt: '2025-01-01T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    verifiedAt: '2026-03-20T10:00:00.000Z',
    observedAt: '2026-03-20T10:00:00.000Z',
    stale: false,
    confidenceLabel: 'High confidence',
    claimConfidenceLabel: 'High confidence',
    dataFreshness: 'current',
    dataFreshnessLabel: 'Current attached record',
    reviewRequired: false,
    authorityClaimCode: 'RN_LICENSE_ACTIVE',
    ...overrides,
  };
}

function buildPassport(
  overrides: Partial<PassportData> = {},
): PassportData {
  const base: PassportData = {
    entityId: 'entity_123',
    npi: '1234567890',
    identity: {
      displayName: 'Ada Lovelace',
      specialty: 'ICU',
      entityType: 'CLINICIAN',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: {
      credentials: [
        buildCredential(),
      ],
      summary: {
        active: 1,
        expired: 0,
        stale: 0,
        missing: ['DEA_REGISTRATION'],
      },
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
      exclusionCheckedAt: '2026-03-20T10:30:00.000Z',
      exclusionConfidenceLabel: 'High confidence',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'CMS PECOS confirms an enrolled provider record in the current quarterly release.',
      enrollmentObservedAt: '2026-03-01T00:00:00.000Z',
      enrollmentDataVersion: 'Q1 2026',
      enrollmentStatusLabel: 'Enrolled',
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
      nextActions: [
        {
          id: 'next_1',
          title: 'Upload DEA evidence',
          detail: 'Attach your DEA registration before the employer acts.',
          priority: 'HIGH',
        },
      ],
    },
    sources: {
      checked: ['NPPES', 'OIG'],
      lastFetch: {
        NPPES: '2026-03-20T10:30:00.000Z',
        OIG: '2026-03-20T10:30:00.000Z',
      },
    },
    lastCheckedAt: '2026-03-20T10:30:00.000Z',
  };

  return {
    ...base,
    ...overrides,
    identity: {
      ...base.identity,
      ...overrides.identity,
    },
    authority: {
      ...base.authority,
      ...overrides.authority,
      credentials: overrides.authority?.credentials ?? base.authority.credentials,
      summary: {
        ...base.authority.summary,
        ...overrides.authority?.summary,
      },
    },
    training: {
      ...base.training,
      ...overrides.training,
      records: overrides.training?.records ?? base.training.records,
    },
    standing: {
      ...base.standing,
      ...overrides.standing,
      negativeFindings: overrides.standing?.negativeFindings ?? base.standing.negativeFindings,
    },
    readiness: {
      ...base.readiness,
      ...overrides.readiness,
      blockers: overrides.readiness?.blockers ?? base.readiness.blockers,
      gaps: overrides.readiness?.gaps ?? base.readiness.gaps,
      nextActions: overrides.readiness?.nextActions ?? base.readiness.nextActions,
    },
    sources: {
      ...base.sources,
      ...overrides.sources,
      checked: overrides.sources?.checked ?? base.sources.checked,
      lastFetch: {
        ...base.sources.lastFetch,
        ...overrides.sources?.lastFetch,
      },
    },
  };
}

function buildTrustState() {
  return {
    npi: '1234567890',
    identityVerified: true,
    licensureStatus: 'verified' as const,
    exclusionClear: true,
    exclusionStatus: 'CLEAR' as const,
    credentialCount: 2,
    readiness_level: 'L2' as const,
    readiness_status: 'Verified — ready to proceed',
    readiness_score: 88,
    gap_summary: [],
    methodology_version: 'trust-state@1.0.0',
    computed_at: '2026-03-20T10:30:00.000Z',
    facts: [
      {
        factType: 'PERSONAL_IDENTITY',
        source: 'CMS NPPES',
        status: 'verified',
        details: 'Ada Lovelace',
      },
      {
        factType: 'SPECIALTY',
        source: 'CMS NPPES',
        status: 'verified',
        details: 'ICU',
      },
    ],
    gaps: [],
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
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

function textContent(container: HTMLElement): string {
  return container.textContent ?? '';
}

async function setInputValue(
  container: HTMLElement,
  ariaLabel: string,
  value: string,
) {
  const input = container.querySelector<HTMLInputElement>(`input[aria-label="${ariaLabel}"]`);
  if (!input) {
    throw new Error(`Unable to find input with aria-label "${ariaLabel}"`);
  }

  await act(async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    );
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function clickByText(
  container: HTMLElement,
  text: string,
  selector = 'button, a',
) {
  const element = Array.from(container.querySelectorAll<HTMLElement>(selector))
    .find((node) => node.textContent?.includes(text));

  if (!element) {
    throw new Error(`Unable to find clickable element containing "${text}"`);
  }

  await act(async () => {
    element.click();
  });
}

function hrefForText(container: HTMLElement, text: string): string | null {
  const link = Array.from(container.querySelectorAll<HTMLAnchorElement>('a'))
    .find((node) => node.textContent?.includes(text));
  return link?.getAttribute('href') ?? null;
}

function trackedEventNames(): string[] {
  return trackUxEventMock.mock.calls.map((call) => call[0]?.event_name);
}

describe('live path regression hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('React', React);
    vi.stubGlobal('fetch', vi.fn());
    window.history.replaceState({}, '', '/');

    roleContextValue = {
      isLoaded: true,
      isSignedIn: false,
      clerkRole: null,
      persona: null,
      role: 'guest',
      landingRoute: '/sign-in',
      isClinician: false,
      isEmployer: false,
      clinicianNpi: null,
      employerOrgId: null,
      workspace: null,
      refresh: async () => undefined,
    };

    buildPassportProofSectionsMock.mockReturnValue([
      {
        id: 'identity',
        trigger: 'Identity verification',
        status: 'verified',
        content: <div>Decision-grade identity proof.</div>,
      },
    ]);
    summarizePassportProofSectionsMock.mockReturnValue({
      decisionGradeCount: 1,
      informationalCount: 0,
      total: 1,
      warningCount: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('submits homepage NPI lookups and reveals the live readiness snapshot', async () => {
    const fetchMock = vi.mocked(fetch);
    const onPreviewReady = vi.fn();

    fetchMock.mockResolvedValueOnce(jsonResponse({
      npi: '1234567890',
      results: [
        { source: 'NPPES_API', status: 'SUCCESS', claimsEmitted: 1, latencyMs: 12 },
        { source: 'OIG_LEIE', status: 'SUCCESS', claimsEmitted: 1, latencyMs: 9 },
      ],
    }) as never);
    fetchMock.mockResolvedValueOnce(jsonResponse(buildTrustState()) as never);

    const view = await renderNode(<LiveTrustConsole onPreviewReady={onPreviewReady} />);

    await setInputValue(view.container, 'NPI number', '1234567890');
    await clickByText(view.container, 'See readiness');
    await flush();
    await advance(260);
    await flush();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/identity/1234567890/ingest',
      { method: 'POST' },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/trust-state/1234567890');
    expect(textContent(view.container)).toContain('Ada Lovelace');
    expect(textContent(view.container)).toContain('Verified — ready to proceed');
    expect(textContent(view.container)).not.toContain('Demo preview');
    expect(onPreviewReady).toHaveBeenCalledWith('1234567890', 'Ada Lovelace');
    expect(trackedEventNames()).toEqual(expect.arrayContaining([
      'page_loaded',
      'npi_submit',
      'loader_started',
      'preview_visible',
    ]));

    await view.unmount();
  });

  it('falls back to the degraded readiness preview when the trust-state call fails', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(jsonResponse({
      npi: '1234567890',
      results: [
        { source: 'NPPES_API', status: 'SUCCESS', claimsEmitted: 1, latencyMs: 12 },
      ],
    }) as never);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'backend down' }, 503) as never);

    const view = await renderNode(<LiveTrustConsole />);

    await setInputValue(view.container, 'NPI number', '1234567890');
    await clickByText(view.container, 'See readiness');
    await flush();
    await advance(260);
    await flush();

    expect(textContent(view.container)).toContain('Demo preview');
    expect(textContent(view.container)).toContain('Partial source coverage · demo preview only');

    const previewVisibleCall = trackUxEventMock.mock.calls
      .map((call) => call[0])
      .find((event) => event?.event_name === 'preview_visible');
    expect(previewVisibleCall?.metadata).toMatchObject({
      interaction_result: 'fallback',
      source_mode: 'demo',
    });

    await view.unmount();
  });

  it('records share success and exposes the canonical review transition link', async () => {
    roleContextValue = {
      ...roleContextValue,
      isSignedIn: true,
      role: 'clinician',
      isClinician: true,
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      shareEventId: 'share_evt_123',
      timestamp: '2026-03-21T09:00:00.000Z',
      status: 'delivered',
    }) as never);

    const passport = buildPassport();
    const view = await renderNode(
      <InterviewClient
        entityId={passport.entityId}
        passport={passport}
        contextId="ctx_abc123"
      />,
    );

    await clickByText(view.container, 'Share with employer');
    await flush();

    expect(fetchMock).toHaveBeenCalledWith('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityId: passport.entityId,
        organizationContextId: 'ctx_abc123',
      }),
    });
    expect(textContent(view.container)).toContain('Share recorded');
    expect(textContent(view.container)).toContain('share_evt_123');
    expect(hrefForText(view.container, 'Open employer review')).toBe(
      `/review/${passport.entityId}?contextId=ctx_abc123&from=Ada%20Lovelace`,
    );
    expect(trackedEventNames()).toEqual(expect.arrayContaining([
      'share_click',
      'share_success',
    ]));

    await view.unmount();
  });

  it('persists employer accept actions and renders the audit success state', async () => {
    roleContextValue = {
      ...roleContextValue,
      isSignedIn: true,
      clerkRole: 'VERIFIER',
      persona: 'VERIFIER',
      role: 'employer',
      isEmployer: true,
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      state: null,
    }) as never);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      state: {
        action: 'accept',
        entityId: 'entity_123',
        clinicianNpi: '1234567890',
        auditEventId: 'audit_evt_accept',
        timestamp: '2026-03-21T11:30:00.000Z',
        persistence: {
          mode: 'durable_record',
          target: 'employer_acceptance',
          acceptanceId: 'accept_123',
          reviewItemId: null,
          reviewItemCreated: false,
        },
        summary: {
          title: 'Head start accepted',
          description: 'The employer acceptance was persisted and linked to an audit event.',
        },
        details: {
          staleSources: [],
          missingDomains: [],
          reason: null,
          priority: null,
        },
      },
    }) as never);

    const passport = buildPassport();
    const view = await renderNode(
      <ReviewClient
        passport={passport}
        contextId="ctx_employer"
        sharedBy="Ada Lovelace"
      />,
    );

    await clickByText(view.container, 'Accept as head start');
    await flush();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/employer-review/${passport.entityId}/status`,
      {
        headers: { Accept: 'application/json' },
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/employer-review/${passport.entityId}/accept`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    expect(textContent(view.container)).toContain('Head start accepted');
    expect(textContent(view.container)).toContain('audit_evt_accept');
    expect(trackedEventNames()).toEqual(expect.arrayContaining([
      'review_opened',
      'employer_action_clicked',
      'employer_action_result',
    ]));

    await view.unmount();
  });

  it('surfaces employer route-to-review failures without fabricating success', async () => {
    roleContextValue = {
      ...roleContextValue,
      isSignedIn: true,
      clerkRole: 'VERIFIER',
      persona: 'VERIFIER',
      role: 'employer',
      isEmployer: true,
    };

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      state: null,
    }) as never);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      error_description: 'Manual review queue unavailable.',
    }, 503) as never);

    const passport = buildPassport();
    const view = await renderNode(<ReviewClient passport={passport} contextId="ctx_review" />);

    await clickByText(view.container, 'Route to review');
    await flush();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/employer-review/${passport.entityId}/route-to-review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Employer routed to review. Blockers: DEA_REGISTRATION, dea registration',
          priority: 'HIGH',
        }),
      },
    );
    expect(textContent(view.container)).toContain('Action failed');
    expect(textContent(view.container)).toContain('Manual review queue unavailable.');
    expect(textContent(view.container)).not.toContain('Routed to review');

    await view.unmount();
  });
});
