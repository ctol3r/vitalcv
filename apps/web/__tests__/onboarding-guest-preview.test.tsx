// @vitest-environment jsdom

/**
 * Record-first sequencing contract (founder experience audit 2026-08-06).
 *
 * The homepage promises the record before the account. /onboarding used to
 * answer with a sign-in wall — "Your NPI binds to your VitalCV account, so
 * sign-in comes first" — which repossessed the promise sixty seconds after
 * it was made. This suite pins the re-sequenced behaviour:
 *
 *   1. An anonymous visitor sees an NPI entry, not a sign-in wall.
 *   2. Resolving an NPI renders the PUBLIC registry record before any
 *      account ask, via the same public reads the homepage uses.
 *   3. The account ask is framed as saving what was found.
 *   4. The bind endpoints are never touched anonymously (#1074: the claim
 *      grants on a session, so the session is the floor).
 *   5. The homepage resolved-state CTA routes to /onboarding — never to the
 *      /holder layout redirect that produced the wall.
 *
 * The fixture NPI is DERIVED at runtime (npiWithCheckDigit below): it must
 * pass the checkNpi entry gate, but only checksum-valid numbers can name real
 * people, so no checksum-valid constant is persisted for a later copy-paste —
 * and the 0-prefixed base sits outside the NPPES enumerator's assignable
 * space (real NPIs begin with 1 or 2). Every network call is mocked — nothing
 * here reaches a real registry, and the fixture person is synthetic.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GetReadySurface from '@/app/get-ready/GetReadySurface';
import { CareerLoopHome } from '@/components/home/career-loop/CareerLoopHome';
import { ONBOARDING_NPI_KEY } from '@/lib/onboarding/npiHandoff';

/** NPI check digit: Luhn over '80840' + the 9-digit base (see lib/vital/npi). */
function npiWithCheckDigit(base9: string): string {
  const s = `80840${base9}`;
  let sum = 0;
  let double = true;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    let d = s.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return `${base9}${(10 - (sum % 10)) % 10}`;
}

// Checksum-valid, never a registrant (0-prefix — see the header note). Distinct
// from 1234567893, the CMS worked example, which one test below uses as a
// second checksum-valid value.
const VALID_NPI = npiWithCheckDigit('099999999');

const BOOTSTRAP_FIXTURE = {
  npi: VALID_NPI,
  npiType: 'TYPE_1',
  identitySource: 'NPPES_API',
  firstName: 'Ada',
  lastName: 'Rivers',
  specialty: 'Family Medicine',
  state: 'OR',
};

function mockFetch() {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url.includes('/api/me/workspaces')) {
      return new Response(null, { status: 401 });
    }
    if (url.includes(`/api/identity/bootstrap/${VALID_NPI}`)) {
      return Response.json(BOOTSTRAP_FIXTURE);
    }
    if (url.includes('/api/trust-state/')) {
      return new Response(null, { status: 503 });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderSurface() {
  root = createRoot(container);
  await act(async () => {
    root.render(<GetReadySurface />);
  });
  await flush();
}

describe('/onboarding anonymous visitor — record before account', () => {
  it('shows an NPI entry, not a sign-in wall', async () => {
    mockFetch();
    await renderSurface();

    expect(container.querySelector('#guest-npi-input')).not.toBeNull();
    expect(container.textContent).toContain('Start with your NPI. See where your record can go.');
    expect(container.querySelector('[data-scene="activation_path"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-activation-path="clinician"] [data-activation-step]')).toHaveLength(4);
    expect(container.textContent).not.toContain('sign-in comes first');
    expect(container.textContent).not.toContain("Sign in to confirm you're a clinician");
  });

  it('resolves the public record and only then asks to save it', async () => {
    const calls = mockFetch();
    await renderSurface();

    const input = container.querySelector<HTMLInputElement>('#guest-npi-input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(input, VALID_NPI);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    // The record renders from the PUBLIC bootstrap read…
    expect(container.querySelector('[data-guest-record]')).not.toBeNull();
    expect(container.textContent).toContain('Ada Rivers');
    expect(container.textContent).toContain('public NPPES registry record');
    // …the account ask is a save, pointing back at /onboarding…
    const save = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('sign in to keep it'),
    );
    expect(save?.getAttribute('href')).toBe('/sign-in?redirect_url=%2Fonboarding');
    // …and no bare "verified" anywhere in the anonymous render.
    expect(container.textContent).not.toMatch(/\bverified\b/i);

    // The bind endpoints were never touched anonymously.
    expect(calls.every((c) => !c.url.includes('/api/profile/npi/bootstrap'))).toBe(true);
    expect(calls.every((c) => !c.url.includes('/api/ownership/claim'))).toBe(true);
    // Data reads stay GET-only; the only POSTs an anonymous visitor may make
    // are telemetry (pilot-ops/analytics), added with /passport's retirement
    // when this lane took over the acquisition funnel's conversion events.
    const nonGet = calls.filter((c) => c.method !== 'GET');
    expect(
      nonGet.every((c) => c.url.includes('/api/pilot-ops') || c.url.includes('/api/analytics')),
      `unexpected non-GET calls: ${nonGet.map((c) => c.url).join(', ')}`,
    ).toBe(true);
  });

  it('auto-resolves an NPI handed off from the homepage', async () => {
    window.sessionStorage.setItem(ONBOARDING_NPI_KEY, VALID_NPI);
    mockFetch();
    await renderSurface();

    expect(container.querySelector('[data-guest-record]')).not.toBeNull();
    expect(container.textContent).toContain('Ada Rivers');
  });

  it('auto-resolves an NPI carried in ?npi= (cross-origin marketing arrival)', async () => {
    // The marketing site's NPI form cannot write this origin's storage — the
    // query string is its only carrier (see lib/onboarding/npiHandoff.ts).
    window.history.replaceState(null, '', `/onboarding?npi=${VALID_NPI}`);
    mockFetch();
    await renderSurface();

    expect(container.querySelector('[data-guest-record]')).not.toBeNull();
    expect(container.textContent).toContain('Ada Rivers');
  });

  it('prefers the fresh ?npi= over a stale stored handoff', async () => {
    // 1234567893 is the CMS check-digit example NPI — checksum-valid, and the
    // fetch mock resolves nothing for it, so if storage won this test would
    // land on the unavailable state instead of the fixture record.
    window.sessionStorage.setItem(ONBOARDING_NPI_KEY, '1234567893');
    window.history.replaceState(null, '', `/onboarding?npi=${VALID_NPI}`);
    mockFetch();
    await renderSurface();

    expect(container.querySelector('[data-guest-record]')).not.toBeNull();
    expect(container.textContent).toContain('Ada Rivers');
  });

  it('ignores a malformed ?npi= and shows the entry form', async () => {
    window.history.replaceState(null, '', '/onboarding?npi=12345');
    mockFetch();
    await renderSurface();

    expect(container.querySelector('#guest-npi-input')).not.toBeNull();
    expect(container.querySelector('[data-guest-record]')).toBeNull();
  });

  it('reports registry silence as a system state, not a finding', async () => {
    window.sessionStorage.setItem(ONBOARDING_NPI_KEY, VALID_NPI);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/me/workspaces')) return new Response(null, { status: 401 });
        return new Response(null, { status: 503 });
      }),
    );
    await renderSurface();

    expect(container.textContent).toContain("The registry didn't answer");
    expect(container.textContent).toContain('not a finding about your NPI');
  });
});

describe('homepage resolved-state CTA routes to the record-first flow', () => {
  it('points at /onboarding, never at the /holder wall', () => {
    const html = renderToStaticMarkup(<CareerLoopHome />);

    expect(html).toContain('Keep this record');
    expect(html).not.toContain('Manage your record');
    // The one action anchor in the review room targets the public flow.
    expect(html).toMatch(/clh-act clh-act--ink[^>]*href="\/onboarding"|href="\/onboarding"[^>]*clh-act clh-act--ink/);
    expect(html).not.toContain('href="/holder"');
  });
});
