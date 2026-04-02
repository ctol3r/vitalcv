'use client';

import React from 'react';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import {
  HOMEPAGE_PUBLIC_TRUTH_SOURCES,
  HOMEPAGE_PREVIEW_COPY,
  resolveHomepagePublicTruthSource,
} from '@/lib/trust/homepage-public-truth';
import Link from 'next/link';

const HOMEPAGE_SOURCE_VIEWS = HOMEPAGE_PUBLIC_TRUTH_SOURCES.map(resolveHomepagePublicTruthSource);

export function TrustStrip() {
  return (
    <div className="border-y border-white/6 bg-white/2 py-5 px-4 sm:px-6 overflow-hidden">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30 shrink-0">
            Current source coverage
          </p>
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap sm:flex-nowrap">
            {HOMEPAGE_SOURCE_VIEWS.map((source) => (
              <div key={source.id} className="flex items-center gap-2 shrink-0">
                <div>
                  <p className="text-xs font-semibold text-white/60 whitespace-nowrap">{source.name}</p>
                  <p className="text-[9px] text-white/25 whitespace-nowrap">{source.sublabel}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] whitespace-nowrap ${source.trustStatusBadgeClassName}`}>
                  {source.trustStatusLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[10px] text-white/20">
          Homepage preview starts with NPPES and OIG. Other lanes stay marked as access required, pending, or preview-only until a connected source actually runs.
        </p>
      </div>
    </div>
  );
}

export function InterviewModeTeaser() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20" style={{ background: '#070d18' }}>
      <div className="mx-auto max-w-4xl">
        <SectionReveal>
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/4 overflow-hidden">
            <div className="px-6 sm:px-8 py-8 sm:py-10">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                <div className="flex-1 max-w-lg">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1 mb-4">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Passport Preview</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-3">
                    Preview your<br className="hidden sm:block" /> passport proof.
                  </h2>
                  <p className="text-sm text-white/50 leading-relaxed mb-5">
                    After your NPI lookup, VitalCV turns that readiness snapshot into a passport view for employer conversations. Sections stay explicitly labeled until backed by a real source run.
                  </p>
                  <Link
                    href="/passport"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 text-sm font-bold text-white transition-all active:scale-[0.98] shadow-[0_0_24px_rgba(16,185,129,0.2)] w-full sm:w-auto"
                  >
                    Preview Passport Proof
                  </Link>
                </div>

                <div className="sm:w-64 shrink-0">
                  <div className="rounded-xl border border-white/10 bg-white/4 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/30">Proof Card</p>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/20 bg-white/5 rounded px-1.5 py-0.5">
                        {HOMEPAGE_PREVIEW_COPY.badge}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-2.5">
                      {HOMEPAGE_SOURCE_VIEWS.map((source) => (
                        <div key={source.id} className="flex items-center justify-between">
                          <span className="text-xs text-white/50">{source.proofLabel}</span>
                          <span className="text-[10px] font-semibold text-white/45">{source.detailLabel}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between bg-white/2">
                      <span className="text-[10px] text-white/30">{HOMEPAGE_PREVIEW_COPY.footerLead}</span>
                      <span className="text-[10px] text-white/20">{HOMEPAGE_PREVIEW_COPY.footerNote}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/20 text-center mt-2">{HOMEPAGE_PREVIEW_COPY.panelNote}</p>
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
