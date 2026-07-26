import Link from 'next/link';

/**
 * Contextual not-found for application detail. Reached when the id in the
 * URL is not in the clinician's live application list — most often because
 * the application was withdrawn or the link is stale.
 */
export default function ApplicationNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-4 py-20 text-center sm:px-6">
      <h1 className="text-2xl font-semibold text-white">This application isn&apos;t in your list</h1>
      <p className="max-w-md text-sm leading-6 text-white/60">
        It may have been withdrawn, or the link may be out of date. Your live applications and
        every employer update are on your updates queue.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/holder/applications"
          className="inline-flex items-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
        >
          Open your applications
        </Link>
        <Link
          href="/holder/opportunities"
          className="inline-flex items-center rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
        >
          Browse live roles
        </Link>
      </div>
    </main>
  );
}
