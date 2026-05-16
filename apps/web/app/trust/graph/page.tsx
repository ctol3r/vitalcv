import type { Metadata } from 'next';
import { FilterableTrustGraph } from '@/components/graph/FilterableTrustGraph';
import { KnowledgeTrustGraphPanel } from '@/components/trust/KnowledgeTrustGraphPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trust Graph Explorer — VitalCV',
  description:
    'Verifier-readable trust topology for VitalCV. Shows the current graph surface, trust contract, and discoverable replay paths.',
};

export default function TrustGraphPage() {
  return (
    <main className="min-h-screen bg-[#080e1a] text-white">
      <header className="border-b border-white/8 px-6 py-5">
        <div className="mx-auto max-w-6xl space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            VitalCV / Trust / Graph
          </div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.16em] text-white">
            Trust Graph Explorer
          </h1>
          <p className="max-w-3xl text-xs text-white/55">
            Verifier-readable topology. The graph is discoverable, replayable, and bound to the
            same chronology contract used on trust and verifier surfaces.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        <FilterableTrustGraph live height={540} compact />
        <KnowledgeTrustGraphPanel expanded />

        <section className="rounded-2xl border border-white/8 bg-white/5 p-4">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Discoverability
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
            {[
              { href: '/trust/schema', label: '/trust/schema', note: 'Schema contract and field order' },
              { href: '/trust/doctrine', label: '/trust/doctrine', note: 'Replay doctrine and chronology' },
              { href: '/.well-known/trust.json', label: '/.well-known/trust.json', note: 'Machine-readable trust manifest' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="border border-white/8 bg-black/20 px-3 py-2 hover:bg-white/10 transition-colors"
              >
                <div className="font-mono text-[11px] text-blue-300 underline underline-offset-2">
                  {item.label}
                </div>
                <div className="mt-0.5 text-white/55">{item.note}</div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
