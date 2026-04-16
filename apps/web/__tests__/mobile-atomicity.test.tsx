// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import NetworkStatusBanner from '../components/mobile/NetworkStatusBanner';
import ClinicianReadinessSurface from '../components/mobile/ClinicianReadinessSurface';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    redirect: vi.fn(),
    usePathname: () => '/holder/readiness',
    useSearchParams: () => new URLSearchParams(),
  };
});

vi.mock('../components/mobile/ClinicianSupportCard', () => ({
  ClinicianSupportCard: () => null,
}));

vi.mock('../components/pilot-ops/PilotFailureSignal', () => ({
  PilotFailureSignal: () => null,
}));

vi.mock('../components/pilot-ops/SupportActionButton', () => ({
  SupportActionButton: () => null,
}));

vi.mock('@/lib/mobile/analytics', () => ({
  trackClinicianEventOncePerSession: vi.fn(async () => undefined),
}));

vi.mock('@/lib/pilot-ops/client', () => ({
  trackPilotEvent: vi.fn(async () => undefined),
}));

vi.mock('@/lib/pilot-ops/funnel', () => ({
  trackPilotFunnelEvent: vi.fn(async () => undefined),
}));

function buildData(overrides: Partial<ClinicianMobileData> = {}): ClinicianMobileData {
  return {
    signedIn: true,
    workspace: {
      personProfile: {
        npi: '1234567890',
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'ICU',
        stateOfPractice: 'OR',
        completeness: 92,
      },
    },
    trustState: {
      npi: '1234567890',
      readinessLevel: 'L3',
      readinessScore: 91,
      readinessStatus: 'Ready to credential',
      trustBand: 'L3',
      trustScore: 91,
      gapSummary: [],
      computedAt: '2026-03-20T10:30:00.000Z',
      cached: false,
    },
    applications: [],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-03-20T10:30:00.000Z',
    profileCompleteness: {
      score: 92,
      dimensions: {
        npiVerified: true,
        resumeUploaded: true,
        linksAdded: true,
        workAuthProvided: true,
        credentialsImported: true,
      },
    },
    trustHistory: [
      {
        id: 'history_1',
        npi: '1234567890',
        readinessLevel: 'L3',
        readinessScore: 91,
        readinessStatus: 'Ready to credential',
        trustBand: 'L3',
        trustScore: 91,
        gapSummary: [],
        computedAt: '2026-03-20T10:30:00.000Z',
        cached: false,
        deltaScore: 4,
        deltaBand: 'up',
        previousLevel: 'L2',
        previousScore: 87,
        newGaps: [],
        resolvedGaps: ['DEA registration verified'],
        reason: 'DEA registration verified',
      },
    ],
    notifications: [],
    blockers: [],
    activeApplications: [],
    availableOpportunities: [],
    recommendedAction: {
      kind: 'apply_now',
      title: 'View matched opportunities',
      description: 'Use your live readiness state to move immediately.',
      href: '/holder/opportunities',
      ctaLabel: 'View opportunities',
    },
    ...overrides,
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function waitForCondition(
  condition: () => boolean,
  message: string,
  attempts = 20,
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (condition()) {
      return;
    }

    await flush();
    await act(async () => {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
    });
  }

  throw new Error(message);
}

async function renderWithProvider(node: React.ReactNode, data = buildData()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <ClinicianMobileProvider initialData={data}>
        {node}
      </ClinicianMobileProvider>,
    );
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

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find((node) => node.textContent?.includes(label));
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Unable to find button "${label}".`);
  }

  return button;
}

describe('mobile atomic rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('React', React);
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the live readiness snapshot visible and dedupes slow refresh taps', async () => {
    let resolveTrustRefresh: ((value: Response) => void) | null = null;
    const trustRefreshPromise = new Promise<Response>((resolvePromise) => {
      resolveTrustRefresh = resolvePromise;
    });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/trust-state/1234567890/refresh') {
        return trustRefreshPromise;
      }

      if (url === '/api/mobile/dashboard') {
        return Promise.resolve(new Response(JSON.stringify(buildData()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = await renderWithProvider(
      <>
        <NetworkStatusBanner />
        <ClinicianReadinessSurface />
      </>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Ready to credential');
    expect(view.container.textContent).toContain('91/100');

    const refreshButton = findButton(view.container, 'Refresh readiness');

    await act(async () => {
      refreshButton.click();
      refreshButton.click();
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(refreshButton.getAttribute('aria-busy')).toBe('true');
    expect(refreshButton.disabled).toBe(true);
    expect(view.container.textContent).toContain('Ready to credential');
    expect(view.container.textContent).toContain('91/100');

    resolveTrustRefresh?.(new Response(null, { status: 200 }));
    await waitForCondition(
      () => fetchMock.mock.calls.some((call) => String(call[0]) === '/api/mobile/dashboard'),
      'Expected the mobile dashboard refresh to run after the trust refresh completed.',
    );

    await view.unmount();
  });

  it('keeps the last resolved readiness visible when refresh fails', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === '/api/trust-state/1234567890/refresh') {
        return Promise.resolve(new Response(null, { status: 200 }));
      }

      if (url === '/api/mobile/dashboard') {
        return Promise.resolve(new Response(null, { status: 503 }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = await renderWithProvider(
      <>
        <NetworkStatusBanner />
        <ClinicianReadinessSurface />
      </>,
    );

    const refreshButton = findButton(view.container, 'Refresh readiness');
    await act(async () => {
      refreshButton.click();
    });
    await waitForCondition(
      () => view.container.textContent?.includes('Readiness could not refresh') ?? false,
      'Expected the mobile readiness surface to surface the refresh failure.',
    );

    expect(view.container.textContent).toContain('Ready to credential');
    expect(view.container.textContent).toContain('91/100');
    expect(view.container.textContent).toContain('Readiness could not refresh');

    await view.unmount();
  });

  it('keeps the /holder entry route on the atomic mobile path', () => {
    const holderRoute = readFileSync(
      resolve(process.cwd(), 'app/holder/page.tsx'),
      'utf8',
    );

    expect(holderRoute).toContain("redirect('/holder/home')");
    expect(holderRoute).not.toContain('useEffect(');
    expect(holderRoute).not.toContain("fetch('/api/me/workspaces')");
  });
});
