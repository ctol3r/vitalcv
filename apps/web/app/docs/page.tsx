import * as React from 'react';
import type { Metadata } from 'next';

import {
  buildStatusFoundationPlan,
  explainStatusSurfaceStatus,
} from '@/lib/commercial/statusFoundation';

export const metadata: Metadata = {
  title: 'Docs',
  description:
    'Docs are a launch-readiness foundation, not complete API documentation.',
  /**
   * Deindexed deliberately (founder ruling D-B, 2026-08-09).
   *
   * This page is honest — it says outright that the docs are a foundation, and
   * labels twelve entries FOUNDATION PLANNED. That honesty is the right call
   * for someone we sent here. It is the wrong thing to publish to a search
   * engine, where the label arrives with no context and the page reads as the
   * product advertising its own unfinished-ness to a stranger.
   *
   * So: reachable by direct link, absent from the index. Nothing links here
   * today anyway (the only inbound reference is under `app/_archive/`), and it
   * has been removed from `app/sitemap.ts` in the same change — a sitemap entry
   * and a noindex directive contradict each other, and crawlers act on the
   * stronger signal.
   *
   * Reversible: delete this block and restore the sitemap row when the docs are
   * something we would choose to be found by.
   */
  robots: { index: false, follow: true },
};

interface DocLink {
  label: string;
  description: string;
  href: string;
}

const DOC_LINKS: ReadonlyArray<DocLink> = [
  {
    label: 'Build chain',
    description: 'Canonical local web build commands and the workspace prebuild contract.',
    href: '/docs/ops/vitalcv-build-chain.md',
  },
  {
    label: 'Completion board',
    description: 'Full-scope schema with delta columns and percentage-phase status lexicon.',
    href: '/docs/ops/vitalcv-completion-board.md',
  },
  {
    label: 'Public claims matrix',
    description: 'Single source of truth for what may be claimed publicly (Live / Partial / Planned / Forbidden).',
    href: '/docs/ops/vitalcv-public-claims-matrix.md',
  },
  {
    label: 'Knowledge Trust Graph',
    description: 'Architecture document for the issuer trust chain (boundaries 1–28).',
    href: '/docs/architecture/vitalcv-knowledge-trust-graph.md',
  },
  {
    label: 'Status preview',
    description: 'Foundation preview of source-health and build status surfaces.',
    href: '/status',
  },
];

export default function DocsPage() {
  const plan = buildStatusFoundationPlan();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Docs
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          Launch-readiness documentation index
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>{`Docs are a launch-readiness foundation, not complete API documentation.`}</strong>
          {' '}Public API documentation, a public changelog, and an incident-notice surface
          are planned but not shipped today.
        </p>
      </header>

      <section
        aria-labelledby="invariants-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="invariants-heading" className="text-base font-semibold sm:text-lg">
          Invariants
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">API docs complete</dt>
            <dd className="mt-1 font-mono">{String(plan.apiDocsComplete)}</dd>
          </div>
          {/* The "Production status page live: false" row was removed: /status
              is live, so the flag publicly contradicted the product. The typed
              literal remains in statusFoundation for its contract tests. */}
        </dl>
      </section>

      <section
        aria-labelledby="links-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="links-heading" className="text-base font-semibold sm:text-lg">
          Documentation index
        </h2>
        <ul className="mt-3 space-y-3">
          {DOC_LINKS.map((d) => (
            <li key={d.label} className="text-sm">
              <p className="font-medium">{d.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="planned-surfaces-heading"
        className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      >
        <h2 id="planned-surfaces-heading" className="text-base font-semibold sm:text-lg">
          Planned status surfaces
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Surfaces below are part of the docs/status foundation plan. None are wired today.
        </p>
        <ul className="mt-3 space-y-3">
          {plan.surfaces.map((s) => (
            <li key={s.kind} className="text-sm">
              <p className="font-medium">
                {s.label}{' '}
                <span
                  className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-slate-400/40 bg-slate-500/10 text-slate-600"
                  aria-label={`Status: ${s.status}`}
                  title={explainStatusSurfaceStatus(s.status)}
                >
                  {s.status.replace(/_/g, ' ')}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="disclaimers-heading"
        className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4 sm:p-5"
      >
        <h2 id="disclaimers-heading" className="text-sm font-semibold">Disclaimers</h2>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          {plan.disclaimers.map((d, i) => <li key={i}>· {d}</li>)}
        </ul>
      </section>
    </main>
  );
}
