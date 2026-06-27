import { SOLUTIONS } from '@/lib/solutions/solutions';
import { SolutionCard } from '@/components/solutions/SolutionCard';
import { DEMO_ENTITY_ID } from '@/lib/demo/demo-passport';

export const metadata = {
  title: 'Solutions · VitalCV',
  description: 'One source-backed evidence platform for clinicians, recruiters, organizations, and enterprise — choose your path.',
};

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 py-14">
        <header className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Solutions</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">One platform, every healthcare-career role</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Clinicians, recruiters, organizations, and enterprise teams all work from the same source-backed evidence,
            trust, timeline, mobility, and organization layers. Pick your path — each runs the real product on a sample clinician.
          </p>
        </header>

        <section aria-label="Solutions by role" className="mt-10 grid gap-4 sm:grid-cols-2">
          {SOLUTIONS.map((s) => (
            <SolutionCard key={s.role} role={s.role} title={s.title} headline={s.headline} valueProps={s.valueProps} reuses={s.reuses} href={s.primaryPath(DEMO_ENTITY_ID)} />
          ))}
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Every path reuses the same shared infrastructure — no segment runs a different engine. Source coverage is reported
          honestly (checked / gated / stale / unknown); acceptance is verifier-policy dependent.
        </p>
      </div>
    </main>
  );
}
