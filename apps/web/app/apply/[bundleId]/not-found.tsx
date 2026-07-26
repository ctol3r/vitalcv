import Link from 'next/link';

/**
 * Contextual 404 for apply bundle links. Reached when the bundleId in the
 * URL is malformed or doesn't resolve to a live bundle — most often a
 * mistyped, revoked, or fabricated link. Must never render bundle data.
 */
export default function ApplyBundleNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ops-gradient px-4 text-foreground">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <h1 className="text-xl font-bold text-foreground">Link not found</h1>
        <p className="text-sm text-muted-foreground">This link is invalid or has been revoked.</p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/passport"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-muted border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Start a new NPI lookup
          </Link>
        </div>
      </div>
    </div>
  );
}
