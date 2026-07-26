// @vitest-environment jsdom
/**
 * Share Recognition + public verifier acceptance panel.
 *
 * Truth contract: the share panel always shows the full link it hands out
 * (nothing hidden), the verifier page renders acceptances from the real
 * backend payload only, and a failed acceptance lookup is a system state —
 * never rendered as "no acceptances".
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareRecognitionPanel } from '../components/recognition/ShareRecognitionPanel';
import VerifierPage from '../app/verify/[npi]/page';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function acceptanceHistoryPayload() {
  return {
    ok: true,
    summary: {
      acceptedOrganizationCount: 1,
      hasPriorAcceptances: true,
      headline: 'Accepted by 1 organization',
      trustCopy:
        'This clinician has already been accepted using VitalCV verification. Each acceptance remains scoped to the organization and scope shown below.',
    },
    history: [
      {
        acceptanceId: 'accept-1',
        orgLabel: 'Pilot organization 1',
        isAnonymized: true,
        acceptedByOrgId: 'org-entity-1',
        acceptedAt: '2026-03-23T18:00:00.000Z',
        acceptanceScope: 'pilot',
        acceptanceReason: 'Accepted as head start using VitalCV verification.',
      },
    ],
  };
}

function minimalPassport() {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: {
      displayName: 'Ada Lovelace',
      specialty: 'Cardiology',
      entityType: 'PERSON',
      status: 'A',
    },
    sourceCoverage: { checks: [] },
    readiness: { status: 'PARTIAL', score: 62 },
    lastCheckedAt: '2026-06-30T12:00:00.000Z',
  };
}

describe('ShareRecognitionPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows the full verifier link, an open action, and copies via the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await act(async () => {
      root.render(<ShareRecognitionPanel npi="1234567890" />);
    });

    expect(container.textContent).toContain('Present VitalCV Recognition');
    expect(container.textContent).toContain('without creating an account');

    const input = container.querySelector<HTMLInputElement>('input[readonly]');
    expect(input?.value).toContain('/verify/1234567890');

    const openLink = container.querySelector('a[target="_blank"]');
    expect(openLink?.getAttribute('href')).toBe('/verify/1234567890');

    const copyButton = [...container.querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Copy link'));
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton!.click();
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/verify/1234567890'));
    expect(container.textContent).toContain('Copied');
  });
});

describe('/verify/[npi] acceptance panel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function stubBackend(routes: {
    passport: () => Response;
    acceptance: () => Response | Promise<Response>;
  }) {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/passport/npi/')) return routes.passport();
      if (url.includes('/acceptance-history')) return routes.acceptance();
      throw new Error(`Unexpected fetch: ${url}`);
    }));
  }

  async function renderPage() {
    const element = await VerifierPage({ params: Promise.resolve({ npi: '1234567890' }) });
    return renderToStaticMarkup(element);
  }

  it('renders recorded acceptances from the backend payload', async () => {
    stubBackend({
      passport: () => jsonResponse(minimalPassport()),
      acceptance: () => jsonResponse(acceptanceHistoryPayload()),
    });

    const html = await renderPage();

    expect(html).toContain('Employer acceptances');
    expect(html).toContain('Accepted by 1 organization');
    expect(html).toContain('Pilot organization 1');
    expect(html).toContain('Pilot scope');
  });

  it('renders an honest zero-state when no acceptances are recorded', async () => {
    stubBackend({
      passport: () => jsonResponse(minimalPassport()),
      acceptance: () => jsonResponse({
        ok: true,
        summary: {
          acceptedOrganizationCount: 0,
          hasPriorAcceptances: false,
          headline: 'No prior acceptances',
          trustCopy: null,
        },
        history: [],
      }),
    });

    const html = await renderPage();

    expect(html).toContain('No employer acceptances recorded for this NPI.');
  });

  it('renders a system-state line — never a zero-state — when the acceptance lookup fails', async () => {
    stubBackend({
      passport: () => jsonResponse(minimalPassport()),
      acceptance: () => jsonResponse({ error: 'boom' }, 500),
    });

    const html = await renderPage();

    expect(html).toContain('Acceptance record temporarily unavailable');
    expect(html).toContain('not a finding about this clinician');
    expect(html).not.toContain('No employer acceptances recorded');
  });
});
