// DL-001 — the global floating feedback chip must never grow back into a
// footprint that can sit on top of primary actions on small viewports.
// Measured 2026-08-07 on production /onboarding (iPhone 14, 390pt): the labeled
// chip (~109×44) fully covered the "Sign in" link; elementFromPoint at the
// link's center resolved to the chip. The fix collapses the chip to an
// icon-only 44px square below md while keeping the accessible name.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    usePathname: () => '/onboarding',
  };
});

vi.mock('@/lib/pilot-ops/client', () => ({
  openPilotReporter: vi.fn(),
}));

import FeedbackButton from '../components/feedback/FeedbackButton';

function renderButton(): string {
  return renderToStaticMarkup(<FeedbackButton />);
}

describe('FeedbackButton footprint (DL-001)', () => {
  it('keeps the 44px tap floor on both axes so the icon-only square stays tappable', () => {
    const html = renderButton();
    expect(html).toContain('min-h-11');
    expect(html).toContain('min-w-11');
  });

  it('drops the visible label below md — only the md: breakpoint may reveal it', () => {
    const html = renderButton();
    const label = html.match(/<span[^>]*>Feedback<\/span>/);
    expect(label, 'label must be a span so it can collapse responsively').toBeTruthy();
    expect(label![0]).toContain('hidden');
    expect(label![0]).toContain('md:inline');
  });

  it('keeps the accessible name in aria-label so collapsing the label never renames the control', () => {
    const html = renderButton();
    expect(html).toContain('aria-label="Send feedback"');
  });

  it('stays fully suppressed on the one-handed MATCHA Discover workflow — nothing renders, not a smaller chip', async () => {
    vi.resetModules();
    vi.doMock('next/navigation', async () => {
      const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
      return { ...actual, usePathname: () => '/holder/opportunities/discover' };
    });
    vi.doMock('@/lib/pilot-ops/client', () => ({ openPilotReporter: vi.fn() }));
    const { default: Suppressed } = await import('../components/feedback/FeedbackButton');
    expect(renderToStaticMarkup(<Suppressed />)).toBe('');
  });
});
