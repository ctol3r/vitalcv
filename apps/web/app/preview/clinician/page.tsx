import Link from 'next/link';

const credential = {
  type: 'Medical License',
  status: 'Verified',
  issuer: 'State Medical Board (Example)',
  lastVerified: 'Jan 2026',
};

export default function ClinicianPreviewPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20 sm:px-10 sm:py-28">
      <header className="space-y-4">
        <p className="text-xs tracking-wide text-neutral-400">
          Illustrative preview &mdash; not live
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Clinician
        </h1>
      </header>

      <section className="mt-16">
        <h2 className="text-sm font-medium tracking-wide text-neutral-400 uppercase">
          Credential record
        </h2>
        <dl className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
          <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-neutral-500">Credential</dt>
            <dd className="text-sm text-neutral-950">{credential.type}</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-neutral-500">Status</dt>
            <dd className="text-sm font-medium text-neutral-950">
              {credential.status}
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-neutral-500">Issuer</dt>
            <dd className="text-sm text-neutral-950">{credential.issuer}</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[180px_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-neutral-500">
              Last verified
            </dt>
            <dd className="text-sm text-neutral-950">
              {credential.lastVerified}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-14">
        <Link
          href="/preview"
          className="text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
        >
          All participants
        </Link>
      </div>

      <footer className="mt-16 border-t border-neutral-200 pt-8">
        <p className="text-xs text-neutral-400">
          Synthetic data over production code paths.
        </p>
      </footer>
    </main>
  );
}
