import { SOLUTIONS } from '@/lib/solutions/solutions';
import { SolutionCard } from '@/components/solutions/SolutionCard';
import { DEMO_ENTITY_ID } from '@/lib/demo/demo-passport';

export const metadata = {
  title: 'Solutions',
  description: 'One source-backed evidence platform for clinicians, recruiters, organizations, and enterprise — choose your path.',
};

export default function SolutionsPage() {
  return (
    // Calm Wave paper — the same house system as the homepage/employers/personas.
    <div className="mz mz-paper mz-persona-verifier min-h-screen">
      <main className="mx-auto w-full max-w-[1120px] px-5 py-16 sm:py-20">
        <header className="max-w-2xl">
          <p className="mz-eyebrow">Solutions</p>
          <h1 className="mz-h1" style={{ marginTop: 14, maxWidth: 720 }}>
            One platform, every healthcare-career role
          </h1>
          <p className="mz-lede" style={{ marginTop: 14, maxWidth: 620 }}>
            Clinicians, recruiters, organizations, and enterprise teams all work from the same source-backed evidence,
            trust, timeline, mobility, and organization layers. Pick your path — each runs the real product on a sample clinician.
          </p>
        </header>

        <section aria-label="Solutions by role" className="mt-10 grid gap-3 sm:grid-cols-2">
          {SOLUTIONS.map((s) => (
            <SolutionCard key={s.role} role={s.role} title={s.title} headline={s.headline} valueProps={s.valueProps} reuses={s.reuses} href={s.primaryPath(DEMO_ENTITY_ID)} />
          ))}
        </section>

        <p className="mz-small" style={{ marginTop: 40, maxWidth: 640 }}>
          Every path reuses the same shared infrastructure — no segment runs a different engine. Source coverage is reported
          honestly (checked / gated / stale / unknown); acceptance is verifier-policy dependent.
        </p>
      </main>
    </div>
  );
}
