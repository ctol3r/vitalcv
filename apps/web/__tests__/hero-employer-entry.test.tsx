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

import { renderHomepageHtml } from './helpers/render-homepage';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnel';

function render() {
  return renderHomepageHtml();
}

describe('hero employer entry (SHD-2.2)', () => {
  it('renders a distinct employer entry routed to /employers', () => {
    const html = render();
    expect(html).toContain('data-home-employer-cta');
    expect(html).toContain('href="/employers"');
    // The label was "For employers — start review from evidence" on the retired
    // vertical page. The film's closing scene is CTAs-only by mandate (guardrail
    // 5, "almost no copy"), so the entry now reads "For employers". What this
    // test protects is the CONTRACT — a distinct, labelled, real employer route
    // that is not the primary action — not the retired sentence.
    expect(html).toMatch(/For employers/i);
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
    // The idle hero does not imply a public evidence graph or source state.
    expect(html).not.toContain('data-home-evidence-field');
    expect(html).not.toContain('data-field-signal');
    // No fabricated readiness verdict in the hero.
    expect(html).not.toMatch(/\bverified\b/i);
  });
});
