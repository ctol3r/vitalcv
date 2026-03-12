'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Metrics {
  credentialsIssued: number;
  activeVerifiers: number;
  networkNodes: number;
  federatedNetworks: number;
}

const DEMO_METRICS: Metrics = {
  credentialsIssued: 12847,
  activeVerifiers: 284,
  networkNodes: 1923,
  federatedNetworks: 2,
};

function AnimatedCounter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const steps = 60;
    const step = end / steps;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, end);
      setCount(Math.floor(current));
      if (current >= end) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [end]);
  return <>{count.toLocaleString()}{suffix}</>;
}

const VALUE_PROPS = [
  {
    icon: '⚡',
    title: 'Speed: 24 hours vs. 30 days',
    desc: 'Traditional credentialing takes 30–90 days. VitalCV delivers cryptographically-verified results in under 24 hours with automated primary source verification.',
    stat: '98%', statLabel: 'faster than manual',
  },
  {
    icon: '🔒',
    title: 'Compliance-grade infrastructure',
    desc: 'Built to HIPAA, HITRUST, and ONC/TEFCA requirements. SD-JWT selective disclosure, W3C VC standards, and OID4VCI/VP interoperability built in.',
    stat: '100%', statLabel: 'HIPAA compliant',
  },
  {
    icon: '🌐',
    title: 'Scale: Network effects',
    desc: 'Every issuer and verifier on VitalCV increases the value for every other participant. 250k+ credentialed clinicians and growing.',
    stat: '250k+', statLabel: 'credentialed clinicians',
  },
];

const MARKET_STATS = [
  { value: '$4.2B', label: 'US healthcare credentialing market' },
  { value: '1.1M', label: 'Active physicians in the US' },
  { value: '6.8M', label: 'Total licensed healthcare workers' },
  { value: '37%', label: 'Annual credentialing spend growth' },
];

export default function InvestorsPage() {
  const [metrics, setMetrics] = useState<Metrics>(DEMO_METRICS);
  const [formData, setFormData] = useState({ name: '', fund: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch('/api/analytics/overview')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMetrics(d); })
      .catch(() => { /* use demo */ });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-6 py-24 text-center">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-6">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-300 text-xs font-medium">Trust Infrastructure · Series Seed</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Healthcare credentialing is a<br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">$4.2B problem.</span>
            <br />VitalCV solves it.
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            Cryptographic trust infrastructure that makes primary source verification instant, auditable, and interoperable — replacing a 30-day manual process with 24-hour automated verification.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#contact" className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
              Schedule a Call
            </a>
            <a href="/analytics" className="border border-white/20 hover:border-white/40 text-white font-medium px-8 py-3 rounded-xl transition-colors">
              Live Metrics →
            </a>
          </div>
        </motion.div>
      </section>

      {/* Live Metrics */}
      <section className="bg-slate-50 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-sm font-semibold text-slate-400 uppercase tracking-widest mb-8">Live Platform Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Credentials Issued', value: metrics.credentialsIssued, suffix: '+' },
              { label: 'Active Verifiers', value: metrics.activeVerifiers, suffix: '' },
              { label: 'Network Nodes', value: metrics.networkNodes, suffix: '+' },
              { label: 'Federated Networks', value: metrics.federatedNetworks, suffix: '' },
            ].map(m => (
              <div key={m.label} className="text-center bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <p className="text-3xl font-bold text-slate-900 tabular-nums">
                  <AnimatedCounter end={m.value} suffix={m.suffix} />
                </p>
                <p className="text-xs text-slate-400 mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Market Opportunity */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">The Market Opportunity</h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            Every clinician in America needs to be credentialed. The process is broken. We fix it.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {MARKET_STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-4xl font-bold text-emerald-600 mb-2">{s.value}</p>
                <p className="text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="bg-slate-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">Why VitalCV Wins</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {VALUE_PROPS.map((vp, i) => (
              <motion.div
                key={vp.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"
              >
                <div className="text-3xl mb-4">{vp.icon}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{vp.title}</h3>
                <p className="text-sm text-slate-500 mb-4">{vp.desc}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-emerald-600">{vp.stat}</span>
                  <span className="text-xs text-slate-400">{vp.statLabel}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="py-20 px-6 bg-white border-t border-slate-100">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400 mb-8">The Builder</p>
          <blockquote className="text-xl md:text-2xl font-medium text-slate-800 leading-relaxed mb-8">
            &ldquo;I watched a brilliant physician wait 11 weeks to start a locums contract — 
            not because of anything she did wrong, but because the system had no memory. 
            Her credentials existed. The verification had been done. 
            Nobody had a way to prove it. VitalCV fixes that permanently.&rdquo;
          </blockquote>
          <div className="flex items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg">
              C
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-900">Christopher Toler</p>
              <p className="text-sm text-slate-500">Founder &amp; CEO, VitalCV</p>
            </div>
          </div>
        </div>
      </section>

      {/* Roadmap strip */}
      <section className="py-16 px-6 bg-slate-900">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-slate-400 mb-10">What&apos;s Next</p>
          <div className="grid sm:grid-cols-4 gap-6 text-center">
            {[
              { phase: 'Now', label: 'MVP Live', desc: 'Two-sided marketplace, live NPI verification, cryptographic credentials', done: true },
              { phase: 'Q2 2026', label: 'Pilot Hospitals', desc: '3–5 health systems onboarded, measurable time-to-start reduction', done: false },
              { phase: 'Q3 2026', label: 'Mobile App', desc: 'React Native clinician passport — credentials on your phone at every desk', done: false },
              { phase: 'Q4 2026', label: 'Series A', desc: '$8M to scale sales, compliance, and federation network', done: false },
            ].map((item) => (
              <div key={item.phase} className="rounded-xl border border-slate-700 bg-slate-800/50 p-5">
                <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${item.done ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {item.phase} {item.done && '✓'}
                </div>
                <p className="text-white font-semibold mb-2">{item.label}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section id="contact" className="py-20 px-6">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-2">Let&apos;s Talk</h2>
          <p className="text-slate-400 text-center mb-8">
            I&apos;m Christopher, the founder. If you&apos;re interested in what we&apos;re building — 
            whether as an investor, pilot partner, or advisor — I respond personally.
          </p>
          {submitted ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">Message Received</h3>
              <p className="text-slate-400">We&apos;ll reach out within 48 hours.</p>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); setSubmitted(true); }} className="space-y-4">
              {[
                { key: 'name', label: 'Your Name', type: 'text', placeholder: 'Jane Smith' },
                { key: 'fund', label: 'Fund / Organization', type: 'text', placeholder: 'Acme Ventures' },
                { key: 'email', label: 'Email', type: 'email', placeholder: 'jane@acmeventures.com' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    required
                    value={formData[f.key as keyof typeof formData]}
                    onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Message</label>
                <textarea
                  rows={4}
                  placeholder="Tell us about your fund and investment thesis..."
                  value={formData.message}
                  onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none"
                />
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-colors">
                Send Message
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
