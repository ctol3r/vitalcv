import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, FileCheck2, Route, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Developers | VitalCV',
  description:
    'Current VitalCV wedge routes for NPI ingest, passport retrieval, employer review, and audit-backed employer actions.',
};

const ROUTE_GROUPS = [
  {
    title: 'Ingest',
    badge: 'Source run',
    routes: [
      'POST /api/ingest/npi/:npi',
    ],
    summary: 'Starts the real NPI-to-readiness run that feeds the passport and employer review wedge.',
  },
  {
    title: 'Passport',
    badge: 'Readiness',
    routes: [
      'GET /api/passport/entity/:entityId',
      'GET /api/passport/npi/:npi',
    ],
    summary: 'Returns the source-backed passport, including readiness, freshness, provenance, and blockers.',
  },
  {
    title: 'Employer review',
    badge: 'Decision wedge',
    routes: [
      'GET /api/employer-review/:entityId/packet',
      'POST /api/employer-review/:entityId/request-refresh',
      'POST /api/employer-review/:entityId/route-to-review',
      'POST /api/employer-review/:entityId/accept',
    ],
    summary: 'Keeps the review surface explicit about what is proven now, what is missing, and which next action is safe.',
  },
] as const;

const PACKAGE_CARDS = [
  {
    title: '@vitalcv/verifier-sdk',
    text: 'Verifier-side helpers for consuming passport and employer review responses without silently upgrading weak states.',
  },
  {
    title: '@vitalcv/issuer-sdk',
    text: 'Issuance-facing package references only where they support the live trust contract already enforced by this branch.',
  },
] as const;

const BOUNDARIES = [
  'This surface is scoped to the live wedge only: NPI -> readiness -> passport -> employer review -> employer action.',
  'Checked, pending, stale, access required, unavailable, review required, and preview-only states must remain visibly distinct.',
  'Developer routes should support the buyer wedge, not create parallel preview loops or unsupported product areas.',
] as const;

export default function DevelopersPage() {
  return (
    <main className="max-w-4xl space-y-12 bg-background px-6 py-12">
      <header className="space-y-4">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
          Developers
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--vt-text-1)]">
          Build against the live wedge
        </h1>
        <p className="max-w-2xl text-[var(--vt-text-2)] leading-relaxed">
          Use the current VitalCV contract for NPI ingest, readiness, passport retrieval, employer review,
          and audit-backed employer actions. This page intentionally stays inside the active wedge and does
          not advertise unsupported wallet, mobile, or marketplace surfaces.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-2.5 text-sm text-[var(--vt-text-1)] transition hover:border-[var(--vt-accent)]/30 hover:bg-[var(--vt-surface-2)]"
          >
            Open live NPI entry
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/review/request"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--vt-border)] px-4 py-2.5 text-sm text-[var(--vt-text-2)] transition hover:border-[var(--vt-border-2)] hover:bg-[var(--vt-surface)] hover:text-[var(--vt-text-1)]"
          >
            Open employer review request
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--vt-border)] px-4 py-2.5 text-sm text-[var(--vt-text-2)] transition hover:border-[var(--vt-border-2)] hover:bg-[var(--vt-surface)] hover:text-[var(--vt-text-1)]"
          >
            Read wedge docs
            <BookOpen className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
          Route Groups
        </h2>
        <div className="grid gap-3">
          {ROUTE_GROUPS.map(({ title, badge, routes, summary }) => (
            <article
              key={title}
              className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-[var(--vt-text-3)]" />
                    <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">{title}</h3>
                  </div>
                  <p className="text-xs leading-5 text-[var(--vt-text-2)]">{summary}</p>
                </div>
                <span className="font-mono text-[10px] text-[var(--vt-text-3)]">{badge}</span>
              </div>
              <div className="mt-4 space-y-2">
                {routes.map((route) => (
                  <code
                    key={route}
                    className="block rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-2 text-xs text-[var(--vt-text-2)]"
                  >
                    {route}
                  </code>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
          Package References
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PACKAGE_CARDS.map(({ title, text }) => (
            <article
              key={title}
              className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5"
            >
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-[var(--vt-text-3)]" />
                <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">{title}</h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--vt-text-2)]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
          Boundaries
        </h2>
        <div className="space-y-2 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5">
          {BOUNDARIES.map((rule) => (
            <div key={rule} className="flex items-start gap-3 text-sm text-[var(--vt-text-2)]">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--vt-text-3)]" />
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
