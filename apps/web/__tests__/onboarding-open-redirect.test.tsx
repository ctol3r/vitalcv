/**
 * onboarding-open-redirect.test.tsx
 *
 * Regression guard for the reflected open-redirect on /onboarding. The page
 * reads `?returnTo=` and renders it as an <a href>. It must reject
 * protocol-relative (`//host`) and backslash (`/\host`) values — which
 * `.startsWith('/')` alone would let through — and fall back to /passport.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import OnboardingPage from '@/app/onboarding/page';

async function render(returnTo?: string): Promise<string> {
  const element = await OnboardingPage({ searchParams: Promise.resolve({ returnTo }) });
  return renderToStaticMarkup(element);
}

describe('/onboarding — open-redirect hardening', () => {
  it('rejects protocol-relative //host and falls back to /passport', async () => {
    const html = await render('//evil.example');
    expect(html).not.toContain('//evil.example');
    expect(html).toContain('href="/passport"');
  });

  it('rejects backslash /\\host tricks', async () => {
    const html = await render('/\\evil.example');
    expect(html).not.toContain('evil.example');
    expect(html).toContain('href="/passport"');
  });

  it('allows a genuine internal path', async () => {
    const html = await render('/holder/readiness');
    expect(html).toContain('href="/holder/readiness"');
  });

  it('defaults to /passport when returnTo is absent', async () => {
    const html = await render(undefined);
    expect(html).toContain('href="/passport"');
  });
});
