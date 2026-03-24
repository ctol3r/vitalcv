'use client';

import { HowItWorksSection } from '@/components/marketing/HomeSections';
import { HeroWithAuthPrompt } from '@/components/hero/HeroWithAuthPrompt';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import {
  getTrustStatusBadgeClassName,
  getTrustStatusLabel,
  type TrustUiStatus,
} from '@/lib/trust/status-language';
import Link from 'next/link';

// ── Wave C: Trust Strip ───────────────────────────────────────

function TrustStrip() {
  const SOURCES = [
    { name: 'NPPES', sub: 'NPI identity', status: 'checked' as TrustUiStatus },
    { name: 'OIG / LEIE', sub: 'Exclusion check', status: 'checked' as TrustUiStatus },
    { name: 'CMS PECOS', sub: 'Quarterly enrollment data', status: 'checked' as TrustUiStatus },
    { name: 'State Boards', sub: 'Connector or institutional access', status: 'access_required' as TrustUiStatus },
  ];

  return (
    <div className="border-y border-white/6 bg-white/2 py-5 px-4 sm:px-6 overflow-hidden">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30 shrink-0">
            Current source coverage
          </p>
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap sm:flex-nowrap">
            {SOURCES.map((s) => (
              <div key={s.name} className="flex items-center gap-2 shrink-0">
                <div>
                  <p className="text-xs font-semibold text-white/60 whitespace-nowrap">{s.name}</p>
                  <p className="text-[9px] text-white/25 whitespace-nowrap">{s.sub}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap ${getTrustStatusBadgeClassName(s.status)}`}>
                  {getTrustStatusLabel(s.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[10px] text-white/20">
          Homepage preview runs NPPES and OIG first. Other sources appear only when connected and actually checked.
        </p>
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
                    Preview your<br className="hidden sm:block" /> interview packet.
                  </h2>
                  <p className="text-sm text-white/50 leading-relaxed mb-5">
                    After your NPI lookup, you can turn a readiness record into a concise packet
                    for employer conversations.
                  </p>
                  <Link
                    href="/interview"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 text-sm font-bold text-white transition-all active:scale-[0.98] shadow-[0_0_24px_rgba(16,185,129,0.2)] w-full sm:w-auto"
                  >
                    Open Interview Preview
                  </Link>
                </div>

                {/* Right — example proof card (labeled as such) */}
                <div className="sm:w-64 shrink-0">
                  <div className="rounded-xl border border-white/10 bg-white/4 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/30">Proof Card</p>
                      {/* M3: labeled "Example" — not real pilot data */}
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/20 bg-white/5 rounded px-1.5 py-0.5">Example</span>
                    </div>
                    <div className="px-4 py-3 space-y-2.5">
                      {[
                        { label: 'Identity',  status: 'Live via NPPES' },
                        { label: 'Sanctions', status: 'Live via OIG' },
                        { label: 'Enrollment', status: 'Quarterly PECOS' },
                        { label: 'Licensure', status: 'Access required' },
                      ].map(r => (
                        <div key={r.label} className="flex items-center justify-between">
                          <span className="text-xs text-white/50">{r.label}</span>
                          <span className="text-[10px] font-semibold text-white/45">{r.status}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between bg-white/2">
                      <span className="text-[10px] text-white/30">Example layout</span>
                      <span className="text-[10px] text-white/20">not a live proof card</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/20 text-center mt-2">Preview only · live shares depend on a real review flow</p>
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

      {/* Interview mode stays below the explainer as a later-step preview */}
      <InterviewModeTeaser />

    </div>
  );
}
