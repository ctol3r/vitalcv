'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const TIERS = [
  {
    name: 'Starter',
    price: '$99',
    period: '/month',
    color: 'from-slate-500 to-slate-600',
    features: [
      '100 API requests / hour',
      'Credential issuance',
      'Basic verification',
      'Trust registry read',
      'Email support',
    ],
  },
  {
    name: 'Growth',
    price: '$299',
    period: '/month',
    color: 'from-emerald-500 to-teal-600',
    popular: true,
    features: [
      '1,000 API requests / hour',
      'Everything in Starter',
      'Selective disclosure (SD-JWT)',
      'OID4VCI / OID4VP flows',
      'Federation & analytics',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    color: 'from-violet-500 to-purple-600',
    features: [
      'Unlimited API requests',
      'Everything in Growth',
      'DID management',
      'Conformance suite',
      'SLA guarantee',
      'Dedicated support',
      'Custom governance',
    ],
  },
];

const DEMO_KEYS = [
  { id: '1', name: 'Production Key', tier: 'GROWTH', requestCount: 8423, lastUsedAt: '2026-03-06', revokedAt: null, createdAt: '2026-01-15' },
  { id: '2', name: 'Staging Key', tier: 'STARTER', requestCount: 234, lastUsedAt: '2026-03-05', revokedAt: null, createdAt: '2026-02-01' },
  { id: '3', name: 'Test Key', tier: 'STARTER', requestCount: 12, lastUsedAt: '2026-02-20', revokedAt: '2026-02-28', createdAt: '2026-02-10' },
];

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    STARTER: 'bg-muted text-muted-foreground',
    GROWTH: 'bg-emerald-50 text-emerald-700',
    ENTERPRISE: 'bg-violet-50 text-violet-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[tier] ?? colors.STARTER}`}>
      {tier}
    </span>
  );
}

export default function BillingPage() {
  const [currentPlan] = useState('GROWTH');
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Billing & API Access</h1>
          </div>
          <p className="text-muted-foreground ml-11">Manage your subscription tier and API keys.</p>
        </motion.div>

        {/* Current Plan Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-emerald-800 font-medium">Active plan: <strong>Growth</strong></span>
            <span className="text-xs text-emerald-600">Renews April 6, 2026</span>
          </div>
          <button className="text-xs text-emerald-700 hover:text-emerald-900 underline underline-offset-2">
            Manage billing →
          </button>
        </motion.div>

        {/* Pricing Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className={`relative rounded-2xl border bg-card p-6 shadow-sm ${
                tier.popular ? 'border-emerald-300 shadow-emerald-100 shadow-md' : 'border-border'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} mb-4`} />
              <h3 className="text-lg font-semibold text-foreground mb-1">{tier.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-foreground">{tier.price}</span>
                <span className="text-muted-foreground text-sm">{tier.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPlan === tier.name.toUpperCase()
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : tier.popular
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'border border-border hover:border-foreground/40 text-foreground'
                }`}
              >
                {currentPlan === tier.name.toUpperCase() ? 'Current Plan' : tier.name === 'Enterprise' ? 'Contact Sales' : `Upgrade to ${tier.name}`}
              </button>
            </motion.div>
          ))}
        </div>

        {/* API Keys Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">API Keys</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Keys are shown once at creation. Store them securely.</p>
            </div>
            <button
              onClick={() => setShowNewKey(!showNewKey)}
              className="flex items-center gap-2 bg-foreground hover:bg-foreground/90 text-background text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Key
            </button>
          </div>

          {showNewKey && (
            <div className="px-6 py-4 bg-muted border-b border-border flex items-center gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production)"
                className="flex-1 text-sm border border-input rounded-lg px-3 py-2 bg-card focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring"
              />
              <button className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Generate
              </button>
            </div>
          )}

          <div className="divide-y divide-border">
            {DEMO_KEYS.map(key => (
              <div key={key.id} className={`px-6 py-4 flex items-center justify-between ${key.revokedAt ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      {key.name}
                      {key.revokedAt && <span className="text-xs text-red-500 font-normal">Revoked</span>}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">vk_••••••••••••{key.id}••••</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <TierBadge tier={key.tier} />
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{key.requestCount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">requests</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Last used</p>
                    <p className="text-xs text-muted-foreground">{key.lastUsedAt}</p>
                  </div>
                  {!key.revokedAt && (
                    <button className="text-xs text-red-500 hover:text-red-700 transition-colors">
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
