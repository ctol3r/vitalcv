// @vitest-environment jsdom
/**
 * ProfileSurface — Wave 2B profile editing depth.
 *
 * Truth contract under test:
 *   - identity header fields carry per-field provenance (registry-hydrated
 *     fields are source-confirmed; nothing missing is ever source-confirmed)
 *   - completeness guidance is filled-ness only, renders the backend
 *     dimension breakdown as done/missing with a fix destination
 *   - save is disabled with no changes; editing after a save clears the
 *     stale "Saved" state; a save that clears a previously saved field is
 *     blocked with an honest explanation (the intake API cannot clear)
 *   - a failed lookup renders as a system state, never as a finding
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileSurface from '../app/clinician/profile/ProfileSurface';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NPI = '1234567890';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function workspacePayload() {
  return {
    userId: 'u1',
    personProfile: {
      npi: NPI,
      firstName: 'Test',
      lastName: 'Clinician',
      specialty: 'Internal Medicine',
      stateOfPractice: 'CA',
      workAuthStatus: 'authorized',
      resumeUrl: null,
      linkedinUrl: 'https://linkedin.com/in/test',
      portfolioUrl: null,
      completeness: 55,
    },
  };
}

function completenessPayload() {
  return {
    userId: 'u1',
    score: 55,
    dimensions: {
      npiVerified: true,
      resumeUploaded: false,
      linksAdded: true,
      workAuthProvided: true,
      credentialsImported: false,
    },
  };
}

function acceptanceHistoryPayload() {
  return {
    ok: true,
    summary: {
      acceptedOrganizationCount: 1,
      hasPriorAcceptances: true,
      headline: 'Accepted by 1 organization.',
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

/** Routes every fetch the surface makes; records profile save POSTs. */
function installFetchMock(options?: { failSaves?: boolean }) {
  const savePosts: string[] = [];
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/me/workspaces')) return jsonResponse(workspacePayload());
    if (url.includes('/api/profile/completeness')) return jsonResponse(completenessPayload());
    if (url.includes('/acceptance-history')) return jsonResponse(acceptanceHistoryPayload());
    if (url.includes('/api/passport/')) return jsonResponse({ error: 'unavailable' }, 503);
    if (
      url.includes('/api/profile/links') ||
      url.includes('/api/profile/resume/upload') ||
      url.includes('/api/profile/work-auth')
    ) {
      savePosts.push(url);
      if (options?.failSaves) return jsonResponse({ error: 'backend unavailable' }, 503);
      return jsonResponse({ ok: true });
    }
    throw new Error(`Unmocked fetch: ${url}`);
  });
  vi.stubGlobal('fetch', mock);
  return { mock, savePosts };
}

async function flushEffects() {
  // Several rounds: workspace load → ready render → passport/completeness/
  // recognition effects → their state commits.
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Submit the profile form the way jsdom supports across versions. */
function submitForm(container: HTMLElement) {
  const form = container.querySelector('form') as HTMLFormElement;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('ProfileSurface (Wave 2B editing depth)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function renderSurface() {
    await act(async () => {
      root = createRoot(container);
      root.render(<ProfileSurface />);
    });
    await flushEffects();
  }

  it('renders per-field identity provenance from the registry-hydrated profile', async () => {
    installFetchMock();
    await renderSurface();

    const section = container.querySelector('[data-testid="identity-provenance"]');
    expect(section).not.toBeNull();
    expect(section!.textContent).toContain('Where your identity data comes from');
    expect(section!.textContent).toContain('Internal Medicine');
    // Hydrated fields carry the source-confirmed chip; nothing shows a bare "Verified".
    expect(section!.querySelectorAll('[data-provenance="VERIFIED"]').length).toBe(4);
    expect(section!.textContent).toContain('Source-confirmed');
    expect(section!.textContent).not.toMatch(/\bVerified\b/);
  });

  it('renders completeness guidance with done/missing rows and fix destinations', async () => {
    installFetchMock();
    await renderSurface();

    const checklist = container.querySelector('[data-testid="completeness-checklist"]');
    expect(checklist).not.toBeNull();
    expect(
      container.querySelector('[data-testid="completeness-npiVerified"]')?.getAttribute('data-complete'),
    ).toBe('true');
    const credentials = container.querySelector('[data-testid="completeness-credentialsImported"]');
    expect(credentials?.getAttribute('data-complete')).toBe('false');
    expect(credentials?.textContent).toContain('Missing');
    expect(credentials?.querySelector('a')?.getAttribute('href')).toBe('/holder#evidence-upload');
    const resume = container.querySelector('[data-testid="completeness-resumeUploaded"]');
    expect(resume?.querySelector('a')?.getAttribute('href')).toBe('#self-attested');
    // Filled-ness-only framing stays pinned.
    expect(container.textContent).toContain('it is not verification');
  });

  it('shows recorded employer acceptances with a link to the recognition record', async () => {
    installFetchMock();
    await renderSurface();

    const recognition = container.querySelector('[data-testid="profile-recognition"]');
    expect(recognition).not.toBeNull();
    expect(recognition!.textContent).toContain('Accepted by 1 organization.');
    const link = Array.from(recognition!.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/holder/recognition',
    );
    expect(link).toBeDefined();
  });

  it('renders the passport failure as a system state, not a finding', async () => {
    installFetchMock();
    await renderSurface();
    expect(container.textContent).toContain(
      'Your source-backed profile sections are temporarily unavailable.',
    );
    expect(container.textContent).toContain('not a finding about your credentials');
  });

  it('disables save with no changes and tracks dirty state on edit', async () => {
    installFetchMock();
    await renderSurface();

    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(container.textContent).toContain('No unsaved changes.');

    const linkedin = container.querySelector('#profile-linkedin') as HTMLInputElement;
    await act(async () => {
      setInputValue(linkedin, 'linkedin.com/in/updated');
    });
    expect(container.textContent).toContain('Unsaved changes.');
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('blocks a save that clears a previously saved field, with honest copy', async () => {
    const { savePosts } = installFetchMock();
    await renderSurface();

    const linkedin = container.querySelector('#profile-linkedin') as HTMLInputElement;
    await act(async () => {
      setInputValue(linkedin, '');
    });
    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await act(async () => {
      submitForm(container);
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('Removing a saved value is not supported on this surface yet');
    expect(alert?.textContent).toContain('LinkedIn');
    expect(savePosts).toEqual([]);
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain('Retry save');
  });

  it('saves only the changed field and reports a failed save with a retry affordance', async () => {
    const { savePosts } = installFetchMock({ failSaves: true });
    await renderSurface();

    const linkedin = container.querySelector('#profile-linkedin') as HTMLInputElement;
    await act(async () => {
      setInputValue(linkedin, 'linkedin.com/in/updated');
    });
    await act(async () => {
      submitForm(container);
    });
    await flushEffects();

    expect(savePosts).toHaveLength(1);
    expect(savePosts[0]).toContain('/api/profile/links');
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('system state');
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain('Retry save');

    // Editing again clears the failed-save state back to a plain save.
    await act(async () => {
      setInputValue(linkedin, 'linkedin.com/in/updated-again');
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain(
      'Save self-attested fields',
    );
  });

  it('completes a successful save and returns to a clean, saved state', async () => {
    const { savePosts } = installFetchMock();
    await renderSurface();

    const workAuth = container.querySelector('#profile-work-auth') as HTMLSelectElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value',
      )?.set;
      setter?.call(workAuth, 'visa_required');
      workAuth.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await act(async () => {
      submitForm(container);
    });
    await flushEffects();

    expect(savePosts.some((url) => url.includes('/api/profile/work-auth'))).toBe(true);
    // The reload resets the form to the saved profile; the save reads as done.
    expect(container.textContent).toContain('Saved as self-attested.');
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks the editable section and the read-only projections honestly', async () => {
    installFetchMock();
    await renderSurface();
    expect(container.textContent).toContain('Editable');
    expect(container.textContent).toContain('Self-attested');
    expect(container.textContent).toContain('Not provided');
    expect(container.textContent).toContain(
      'User-entered information is not verified until source-backed evidence is attached.',
    );
  });
});
