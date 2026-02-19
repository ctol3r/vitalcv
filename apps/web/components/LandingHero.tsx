import Link from 'next/link';

const previewLinks = [
  { href: '/preview/clinician', label: 'Clinician Preview' },
  { href: '/preview/issuer', label: 'Issuer Preview' },
  { href: '/preview/verifier', label: 'Verifier Preview' },
];

export default function LandingHero() {
  return (
    <section className="space-y-8 pb-16 border-b border-neutral-200 sm:pb-20">
      <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-neutral-950 sm:text-5xl">
        Healthcare credentials were never meant to move this slowly.
      </h1>

      <p className="max-w-2xl text-lg leading-relaxed text-neutral-600 sm:text-xl sm:leading-relaxed">
        VitalCV is trust infrastructure for clinicians, issuers, and healthcare
        systems — built to verify once and reuse everywhere.
      </p>

      <nav aria-label="Role preview links" className="pt-2">
        <ul className="flex flex-wrap gap-6 sm:gap-8">
          {previewLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm font-medium text-neutral-600 underline underline-offset-4 decoration-neutral-300 hover:text-neutral-950 hover:decoration-neutral-600 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
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
