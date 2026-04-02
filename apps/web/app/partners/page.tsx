'use client';

import { useState } from 'react';

const TIERS = [
  {
    name: 'Technology Partner',
    desc: 'Integrate VitalCV trust infrastructure into your healthcare platform.',
    benefits: [
      'Full API access',
      'Technical onboarding and integration support',
      'Co-marketing opportunities',
      'Partner listing',
    ],
  },
  {
    name: 'Integration Partner',
    desc: 'Build certified integrations between VitalCV and EHR, HRIS, or credentialing platforms.',
    benefits: [
      'Certified integration status',
      'Co-sell and referral program',
      'Joint solution briefs',
      'Dedicated partnership manager',
    ],
  },
  {
    name: 'Channel Partner',
    desc: 'Resell or refer VitalCV to healthcare organizations and staffing firms.',
    benefits: [
      'Reseller margin',
      'Sales enablement toolkit',
      'Deal registration portal',
      'Co-branded materials',
    ],
  },
];

export default function PartnersPage() {
  const [formData, setFormData] = useState({
    name: '', org: '', email: '', tier: '', message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="border-b border-border bg-card px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Build with VitalCV
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Integrate source-backed credential verification into your healthcare platform.
          </p>
          <a
            href="#contact"
            className="mt-8 inline-block rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
          >
            Become a Partner
          </a>
        </div>
      </section>

      {/* Partner Tiers */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-semibold text-center text-foreground mb-2">Partnership Tiers</h2>
          <p className="text-sm text-muted-foreground text-center mb-12">Choose the model that fits your business.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="rounded-lg border border-border bg-card p-6"
              >
                <h3 className="font-semibold text-foreground mb-2">{tier.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{tier.desc}</p>
                <ul className="space-y-2 mb-6">
                  {tier.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setFormData((p) => ({ ...p, tier: tier.name }))}
                  className="w-full rounded-md border border-border py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Apply as {tier.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="border-t border-border py-20 px-6">
        <div className="max-w-xl mx-auto">
          <h2 className="text-xl font-semibold text-center text-foreground mb-2">Partner Inquiry</h2>
          <p className="text-sm text-muted-foreground text-center mb-8">
            Tell us about your organization. We will respond within 2 business days.
          </p>
          {submitted ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">Inquiry Received</h3>
              <p className="text-sm text-muted-foreground">
                Our partnerships team will reach out within 2 business days.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Your Name</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Organization</label>
                <input
                  type="text"
                  placeholder="Acme Health Systems"
                  required
                  value={formData.org}
                  onChange={(e) => setFormData((p) => ({ ...p, org: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Work Email</label>
                <input
                  type="email"
                  placeholder="jane@acmehealth.com"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Partnership Interest</label>
                <select
                  value={formData.tier}
                  onChange={(e) => setFormData((p) => ({ ...p, tier: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                >
                  <option value="">Select a tier…</option>
                  {TIERS.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Message</label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your integration use case…"
                  value={formData.message}
                  onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
              >
                Submit Inquiry
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
