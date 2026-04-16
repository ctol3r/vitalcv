/**
 * loading.tsx — Next.js App Router streaming fallback for /p/[slug].
 *
 * Rendered while the server component awaits the single public profile
 * fetch. Structure mirrors the real page (onboarding header → evidence
 * slot → decision surface) so layout doesn't shift when the real content
 * streams in.
 *
 * Pure presentation; no hooks; no data fetches.
 */

function SkeletonBar({ className = 'h-3 w-3/4' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded bg-muted ${className}`}
    />
  );
}

export default function PublicTrustProfileLoading() {
  return (
    <main className="min-h-screen bg-background pb-28" aria-busy="true">
      <div className="relative mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
        <article className="rounded-lg border border-border bg-card p-8 shadow-sm md:p-12">
          <header className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" aria-hidden />
            <SkeletonBar className="h-3 w-40" />
          </header>

          <div className="mb-8 h-px bg-border" />

          {/* Onboarding header skeleton */}
          <section className="mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <SkeletonBar className="h-3 w-32" />
            <SkeletonBar className="mt-2 h-3 w-full max-w-md" />
          </section>

          {/* Evidence panel skeleton (3 rows) */}
          <section className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <SkeletonBar className="h-3 w-40" />
            <ul className="mt-4 space-y-4">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBar className="h-3 w-40" />
                    <SkeletonBar className="h-2 w-28" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-muted" aria-hidden />
                    <SkeletonBar className="h-3 w-20" />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Decision card skeleton */}
          <section className="mb-6">
            <div className="rounded-xl border-2 border-border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <SkeletonBar className="h-3 w-24" />
                  <SkeletonBar className="h-10 w-56" />
                </div>
                <div className="space-y-2 text-right">
                  <SkeletonBar className="h-3 w-20" />
                  <SkeletonBar className="h-6 w-12" />
                </div>
              </div>
              <SkeletonBar className="mt-4 h-3 w-full" />
              <SkeletonBar className="mt-2 h-3 w-5/6" />
            </div>
          </section>

          <p
            role="status"
            aria-live="polite"
            className="mt-6 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Checking sources…
          </p>
          <p className="sr-only">
            Loading trust snapshot. If this takes longer than usual the upstream
            verification sources may be delayed — the page will update as data
            arrives.
          </p>
        </article>
      </div>
    </main>
  );
}
