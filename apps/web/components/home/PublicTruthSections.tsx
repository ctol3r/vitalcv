'use client';

import React from 'react';
import { SectionReveal } from '@/components/motion/ScrollMotion';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  HOMEPAGE_PUBLIC_TRUTH_SOURCES,
  HOMEPAGE_PREVIEW_COPY,
  resolveHomepagePublicTruthSource,
} from '@/lib/trust/homepage-public-truth';
import Link from 'next/link';

const HOMEPAGE_SOURCE_VIEWS = HOMEPAGE_PUBLIC_TRUTH_SOURCES.map(resolveHomepagePublicTruthSource);

export function TrustStrip() {
  return (
    <div className="overflow-hidden border-y border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] py-5 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--vt-text-muted)]">
            Current source coverage
          </p>
          <TooltipProvider delayDuration={120}>
            <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap sm:flex-nowrap">
              {HOMEPAGE_SOURCE_VIEWS.map((source) => (
                <div key={source.id} className="flex items-center gap-2 shrink-0">
                  <div>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <p className="text-xs font-semibold text-foreground">{source.name}</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] leading-none text-[var(--vt-text-muted)] transition-colors hover:text-[var(--vt-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vt-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vt-surface)]"
                            aria-label={`About ${source.name}`}
                          >
                            <span aria-hidden="true">ⓘ</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-[280px] rounded-xl border border-[var(--vt-border-subtle)] bg-[var(--vt-text-primary)] px-[14px] py-[10px] text-left text-[12px] leading-relaxed text-[var(--vt-bg)] shadow-[var(--vt-shadow-card)]"
                        >
                          <p>{source.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="whitespace-nowrap text-[10px] text-[var(--vt-text-muted)]">{source.sublabel}</p>
                  </div>
                  <TrustStatusBadge status={source.trustStatus} label={source.trustStatusLabel} size="sm" />
                </div>
              ))}
            </div>
          </TooltipProvider>
        </div>
        <p className="mt-3 text-[11px] text-[var(--vt-text-muted)]">
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
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight mb-3">
                    Preview your<br className="hidden sm:block" /> passport proof.
                  </h2>
                  <p className="text-sm text-foreground/70 leading-relaxed mb-5">
                    After your NPI lookup, VitalCV turns that readiness snapshot into a passport view for employer conversations. Sections stay explicitly labeled until backed by a real source run.
                  </p>
                  <Link
                    href="/passport"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 text-sm font-bold text-foreground transition-all active:scale-[0.98] shadow-[0_0_24px_rgba(16,185,129,0.2)] w-full sm:w-auto"
                  >
                    Preview Passport Proof
                  </Link>
                </div>

                <div className="sm:w-64 shrink-0">
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">Proof Card</p>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 bg-muted rounded px-1.5 py-0.5">
                        {HOMEPAGE_PREVIEW_COPY.badge}
                      </span>
                    </div>
                    <div className="px-4 py-3 space-y-2.5">
                      {HOMEPAGE_SOURCE_VIEWS.map((source) => (
                        <div key={source.id} className="flex items-center justify-between">
                          <span className="text-xs text-foreground/70">{source.proofLabel}</span>
                          <span className="text-[10px] font-semibold text-foreground">{source.detailLabel}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between bg-white/2">
                      <span className="text-[10px] text-muted-foreground/60">{HOMEPAGE_PREVIEW_COPY.footerLead}</span>
                      <span className="text-[10px] text-muted-foreground/40">{HOMEPAGE_PREVIEW_COPY.footerNote}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/40 text-center mt-2">{HOMEPAGE_PREVIEW_COPY.panelNote}</p>
                </div>
              </div>
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
