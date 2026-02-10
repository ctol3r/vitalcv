import Link from 'next/link';

const capabilities = [
  { label: 'Issue credential', status: 'read-only' },
  { label: 'Revocation authority enabled', status: 'read-only' },
];

export default function IssuerPreviewPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20 sm:px-10 sm:py-28">
      <header className="space-y-4">
        <p className="text-xs tracking-wide text-neutral-400">
          Illustrative preview &mdash; not live
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Issuer
        </h1>
      </header>

      <section className="mt-16">
        <h2 className="text-sm font-medium tracking-wide text-neutral-400 uppercase">
          Issuance controls
        </h2>
        <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
          {capabilities.map((cap) => (
            <li key={cap.label} className="flex items-baseline justify-between py-4">
              <span className="text-sm text-neutral-950">
                {cap.label}
              </span>
              <span className="text-xs text-neutral-400">{cap.status}</span>
            </li>
          ))}
        </ul>
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
