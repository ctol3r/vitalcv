import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// Banned string fragments split so this test file itself doesn't
// trigger a naive banned-string grep on its own source.
const BANNED = [
  ['GDPR', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['certified', 'compliant'].join(' '),
];

// DPA-as-contract phrases — the page must NOT present itself as a binding agreement.
// These are split to avoid tripping the grep; the join() restores them at runtime.
const DPA_BINDING_PHRASES = [
  ['binding', 'agreement signed'].join(' '),
  ['this', 'agreement is binding'].join(' '),
  ['constitutes', 'a contract'].join(' '),
  ['legally', 'binding DPA'].join(' '),
];

async function renderDpa(): Promise<string> {
  const mod = await import('../app/legal/dpa/page');
  const Page = mod.default;
  return renderToStaticMarkup(<Page />);
}

async function renderCookies(): Promise<string> {
  const mod = await import('../app/legal/cookies/page');
  const Page = mod.default;
  return renderToStaticMarkup(<Page />);
}

// Case 1 — DPA page renders without error and contains template disclaimer
describe('DPA page', () => {
  it('renders and contains the template disclaimer copy', async () => {
    const html = await renderDpa();
    expect(html).toContain('template for review by your legal team');
    expect(html).toContain('not a binding agreement');
    expect(html).toContain('Data Processing Agreement');
  });
});

// Case 2 — Cookies page renders and lists required cookies
describe('Cookies page', () => {
  it('renders and lists Clerk, PostHog, and Vercel cookies', async () => {
    const html = await renderCookies();
    expect(html).toContain('Clerk');
    expect(html).toContain('PostHog');
    expect(html).toContain('Vercel');
    expect(html).toContain('Cookie Policy');
  });
});

// Case 3 — Neither page contains banned compliance strings
describe('legal pages — no banned compliance strings', () => {
  it('DPA page contains no banned compliance strings', async () => {
    const html = (await renderDpa()).toLowerCase();
    for (const phrase of BANNED) {
      expect(html).not.toContain(phrase.toLowerCase());
    }
  });

  it('Cookies page contains no banned compliance strings', async () => {
    const html = (await renderCookies()).toLowerCase();
    for (const phrase of BANNED) {
      expect(html).not.toContain(phrase.toLowerCase());
    }
  });
});

// Case 4 — DPA page does not present itself as a binding agreement
describe('DPA page — no DPA-as-contract claim', () => {
  it('does not claim to be a binding agreement', async () => {
    const html = (await renderDpa()).toLowerCase();
    for (const phrase of DPA_BINDING_PHRASES) {
      expect(html).not.toContain(phrase.toLowerCase());
    }
  });
});
