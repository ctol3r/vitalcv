import type { Metadata } from 'next';
import Link from 'next/link';

type Milestone = {
  date: string;
  title: string;
  detail: string;
};

const built: Milestone[] = [
  { date: '2026-01-18', title: 'Identity artifact pipeline', detail: 'End-to-end NPI lookup → NPPES normalization → deterministic artifact → ES256 signing.' },
  { date: '2026-01-25', title: 'OpenID4VCI issuance flow', detail: 'Pre-Authorized Code flow with PKCE S256 and DPoP token binding.' },
  { date: '2026-02-01', title: 'Verifier presentation', detail: 'OpenID4VP presentation with same-device redirect and cross-device QR.' },
  { date: '2026-02-05', title: 'Public marketing site', detail: 'Landing page, how-it-works, security posture, progress tracking — all live.' },
  { date: '2026-02-10', title: 'Trust state engine', detail: 'Rule-based credential status with trust flags, revocation, and drift detection.' },
  { date: '2026-02-15', title: 'Live interactive demo', detail: '3-step demo wizard with real NPPES data, signed credentials, and raw JSON view.' },
];

const building: Milestone[] = [
  { date: '2026-02', title: 'PostgreSQL migration', detail: 'Move from SQLite + in-memory stores to hosted PostgreSQL via Prisma.' },
  { date: '2026-02', title: 'API security hardening', detail: 'CORS lockdown, helmet headers, API key rotation, and request signing.' },
  { date: '2026-03', title: 'Authentication', detail: 'Clerk or NextAuth integration for verifier dashboard access.' },
];

const next: Milestone[] = [
  { date: '2026 Q1', title: 'Primary source verification', detail: 'Automated board license and DEA verification with evidence capture.' },
  { date: '2026 Q1', title: 'Error tracking + observability', detail: 'Sentry integration, structured logging, and performance monitoring.' },
  { date: '2026 Q2', title: 'Credentialing workflow', detail: 'Multi-step credentialing with approval chains and audit trail.' },
];

const architecture = [
  { label: 'Browser', description: 'Next.js 15 marketing site + React 19 web app', color: 'bg-blue-500' },
  { label: 'API Gateway', description: 'Express.js on Railway with rate limiting', color: 'bg-violet-500' },
  { label: 'Identity Module', description: 'NPPES lookup → normalize → artifact → sign', color: 'bg-emerald-500' },
  { label: 'Trust Engine', description: 'Rule-based trust state with flags + revocation', color: 'bg-amber-500' },
  { label: 'Storage', description: 'PostgreSQL (migrating from SQLite)', color: 'bg-rose-500' },
  { label: 'Standards', description: 'OpenID4VCI, OpenID4VP, W3C VC, HAIP 1.0', color: 'bg-cyan-500' },
];

export const metadata: Metadata = {
  title: 'Progress — VitalCV',
  description: 'Public build log and architecture overview for VitalCV.',
  openGraph: {
    title: 'Progress — VitalCV',
    description: 'Public build log and architecture overview for VitalCV.',
    url: 'https://vitalcv.com/progress',
  },
  twitter: {
    title: 'Progress — VitalCV',
    description: 'Public build log and architecture overview for VitalCV.',
  },
};

function MilestoneList({ heading, badge, items }: { heading: string; badge: string; items: Milestone[] }) {
  return (
    <section className="rounded-lg border border-border p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
          {badge}
        </span>
      </div>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.title} className="flex gap-4">
            <span className="shrink-0 pt-0.5 text-xs font-mono text-muted w-20">
              {item.date}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-0.5 text-sm text-muted">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ProgressPage() {
  return (
    <main className="bg-background">
      {/* ── Hero ── */}
      <section className="mx-auto max-w-[1200px] px-6 pt-20 pb-12 md:pt-28">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">Roadmap</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          What we shipped / what comes next.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          Public updates for YC investors and early adopters. Every milestone
          includes a date and a concrete deliverable.
        </p>
      </section>

      {/* ── Milestones ── */}
      <section className="border-y border-border bg-surface py-14">
        <div className="mx-auto max-w-[1200px] space-y-6 px-6">
          <MilestoneList heading="Built" badge={`${built.length} shipped`} items={built} />
          <MilestoneList heading="Building" badge="in progress" items={building} />
          <MilestoneList heading="Next" badge="planned" items={next} />
        </div>
      </section>

      {/* ── Architecture overview ── */}
      <section className="mx-auto max-w-[1200px] px-6 py-14">
        <h2 className="text-sm uppercase tracking-[0.2em] text-muted">
          Architecture
        </h2>
        <p className="mt-4 text-2xl font-semibold text-foreground">
          System overview
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {architecture.map((layer) => (
            <div key={layer.label} className="rounded-lg border border-border p-5">
              <div className="flex items-center gap-2">
                <span className={`block h-2.5 w-2.5 rounded-full ${layer.color}`} />
                <p className="text-sm font-semibold text-foreground">{layer.label}</p>
              </div>
              <p className="mt-2 text-sm text-muted">{layer.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <Link
            href="/security"
            className="inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-theme hover:opacity-90"
          >
            Read security
          </Link>
        </div>
      </section>
    </main>
  );
}
