import * as React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

import {
  buildPricingFoundationPlan,
  explainPricingPlanStatus,
  type PricingPlanStatus,
} from '@/lib/commercial/pricingFoundation';
import { ctaForPricingPlan } from '@/lib/commercial/pricingCta';
import { CalendarBookingEmbed } from '@/components/pricing/CalendarBookingEmbed';

/**
 * /pricing — visual design adopted from the wave1505 pricing doctrine
 * (DG-13.3): paper/ink cards, Fraunces headings, mono eyebrows, the
 * HonestyLabel treatment, and the "what this page will never claim" doctrine
 * block. The CONTENT stays real and test-true: plans come from the canonical
 * buildPricingFoundationPlan() helper, CTAs from ctaForPricingPlan() (with the
 * data-* test hooks preserved), and the "Payments are not collected" honesty
 * copy is unchanged. No mockup pricing fiction is introduced.
 *
 * Design Handoff Reference:
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1505/w1505-pricing.jsx
 */

// Bound external shared-cache staleness to 5 min (see app/page.tsx note).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Pricing Foundation',
  description: 'Pricing is a foundation preview. Payments are not collected in this build.',
};

const paper = '#f4f2ec';
const card = '#ffffff';
const ink = '#141414';
const rule = '#dddbd3';
const ruleSoft = '#e7e4dc';
const textSecondary = '#474540';
const textMuted = '#6b6860';
// 10px uppercase mono labels ('Pricing foundation', the tier eyebrows).
// Was #8a8780, which measured 3.58:1 on white and 3.20:1 on the panel —
// below the 4.5:1 AA floor. 10px bold is NOT 'large text' (that needs
// >=18.66px bold or >=24px), so the 3:1 allowance does not apply here.
// #6b6963 keeps the warm 138:135:128 hue ratio and clears every surface
// these labels actually sit on, with headroom: white 5.49, panel 4.90,
// card 5.03. Measured against the rendered page, not assumed.
const textFaint = '#6b6963';
const stateP0 = '#7a1414';
const stateChecked = '#1c5c38';
const stateStale = '#7d5a1e';
const statePreview = '#1a3e6b';
const displayFont = "var(--font-display, 'Fraunces', Georgia, serif)";
const monoFont = "var(--font-mono, 'Geist Mono', ui-monospace, monospace)";
const bodyFont = "var(--font-body, 'Geist', ui-sans-serif, system-ui, sans-serif)";

const STATUS_COLOR: Record<PricingPlanStatus, string> = {
  foundation_preview: statePreview,
  pilot_ready: stateChecked,
  planned: stateStale,
};

export default function PricingFoundationPage() {
  const plans = buildPricingFoundationPlan();

  return (
    <main
      style={{
        background: paper,
        color: ink,
        fontFamily: bodyFont,
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '64px 24px 40px' }}>
        <header style={{ maxWidth: '64ch' }}>
          <span style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: textFaint }}>
            Pricing foundation
          </span>
          <h1 style={{ fontFamily: displayFont, fontWeight: 560, fontSize: 40, lineHeight: 1.08, letterSpacing: '-0.02em', margin: '10px 0 0', maxWidth: '18ch' }}>
            Plain terms, stated — not teased.
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 15, lineHeight: 1.6, color: textSecondary }}>
            <strong style={{ fontWeight: 600, color: ink }}>Pricing is a foundation preview. Payments are not collected in this build.</strong>{' '}
            Plan cards describe launch scaffolding only and do not activate paid access.
          </p>
          <p
            style={{
              margin: '18px 0 0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: monoFont,
              fontSize: 10.5,
              letterSpacing: '0.04em',
              lineHeight: 1.6,
              color: textSecondary,
              border: `1px solid ${rule}`,
              background: card,
              borderRadius: 2,
              padding: '8px 12px',
            }}
          >
            <span aria-hidden="true" style={{ color: stateStale, fontWeight: 700 }}>◆</span>
            Any figure shown is illustrative — real pricing is set in a signed scope, never on this page.
          </p>
        </header>

        <section aria-labelledby="plans-heading" style={{ marginTop: 40 }}>
          <h2 id="plans-heading" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Foundation pricing plans
          </h2>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            }}
          >
            {plans.map((plan) => (
              <li
                key={plan.kind}
                style={{
                  background: card,
                  border: `1px solid ${plan.status === 'pilot_ready' ? '#c9c6bd' : rule}`,
                  borderRadius: 4,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontFamily: monoFont, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: textFaint }}>
                    {plan.audience}
                  </span>
                  <span
                    aria-label={`Status: ${plan.status.replace(/_/g, ' ')}`}
                    title={explainPricingPlanStatus(plan.status)}
                    style={{
                      fontFamily: monoFont,
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: STATUS_COLOR[plan.status],
                      border: `1px solid ${STATUS_COLOR[plan.status]}33`,
                      borderRadius: 2,
                      padding: '3px 7px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {plan.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontFamily: displayFont, fontWeight: 560, fontSize: 22, letterSpacing: '-0.01em', margin: 0 }}>
                    {plan.label}
                  </h3>
                  <p style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: '0.04em', color: textMuted, margin: '6px 0 0' }}>
                    {plan.priceLabel}
                  </p>
                </div>

                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: textSecondary, flex: 1 }}>
                  {plan.description}
                </p>

                <p
                  style={{
                    margin: 0,
                    paddingTop: 12,
                    borderTop: `1px solid ${ruleSoft}`,
                    fontFamily: monoFont,
                    fontSize: 10,
                    letterSpacing: '0.03em',
                    lineHeight: 1.7,
                    color: textMuted,
                  }}
                >
                  No payment is collected in this build.
                </p>

                <PlanCta planKind={plan.kind} />
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: 56, borderTop: `1px solid ${rule}`, paddingTop: 40 }}>
          <span style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: textFaint }}>
            Doctrine
          </span>
          <h2 style={{ fontFamily: displayFont, fontWeight: 560, fontSize: 24, letterSpacing: '-0.015em', margin: '8px 0 0' }}>
            What this page will never claim
          </h2>
          <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, maxWidth: '72ch', display: 'flex', flexDirection: 'column' }}>
            {[
              'No invented customer counts or borrowed authority.',
              'No borrowed-logo strips or credentials we did not earn in writing.',
              'No payback guarantees, ROI math, or lowest-price claims.',
              'No unlabeled illustrative metrics — every example figure is marked as illustrative.',
              'No countdown timers, seat scarcity, or launch-pricing pressure.',
            ].map((line) => (
              <li
                key={line}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'baseline',
                  padding: '9px 0',
                  borderBottom: `1px solid ${ruleSoft}`,
                  fontFamily: monoFont,
                  fontSize: 11.5,
                  letterSpacing: '0.03em',
                  lineHeight: 1.6,
                  color: ink,
                }}
              >
                <span aria-hidden="true" style={{ color: stateP0, flexShrink: 0 }}>—</span>
                {line}
              </li>
            ))}
          </ul>
        </section>

        <CalendarBookingEmbed />
      </div>
    </main>
  );
}

function PlanCta({
  planKind,
}: {
  planKind: ReturnType<typeof buildPricingFoundationPlan>[number]['kind'];
}) {
  // Resolve the CTA from the canonical helper so the page never
  // hardcodes a checkout/payment claim.
  const cta = ctaForPricingPlan({ kind: planKind } as Parameters<typeof ctaForPricingPlan>[0]);

  if (cta.href === null) {
    return (
      <p
        style={{ margin: 0, fontSize: 11.5, lineHeight: 1.6, color: textMuted }}
        data-testid="plan-cta"
        data-cta-kind={cta.kind}
        data-opens-paid-checkout={String(cta.opensPaidCheckout)}
      >
        {cta.label}. {cta.rationale}
      </p>
    );
  }

  return (
    <div
      data-testid="plan-cta"
      data-cta-kind={cta.kind}
      data-cta-href={cta.href}
      data-opens-paid-checkout={String(cta.opensPaidCheckout)}
    >
      <Link
        href={cta.href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 42,
          padding: '0 18px',
          fontFamily: bodyFont,
          fontSize: 13,
          fontWeight: 500,
          color: paper,
          background: ink,
          borderRadius: 2,
          textDecoration: 'none',
        }}
      >
        {cta.label} →
      </Link>
      <p style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.6, color: textMuted }}>{cta.rationale}</p>
    </div>
  );
}
