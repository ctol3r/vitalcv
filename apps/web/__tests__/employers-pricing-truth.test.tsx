import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import EmployersPage from '@/app/employers/page';
import { buildPricingFoundationPlan } from '@/lib/commercial/pricingFoundation';
import { NAV_GROUPS } from '@/components/layout/navDestinations';

/**
 * The employer pricing statement is TRUE, or it is not there (founder ruling,
 * 2026-08-07). The audit's 30-second test asked "what do I pay for?" and
 * /employers answered with silence. The block that now answers it makes three
 * claims, each anchored:
 *
 *   1. "no payment is collected on this site" — anchored to
 *      collectsPayment:false across every plan in pricingFoundation. This
 *      suite FAILS THE MOMENT a plan starts collecting payment while the
 *      sentence still renders: flip billing on, and this copy must change in
 *      the same PR.
 *   2. "commercial terms are set in a signed scope" — /pricing's own
 *      published doctrine sentence.
 *   3. The outcomes direction — the category strategy's model
 *      (vitalcv-category-strategy.md: "Employers should pay for outcomes and
 *      workflow"), stated without figures.
 *
 * And one ratchet: no dollar figure may appear on /employers, ever — real
 * pricing is set in a signed scope, never on a page.
 */

const markup = renderToStaticMarkup(<EmployersPage />);
const text = markup
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&rsquo;|&#x27;|&apos;/g, "'")
  .replace(/\s+/g, ' ');

describe('/employers — what this costs', () => {
  it('answers the cost question on the page', () => {
    expect(markup).toContain('data-employer-pricing');
    expect(text).toContain('Free for clinicians, always');
    expect(text).toContain('no payment is collected on this site');
    expect(text).toContain('the pilot costs nothing');
    expect(text).toContain('commercial terms are set in a signed scope');
  });

  it('states the outcomes direction without figures', () => {
    expect(text).toContain('charges for outcomes');
    expect(text).toContain('not seats or lookups');
  });

  it('links the plain-terms page', () => {
    expect(markup).toContain('href="/pricing"');
  });

  it('renders no dollar figure — real pricing lives in a signed scope', () => {
    expect(text).not.toMatch(/\$\s?\d/);
  });

  it('"no payment is collected" stays anchored to the billing foundation', () => {
    // If any plan flips collectsPayment, this fails before the copy lies.
    for (const plan of buildPricingFoundationPlan()) {
      expect(
        plan.collectsPayment,
        `${plan.label} collects payment while /employers still says none is collected — update the copy in the same PR`,
      ).toBe(false);
    }
  });
});

describe('/pricing is findable', () => {
  it('has a nav entry in the Employers group', () => {
    const employers = NAV_GROUPS.find((g) => g.id === 'employers');
    expect(employers?.links.map((l) => l.href)).toContain('/pricing');
  });
});
