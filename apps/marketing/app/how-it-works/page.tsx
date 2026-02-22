import type { Metadata } from 'next';
import Link from 'next/link';

const phases = [
  {
    title: 'Lookup',
    description:
      'Clinician or verifier starts with a single NPI lookup. The app pulls source data from trusted APIs and writes an auditable event trail.',
  },
  {
    title: 'Verify',
    description:
      'VitalCV normalizes source artifacts and issues verifiable credentials with strict profile checks and ES256 signatures.',
  },
  {
    title: 'Share',
    description:
      'Shareable artifact links and holder-friendly verification flows expose only the signals verifiers need, not the full raw pile.',
  },
  {
    title: 'Re-Verify',
    description:
      'Monitoring and status endpoints expose renewal windows and freshness so trust is maintained between credentialing cycles.',
  },
];

export const metadata: Metadata = {
  title: 'How it works — VitalCV',
};

function WorkflowStep({ title, description }: { title: string; description: string }) {
  return (
    <article className="rounded-lg border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
    </article>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="bg-background">
      <section className="mx-auto max-w-[1200px] px-6 pt-20 pb-12 md:pt-28">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">YC flow</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Lightweight trust loop for credentialing.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          The path from lookup to verification uses strict standards, minimal manual
          steps, and auditable state transitions.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-theme hover:opacity-90"
          >
            Try demo
          </Link>
          <Link
            href="/security"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-theme hover:bg-surface"
          >
            Read security
          </Link>
        </div>
      </section>

      <section className="border-y border-border bg-surface py-14">
        <div className="mx-auto grid max-w-[1200px] gap-4 px-6 md:grid-cols-2">
          {phases.map((phase) => (
            <WorkflowStep
              key={phase.title}
              title={phase.title}
              description={phase.description}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
