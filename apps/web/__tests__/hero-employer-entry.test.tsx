import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// SHD-2.2 as amended by Direction D.1: the hero's secondary doorway is public
// opportunities. The distinct employer entry remains later in the same page,
// after the clinician NPI action, and routes to the existing /employers
// destination (no speculative onboarding).

vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

import { renderHomepageHtml } from './helpers/render-homepage';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnel';

function render() {
  return renderHomepageHtml();
}

describe('homepage employer entry (SHD-2.2 / Direction D.1)', () => {
  it('renders a distinct employer entry routed to /employers', () => {
    const html = render();
    expect(html).toContain('data-home-employer-cta');
    expect(html).toContain('href="/employers"');

    // This used to assert the literal phrase "For employers" while its own
    // comment said it protected "the CONTRACT ... not the retired sentence".
    // Those disagreed, and the phrase won: rewording the door to something
    // better turned it red for no defect. Assert the properties that make an
    // employer entry real instead — the marker sits on an anchor pointing at
    // /employers, and that anchor carries meaningful visible text rather than
    // an icon or an empty box.
    const anchor = html.match(/<a\b[^>]*data-home-employer-cta[^>]*>([\s\S]*?)<\/a>/i);
    expect(anchor, 'employer marker must sit on an <a>, not a bare element').not.toBeNull();
    expect(anchor?.[0]).toContain('href="/employers"');

    const label = (anchor?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
    expect(label.length, `employer entry needs a readable label, got "${label}"`)
      .toBeGreaterThanOrEqual(10);
    // It must read as an invitation to the buyer, not a bare nav word.
    expect(label).toMatch(/employer|hiring|evidence|review/i);
  });

  it('keeps the clinician NPI action primary and separate', () => {
    const html = render();
    // Primary NPI CTA still appears first and remains distinct from the
    // deliberately subordinate employer entry.
    expect(html).toContain('data-home-primary-cta');
    expect(html).toContain('data-home-hero');
    // employer entry is not the primary CTA element
    const employerIdx = html.indexOf('data-home-employer-cta');
    const primaryIdx = html.indexOf('data-home-primary-cta');
    expect(primaryIdx).toBeGreaterThanOrEqual(0);
    expect(employerIdx).toBeGreaterThan(primaryIdx);
  });

  it('defines a dedicated funnel event so the two sides are distinguishable', () => {
    expect(FUNNEL_EVENTS.EMPLOYER_ENTRY_CLICKED).toBe('employer_entry_clicked');
  });

  it('makes no clinician-specific claim in the idle hero scene', () => {
    const html = render();
    // The idle hero does not imply a public evidence graph or source state.
    expect(html).not.toContain('data-home-evidence-field');
    expect(html).not.toContain('data-field-signal');
    // No fabricated readiness verdict in the hero.
    expect(html).not.toMatch(/\bverified\b/i);
  });
});
