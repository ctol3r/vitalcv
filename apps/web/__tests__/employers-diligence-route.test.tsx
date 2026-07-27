import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EmployersPage from '@/app/employers/page';

/**
 * /employers must route a procurement reader to the per-field source register.
 *
 * Competitive study (docs/research/competitor-message-brand-study-2026-07-26.md,
 * §9.5): every employer-facing vendor in the market answers diligence with a
 * compliance badge — NCQA, SOC 2, HITRUST. Our truth contract forbids those
 * claim phrasings outright, so the substitute is an auditable artifact:
 * /trust/attribution, which discloses what each source does NOT establish.
 *
 * That register was already published and already linked from the clinician
 * homepage — but not from /employers, the one surface where a credentialing
 * or procurement reader lands with a diligence question. A published artifact
 * nobody can reach does not function as proof.
 *
 * Asserted against the ROUTE (the real page export), not the component, so
 * swapping the component out cannot silently turn this green.
 */
describe('/employers — diligence route to the source register', () => {
  it('links to the per-field source register', () => {
    const html = renderToStaticMarkup(<EmployersPage />);

    expect(html).toContain('href="/trust/attribution"');
  });

  it('keeps the register link inside the plainly-stated limits block', () => {
    const html = renderToStaticMarkup(<EmployersPage />);
    const limitsStart = html.indexOf('data-employer-limits');
    const linkIndex = html.indexOf('href="/trust/attribution"');

    expect(limitsStart).toBeGreaterThan(-1);
    expect(linkIndex).toBeGreaterThan(limitsStart);

    // The limits block is a single <div>; the link must land before it closes,
    // so the diligence route sits with the boundary rather than drifting into
    // the marketing body below it.
    const limitsBlock = html.slice(limitsStart, limitsStart + 1400);
    expect(limitsBlock).toContain('href="/trust/attribution"');
  });

  it('does not answer diligence with a compliance badge claim', () => {
    const html = renderToStaticMarkup(<EmployersPage />).toLowerCase();

    for (const banned of [
      'hipaa compliant',
      'soc2 certified',
      'soc 2 certified',
      'certified compliant',
      'ncqa certified',
    ]) {
      expect(html).not.toContain(banned);
    }
  });
});
