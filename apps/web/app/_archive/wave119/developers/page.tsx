import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Code2,
  Globe,
  Lock,
  Package2,
  ShieldCheck,
} from 'lucide-react';
import { getPublicApiBase, getPublicApiHostLabel } from '@/lib/api';
import { CodeBlock } from '@/components/developers/CodeBlock';
import { TryItSection } from '@/components/developers/TryItSection';

export const metadata: Metadata = {
  title: 'Developers',
  description:
    'Current VitalCV wedge APIs, SDK packages, and integration boundaries.',
  openGraph: {
    title: 'Developers',
    description:
      'Current VitalCV wedge APIs, SDK packages, and integration boundaries.',
    url: 'https://vitalcv.com/developers',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Developers',
    description:
      'Current VitalCV wedge APIs, SDK packages, and integration boundaries.',
  },
};

const ROUTE_FAMILIES = [
  {
    title: 'Identity ingest',
    detail: 'Start the wedge by ingesting an NPI into the current source-backed pipeline.',
    routes: ['POST /api/identity/:npi/ingest'],
    example: {
      request: 'POST /api/identity/1003000126/ingest',
      response: '{ "runId": "run_abc123", "npi": "1003000126", "status": "started" }',
    },
  },
  {
    title: 'Passport retrieval',
    detail: 'Fetch the same passport truth used by clinician and employer surfaces.',
    routes: ['GET /api/passport/npi/:npi', 'GET /api/passport/entity/:id'],
    example: {
      request: 'GET /api/passport/npi/1003000126',
      response: '{ "entity": { "npi": "1003000126", "name": "...", "readiness": { "score": 82, "level": "L2" } }, "sources": [...] }',
    },
  },
  {
    title: 'Employer review',
    detail: 'Inspect packets and persist employer actions with audit confirmation.',
    routes: [
      'GET /api/employer-review/:entityId/packet',
      'POST /api/employer-review/:entityId/accept',
      'POST /api/employer-review/:entityId/request-refresh',
      'POST /api/employer-review/:entityId/route-to-review',
    ],
    example: {
      request: 'POST /api/employer-review/:entityId/accept',
      response: '{ "accepted": true, "auditEventId": "evt_xyz", "timestamp": "2026-04-09T..." }',
    },
  },
  {
    title: 'Workspace context',
    detail: 'Resolve persona and active organization context for employer and clinician flows.',
    routes: ['GET /api/me/workspaces', 'POST /api/workspaces/switch'],
    example: null,
  },
  {
    title: 'Pilot ops',
    detail: 'Operator-only KPI exports and scoped start outcome capture for pilots.',
    routes: [
      'GET /api/internal/pilot/kpis',
      'GET /api/internal/pilot/kpis/export',
      'POST /api/internal/pilot/start-outcome',
    ],
    example: null,
  },
  {
    title: 'Wallet sync',
    detail: 'Current mobile mobile wallet preview surface used by the Expo client.',
    routes: [
      'GET /api/credentials/wallet',
      'GET /api/credentials/wallet/:subject/summary',
    ],
    example: null,
  },
] as const;

const SDK_PACKAGES = [
  '@vitalcv/wallet-sdk',
  '@vitalcv/verifier-sdk',
  '@vitalcv/issuer-sdk',
] as const;

const INTEGRATION_RULES = [
  'The public contract stays centered on NPI -> readiness -> passport -> review -> start outcome.',
  'Employer actions must write an audit event before success is shown.',
  'Unsupported sources must remain explicitly gated, unavailable, pending, or review-required.',
  'Standards packages exist in the repo, but not every issuer/verifier flow is self-serve from this surface yet.',
] as const;

export default function DevelopersPage() {
  const publicApiBase = getPublicApiBase();
  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
            <Code2 className="h-3.5 w-3.5" />
            Current wedge API
          </div>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">
              Build against the VitalCV launch wedge.
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              This page intentionally stays narrow. It documents the current integration truth:
              source-backed identity ingest, passport retrieval, employer review actions,
              workspace context, pilot reporting, and mobile wallet preview.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                API host
              </div>
              <p className="mt-3 text-lg font-semibold">{getPublicApiHostLabel()}</p>
              <p className="mt-1 text-sm text-muted-foreground">{publicApiBase}</p>
              {/* TODO: Migrate API host to api.vitalcv.com */}
              <p className="mt-2 text-[10px] text-muted-foreground/60">
                Planned migration to api.vitalcv.com
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Audit rule
              </div>
              <p className="mt-3 text-lg font-semibold">Mutations are auditable</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Review actions must persist an audit event before returning success.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Mode
              </div>
              <p className="mt-3 text-lg font-semibold">Wedge-first</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Older platform and intelligence surfaces are not part of the public integration contract.
              </p>
            </div>
          </div>
        </header>

        {/* Authentication */}
        <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Authentication
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Public endpoints</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Identity ingest and passport retrieval endpoints are currently open for public
                use during the launch period. No API key required.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Authenticated endpoints</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                Employer review, workspace, and pilot endpoints require a Clerk session token
                passed via the <code className="rounded bg-background px-1.5 py-0.5 text-xs font-mono">Authorization: Bearer &lt;token&gt;</code> header.
                Workspace context determines org-scoped permissions.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-background px-4 py-3">
            <p className="text-xs font-mono text-muted-foreground">
              {/* TODO: Add API key issuance when available */}
              Rate limiting: 60 requests/minute for unauthenticated, 300/minute for authenticated sessions.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {ROUTE_FAMILIES.map((family) => (
            <article key={family.title} className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">{family.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{family.detail}</p>
              <div className="mt-4 space-y-2">
                {family.routes.map((route) => (
                  <div
                    key={route}
                    className="rounded-xl border border-border/80 bg-background px-3 py-2 font-mono text-xs text-foreground/80"
                  >
                    {route}
                  </div>
                ))}
              </div>
              {family.example && (
                <div className="mt-4 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Response</p>
                  <div className="rounded-xl border border-border/80 bg-background px-3 py-2 font-mono text-[11px] text-foreground/60 overflow-x-auto">
                    {family.example.response}
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>

        {/* Try it — interactive curl section */}
        <TryItSection publicApiBase={publicApiBase} />

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-2xl border border-border bg-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Quick start
            </p>
            <CodeBlock
              code={`# 1. Ingest an NPI
curl -X POST '${publicApiBase}/api/identity/1003000126/ingest' \\
  -H 'content-type: application/json'

# 2. Retrieve the passport
curl '${publicApiBase}/api/passport/npi/1003000126'

# 3. Accept as employer (authenticated)
curl -X POST '${publicApiBase}/api/employer-review/<entityId>/accept' \\
  -H 'content-type: application/json' \\
  -H 'Authorization: Bearer <clerk-session-token>' \\
  -d '{"organizationContextId":"<orgId>","acceptanceReason":"head-start"}'`}
            />
          </article>

          <article className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Package2 className="h-3.5 w-3.5" />
              SDK packages
            </div>
            <div className="mt-4 space-y-2">
              {SDK_PACKAGES.map((pkg) => (
                <div
                  key={pkg}
                  className="rounded-xl border border-border/80 bg-background px-3 py-2 font-mono text-xs text-foreground/85 flex items-center justify-between"
                >
                  <span>{pkg}</span>
                  {/* TODO: Link to npm/github when packages are published */}
                  <span className="text-[10px] text-muted-foreground/50">internal</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Integration boundaries
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {INTEGRATION_RULES.map((rule) => (
              <div key={rule} className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm leading-6 text-muted-foreground">
                {rule}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/passport"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Open live NPI entry
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/review/request"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground/75 transition hover:text-foreground"
            >
              Open employer review request
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
