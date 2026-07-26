// @vitest-environment jsdom
/**
 * Recognition card + acceptance-recognition helper.
 *
 * Truth contract: the card renders only real acceptance-history payloads;
 * a failed lookup is presented as a system state, never as a finding; an
 * empty record says exactly that. Copy pins the holder-facing recognition
 * vocabulary ("employer acceptances", "head start") — no bare "Verified".
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecognitionCard } from '../components/recognition/RecognitionCard';
import { fetchAcceptanceRecognition } from '../lib/recognition/acceptance-recognition';

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

describe('fetchAcceptanceRecognition', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns recognized with the normalized payload when acceptances exist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(acceptanceHistoryPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAcceptanceRecognition('1234567890');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/employer-review/1234567890/acceptance-history',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(result.state).toBe('recognized');
    if (result.state === 'recognized') {
      expect(result.recognition.summary.headline).toBe('Accepted by 1 organization');
      expect(result.recognition.history).toHaveLength(1);
    }
  });

  it('maps an empty record and an unknown NPI (404) to none_recorded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      ok: true,
      summary: {
        acceptedOrganizationCount: 0,
        hasPriorAcceptances: false,
        headline: 'No prior acceptances',
        trustCopy: null,
      },
      history: [],
    })));
    expect((await fetchAcceptanceRecognition('1234567890')).state).toBe('none_recorded');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'not_found' }, 404)));
    expect((await fetchAcceptanceRecognition('9999999999')).state).toBe('none_recorded');
  });

  it('maps server failures, malformed payloads, and network errors to unavailable — never a finding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, 500)));
    expect((await fetchAcceptanceRecognition('1234567890')).state).toBe('unavailable');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true, summary: {}, history: 'nope' })));
    expect((await fetchAcceptanceRecognition('1234567890')).state).toBe('unavailable');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await fetchAcceptanceRecognition('1234567890')).state).toBe('unavailable');
  });
});

describe('RecognitionCard', () => {
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

  async function renderCard(npi: string) {
    await act(async () => {
      root.render(<RecognitionCard npi={npi} />);
    });
  }

  it('renders the real acceptance record with headline, latest entry, and scope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(acceptanceHistoryPayload())));

    await renderCard('1234567890');

    expect(container.textContent).toContain('Recognition');
    expect(container.textContent).toContain('Accepted by 1 organization');
    expect(container.textContent).toContain('Pilot organization 1');
    expect(container.textContent).toContain('Pilot scope');
    const link = container.querySelector('a[href="/holder/recognition"]');
    expect(link).not.toBeNull();
  });

  it('renders an honest empty state when nothing is recorded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'not_found' }, 404)));

    await renderCard('1234567890');

    expect(container.textContent).toContain('No employer acceptances recorded yet');
    expect(container.textContent).toContain('accepts your evidence as a head start');
    expect(container.querySelector('a[href="/holder/readiness"]')).not.toBeNull();
  });

  it('renders a system-state message (not a finding) when the lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await renderCard('1234567890');

    expect(container.textContent).toContain('Recognition status is temporarily unavailable');
    expect(container.textContent).toContain('not a finding about your record');
  });

  it('never renders a bare Verified label in any state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(acceptanceHistoryPayload())));

    await renderCard('1234567890');

    const text = container.textContent ?? '';
    expect(/\bVerified\b/.test(text)).toBe(false);
  });
});
