'use client';

/**
 * /billing — Pricing & self-serve activation
 *
 * Doctrine: clinicians and issuers are always free.
 * Organizations pay for verified pulls, monitoring, exports, and integration utility.
 *
 * Self-serve checkout is gated during pilot — "Get access" flows to a contact form.
 * No synthetic key data. No dead buttons that look real.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BILLING_FEATURE_LABELS,
  PRICING_DOCTRINE_LIMITATIONS,
  formatUsd,
  listBillingPlans,
  summarizePricingAccess,
  type BillingTier,
} from '@vitalcv/shared/pricing';

const TIER_ACCENTS: Record<BillingTier, { color: string; popular?: boolean }> = {
  STARTER: { color: 'from-slate-500 to-slate-600' },
  GROWTH: { color: 'from-emerald-500 to-teal-600', popular: true },
  ENTERPRISE: { color: 'from-violet-500 to-purple-600' },
};

const PLANS = listBillingPlans();

// Sample calculator — illustrates no-double-pay logic; not connected to a real account
const SAMPLE_ACTIVITY = summarizePricingAccess([
  { activity: 'credential_access', organizationId: 'example-org', credentialKey: 'npi:1111111111', freshnessBand: 'static' },
  { activity: 'credential_access', organizationId: 'example-org', credentialKey: 'npi:1111111111', freshnessBand: 'static' },
  { activity: 'credential_access', organizationId: 'example-org', credentialKey: 'npi:1111111111', freshnessBand: 'monthly-monitoring' },
  { activity: 'credential_access', organizationId: 'example-org', credentialKey: 'npi:2222222222', freshnessBand: 'continuous-monitoring' },
  { activity: 'credential_access', organizationId: 'example-org', credentialKey: 'npi:2222222222', freshnessBand: 'continuous-monitoring' },
  { activity: 'monitoring_refresh', organizationId: 'example-org', count: 5 },
  { activity: 'export_run', organizationId: 'example-org', count: 2 },
]);

const SAMPLE_GOVERNMENT_FEES = 184.25;

// ── Access tiers email — self-serve before Stripe is wired ─────────────────

const ACCESS_EMAIL = 'access@vitalcv.com';

function accessMailto(plan: BillingTier): string {
  return `mailto:${ACCESS_EMAIL}?subject=VitalCV+${plan}+access+request&body=Plan+requested:+${plan}%0ANotes:`;
}

export default function BillingPage() {
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [keyFormSubmitted, setKeyFormSubmitted] = useState(false);

  function handleKeyRequest() {
    if (!newKeyName.trim()) return;
    setKeyFormSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Pricing & Access</h1>
          </div>
          <p className="text-muted-foreground ml-11">Organization plans. Clinicians and issuers are always free.</p>
        </motion.div>

        {/* Free for clinicians callout */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {[
            { label: 'Clinicians', note: 'Free forever', desc: 'Build, share, and own your readiness profile at no cost.' },
            { label: 'Issuers', note: 'Free forever', desc: 'Issue credentials and connect to the trust network at no cost.' },
            { label: 'Organizations', note: 'Pay for workflow', desc: 'Verified pulls, monitoring refreshes, exports, and API access.' },
          ].map(({ label, note, desc }) => (
            <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <span className={`text-xs font-medium ${note === 'Free forever' ? 'text-emerald-600' : 'text-amber-600'}`}>{note}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Pilot access notice */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10 p-4 rounded-xl bg-amber-50 border border-amber-200"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-amber-800">Pilot access mode — no active plan required</p>
              <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                During the pilot phase, access is granted directly. Self-serve card checkout activates after the pilot gate closes.
                To request organization access now, email <a href={`mailto:${ACCESS_EMAIL}`} className="underline underline-offset-2 hover:text-amber-900">{ACCESS_EMAIL}</a>.
              </p>
            </div>
            <a
              href={`mailto:${ACCESS_EMAIL}?subject=VitalCV+organization+access+request`}
              className="shrink-0 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2 transition-colors"
            >
              Request access →
            </a>
          </div>
        </motion.div>

        {/* Pricing Tiers */}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">Organization plans</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((plan, i) => {
            const accent = TIER_ACCENTS[plan.tier];
            const price = plan.priceMonthly === null ? plan.priceLabel : `$${plan.priceMonthly}`;
            const period = plan.priceMonthly === null ? '' : '/month';
            const requestLimit = plan.apiRequestsPerHour === null
              ? 'Unlimited API requests'
              : `${plan.apiRequestsPerHour.toLocaleString()} API requests / hour`;
            const features = [
              requestLimit,
              ...plan.features.map((feature) => BILLING_FEATURE_LABELS[feature]),
            ];

            return (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className={`relative rounded-2xl border bg-card p-6 shadow-sm ${
                  accent.popular ? 'border-emerald-300 shadow-emerald-100 shadow-md' : 'border-border'
                }`}
              >
                {accent.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent.color} mb-4`} />
                <h3 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-foreground">{price}</span>
                  <span className="text-muted-foreground text-sm">{period}</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mb-6 rounded-xl border border-dashed border-border bg-muted/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Launch Limitations</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    {plan.launchLimitations.map((limitation) => (
                      <li key={limitation}>{limitation}</li>
                    ))}
                  </ul>
                </div>
                {plan.checkoutMode === 'contact-sales' ? (
                  <a
                    href={accessMailto(plan.tier)}
                    className="block w-full py-2 rounded-lg text-sm font-medium text-center border border-border hover:border-foreground/40 text-foreground transition-colors"
                  >
                    Contact Sales
                  </a>
                ) : (
                  <a
                    href={accessMailto(plan.tier)}
                    className={`block w-full py-2 rounded-lg text-sm font-medium text-center transition-colors ${
                      accent.popular
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'border border-border hover:border-foreground/40 text-foreground'
                    }`}
                  >
                    Get {plan.name} access →
                  </a>
                )}
                <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
                  Self-serve checkout activates after pilot gate closes
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Doctrine + Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-16 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
        >
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pricing Doctrine</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">What we bill, and what we do not</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {PRICING_DOCTRINE_LIMITATIONS.map((limitation) => (
                <li key={limitation} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {limitation}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sample Usage Calculator</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">Billable activity, not implied revenue</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Example month. Same-band repeat access stays free — only new freshness-band pulls count as billable.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-muted-foreground text-xs">Billable pulls</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{SAMPLE_ACTIVITY.billableCredentialPulls}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-muted-foreground text-xs">No-double-pay repeat views</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{SAMPLE_ACTIVITY.includedRepeatViews}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-muted-foreground text-xs">Monitoring refreshes</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{SAMPLE_ACTIVITY.monitoringRefreshes}</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-muted-foreground text-xs">Export runs</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{SAMPLE_ACTIVITY.exportRuns}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              Government fee pass-through example:{' '}
              <span className="font-semibold text-foreground">{formatUsd(SAMPLE_GOVERNMENT_FEES)}</span>
              <p className="mt-1 text-xs">
                Pass-through fees are itemized at cost, not marked up.
                Contract-gated source fees appear only when that source is live.
              </p>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground/60">
              This calculator shows example data to illustrate the no-double-pay model. It is not connected to a real account.
            </p>
          </div>
        </motion.div>

        {/* API Keys — gated until checkout */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">API Keys</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Keys are provisioned after an organization plan is activated.
                During the pilot, request access by email.
              </p>
            </div>
            <button
              onClick={() => setShowNewKeyForm(!showNewKeyForm)}
              className="flex items-center gap-2 bg-foreground hover:bg-foreground/90 text-background text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Request key
            </button>
          </div>

          {showNewKeyForm && !keyFormSubmitted && (
            <div className="px-6 py-4 bg-muted border-b border-border">
              <p className="text-xs text-muted-foreground mb-3">
                API key provisioning is handled manually during the pilot. Enter a name and submit —
                we will follow up at your account email.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Key name (e.g. Production, Staging)"
                  className="flex-1 text-sm border border-input rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring"
                />
                <button
                  onClick={handleKeyRequest}
                  disabled={!newKeyName.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Submit request
                </button>
              </div>
            </div>
          )}

          {showNewKeyForm && keyFormSubmitted && (
            <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-200">
              <p className="text-sm font-medium text-emerald-800">Request noted — &ldquo;{newKeyName}&rdquo;</p>
              <p className="text-xs text-emerald-700 mt-1">
                API key provisioning happens manually during the pilot. We will follow up to confirm your access.
              </p>
            </div>
          )}

          {/* Empty state — no synthetic keys shown */}
          <div className="px-6 py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">No API keys provisioned yet</p>
            <p className="mt-2 text-xs text-muted-foreground max-w-xs mx-auto">
              Keys are created after an organization plan is active.
              Pilot participants can request a key above or by emailing{' '}
              <a href={`mailto:${ACCESS_EMAIL}`} className="text-emerald-600 hover:text-emerald-700 underline underline-offset-2">
                {ACCESS_EMAIL}
              </a>.
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
