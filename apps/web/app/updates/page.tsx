import type { Metadata } from 'next';
import Link from 'next/link';
import { getDeployInfo } from '@/lib/deployInfo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Updates',
  description: 'Live deployment status and recent product changes.',
};

// ── Recent changes manifest ───────────────────────────────────────────────────
// Update this list with each wave. Newest first.

const RECENT_CHANGES = [
  {
    date: '2026-03-22',
    tag: 'ACTIVATION',
    items: [
      'Interview Mode — new entry point for clinicians heading into an interview',
      'Passport — top-level Passport surface is now live',
      '/updates and /labs surfaces deployed',
      'Live deploy indicator added to footer',
      'Navbar updated: Interview Mode + Passport added',
    ],
  },
  {
    date: '2026-03-22',
    tag: 'UI FOUNDATION',
    items: [
      'Token sweep: analytics, billing, and all internal/* pages now use semantic tokens',
      'Verifier inbox raw hex background removed — inherits layout shell correctly',
      '/billing auth gap closed — now ADMIN-gated',
      'foundry-primitives.tsx deleted; VerifierBreadcrumb added',
      'docs/UI_PRIMITIVES.md created — canonical primitive ownership',
    ],
  },
  {
    date: '2026-03-12',
    tag: 'PLATFORM',
    items: [
      'All 7 platform pillars live: Passport, Proof, Trust Graph, Simulation, Apply Bundle, Decision Capsules, OID4VP',
      'Document Intelligence — drag-drop OCR → credential parser → ingestion → audit',
      'Credential enrichment from live opportunity data',
      'Capacity Score MVP (0–100 demand pipeline)',
      'OIG/LEIE exclusion check integrated into WalletPassport',
    ],
  },
  {
    date: '2026-03-06',
    tag: 'INTELLIGENCE',
    items: [
      'Investigator Orchestration + Workbench (INV-1, INV-2, INV-3)',
      '9 autonomous investigators: trust decline, divergence, sanctions, clinical trials, institutions',
      'Command palette (⌘K) with copilot, search, and command modes',
      'Storyline Engine — clusters findings into living narratives',
      'CalibrationDashboard — investigator accuracy tracking',
    ],
  },
] as const;

// ── In-progress section ───────────────────────────────────────────────────────

const IN_PROGRESS = [
  { label: 'Apply-with-VCV event system', status: 'BUILDING', note: 'Organization context, webhook delivery, provider confirmation' },
  { label: 'Passport top-level surface', status: 'LIVE', note: 'Entry point live; real data hooks next' },
  { label: 'Interview Mode', status: 'LIVE', note: 'Placeholder live; real readiness binding next' },
  { label: 'Mobile PWA surface', status: 'PLANNED', note: 'Responsive web first, then native shell' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

const TAG_COLORS: Record<string, string> = {
  ACTIVATION: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  'UI FOUNDATION': 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  PLATFORM: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  INTELLIGENCE: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
};

const STATUS_COLORS: Record<string, string> = {
  LIVE: 'text-emerald-400',
  BUILDING: 'text-amber-400',
  PLANNED: 'text-white/40',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function UpdatesPage() {
  const deploy = getDeployInfo();

  const envLabel = deploy.env === 'production' ? 'Production' : deploy.env === 'preview' ? 'Preview' : 'Dev';
  const envDot = deploy.env === 'production' ? 'bg-emerald-400 animate-pulse' : deploy.env === 'preview' ? 'bg-amber-400' : 'bg-muted';

  return (
    <div className="min-h-screen bg-vt-surface-ops-base px-4 sm:px-6 py-12 sm:py-16 text-white">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-10 sm:mb-14">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">VitalCV</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Product Updates</h1>
          <p className="text-sm text-white/70">What shipped, what's building, what's next.</p>
        </div>

        {/* Deploy status panel */}
        <section className="mb-10 rounded-2xl border border-white/8 bg-card p-5 sm:p-6">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Deployment</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-[10px] text-white/50 mb-1 uppercase tracking-wide">Environment</p>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${envDot}`} />
                <span className="text-sm font-semibold text-white">{envLabel}</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/50 mb-1 uppercase tracking-wide">Commit</p>
              <p className="font-mono text-sm text-white/80">{deploy.sha}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/50 mb-1 uppercase tracking-wide">Branch</p>
              <p className="font-mono text-sm text-white/80 truncate">{deploy.branch}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/50 mb-1 uppercase tracking-wide">Deployed</p>
              <p className="text-sm text-white/80">
                {new Date(deploy.deployedAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
          {deploy.message && (
            <p className="mt-4 pt-4 border-t border-white/6 text-xs text-white/60 font-mono truncate">
              {deploy.message}
            </p>
          )}
          {deploy.env === 'preview' && (
            <div className="mt-4 pt-4 border-t border-white/6 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-300/70">Preview deployment active</p>
              <a
                href={deploy.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-amber-300 hover:text-amber-200 transition-colors"
              >
                Open preview →
              </a>
            </div>
          )}
        </section>

        {/* In progress */}
        <section className="mb-10">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Currently In Progress</p>
          <div className="space-y-2">
            {IN_PROGRESS.map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-xl border border-white/6 bg-white/2 px-4 py-3">
                <span className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide min-w-[60px] ${STATUS_COLORS[item.status] ?? 'text-white/40'}`}>
                  {item.status}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{item.label}</p>
                  <p className="text-xs text-white/60 mt-0.5">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Changelog */}
        <section>
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Recent Changes</p>
          <div className="space-y-6">
            {RECENT_CHANGES.map((entry) => (
              <div key={`${entry.date}-${entry.tag}`} className="rounded-2xl border border-white/6 bg-white/2 p-5">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <time className="text-xs text-white/50 font-mono">{entry.date}</time>
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TAG_COLORS[entry.tag] ?? 'bg-white/5 text-white/60 border-white/10'}`}>
                    {entry.tag}
                  </span>
                </div>
                <ul className="space-y-2">
                  {entry.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-muted shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-white/8 flex flex-wrap gap-4 text-sm text-white/50">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/labs" className="hover:text-white transition-colors">Labs</Link>
          <Link href="/status" className="hover:text-white transition-colors">Status</Link>
        </div>

      </div>
    </div>
  );
}
