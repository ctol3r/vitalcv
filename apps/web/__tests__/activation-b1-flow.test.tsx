// @vitest-environment jsdom

/**
 * Driving the real activation component through a whole activation — Wave 1076 B1.
 *
 * The other B1 suites test the pieces: the planner's rules, the proxies'
 * refusals, the markup a component emits for a fixed input. This one mounts
 * `ActivateProfileFlow` and clicks through it against a fake server that
 * implements the same contract the real one does, because several of the
 * requirements are about the SEQUENCE and cannot be seen in any single render:
 *
 *   - a correction is a draft write and does not save or activate;
 *   - an incomplete save is refused, and the refusal names what is missing;
 *   - activation appears only when the SERVER says it happened;
 *   - a reload mid-flow comes back to the same place, with edits intact;
 *   - a clinician arriving with no NPI at all is still recovered.
 *
 * The fake server is deliberately strict — it refuses an incomplete save with
 * 422 and stamps `activatedAt` only when all three conditions hold, exactly as
 * the real service does. A permissive double would let the component pass while
 * doing something the backend would never allow.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ActivateProfileFlow } from '@/components/activation/ActivateProfileFlow';
import type { ProfileView } from '@/lib/activation/profileView';

const NPI = '1003000126';

const SPECS = [
  { key: 'fullName', label: 'Name', supports: 'Identifies the profile.', origin: 'public_source_correctable', required: true, freeText: true },
  { key: 'credential', label: 'Credential', supports: 'Employer filter.', origin: 'public_source_correctable', required: true, freeText: true },
  { key: 'specialty', label: 'Specialty', supports: 'Role matching.', origin: 'public_source_correctable', required: true, freeText: true },
  { key: 'practiceState', label: 'Practice location', supports: 'Role matching.', origin: 'public_source_correctable', required: true, freeText: false },
  { key: 'licensedStates', label: 'States you are licensed in', supports: 'Cross-state matching.', origin: 'public_source_correctable', required: false, freeText: false },
  { key: 'preferredStates', label: 'Where you want to work', supports: 'Role relevance.', origin: 'clinician_only', required: false, freeText: false },
  { key: 'workArrangement', label: 'Work arrangement', supports: 'Role relevance.', origin: 'clinician_only', required: false, freeText: false },
  { key: 'contactEmail', label: 'Contact email', supports: 'A reply path.', origin: 'clinician_only', required: true, freeText: true },
] as ProfileView['fieldSpecs'];

const REQUIRED = ['fullName', 'credential', 'specialty', 'practiceState', 'contactEmail'];

/**
 * A fake clinician-profile service with the real one's rules.
 *
 * State lives here between requests, so a "reload" in a test is a genuine
 * remount against a server that remembers — which is the only way to show that
 * recovery works rather than that state happened to survive in React.
 */
class FakeServer {
  /** What NPPES returned. Never overwritten by a correction. */
  snapshot: Record<string, unknown> = { fullName: 'JEAN ABBOTT', specialty: 'Emergency Medicine', practiceState: 'CO' };
  clinician: Record<string, unknown> = {};
  reviewedAt: string | null = null;
  sharingConfirmedAt: string | null = null;
  savedAt: string | null = null;
  activatedAt: string | null = null;
  claims = 0;

  private view(): ProfileView {
    const fields: ProfileView['fields'] = [];
    for (const spec of SPECS) {
      if (Object.prototype.hasOwnProperty.call(this.clinician, spec.key)) {
        fields.push({ key: spec.key, value: this.clinician[spec.key], truthClass: 'clinician_provided' });
      } else if (this.snapshot[spec.key] !== undefined) {
        fields.push({ key: spec.key, value: this.snapshot[spec.key], truthClass: 'public_source', source: 'NPPES' });
      }
    }
    const present = new Set(fields.map((f) => f.key));
    const missingRequired = REQUIRED.filter((k) => !present.has(k));

    // Activation is the SERVER's conclusion, stamped once.
    if (this.reviewedAt && this.sharingConfirmedAt && this.savedAt && !this.activatedAt) {
      this.activatedAt = '2026-08-06T00:00:00.000Z';
    }
    const activated = this.activatedAt !== null;

    return {
      npi: NPI,
      state: activated ? 'profile_saved' : 'resolved',
      disclosure: activated
        ? 'Your profile is saved and reusable. Details you added are your own statements, not independently checked.'
        : 'Information found for this NPI. This does not confirm it is yours.',
      fields,
      missingRequired,
      reviewedAt: this.reviewedAt,
      sharingConfirmedAt: this.sharingConfirmedAt,
      savedAt: this.savedAt,
      activatedAt: this.activatedAt,
      permissions: {
        reusableProfile: activated,
        opportunityDiscovery: activated,
        selfAttestedSharing: activated,
        // Never unlocked by a save.
        privateCredentialHoldings: false,
      },
      fieldSpecs: SPECS,
    };
  }

  handle(url: string, init?: RequestInit): { status: number; body: unknown } {
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};

    if (url.endsWith('/claim')) {
      this.claims += 1;
      return { status: 200, body: this.view() };
    }
    if (url.includes('?include=all')) {
      return { status: 200, body: { profiles: this.claims > 0 ? [this.view()] : [] } };
    }
    if (url.endsWith('/review')) {
      this.reviewedAt ??= '2026-08-06T00:00:00.000Z';
      return { status: 200, body: this.view() };
    }
    if (url.endsWith('/sharing')) {
      this.sharingConfirmedAt ??= '2026-08-06T00:00:00.000Z';
      return { status: 200, body: this.view() };
    }
    if (url.endsWith('/save')) {
      const missing = this.view().missingRequired;
      if (missing.length > 0) {
        return {
          status: 422,
          body: { error: { code: 'PROFILE_INCOMPLETE', message: `Add ${missing.join(', ')} before saving a reusable profile.` } },
        };
      }
      this.savedAt ??= '2026-08-06T00:00:00.000Z';
      return { status: 200, body: this.view() };
    }
    if (method === 'PATCH') {
      const corrections = (body.corrections ?? {}) as Record<string, unknown>;
      const email = corrections.contactEmail;
      if (typeof email === 'string' && !email.includes('@')) {
        return { status: 400, body: { error: { code: 'FIELD_INVALID', message: 'Enter a valid email address.', field: 'contactEmail' } } };
      }
      // Normalizes, like the real validators — the surface must show what was
      // STORED, not what was typed.
      if (typeof email === 'string') corrections.contactEmail = email.toLowerCase();
      Object.assign(this.clinician, corrections);
      return { status: 200, body: this.view() };
    }
    return { status: 200, body: this.view() };
  }
}

let server: FakeServer;
let container: HTMLDivElement;
let root: Root;

/** Flush the component's pending promises and re-render. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount(initialNpi: string | null) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<ActivateProfileFlow initialNpi={initialNpi} />);
  });
  await settle();
}

function unmount() {
  act(() => root.unmount());
  container.remove();
}

const html = () => container.innerHTML;
const byAction = (name: string) => container.querySelector<HTMLButtonElement>(`[data-action="${name}"]`);
const input = (key: string) => container.querySelector<HTMLInputElement>(`#f-${key}`)!;

async function click(el: HTMLElement | null) {
  if (!el) throw new Error('control not present');
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle();
}

/** Type into a controlled React input. */
async function type(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  server = new FakeServer();
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const { status, body } = server.handle(String(url), init);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response);
  });
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('a clinician goes from a claimed NPI to a reusable profile', () => {
  it('walks the whole sequence and ends with the planner', async () => {
    await mount(NPI);

    // ── what VitalCV found, labelled by origin ───────────────────────────
    expect(html()).toContain('Found in NPPES');
    expect(input('fullName').value).toBe('JEAN ABBOTT');
    // …and what is missing, explained rather than reddened.
    expect(html()).toContain('data-missing-field="contactEmail"');
    expect(html()).toContain('employer can respond when you choose to share');

    // ── an incomplete save is refused, and says what is missing ──────────
    await click(byAction('save-profile'));
    expect(html()).toContain('data-activation-notice');
    expect(html()).toContain('before saving a reusable profile');
    expect(server.savedAt).toBeNull();
    expect(server.activatedAt).toBeNull();

    // ── corrections are a DRAFT write ────────────────────────────────────
    await type(input('contactEmail'), 'Jean@Example.com');
    await type(input('credential'), 'NP');
    await click(container.querySelector('button')); // "Keep these changes"
    await settle();

    expect(server.clinician.contactEmail).toBe('jean@example.com');
    // The input now shows what the server stored, not what was typed.
    expect(input('contactEmail').value).toBe('jean@example.com');
    expect(server.savedAt).toBeNull();
    expect(server.activatedAt).toBeNull();
    // An edited public value is re-attributed to the clinician.
    await type(input('specialty'), 'Urgent Care');
    await click(container.querySelector('button'));
    expect(html()).toContain('Added or changed by you');

    // ── review and sharing, still not activation ─────────────────────────
    await click(byAction('confirm-review'));
    expect(server.reviewedAt).not.toBeNull();
    expect(server.activatedAt).toBeNull();
    expect(html()).not.toContain('data-readiness-planner');

    await click(byAction('confirm-sharing'));
    expect(server.sharingConfirmedAt).not.toBeNull();
    expect(server.activatedAt).toBeNull();
    // Reviewed, sharing-confirmed and complete — and still no planner,
    // because the clinician has not asked to keep it.
    expect(html()).not.toContain('data-readiness-planner');

    // ── the explicit save is what activates ──────────────────────────────
    await click(byAction('save-profile'));
    expect(server.savedAt).not.toBeNull();
    expect(server.activatedAt).not.toBeNull();

    expect(html()).toContain('data-activation-stage="active"');
    expect(html()).toContain('data-readiness-planner');
    expect(html()).toContain('Your profile is ready to reuse');
    // The lock is stated, not left to be noticed.
    expect(html()).toContain('stay locked');

    unmount();
  });

  it('offers no control that activates without saving', async () => {
    await mount(NPI);
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent?.toLowerCase() ?? '');
    expect(labels.some((l) => l.includes('activate'))).toBe(false);
    unmount();
  });

  it('places a field-level refusal on the field that caused it', async () => {
    await mount(NPI);

    await type(input('contactEmail'), 'not-an-email');
    await click(container.querySelector('button'));

    expect(input('contactEmail').getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('#e-contactEmail')?.textContent).toContain('valid email');
    // A typo is not an outage, so it does not raise the page-level notice.
    expect(html()).not.toContain('data-activation-notice');

    unmount();
  });
});

describe('nothing has to be entered twice', () => {
  it('comes back to the same place after a reload, with corrections intact', async () => {
    await mount(NPI);
    await type(input('contactEmail'), 'jean@example.com');
    await click(container.querySelector('button'));
    await click(byAction('confirm-review'));
    unmount();

    // A genuine remount — the component starts from nothing and recovers.
    await mount(NPI);

    expect(input('contactEmail').value).toBe('jean@example.com');
    expect(byAction('confirm-review')?.textContent).toContain('Reviewed');
    unmount();
  });

  it('recovers from the browser when the return URL lost the NPI', async () => {
    await mount(NPI);
    unmount();

    // Signed in and returned with a bare URL — localStorage still has it.
    await mount(null);
    expect(html()).toContain('data-activation-stage="review"');
    expect(input('fullName').value).toBe('JEAN ABBOTT');
    unmount();
  });

  it('recovers from the server on a machine that has never seen this flow', async () => {
    // Claimed on some other device.
    server.claims = 1;
    server.clinician = { contactEmail: 'jean@example.com' };
    window.localStorage.clear();

    await mount(null);

    expect(html()).toContain('data-activation-stage="review"');
    expect(input('contactEmail').value).toBe('jean@example.com');
    unmount();
  });

  it('asks for an NPI only when there is genuinely nothing to recover', async () => {
    await mount(null);
    expect(html()).toContain('Start with your NPI');
    expect(html()).not.toContain('data-activation-stage="review"');
    unmount();
  });

  it('claims once per visit, not once per render', async () => {
    await mount(NPI);
    await click(byAction('confirm-review'));
    await click(byAction('confirm-sharing'));
    expect(server.claims).toBe(1);
    unmount();
  });

  it('repeating a confirmation does not undo or re-stamp it', async () => {
    await mount(NPI);
    await click(byAction('confirm-review'));
    const first = server.reviewedAt;
    // The button is disabled once confirmed; clicking it cannot re-stamp.
    await click(byAction('confirm-review'));
    expect(server.reviewedAt).toBe(first);
    unmount();
  });
});

describe('the sharing disclosures survive', () => {
  it('states who chooses, that nothing is automatic, and who decides', async () => {
    await mount(NPI);
    const markup = html();
    expect(markup).toContain('You choose what gets shared.');
    expect(markup).toContain('Review it, and add what is missing.');
    expect(markup).toContain('Institution review decides the outcome.');
    expect(markup).toContain('Nothing is sent to an employer automatically');
    unmount();
  });

  it('explains that saving is not verification of anything', async () => {
    await mount(NPI);
    expect(html()).toContain(
      'Saving does not mean ownership, credentials, employment, or readiness were',
    );
    unmount();
  });
});
