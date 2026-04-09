import Link from 'next/link';

interface ComparisonCTAProps {
  headline?: string;
  description?: string;
}

/** Shared call-to-action block for comparison and marketing pages. */
export function ComparisonCTA({
  headline = 'Try it now — enter your NPI',
  description = 'Get a free, source-backed credentialing snapshot in seconds. No signup required.',
}: ComparisonCTAProps) {
  return (
    <section className="rounded-2xl border-2 border-foreground/10 bg-card p-8 text-center space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">{headline}</h2>
      <p className="text-muted-foreground max-w-lg mx-auto">{description}</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link
          href="/passport"
          className="inline-flex rounded-xl bg-foreground px-8 py-3 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Check your readiness — free
        </Link>
        <Link
          href="/pilot"
          className="inline-flex rounded-xl border border-border bg-background px-8 py-3 text-sm font-semibold transition hover:bg-card"
        >
          Start an employer pilot
        </Link>
      </div>
    </section>
  );
}
