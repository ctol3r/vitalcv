import Link from 'next/link';

const rolePreviews = [
  { href: '/preview/clinician', label: 'Clinician Portal' },
  { href: '/preview/issuer', label: 'Issuer Portal' },
  { href: '/preview/verifier', label: 'Verifier Portal' },
];

export default function PreviewIndexPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20 sm:px-10 sm:py-28">
      <header className="space-y-4">
        <p className="text-sm font-medium tracking-wide text-neutral-400">
          Illustrative preview — not live
        </p>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
          Preview mode
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-neutral-600">
          Preview the credential lifecycle from each participant&apos;s perspective.
          Illustrative data. Real workflows.
        </p>
      </header>

      <section className="mt-16" aria-label="Preview role portals">
        <h2 className="text-sm font-medium tracking-wide text-neutral-600">
          Participants
        </h2>
        <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200">
          {rolePreviews.map((role) => (
            <li key={role.href} className="py-4">
              <Link
                href={role.href}
                className="text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-900 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
              >
                {role.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-16 border-t border-neutral-200 pt-8">
        <p className="text-xs text-neutral-400">
          Demo runs real code paths with synthetic data.
        </p>
      </footer>
    </main>
  );
}
