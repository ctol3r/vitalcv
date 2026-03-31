'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const TIERS = [
  {
    name: 'Technology Partner',
    icon: '⚙️',
    color: 'from-blue-500 to-indigo-600',
    desc: 'Integrate VitalCV trust infrastructure into your healthcare platform.',
    benefits: [
      'Full API access (Growth tier)',
      'Technical onboarding & integration support',
      'Co-marketing opportunities',
      'Partner badge & listing',
      'Priority bug reports',
    ],
    cta: 'Apply as Technology Partner',
  },
  {
    name: 'Integration Partner',
    icon: '🔗',
    color: 'from-emerald-500 to-teal-600',
    desc: 'Build certified integrations between VitalCV and your EHR, HRIS, or credentialing platform.',
    benefits: [
      'Certified integration status',
      'Co-sell & referral program',
      'Joint solution briefs',
      'Dedicated partnership manager',
      'Revenue sharing on referrals',
    ],
    cta: 'Apply as Integration Partner',
  },
  {
    name: 'Channel Partner',
    icon: '📡',
    color: 'from-violet-500 to-purple-600',
    desc: 'Resell or refer VitalCV to healthcare organizations and staffing firms.',
    benefits: [
      'Reseller margin (up to 30%)',
      'Sales enablement toolkit',
      'Deal registration portal',
      'Training & certification',
      'Co-branded materials',
    ],
    cta: 'Apply as Channel Partner',
  },
];

const WHY_PARTNER = [
  { icon: '🚀', title: 'Fast Integration', desc: 'REST API + OID4VCI/VP standards. Most integrations live in under 2 weeks.' },
  { icon: '💰', title: 'Revenue Share', desc: 'Earn up to 30% on every deal you close. No cap.' },
  { icon: '🏥', title: 'Healthcare Focus', desc: 'Built for the compliance requirements of healthcare. HIPAA-native.' },
  { icon: '🌐', title: 'Interoperability', desc: 'W3C VCs, SD-JWT, OID4VCI/VP — works with any standards-compliant system.' },
];

export default function PartnersPage() {
  const [formData, setFormData] = useState({
    name: '', org: '', email: '', tier: '', message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-vt-surface-ops-base">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[var(--vt-ops-from)] to-[var(--vt-ops-via)] px-6 py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Build the future of<br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              healthcare trust
            </span>{' '}with us.
          </h1>
          <p className="text-vt-neutral-300 text-lg mb-8 max-w-xl mx-auto">
            Join the VitalCV partner ecosystem and help healthcare organizations verify, trust, and hire faster.
          </p>
          <a href="#contact" className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors inline-block">
            Become a Partner →
          </a>
        </motion.div>
      </section>

      {/* Partner Tiers */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-3">Partnership Tiers</h2>
          <p className="text-vt-neutral-400 text-center mb-12">Choose the partnership that fits your business model.</p>
          <div className="grid md:grid-cols-3 gap-8">
            {TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl ring-1 ring-white/10 bg-white/5 p-6 hover:bg-white/[0.08] transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-xl mb-4`}>
                  {tier.icon}
                </div>
                <h3 className="font-semibold text-white mb-2">{tier.name}</h3>
                <p className="text-sm text-vt-neutral-400 mb-4">{tier.desc}</p>
                <ul className="space-y-2 mb-6">
                  {tier.benefits.map(b => (
                    <li key={b} className="flex items-start gap-2 text-sm text-vt-neutral-300">
                      <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setFormData(p => ({ ...p, tier: tier.name }))}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r ${tier.color} text-white hover:opacity-90 transition-opacity`}
                >
                  {tier.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Partner */}
      <section className="bg-vt-surface-ops-raised py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-10">Why Partner with VitalCV?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {WHY_PARTNER.map(w => (
              <div key={w.title} className="text-center">
                <div className="text-3xl mb-3">{w.icon}</div>
                <h3 className="font-semibold text-white text-sm mb-1">{w.title}</h3>
                <p className="text-xs text-vt-neutral-400">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner inquiry prompt */}
      <section className="py-12 px-6 border-y border-white/10">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm text-vt-neutral-400">
            Interested in partnering? <a href="#contact" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">Contact us</a>.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 px-6">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-2">Partner Inquiry</h2>
          <p className="text-vt-neutral-400 text-center mb-8">Tell us about your organization and we&apos;ll be in touch within 2 business days.</p>
          {submitted ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="text-xl font-semibold text-white mb-2">Inquiry Received</h3>
              <p className="text-vt-neutral-400">Our partnerships team will reach out within 2 business days.</p>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); setSubmitted(true); }} className="space-y-4">
              {[
                { key: 'name', label: 'Your Name', type: 'text', placeholder: 'John Smith' },
                { key: 'org', label: 'Organization', type: 'text', placeholder: 'Acme Health Systems' },
                { key: 'email', label: 'Work Email', type: 'email', placeholder: 'john@acmehealth.com' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sm font-medium text-vt-neutral-300 mb-1 block">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    required
                    value={formData[f.key as keyof typeof formData]}
                    onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white placeholder:text-vt-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-vt-neutral-300 mb-1 block">Partnership Interest</label>
                <select
                  value={formData.tier}
                  onChange={e => setFormData(p => ({ ...p, tier: e.target.value }))}
                  className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="" className="bg-vt-surface-ops-raised">Select a tier...</option>
                  {TIERS.map(t => <option key={t.name} value={t.name} className="bg-vt-surface-ops-raised">{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-vt-neutral-300 mb-1 block">Message</label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your integration use case..."
                  value={formData.message}
                  onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                  className="w-full rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-sm text-white placeholder:text-vt-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white" size="lg">
                Submit Inquiry
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
