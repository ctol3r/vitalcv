import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Labs — VitalCV',
  description: 'Experimental features and preview surfaces in active development.',
};

// ── Experiments manifest ──────────────────────────────────────────────────────
// Status levels:
//   STABLE      — proven, used in production flows
//   PREVIEW     — functionally complete, in broader testing
//   EXPERIMENT  — active development, may change or break
//   INTERNAL    — admin/ops only, not linked publicly

type LabStatus = 'STABLE' | 'PREVIEW' | 'EXPERIMENT' | 'INTERNAL';

interface LabEntry {
  title: string;
  description: string;
  href: string;
  status: LabStatus;
  tags?: string[];
  requiresAuth?: boolean;
}

const LABS: LabEntry[] = [
  {
    title: 'Passport View',
    description: 'Share a source-backed readiness snapshot with an employer — passport-first view for the clinical hiring conversation.',
    href: '/passport',
    status: 'PREVIEW',
    tags: ['Your readiness'],
  },
  {
    title: 'Passport',
    description: 'Your portable proof of authority. Identity, readiness, and credentials in one object.',
    href: '/passport',
    status: 'PREVIEW',
    tags: ['Your readiness'],
  },
  {
    title: 'Apply with VitalCV',
    description: 'Generate a signed credential bundle for employers — no employer account required.',
    href: '/explore',
    status: 'STABLE',
    tags: ['Trust Transfer'],
  },
  {
    title: 'Document Intelligence',
    description: 'Drag-drop credential documents → OCR → extract → verify → ingest into your trust profile.',
    href: '/documents',
    status: 'STABLE',
    tags: ['Evidence Capture'],
  },
  {
    title: 'Trust Graph',
    description: 'Live force-directed graph of your credential network — issuers, verifiers, and relationships.',
    href: '/graph',
    status: 'STABLE',
    tags: ['Intelligence'],
    requiresAuth: true,
  },
  {
    title: 'Simulation Engine',
    description: 'Simulate credential revocation, expiration, and compliance rule changes and see the cascade.',
    href: '/simulation',
    status: 'STABLE',
    tags: ['Trust Analysis'],
  },
  {
    title: 'Ask VitalCV',
    description: 'Natural language interface to the trust network — query readiness, credentials, and providers.',
    href: '/ask',
    status: 'PREVIEW',
    tags: ['Intelligence'],
  },
  {
    title: 'Selective Disclosure',
    description: 'Share only the credentials you choose — SD-JWT backed, per-claim granularity.',
    href: '/holder',
    status: 'STABLE',
    tags: ['Privacy', 'OID4VP'],
    requiresAuth: true,
  },
  {
    title: 'OID4VP Presentation',
    description: 'Standards-compliant verifiable presentation flow (OpenID for Verifiable Presentations).',
    href: '/verify',
    status: 'STABLE',
    tags: ['Interop', 'W3C VC'],
  },
  {
    title: 'Intelligence Workbench',
    description: '4-panel investigator workbench: findings inbox, evidence viewer, network graph, copilot.',
    href: '/investigations',
    status: 'INTERNAL',
    tags: ['Ops', 'Intelligence'],
    requiresAuth: true,
  },
  {
    title: 'Mission Ops Console',
    description: 'Operator-level view of system readiness, onboarding funnels, and trust state distribution.',
    href: '/mission-ops',
    status: 'INTERNAL',
    tags: ['Ops', 'Admin'],
    requiresAuth: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LabStatus, { label: string; dot: string; text: string; badge: string }> = {
  STABLE:     { label: 'Stable',     dot: 'bg-emerald-400',    text: 'text-emerald-300', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' },
  PREVIEW:    { label: 'Preview',    dot: 'bg-sky-400',        text: 'text-sky-300',     badge: 'bg-sky-500/10 border-sky-500/20 text-sky-300' },
  EXPERIMENT: { label: 'Experiment', dot: 'bg-amber-400',      text: 'text-amber-300',   badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
  INTERNAL:   { label: 'Internal',   dot: 'bg-muted',       text: 'text-muted-foreground/60',    badge: 'bg-muted border-border text-muted-foreground/60' },
};

function resolveLabHref(entry: LabEntry): string {
  return entry.requiresAuth
    ? `/sign-in?redirect_url=${encodeURIComponent(entry.href)}`
    : entry.href;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LabsPage() {
  const publicEntries = LABS.filter((e) => e.status !== 'INTERNAL');
  const internalEntries = LABS.filter((e) => e.status === 'INTERNAL');

  return (
    <div className="min-h-screen bg-vt-surface-ops-base px-4 sm:px-6 py-12 sm:py-16 text-foreground">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-10 sm:mb-14">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">VitalCV</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Labs</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Active experiments and preview surfaces. Everything here is in development.
            Stable features are in active production use.
          </p>
        </div>

        {/* Status legend */}
        <div className="mb-8 flex flex-wrap gap-3">
          {(Object.entries(STATUS_CONFIG) as [LabStatus, typeof STATUS_CONFIG[LabStatus]][])
            .filter(([s]) => s !== 'INTERNAL')
            .map(([status, cfg]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </div>
            ))
          }
        </div>

        {/* Public experiments */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-12">
          {publicEntries.map((entry) => {
            const cfg = STATUS_CONFIG[entry.status];
            const href = resolveLabHref(entry);
            return (
              <Link
                key={entry.href + entry.title}
                href={href}
                className="group relative flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 rounded-2xl border border-white/6 bg-white/2 p-4 sm:p-5 transition-all hover:bg-muted hover:border-border active:scale-[0.99]"
              >
                {/* Status dot */}
                <div className="flex items-center gap-2 sm:hidden">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
                  {entry.requiresAuth && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-100">
                      <Lock className="h-3 w-3" />
                      Locked
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-sm font-semibold text-foreground group-hover:text-foreground transition-colors">
                      {entry.title}
                    </h2>
                    {entry.requiresAuth ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100">
                        <Lock className="h-2.5 w-2.5" />
                        Sign in required
                      </span>
                    ) : null}
                    {entry.tags?.map((tag) => (
                      <span key={tag} className="hidden sm:inline-flex text-[9px] font-bold uppercase tracking-wide bg-muted text-muted-foreground/60 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{entry.description}</p>
                </div>

                {/* Desktop status badge */}
                <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${cfg.badge}`}>
                    <span className={`h-1 w-1 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                  {entry.requiresAuth && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-amber-100/80">
                      <Lock className="h-3 w-3" />
                      Sign in required
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors hidden sm:block">→</span>
              </Link>
            );
          })}
        </div>

        {/* Internal section — clearly labeled */}
        <section>
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Internal — Ops Only</p>
          <p className="mb-4 text-xs text-muted-foreground/50">
            These surfaces are for operators and investigators. They require authentication and are not linked publicly.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {internalEntries.map((entry) => {
              const cfg = STATUS_CONFIG[entry.status];
              return (
                <div
                  key={entry.href + entry.title}
                  className="flex items-start gap-3 rounded-xl border border-white/4 bg-white/1 px-4 py-3 opacity-50"
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{entry.title}</p>
                    <p className="text-xs text-muted-foreground/40 mt-0.5">{entry.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-white/6 flex flex-wrap gap-4 text-sm text-muted-foreground/60">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/updates" className="hover:text-foreground transition-colors">Updates</Link>
          <Link href="/status" className="hover:text-foreground transition-colors">Status</Link>
        </div>

      </div>
    </div>
  );
}
