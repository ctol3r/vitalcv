import Link from 'next/link';

export function CTASection() {
  return (
    <section className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Start verifying.
          </h2>
          <p className="mt-4 text-base text-muted">
            Integrate VitalCV into your credentialing workflow. Reduce PSV
            cycle time from months to minutes with cryptographic proof.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="https://vitalcv.com/passport"
              className="rounded-md bg-accent px-5 py-2.5 text-center text-sm font-medium text-accent-foreground transition-theme hover:opacity-80"
            >
              Try NPI lookup
            </Link>
            <Link
              href="https://vitalcv.com/pilot"
              className="rounded-md border border-border bg-transparent px-5 py-2.5 text-center text-sm font-medium text-foreground transition-theme hover:bg-background"
            >
              Request access
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
