import Link from 'next/link';

const rolePreviews = [
  { href: '/preview/clinician', label: 'Clinician' },
  { href: '/preview/issuer', label: 'Issuer' },
  { href: '/preview/verifier', label: 'Verifier' },
];

export default function PreviewIndexPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:px-10 sm:py-20">
      <header className="space-y-4">
        <p className="text-xs tracking-wide text-neutral-400">
          Illustrative preview &mdash; not live
        </p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Credential lifecycle by participant
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-neutral-600">
          Synthetic data. Production code paths.
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-sm font-medium tracking-wide text-neutral-400 uppercase">
          Participants
        </h2>
        <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
          {rolePreviews.map((role) => (
            <li key={role.href} className="py-4">
              <h3 className="text-base font-medium text-neutral-900">
                <Link
                  href={role.href}
                  className="underline underline-offset-4 hover:text-neutral-700 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
                >
                  {role.label}
                </Link>
              </h3>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10">
        <Link
          href="/"
          className="text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
        >
          VitalCV
        </Link>
      </div>

      <footer className="mt-12 border-t border-neutral-200 pt-6">
        <p className="text-xs text-neutral-400">
          Synthetic data over production code paths.
        </p>
      </footer>
    </main>
  );
}
