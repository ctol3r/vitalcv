import { describe, expect, it } from 'vitest';

import { ctaForKind, ctaForPricingPlan } from '@/lib/commercial/pricingCta';
import {
  buildPricingFoundationPlan,
  type PricingPlanKind,
} from '@/lib/commercial/pricingFoundation';

const ALL_KINDS: ReadonlyArray<PricingPlanKind> = [
  'clinician_free',
  'clinician_plus_planned',
  'verifier_pilot',
  'verifier_team_planned',
  'enterprise_planned',
];

describe('ctaForPricingPlan — truth contract', () => {
  it('every plan returns opensPaidCheckout: false', () => {
    for (const kind of ALL_KINDS) {
      const cta = ctaForKind(kind);
      // Literal-typed false — covered by TS too, but assert at runtime
      // so a future change that flips the literal fails this test.
      expect(cta.opensPaidCheckout).toBe(false);
    }
  });

  it('clinician plans have null href (no contact CTA)', () => {
    expect(ctaForKind('clinician_free').href).toBeNull();
    expect(ctaForKind('clinician_plus_planned').href).toBeNull();
  });

  it('verifier and enterprise plans route to /contact with persona', () => {
    expect(ctaForKind('verifier_pilot').href).toBe('/contact?persona=cvo');
    expect(ctaForKind('verifier_team_planned').href).toBe('/contact?persona=cvo');
    expect(ctaForKind('enterprise_planned').href).toBe('/contact?persona=health_system');
  });

  it('builds a CTA for every plan returned by buildPricingFoundationPlan', () => {
    const plans = buildPricingFoundationPlan();
    for (const plan of plans) {
      const cta = ctaForPricingPlan(plan);
      expect(cta).toBeDefined();
      expect(cta.opensPaidCheckout).toBe(false);
    }
  });

  it('rationale on contact CTAs explicitly disclaims payment', () => {
    const verifier = ctaForKind('verifier_pilot');
    expect(verifier.rationale.toLowerCase()).toContain('no payment');
    const enterprise = ctaForKind('enterprise_planned');
    expect(enterprise.rationale.toLowerCase()).toMatch(
      /conversation|scoping|talk|fit/i,
    );
  });
});
