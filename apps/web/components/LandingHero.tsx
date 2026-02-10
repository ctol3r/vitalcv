import Link from 'next/link';

const previewLinks = [
  { href: '/preview/clinician', label: 'Clinician' },
  { href: '/preview/issuer', label: 'Issuer' },
  { href: '/preview/verifier', label: 'Verifier' },
];

export default function LandingHero() {
  return (
    <section className="border-b border-neutral-200 pb-14 sm:pb-16">
      <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-neutral-950 sm:text-5xl">
        Trust infrastructure for healthcare credentialing
      </h1>

      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-neutral-600 sm:text-xl sm:leading-relaxed">
        Credentials are issued, held, and verified.
        Every state transition produces proof.
      </p>

      <nav aria-label="Participants" className="mt-12">
        <ul className="flex gap-6 sm:gap-8">
          {previewLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm font-medium text-neutral-500 underline underline-offset-4 decoration-neutral-300 hover:text-neutral-950 hover:decoration-neutral-500 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
