import { Suspense } from 'react';
import Link from 'next/link';
import { NpiInput } from './NpiInput';

export function HeroSection() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 pb-24 pt-20 md:pb-32 md:pt-28">
      <h1 className="text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
        Stop starting over.
        <br />
        Start ready.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted">
        Source-backed credential verification infrastructure for clinicians and
        verifiers — freshness and provenance stay visible on every check.
      </p>

      <div className="mt-10 max-w-md">
        <Suspense fallback={<div className="h-12" />}>
          <NpiInput />
        </Suspense>
      </div>

      <div className="mt-10 flex items-center gap-6">
        <Link
          href="https://vitalcv.com/passport"
          className="text-sm font-medium text-foreground underline underline-offset-4 decoration-border transition-theme hover:decoration-foreground"
        >
          Check your readiness &rarr;
        </Link>
      </div>
    </section>
  );
}
