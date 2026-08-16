import Link from 'next/link';
import { DEMO_ENTITY_ID } from '@/lib/demo/demo-passport';

export const metadata = {
  title: 'Live Demo',
  description: 'Explore VitalCV with a source-backed sample clinician — ecosystem, recruiter review, career intelligence, and proof packet.',
  /**
   * W0.4: demo surfaces are not indexable.
   *
   * The page is honest on its face — it says the clinician is a curated
   * example and that sample data is demo data. But it shipped `index, follow`,
   * so a search engine could surface a sample clinician's ecosystem, recruiter
   * review, or proof packet as a VitalCV result, stripped of the surrounding
   * "this is a demo" framing. The /design/* prototypes already set this;
   * /demo was the one that did not.
   */
  robots: { index: false, follow: false },
};

const id = encodeURIComponent(DEMO_ENTITY_ID);

const SURFACES: Array<{ href: string; title: string; blurb: string }> = [
  { href: `/ecosystem/${id}`, title: 'Career Ecosystem', blurb: 'The operating system for a healthcare career — evidence, trust, mobility, organizations, and activity in one 60-second view.' },
  { href: `/recruiter/candidate/${id}`, title: 'Recruiter Candidate Review', blurb: 'A source-backed placement decision with per-state readiness — move forward, request evidence, or not ready.' },
  { href: `/career-intelligence/${id}`, title: 'Career Intelligence', blurb: 'Deterministic, explainable insights, notifications, and prioritized actions.' },
  { href: `/packet/${id}`, title: 'Proof Packet', blurb: 'The shareable, recruiter-ready credential readiness packet.' },
  { href: `/career-map/${id}`, title: 'Career Map', blurb: 'A navigable map of evidence, sources, and trust.' },
  { href: `/network/${id}`, title: 'My Network', blurb: 'The organizations connected to a clinician.' },
];

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-14">
        <header className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Live Demo</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">See VitalCV with a source-backed sample clinician</h1>
          <p className="mt-3 text-base text-muted-foreground">
            This demo runs the real product against a curated, decision-grade example clinician — every surface below shows
            honest, source-backed status (checked, gated, stale, or unknown — never a guarantee). No login or NPI required.
          </p>
        </header>

        <section aria-label="Demo surfaces" className="mt-10 grid gap-4 sm:grid-cols-2">
          {SURFACES.map((s) => (
            <Link key={s.href} href={s.href} className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
                <span aria-hidden className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
            </Link>
          ))}
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Sample data is clearly demo data. Your VitalCV profile is source-backed; acceptance is verifier-policy dependent.
        </p>
      </div>
    </main>
  );
}
