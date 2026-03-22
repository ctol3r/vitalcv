'use client';

import { HowItWorksSection } from '@/components/marketing/HomeSections';
import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

// ── Wave C: Trust Strip ───────────────────────────────────────

function TrustStrip() {
  const SOURCES = [
    { name: 'State Medical Boards',  sub: '50 states'       },
    { name: 'NPDB',                  sub: 'National database' },
    { name: 'DEA',                   sub: 'Drug Enforcement' },
    { name: 'OIG / LEIE',            sub: 'Exclusion check'  },
    { name: 'ABMS',                  sub: 'Board certs'      },
    { name: 'NPPES',                 sub: '10M+ providers'   },
  ];

  return (
    <div className="border-y border-white/6 bg-white/2 py-5 px-4 sm:px-6 overflow-hidden">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30 shrink-0">
            Verified against
          </p>
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap sm:flex-nowrap">
            {SOURCES.map((s) => (
              <div key={s.name} className="flex items-center gap-2 shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/50 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white/60 whitespace-nowrap">{s.name}</p>
                  <p className="text-[9px] text-white/25 whitespace-nowrap">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Interview Mode teaser ─────────────────────────────────────

function InterviewModeTeaser() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ background: '#070d18' }}>
      <div className="mx-auto max-w-4xl">
        <SectionReveal>
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/4 overflow-hidden">
            <div className="px-6 sm:px-8 py-8 sm:py-10">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">

                {/* Left */}
                <div className="flex-1 max-w-lg">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1 mb-4">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Interview Mode</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-3">
                    Use this in your<br className="hidden sm:block" /> next interview.
                  </h2>
                  <p className="text-sm text-white/50 leading-relaxed mb-5">
                    Walk in with a signed proof card. The employer sees exactly what is verified,
                    what is pending, and what can proceed — before the conversation starts.
                  </p>
                  <Link
                    href="/interview"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 text-sm font-bold text-white transition-all active:scale-[0.98] shadow-[0_0_24px_rgba(16,185,129,0.2)] w-full sm:w-auto"
                  >
                    Try Interview Mode
                  </Link>
                </div>

                {/* Right — mock proof card */}
                <div className="sm:w-64 shrink-0">
                  <div className="rounded-xl border border-white/10 bg-white/4 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/30">Proof Card</p>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="px-4 py-3 space-y-2.5">
                      {[
                        { label: 'License', status: 'VERIFIED' },
                        { label: 'DEA',     status: 'VERIFIED' },
                        { label: 'Board',   status: 'VERIFIED' },
                        { label: 'NPDB',    status: 'CLEAR'    },
                      ].map(r => (
                        <div key={r.label} className="flex items-center justify-between">
                          <span className="text-xs text-white/50">{r.label}</span>
                          <span className="text-[10px] font-bold text-emerald-400">{r.status}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between bg-emerald-500/6">
                      <span className="text-[10px] text-emerald-400/70 font-semibold">Readiness: 84</span>
                      <span className="text-[10px] text-white/25">SHA-256 signed</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/20 text-center mt-2">Shared via secure link · 24h TTL</p>
                </div>

              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ background: '#080e1a' }} className="min-h-screen">

      {/* HERO — headline immediately visible, solid CTA, NPI preview + auth prompt */}
      <HeroWithAuthPrompt />

      {/* Trust strip — verified against real sources */}
      <TrustStrip />

      {/* How it works — compressed 3-step */}
      <HowItWorksSection />

      {/* WAVE F — Interview Mode teaser: strongest feature made visible */}
      <InterviewModeTeaser />

      {/* Entry paths */}
      <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ background: '#080e1a' }}>
        <div className="mx-auto max-w-4xl">
          <SectionReveal>
            <div className="text-center mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white">One trust layer. Three paths in.</h2>
            </div>
          </SectionReveal>
          <SectionReveal>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
              {[
                {
                  href: '/interview',
                  title: 'Interview Mode',
                  body: 'Share proof in the room. Employer sees what\'s verified, what\'s missing, what can proceed.',
                  cta: 'Start Interview Mode',
                  border: 'border-emerald-500/25 hover:border-emerald-500/50',
                  tag: 'For Clinicians',
                },
                {
                  href: '/passport',
                  title: 'Your Passport',
                  body: 'Identity, readiness, and credentials — one portable object.',
                  cta: 'View your Passport',
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  href: '/get-ready',
                  title: 'Get Verified',
                  // Wave G: copy compressed ~40%
                  body: 'Build your trust profile. Carry it everywhere.',
                  cta: 'Start now',
                  border: 'border-white/8 hover:border-white/15',
                },
                {
                  href: '/employers',
                  title: 'For Employers',
                  // Wave G: copy compressed
                  body: 'See readiness instantly. Start credentialed clinicians faster.',
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
