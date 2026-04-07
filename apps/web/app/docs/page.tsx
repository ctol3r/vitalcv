import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Code2, Database, ShieldCheck, Activity } from 'lucide-react';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

export const metadata: Metadata = {
  title: 'Documentation | VitalCV',
  description: 'Integrate the VitalCV readiness and employer decision wedge.',
};

const SECTIONS = [
  {
    icon: BookOpen,
    title: 'API Reference',
    desc: 'Endpoints for NPI ingest, passport retrieval, and employer review state.',
    href: PUBLIC_WEDGE_ROUTE_TARGETS.developersEntry,
    badge: 'REST · JSON',
  },
  {
    icon: Database,
    title: 'Source Coverage',
    desc: 'The canonical source map for identity, licensure, and exclusion status.',
    href: PUBLIC_WEDGE_ROUTE_TARGETS.developersEntry,
    badge: 'Evidence',
  },
  {
    icon: ShieldCheck,
    title: 'Trust Contract',
    desc: 'How VitalCV models readiness, blocks, and freshness to support safe hiring decisions.',
    href: PUBLIC_WEDGE_ROUTE_TARGETS.developersEntry,
    badge: 'Wedge Logic',
  },
] as const;

const QUICK_LINKS = [
  { label: 'Enter NPI (Sandbox)', href: PUBLIC_WEDGE_ROUTE_TARGETS.homepageLookup },
  { label: 'Employer Review UX', href: PUBLIC_WEDGE_ROUTE_TARGETS.reviewEntry },
  { label: 'Readiness API', href: PUBLIC_WEDGE_ROUTE_TARGETS.developersEntry },
] as const;

const PRINCIPLES = [
  { icon: ShieldCheck, text: 'Decision before data — surfacing what is actionable immediately' },
  { icon: Activity, text: 'Source-backed reality — exposing the exact provenance and freshness' },
  { icon: Database, text: 'Honest coverage — no mock claims, no simulated trust' },
] as const;

export default function DocsPage() {
  return (
    <article className="max-w-2xl space-y-14 bg-background px-6 py-12">
      <header className="space-y-4">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
          Documentation
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--vt-text-1)]">
          Integrate the decision wedge
        </h1>
        <p className="text-[var(--vt-text-2)] leading-relaxed">
          VitalCV exposes clinician readiness as a strict, source-backed trust contract.
          Use the current wedge routes to parse identity, standing, and authority without
          overstating what has not been checked yet.
        </p>
      </header>

      <section className="space-y-2">
        {PRINCIPLES.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 text-sm text-[var(--vt-text-2)]">
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--vt-text-3)]" />
            <span>{text}</span>
          </div>
        ))}
      </section>

      <hr className="border-[var(--vt-border)]" />

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
          Reference
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SECTIONS.map(({ icon: Icon, title, desc, href, badge }) => (
            <Link
              key={href + title}
              href={href}
              className="group flex flex-col gap-4 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 transition hover:border-[var(--vt-accent)]/30 hover:bg-[var(--vt-surface-2)]"
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 text-[var(--vt-text-3)]" />
                <span className="font-mono text-[10px] text-[var(--vt-text-3)]">{badge}</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">{title}</h3>
                <p className="text-xs leading-5 text-[var(--vt-text-2)]">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
          Quick Links
        </h2>
        <div className="grid gap-1 sm:grid-cols-2">
          {QUICK_LINKS.map(({ label, href }) => (
            <Link
              key={href + label}
              href={href}
              className="group flex items-center justify-between rounded-lg border border-[var(--vt-border)] px-4 py-2.5 text-sm text-[var(--vt-text-2)] transition hover:border-[var(--vt-border-2)] hover:bg-[var(--vt-surface)] hover:text-[var(--vt-text-1)]"
            >
              <span>{label}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
