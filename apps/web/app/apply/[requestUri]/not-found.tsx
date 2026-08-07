import Link from 'next/link';

/**
 * Contextual 404 for opaque Apply Intent and legacy bundle links. Reached when
 * the identifier is malformed or no longer resolves. Must never render packet,
 * clinician, employer-private, or bundle data.
 */
export default function ApplyLinkNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ops-gradient px-4 text-foreground">
      <div className="w-full max-w-sm space-y-4 text-center">
        <div className="text-5xl" aria-hidden="true">?</div>
        <h1 className="text-xl font-bold text-foreground">Link not found</h1>
        <p className="text-sm text-muted-foreground">This link is invalid or has been revoked.</p>
        <div className="flex flex-col gap-2 pt-2">
          <Link href="/onboarding" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-muted px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
            Start a new NPI lookup
          </Link>
        </div>
      </div>
    </div>
  );
}
