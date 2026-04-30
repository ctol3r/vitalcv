import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildPricingFoundationPlan,
  explainPricingPlanStatus,
  type PricingPlanStatus,
} from '@/lib/commercial/pricingFoundation';

export const metadata: Metadata = {
  title: 'Pricing Foundation | VitalCV',
  description: 'Pricing is a foundation preview. Payments are not collected in this build.',
};

const STATUS_CLASS: Record<PricingPlanStatus, string> = {
  foundation_preview: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  pilot_ready: 'border-sky-500/40 bg-sky-500/10 text-sky-700',
  planned: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
};

export default function PricingFoundationPage() {
  const plans = buildPricingFoundationPlan();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Pricing foundation
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Commercial plan preview
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Pricing is a foundation preview. Payments are not collected in this build.`}</strong>{' '}
          Plan cards describe launch scaffolding only and do not activate paid access.
        </p>
      </header>

      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="sr-only">
          Foundation pricing plans
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <li
              key={plan.kind}
              className="rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold">{plan.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.audience}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CLASS[plan.status]}`}
                  aria-label={`Status: ${plan.status}`}
                  title={explainPricingPlanStatus(plan.status)}
                >
                  {plan.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="mt-4 text-lg font-semibold">{plan.priceLabel}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Payments collected: {String(plan.collectsPayment)}. Checkout live:{' '}
                {String(plan.checkoutIntegrationLive)}. Subscription active:{' '}
                {String(plan.subscriptionActive)}.
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
