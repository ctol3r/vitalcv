// @vitest-environment jsdom
/**
 * /holder/recognition surface — full recognition record.
 *
 * Truth contract: only real acceptance-history payloads render; the meaning
 * explainer never overstates (scoped to the accepting organization, anchored
 * to source checks); failures are system states; no bare "Verified".
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecognitionSurface } from '../components/recognition/RecognitionSurface';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function workspacesPayload(npi: string | null) {
  return { personProfile: npi ? { npi, firstName: 'Ada' } : null };
}

function acceptanceHistoryPayload() {
  return {
    ok: true,
    summary: {
      acceptedOrganizationCount: 2,
      hasPriorAcceptances: true,
      headline: 'Accepted by 2 organizations',
      trustCopy:
        'This clinician has already been accepted using VitalCV verification. Each acceptance remains scoped to the organization and scope shown below.',
    },
    history: [
      {
        acceptanceId: 'accept-2',
        orgLabel: 'Providence',
        isAnonymized: false,
        acceptedByOrgId: 'org-entity-2',
        acceptedAt: '2026-05-11T12:00:00.000Z',
        acceptanceScope: 'full',
        acceptanceReason: null,
      },
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

function stubFetchByUrl(routes: Record<string, () => Response | Promise<Response>>) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [prefix, respond] of Object.entries(routes)) {
      if (url.startsWith(prefix)) return respond();
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }));
}

describe('RecognitionSurface', () => {
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

  async function renderSurface() {
    await act(async () => {
      root.render(<RecognitionSurface />);
    });
  }

  it('renders the full acceptance record with every entry, scope, and the meaning explainer', async () => {
    stubFetchByUrl({
      '/api/me/workspaces': () => jsonResponse(workspacesPayload('1234567890')),
      '/api/employer-review/1234567890/acceptance-history': () =>
        jsonResponse(acceptanceHistoryPayload()),
    });

    await renderSurface();

    expect(container.textContent).toContain('Your recognition record');
    expect(container.textContent).toContain('Accepted by 2 organizations');
    expect(container.textContent).toContain('Providence');
    expect(container.textContent).toContain('Full scope');
    expect(container.textContent).toContain('Pilot organization 1');
    expect(container.textContent).toContain('Pilot scope');
    expect(container.textContent).toContain('Accepted as head start using VitalCV verification.');
    // Meaning explainer: scoped, audit-recorded, canonical sequence.
    expect(container.textContent).toContain('What an acceptance means');
    expect(container.textContent).toContain('scoped to the accepting organization');
    expect(container.textContent).toContain('does not replace another organization');
    expect(container.textContent).toContain('Recognition, then acceptance, then start');
    expect(container.querySelector('a[href="/holder"]')).not.toBeNull();
    expect(container.querySelector('a[href="/holder/applications"]')).not.toBeNull();
  });

  it('renders the honest empty state when nothing is recorded', async () => {
    stubFetchByUrl({
      '/api/me/workspaces': () => jsonResponse(workspacesPayload('1234567890')),
      '/api/employer-review/1234567890/acceptance-history': () =>
        jsonResponse({ error: 'not_found' }, 404),
    });

    await renderSurface();

    expect(container.textContent).toContain('No employer acceptances recorded yet');
    expect(container.textContent).toContain('accepts it as a head start');
    expect(container.querySelector('a[href="/holder/readiness"]')).not.toBeNull();
  });

  it('routes a missing NPI to the readiness setup path', async () => {
    stubFetchByUrl({
      '/api/me/workspaces': () => jsonResponse(workspacesPayload(null)),
    });

    await renderSurface();

    expect(container.textContent).toContain('Set up your readiness first');
    expect(container.querySelector('a[href="/get-ready"]')).not.toBeNull();
  });

  it('presents lookup failures as system states, never findings', async () => {
    stubFetchByUrl({
      '/api/me/workspaces': () => jsonResponse(workspacesPayload('1234567890')),
      '/api/employer-review/1234567890/acceptance-history': () =>
        jsonResponse({ error: 'boom' }, 500),
    });

    await renderSurface();

    expect(container.textContent).toContain('Recognition status is temporarily unavailable');
    expect(container.textContent).toContain('not a finding about your record');
  });

  it('never renders a bare Verified label', async () => {
    stubFetchByUrl({
      '/api/me/workspaces': () => jsonResponse(workspacesPayload('1234567890')),
      '/api/employer-review/1234567890/acceptance-history': () =>
        jsonResponse(acceptanceHistoryPayload()),
    });

    await renderSurface();

    expect(/\bVerified\b/.test(container.textContent ?? '')).toBe(false);
  });
});
