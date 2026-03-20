'use client';

import { HowItWorksSection } from '@/components/marketing/HomeSections';
import { LiveTrustConsole } from '@/components/hero/LiveTrustConsole';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ background: '#080e1a' }} className="min-h-screen">
      {/* Hero — single message, single CTA */}
      <LiveTrustConsole />

      {/* How it works — 3-step proof */}
      <HowItWorksSection />

      {/* Entry paths — Clinician / Employer */}
      <section className="px-6 py-24" style={{ background: '#080e1a' }}>
        <div className="mx-auto max-w-4xl">
          <SectionReveal>
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/50 mb-3">Get started</p>
              <h2 className="text-2xl font-bold text-white">Choose your path</h2>
            </div>
          </SectionReveal>
          <SectionReveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  href: '/onboarding',
                  title: 'For Clinicians',
                  body: 'Get verified in hours. Carry your credential trust state everywhere you practice.',
                  cta: 'Get verified now',
                  border: 'border-emerald-500/20 hover:border-emerald-500/40',
                },
                {
                  href: '/employers',
                  title: 'For Employers',
                  body: 'See candidate readiness instantly. Hire credentialed clinicians faster than anyone.',
                  cta: 'Start hiring',
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
        </div>
      </section>
    </div>
  );
}
