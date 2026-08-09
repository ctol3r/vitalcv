// @vitest-environment jsdom
/**
 * Clinician profile — state-licensure honesty contract, and the editing-flow
 * doctrine flip.
 *
 * VitalCV lists state license numbers on the clinician profile, but a number
 * is self-reported until a state-board SOURCE confirms it. Those lanes are
 * agreement-blocked today, so this surface must never render a license STATUS
 * and never present a self-reported number as verified.
 *
 * WHAT CHANGED, AND WHY THIS FILE WAS REWRITTEN RATHER THAN DELETED:
 * this suite used to assert `not.toContain('<input')` plus the banner string
 * "This profile is read-only for now." Those were correct guards for a real
 * defect — /clinician/profile had shipped 34 readOnly inputs with live focus
 * rings and no Save control, so typing silently did nothing. The fix at the
 * time was to render honest read-only rows.
 *
 * That is no longer the shape of the page: ProfileSurface is wired in and the
 * fields genuinely save. Kept verbatim, those two assertions would have been a
 * guard enforcing retired doctrine — failing the build for shipping the very
 * editing flow the banner promised. What they were really protecting is
 * preserved below and made stronger: a control that LOOKS typeable must
 * actually persist, so this asserts the Save affordance exists and the inputs
 * are not inert, rather than asserting no inputs exist at all.
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileSurface from '../app/clinician/profile/ProfileSurface';
import { isPassportData } from '../lib/trust/passport-contract';
import { buildPassport } from './fixtures/passport';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NPI = '1234567890';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * A contract-valid passport carrying two NPPES-reported license numbers.
 * Built from the shared fixture on purpose: ProfileSurface only renders the
 * licensure card when isPassportData() accepts the payload, so a partial
 * literal here would fail validation and silently test the outage branch.
 */
function passportPayload() {
  return {
    ...buildPassport(),
    nppesLicensure: [
      { state: 'CA', licenseNumber: 'A123456' },
      { state: 'NY', licenseNumber: 'B987654' },
    ],
  };
}

function installFetchMock() {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/me/workspaces')) {
      return jsonResponse({
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
      });
    }
    if (url.includes('/api/profile/completeness')) {
      return jsonResponse({
        userId: 'u1',
        score: 55,
        dimensions: {
          npiVerified: true,
          resumeUploaded: false,
          linksAdded: true,
          workAuthProvided: true,
          credentialsImported: false,
        },
      });
    }
    if (url.includes('/acceptance-history')) return jsonResponse({ ok: true, summary: null, history: [] });
    if (url.includes('/api/passport/')) return jsonResponse(passportPayload());
    throw new Error(`Unmocked fetch: ${url}`);
  });
  vi.stubGlobal('fetch', mock);
}

async function flushEffects() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('clinician profile — state licensure honesty', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    installFetchMock();
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container);
      root.render(<ProfileSurface />);
    });
    await flushEffects();
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('the fixture actually satisfies the passport contract', () => {
    // Pins the trap this suite fell into: the fixture is written with an
    // `as PassportData` cast, which silences the compiler but not
    // isPassportData(). While it was invalid, ProfileSurface took its
    // "passport unavailable" branch and every licensure assertion below
    // failed as if the CARD were broken. If this goes red, fix the fixture —
    // the licensure failures underneath it are a symptom, not the cause.
    expect(isPassportData(passportPayload())).toBe(true);
  });

  it('lists NPPES-reported license numbers', () => {
    const card = container.querySelector('[data-testid="nppes-licensure-card"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain('State licensure on file');
    expect(card!.textContent).toContain('A123456');
    expect(card!.textContent).toContain('B987654');
  });

  it('never renders a license status, and never calls a number board-verified', () => {
    const card = container.querySelector('[data-testid="nppes-licensure-card"]') as HTMLElement;
    expect(card.textContent).toContain('Self-reported to NPPES');
    expect(card.textContent).toContain('not board-verified');
    // The status vocabulary owned by the Verification section must not appear
    // here — a stale self-reported number must never read as "active".
    expect(card.textContent).not.toMatch(/\bactive\b/i);
    expect(card.textContent).not.toMatch(/\bexpired\b/i);
    expect(card.textContent).not.toMatch(/\bsource-confirmed\b/i);
  });

  it('never renders a bare "Verified" label anywhere on the surface', () => {
    // The truth contract's single hardest rule: VERIFIED provenance renders as
    // "Source-confirmed", never the unqualified word.
    expect(container.innerHTML).not.toMatch(/>\s*Verified\s*</);
  });

  it('presents completeness as filled-ness, never as verification', () => {
    expect(container.textContent).toContain('it is not verification');
    // The fabricated "Filled 0/36 (0%)" counter had a hardcoded-zero numerator.
    expect(container.textContent).not.toContain('Profile completion summary');
    expect(container.textContent).not.toMatch(/0\s*\/\s*36/);
  });

  it('the editing flow is real: typeable controls exist and are backed by a Save control', () => {
    // The retired assertion was "no inputs exist". The defect it guarded was
    // inputs that LOOK typeable and drop keystrokes. The durable form of that
    // guard is: if there are inputs, there is a save path for them.
    const inputs = container.querySelectorAll('input:not([type="hidden"]), select, textarea');
    expect(inputs.length).toBeGreaterThan(0);
    for (const el of Array.from(inputs)) {
      expect(el.hasAttribute('readonly')).toBe(false);
    }
    const submits = container.querySelectorAll('button[type="submit"]');
    expect(submits.length).toBeGreaterThan(0);
  });

  it('the read-only shell banner is gone, because its claim is no longer true', () => {
    expect(container.textContent).not.toContain('This profile is read-only for now.');
    expect(container.textContent).not.toContain('the editing flow has not shipped yet');
    expect(container.textContent).not.toContain('This is the foundation shell.');
  });

  it('names what it still cannot capture instead of dropping those sections silently', () => {
    const gap = container.querySelector('[data-testid="profile-coverage-gap"]');
    expect(gap).not.toBeNull();
    for (const missing of ['Residency', 'fellowship', 'training programs', 'publications']) {
      expect(gap!.textContent).toContain(missing);
    }
  });

  it('keeps user-entered fields labelled as self-attested, never as verified', () => {
    expect(container.textContent).toContain('Self-attested');
    expect(container.textContent).toContain(
      'User-entered information is not verified until source-backed evidence is attached.',
    );
  });
});
