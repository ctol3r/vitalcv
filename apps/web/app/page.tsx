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

      {/* Entry paths — core product entry points */}
      <section className="px-4 sm:px-6 py-20 sm:py-24" style={{ background: '#080e1a' }}>
        <div className="mx-auto max-w-4xl">
          <SectionReveal>
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/50 mb-3">Get started</p>
              <h2 className="text-2xl font-bold text-white">One promise. Three paths.</h2>
            </div>
          </SectionReveal>
          <SectionReveal>
            {/* Primary — Interview Mode + Passport */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
              {[
                {
                  href: '/interview',
                  title: 'Interview Mode',
                  body: 'Share verified proof in the interview room. Employer sees what is proven, what is missing, what can proceed.',
                  cta: 'Start Interview Mode',
                  border: 'border-emerald-500/25 hover:border-emerald-500/50',
                  tag: 'For Clinicians',
                },
                {
                  href: '/passport',
                  title: 'Your Passport',
                  body: 'Your portable proof of authority. Identity, readiness, and credentials — in one object.',
                  cta: 'See your Passport',
                  border: 'border-sky-500/20 hover:border-sky-500/40',
                  tag: 'For Clinicians',
                },
              ].map(({ href, title, body, cta, border, tag }) => (
                <Link
                  key={href}
                  href={href}
                  className={`group block rounded-2xl border bg-white/3 p-5 sm:p-6 transition-all hover:bg-white/6 ${border}`}
                >
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">{tag}</p>
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-2 text-sm text-white/50 leading-relaxed">{body}</p>
                  <p className="mt-4 text-xs font-semibold text-emerald-400/60 group-hover:text-emerald-400 transition-colors">{cta} →</p>
                </Link>
              ))}
            </div>
            {/* Secondary — Clinicians / Employers */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  href: '/get-ready',
                  title: 'Get Verified',
                  body: 'Build your trust profile. Carry it everywhere you practice.',
                  cta: 'Start now',
                  border: 'border-white/8 hover:border-white/15',
                },
                {
                  href: '/employers',
                  title: 'For Employers',
                  body: 'See candidate readiness instantly. Start credentialed clinicians faster.',
                  cta: 'Learn more',
                  border: 'border-white/8 hover:border-white/15',
                },
              ].map(({ href, title, body, cta, border }) => (
                <Link
                  key={href}
                  href={href}
                  className={`group block rounded-2xl border bg-white/2 p-5 transition-all hover:bg-white/4 ${border}`}
                >
                  <p className="font-medium text-white/70 group-hover:text-white transition-colors">{title}</p>
                  <p className="mt-1.5 text-sm text-white/35 leading-relaxed">{body}</p>
                  <p className="mt-3 text-xs font-medium text-white/30 group-hover:text-white/60 transition-colors">{cta} →</p>
                </Link>
              ))}
            </div>
          </SectionReveal>
        </div>
      </section>
    </div>
  );
}
