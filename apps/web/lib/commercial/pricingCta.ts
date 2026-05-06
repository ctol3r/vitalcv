import type {
  PricingFoundationPlan,
  PricingPlanKind,
} from './pricingFoundation';

/**
 * Maps a pricing plan to a buyer-facing call-to-action.
 *
 * Truth contract:
 *   - This module never claims a plan collects payment, has a live
 *     subscription, or has live checkout. Those literals stay
 *     `false` on PricingFoundationPlan and are surfaced verbatim in
 *     the page.
 *   - The CTA's only effect is to route the buyer into a real
 *     conversation via /contact?persona=<derived>. No ledger write,
 *     no Stripe checkout, no payment capture.
 */

export type PricingPlanCtaKind =
  | 'contact_pilot'
  | 'contact_team'
  | 'contact_enterprise'
  | 'self_serve_no_action';

export interface PricingPlanCta {
  kind: PricingPlanCtaKind;
  /** Visible button label. */
  label: string;
  /**
   * Internal href. Always a relative URL into /contact when the CTA
   * is conversational; null when no CTA action is appropriate.
   */
  href: string | null;
  /** Whether the CTA opens a paid checkout. Always false in this
   *  PR — kept here as a typed literal so a future PR that wires
   *  Stripe must update both the literal and the truth tests. */
  opensPaidCheckout: false;
  /**
   * Short rationale shown beneath the CTA button. Defensive copy
   * that reinforces the truth contract.
   */
  rationale: string;
}

/**
 * Pure helper. No fetch, no env access, no DOM. Safe to import in
 * any environment.
 */
export function ctaForPricingPlan(plan: PricingFoundationPlan): PricingPlanCta {
  return ctaForKind(plan.kind);
}

export function ctaForKind(kind: PricingPlanKind): PricingPlanCta {
  switch (kind) {
    case 'clinician_free':
      return {
        kind: 'self_serve_no_action',
        label: 'No action needed',
        href: null,
        opensPaidCheckout: false,
        rationale:
          'The clinician baseline is free to view. No checkout flow exists for this plan.',
      };
    case 'clinician_plus_planned':
      return {
        kind: 'self_serve_no_action',
        label: 'Roadmap only',
        href: null,
        opensPaidCheckout: false,
        rationale:
          'Clinician Plus is a future plan shape. No checkout or pilot conversation is wired for it today.',
      };
    case 'verifier_pilot':
      return {
        kind: 'contact_pilot',
        label: 'Start a pilot conversation',
        href: '/contact?persona=cvo',
        opensPaidCheckout: false,
        rationale:
          'Routes you to the pilot intake form. We typically reply within one business day. No payment is collected from this button.',
      };
    case 'verifier_team_planned':
      return {
        kind: 'contact_team',
        label: 'Talk to us about a team plan',
        href: '/contact?persona=cvo',
        opensPaidCheckout: false,
        rationale:
          'Verifier Team pricing is planned, not live. The CTA opens the same pilot intake form so we can scope a fit.',
      };
    case 'enterprise_planned':
      return {
        kind: 'contact_enterprise',
        label: 'Talk to us about enterprise',
        href: '/contact?persona=health_system',
        opensPaidCheckout: false,
        rationale:
          'Enterprise scoping is conversation-led. The CTA opens the pilot intake form so we can route to the right contact.',
      };
  }
}
