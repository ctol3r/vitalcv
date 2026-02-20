import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoErrorBoundary } from '../../components/demo/DemoErrorBoundary';
import { DemoWizard } from '../../components/demo/DemoWizard';
import LiveStatusWidget from '../../components/site/LiveStatusWidget';

export const metadata: Metadata = {
  title: 'Live demo — VitalCV',
  description:
    "Walk through VitalCV's identity pipeline: look up an NPI, verify a provider, and generate a signed credential — all live.",
  openGraph: {
    title: 'Live demo — VitalCV',
    description:
      'Interactive 3-step demo of cryptographically signed healthcare credentials.',
  },
};

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

const statusLinks = [
  { method: 'GET', path: '/demo/status', description: 'Live service health, version, and environment.' },
  { method: 'GET', path: '/api/version', description: 'Build/commit metadata for release tracking.' },
  { method: 'GET', path: '/api/security/posture', description: 'Security toggle and enforcement posture.' },
];

function EndpointLink({ path, method, description }: { path: string; method: string; description: string }) {
  const url = apiBase ? `${apiBase}${path}` : path;

  return (
    <li className="rounded-lg border border-border p-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">
        {method}
      </p>
      <p className="mt-1 font-mono text-sm text-foreground break-all">{url}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
    </li>
  );
}

export default function DemoPage() {
  return (
    <main className="bg-background">
      {/* ── Hero ── */}
      <section className="mx-auto max-w-[1200px] px-6 pt-20 pb-12 md:pt-28">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">
          Live demo
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          See the identity pipeline in action.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          Enter any NPI below to look up a real provider from the CMS NPPES
          registry, then generate a cryptographically signed identity
          credential — all in three steps.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/how-it-works"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-theme hover:bg-surface"
          >
            How it works
          </Link>
          <Link
            href="/security"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-theme hover:bg-surface"
          >
            Security model
          </Link>
        </div>
      </section>

      {/* ── Interactive wizard ── */}
      <section className="border-y border-border bg-surface py-14">
        <div className="mx-auto max-w-[1200px] px-6">
          <DemoErrorBoundary>
            <DemoWizard />
          </DemoErrorBoundary>
        </div>
      </section>

      {/* ── Live status + endpoints ── */}
      <section className="mx-auto max-w-[1200px] px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-sm uppercase tracking-[0.2em] text-muted">
              Live status
            </h2>
            <p className="mt-4 text-2xl font-semibold text-foreground">
              Real-time backend signal
            </p>
            <LiveStatusWidget />
          </div>

          <div>
            <h2 className="text-sm uppercase tracking-[0.2em] text-muted">
              API endpoints
            </h2>
            <ul className="mt-6 space-y-3">
              {statusLinks.map((item) => (
                <EndpointLink
                  key={item.path}
                  method={item.method}
                  path={item.path}
                  description={item.description}
                />
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
