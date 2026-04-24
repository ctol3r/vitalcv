import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apply bundle page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('explains expired employer review snapshots without sending users to holder-only flows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 410)));

    const ApplyBundlePage = (await import('../app/apply/[bundleId]/page')).default;
    const markup = renderToStaticMarkup(await ApplyBundlePage({
      params: Promise.resolve({ bundleId: 'bundle-1' }),
    }));

    expect(markup).toContain('This employer review snapshot has expired');
    expect(markup).toContain('Employer review snapshots are valid for 24 hours.');
    expect(markup).toContain('Start a new NPI lookup');
    expect(markup).toContain('Back to passport');
    expect(markup).not.toContain('/holder');
  });

  it('renders a deterministic retry link instead of a client-only reload button when snapshot loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));

    const ApplyBundlePage = (await import('../app/apply/[bundleId]/page')).default;
    const markup = renderToStaticMarkup(await ApplyBundlePage({
      params: Promise.resolve({ bundleId: 'bundle-1' }),
    }));

    expect(markup).toContain('We could not load this employer review snapshot right now.');
    expect(markup).toContain('Try this review link again');
    expect(markup).toContain('href="/apply/bundle-1"');
    expect(markup).not.toContain('window.location.reload');
  });

  it('tells employers when a review link was revoked instead of treating it like a generic failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      error: 'Bundle share has been revoked.',
      error_code: 'share_revoked',
      revokedAt: '2026-04-22T00:00:00.000Z',
    }, 410)));

    const ApplyBundlePage = (await import('../app/apply/[bundleId]/page')).default;
    const markup = renderToStaticMarkup(await ApplyBundlePage({
      params: Promise.resolve({ bundleId: 'bundle-1' }),
    }));

    expect(markup).toContain('This employer review link was revoked');
    expect(markup).toContain('Ask the clinician or recruiting team to send a new employer review link');
    expect(markup).toContain('Start a new NPI lookup');
    expect(markup).toContain('Back to passport');
  });
});
