import Link from 'next/link';

export default function PublicTrustProfileNotFound() {
  return (
    <div className="min-h-[60vh] bg-background px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Credential readiness snapshot
        </p>
        <h1 className="mt-3 text-2xl font-bold text-foreground">
          We couldn’t find this clinician
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The NPI or share link you opened doesn’t match an active VitalCV profile.
          It may not have been published yet, or the link may have expired.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Return to VitalCV
          </Link>
          <Link
            href="/explore"
            className="rounded-lg border-2 border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
          >
            Browse clinician profiles
          </Link>
        </div>
      </div>
    </div>
  );
}
