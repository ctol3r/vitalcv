import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// SHD-2.2: the hero carries a quiet employer entry beside the clinician NPI
// action. NPI stays primary; the employer link is real, distinguishable, and
// routed to the existing /employers destination (no speculative onboarding).

vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

import HomePageClient from '@/app/HomePageClient';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnel';

function render() {
  return renderToStaticMarkup(<HomePageClient />);
}

describe('hero employer entry (SHD-2.2)', () => {
  it('renders a distinct employer entry routed to /employers', () => {
    const html = render();
    expect(html).toContain('data-home-employer-cta');
    expect(html).toContain('href="/employers"');
    expect(html).toMatch(/For employers[^<]*start review from evidence/i);
  });

  it('keeps the clinician NPI action primary and separate', () => {
    const html = render();
    // primary NPI CTA still present and distinct from the employer entry
    expect(html).toContain('data-home-primary-cta');
    expect(html).toContain('data-home-hero');
    // employer entry is not the primary CTA element
    const employerIdx = html.indexOf('data-home-employer-cta');
    const primaryIdx = html.indexOf('data-home-primary-cta');
    expect(primaryIdx).toBeGreaterThanOrEqual(0);
    expect(employerIdx).toBeGreaterThan(primaryIdx); // NPI action comes first
  });

  it('defines a dedicated funnel event so the two sides are distinguishable', () => {
    expect(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED).toBe('employer_entry_clicked');
  });

  it('makes no clinician-specific claim in the idle hero scene', () => {
    const html = render();
    // The field's SSR signal is idle before any interaction.
    expect(html).toContain('data-field-signal="idle"');
    // No fabricated readiness verdict in the hero.
    expect(html).not.toMatch(/\bverified\b/i);
  });
});
