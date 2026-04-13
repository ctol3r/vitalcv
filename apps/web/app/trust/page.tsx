import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Database, Eye, Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Trust Model — VitalCV',
  description:
    'How VitalCV verifies clinician credentials using federal and state sources. No self-reported data. No inflated claims. Source-backed readiness only.',
};

const TRUST_PILLARS = [
  {
    icon: Database,
    title: 'Source-backed only',
    body: 'Every claim in a VitalCV passport traces to a federal or state source — NPPES, OIG/LEIE, CMS PECOS, or a state medical board. Nothing is self-reported.',
  },
  {
    icon: Eye,
    title: 'Transparent coverage',
    body: 'When a source is unavailable or a lane is not yet supported, VitalCV says so. Gaps are visible, not hidden. Unsupported sources are never marked as verified.',
  },
  {
    icon: Lock,
    title: 'Verifiable artifacts',
    body: 'Employer review packets and readiness snapshots include source timestamps, coverage status, and audit context. Every fact is inspectable.',
  },
  {
    icon: ShieldCheck,
    title: 'No inflated scores',
    body: 'Readiness reflects what the current source record proves — not what the clinician claims. If data is missing, the score reflects that.',
  },
] as const;

const SOURCES = [
  { name: 'NPPES', description: 'National Plan & Provider Enumeration System — identity, taxonomy, and practice location' },
  { name: 'OIG/LEIE', description: 'Office of Inspector General exclusion list — sanctions and federal exclusions' },
  { name: 'CMS PECOS', description: 'Provider Enrollment, Chain, and Ownership System — Medicare enrollment status' },
  { name: 'State Boards', description: 'State medical board license verification — where institutional agreements allow' },
];

export default function TrustPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-3xl space-y-12">
        <header className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trust model
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            How VitalCV earns trust
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            VitalCV does not ask clinicians to upload documents or self-report credentials.
            Every readiness signal traces to a real federal or state source. When a source is
            unavailable, the gap is visible — never papered over.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {TRUST_PILLARS.map((pillar) => (
            <article key={pillar.title} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="mb-3 inline-flex rounded-full bg-emerald-500/10 p-2 text-emerald-400">
                <pillar.icon className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{pillar.body}</p>
            </article>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Sources we check</h2>
          <div className="space-y-3">
            {SOURCES.map((source) => (
              <div key={source.name} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <span className="shrink-0 rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                  {source.name}
                </span>
                <p className="text-sm text-muted-foreground">{source.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Data practices</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">No PHI stored.</strong> VitalCV is a credential readiness platform. We do not store, process, or transmit Protected Health Information.
            </p>
            <p>
              <strong className="text-foreground">Audit logging.</strong> All verifications and system actions are securely logged with timestamps and source provenance.
            </p>
            <p>
              <strong className="text-foreground">Data retention.</strong> Public credential data is cached for performance and can be refreshed or removed on request.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6">
          <h2 className="text-2xl font-semibold">Check your readiness</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Enter your NPI to see what the current source record proves about your credentials.
          </p>
          <div className="mt-5">
            <Link
              href="/passport"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Check readiness
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
