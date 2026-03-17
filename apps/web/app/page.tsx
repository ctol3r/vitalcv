'use client';

import AcceptanceNetwork from '@/components/marketing/AcceptanceNetwork';
import { LiveTrustConsole } from '@/components/hero/LiveTrustConsole';
import { HowItWorksSection, PlatformVisionSection, ProblemSection, TractionSection } from '@/components/marketing/HomeSections';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import PrequalifyTrigger from '@/components/prequalify/PrequalifyTrigger';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ background: '#080e1a' }} className="min-h-screen">
      {/* Hero */}
      <LiveTrustConsole />

      {/* Narrative arc: Problem → Solution → Platform → Proof */}
      <ProblemSection />
      <HowItWorksSection />
      <section className="px-6 pt-6 pb-2" style={{ background: '#080e1a' }}>
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70 mb-3">
            Verify Once - Trust Everywhere
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            One verified trust surface for clinicians and employers
          </h2>
        </div>
      </section>
      <AcceptanceNetwork />
      <PlatformVisionSection />
      <TractionSection />

      {/* Entry paths */}
      <section className="px-6 py-24" style={{ background: '#080e1a' }}>
        <div className="mx-auto max-w-4xl">
          <SectionReveal>
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/50 mb-3">Get started</p>
              <h2 className="text-2xl font-bold text-white">For Clinicians / For Employers</h2>
            </div>
          </SectionReveal>
          <SectionReveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  href: '/holder/home',
                  title: 'For Clinicians',
                  body: 'Verify once, carry your credential trust state everywhere, and get faster starts.',
                  cta: 'Open clinician workspace',
                  border: 'border-emerald-500/20 hover:border-emerald-500/40',
                },
                {
                  href: '/verifier/home',
                  title: 'For Employers',
                  body: 'Validate primary-source evidence faster and onboard with less credentialing drag.',
                  cta: 'Open employer workspace',
                  border: 'border-blue-500/20 hover:border-blue-500/40',
                },
              ].map(({ href, title, body, cta, border }) => (
                <Link
                  key={href}
                  href={href}
                  className={`group block rounded-2xl border bg-white/3 p-6 transition-all hover:bg-white/6 ${border}`}
                >
                  <p className="mt-4 font-semibold text-white">{title}</p>
                  <p className="mt-2 text-sm text-white/55 leading-relaxed">{body}</p>
                  <p className="mt-4 text-xs font-semibold text-emerald-400/70 group-hover:text-emerald-400 transition-colors">{cta} →</p>
                </Link>
              ))}
            </div>
          </SectionReveal>
          <SectionReveal>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <PrequalifyTrigger label="Get Prequalified" />
              <Link
                href="/explore"
                className="inline-flex items-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-white/40 hover:text-white"
              >
                Explore Opportunities
              </Link>
            </div>
          </SectionReveal>
        </div>
      </section>

    </div>
  );
}
