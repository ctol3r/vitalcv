'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function ForEmployersSection() {
  return (
    <section className="border-t border-border bg-card px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-background p-8 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          For healthcare employers
        </p>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Reduce provider time-to-start.
        </h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          See verified readiness, not self-reported claims. VitalCV gives your
          credentialing team source-backed snapshots from day one — so you can
          move from interview to start in under 60 days.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/pilot"
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
          >
            Request a pilot <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/employers"
            className="rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Learn more
          </Link>
        </div>
      </div>
    </section>
  );
}
