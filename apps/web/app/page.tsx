'use client';

import { LiveTrustConsole } from '@/components/hero/LiveTrustConsole';
import { HowItWorksSection, PlatformVisionSection, ProblemSection, TractionSection } from '@/components/marketing/HomeSections';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ background: '#080e1a' }} className="min-h-screen">
      {/* Hero */}
      <LiveTrustConsole />

      {/* Narrative arc: Problem → Solution → Platform → Proof */}
      <ProblemSection />
      <HowItWorksSection />
      <PlatformVisionSection />
      <TractionSection />

      {/* Entry paths */}
      <section className="px-6 py-24" style={{ background: '#080e1a' }}>
        <div className="mx-auto max-w-4xl">
          <SectionReveal>
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/50 mb-3">Get started</p>
              <h2 className="text-2xl font-bold text-white">Your path into VitalCV</h2>
            </div>
          </SectionReveal>
          <SectionReveal>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  href: '/holder/home',
                  emoji: '🩺',
                  title: "I'm a Clinician",
                  body: "Verify your credentials, build your trust passport, and get matched with roles.",
                  cta: 'Get started',
                  border: 'border-emerald-500/20 hover:border-emerald-500/40',
                },
                {
                  href: '/verifier/home',
                  emoji: '🏥',
                  title: "I'm an Employer",
                  body: "Find prequalified clinicians, publish opportunities, and hire with confidence.",
                  cta: 'Employer dashboard',
                  border: 'border-blue-500/20 hover:border-blue-500/40',
                },
                {
                  href: '/demo',
                  emoji: '👀',
                  title: "See a Demo",
                  body: "Watch VitalCV verify a clinician in real time — no account needed.",
                  cta: 'Try the demo',
                  border: 'border-white/10 hover:border-white/25',
                },
              ].map(({ href, emoji, title, body, cta, border }) => (
                <Link
                  key={href}
                  href={href}
                  className={`group block rounded-2xl border bg-white/3 p-6 transition-all hover:bg-white/6 ${border}`}
                >
                  <span className="text-3xl" aria-hidden="true">{emoji}</span>
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
