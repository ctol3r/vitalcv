// @vitest-environment jsdom

/**
 * /employer/post — the websiteless inline org-setup fallback is retired.
 *
 * The fallback POSTed { name } to /api/employer/setup with no website, and the
 * authority gate (resolveOrganizationAuthority, employerIntegrity.ts) requires
 * the caller's work-email domain to match the organization's website domain —
 * so the fallback ALWAYS 403'd (`no_org_domain`). The one working setup
 * surface is /employers (EmployerGetStartedClient sends the website).
 *
 * Outcome asserted (not mechanism): after a post fails for lack of an
 * organization, the page shows a notice routing to /employers, and NO request
 * to /api/employer/setup is ever issued from this surface.
 */

import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EmployerPostPage from '@/app/employer/post/page';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchSpy: ReturnType<typeof vi.fn>;

/** GET openings → empty list; POST opening → 404 no-org; everything else 500. */
function wireFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/employer/opportunities') && init?.method === 'POST') {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'No organization found for this account.' }),
      } as unknown as Response;
    }
    if (url.includes('/api/employer/opportunities')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ opportunities: [] }),
      } as unknown as Response;
    }
    return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
  });
}

/** Drive a React controlled input the way a user would. */
function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function inputByPlaceholder(placeholder: string): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`);
  if (!el) throw new Error(`No input with placeholder "${placeholder}"`);
  return el;
}

beforeEach(async () => {
  fetchSpy = wireFetch();
  global.fetch = fetchSpy as unknown as typeof fetch;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<EmployerPostPage />);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('/employer/post with no registered organization', () => {
  it('routes a no-org post to /employers instead of an inline name-only setup', async () => {
    // Fill the minimum the client-side validator requires, then submit.
    await act(async () => {
      setInputValue(inputByPlaceholder('Family Medicine Physician'), 'Hospitalist');
      setInputValue(inputByPlaceholder('Family Medicine'), 'Internal Medicine');
      setInputValue(inputByPlaceholder('CA'), 'CA');
    });
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    await act(async () => {
      form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // The notice replaced the retired inline setup form.
    const notice = container.querySelector('[data-testid="needs-org-notice"]');
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toContain('Finish employer setup');

    // It routes to the ONE working setup surface.
    const link = notice!.querySelector<HTMLAnchorElement>('a[href="/employers"]');
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain('Go to employer setup');

    // The retired fallback's markup is gone: no org-name input, no
    // set-up-and-post button anywhere on the page.
    expect(container.querySelector('input[placeholder="Bay Area Cardiac Group"]')).toBeNull();
    expect(container.textContent).not.toContain('Set up & post');
  });

  it('never issues a request to /api/employer/setup from this surface', async () => {
    await act(async () => {
      setInputValue(inputByPlaceholder('Family Medicine Physician'), 'Hospitalist');
      setInputValue(inputByPlaceholder('Family Medicine'), 'Internal Medicine');
      setInputValue(inputByPlaceholder('CA'), 'CA');
    });
    const form = container.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const requestedUrls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(requestedUrls.length).toBeGreaterThan(0);
    for (const url of requestedUrls) {
      expect(url).not.toContain('/api/employer/setup');
    }
  });
});
