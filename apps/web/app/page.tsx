import Link from 'next/link';
import LandingHero from '../components/LandingHero';
import LandingSection from '../components/LandingSection';
import Footer from '../components/Footer';

const participantCopy = [
  {
    title: 'Clinicians',
    body: 'Carry verified credentials across roles, systems, and states.',
  },
  {
    title: 'Issuers',
    body: 'Issue, revoke, and audit credentials with authoritative provenance.',
  },
  {
    title: 'Verifiers',
    body: 'Instantly trust credentials with audit-ready proof.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-16 sm:px-10 sm:py-24">
      <LandingHero />

      <div className="mt-16 space-y-16">
        <LandingSection heading="Who it’s for">
          <ul className="divide-y divide-neutral-200">
            {participantCopy.map((item) => (
              <li key={item.title} className="py-4">
                <p className="text-sm font-medium text-neutral-950">{item.title}</p>
                <p className="mt-1 text-neutral-600">{item.body}</p>
              </li>
            ))}
          </ul>
        </LandingSection>

        <LandingSection heading="How it works">
          <p className="font-medium text-neutral-900">
            Recognition → Acceptance → Start
          </p>
          <p className="mt-2 text-neutral-600">
            Trusted issuers recognize. Clinicians accept. Systems proceed — with proof.
          </p>
        </LandingSection>

        <LandingSection heading="Preview mode">
          <p className="text-neutral-600">
            Preview the credential lifecycle from each participant’s perspective.
            Illustrative data. Real workflows.
          </p>
          <p className="mt-4 text-neutral-700">
            <Link href="/preview" className="underline underline-offset-4">
              Open preview index
            </Link>
            {' · '}
            <Link href="/preview/clinician" className="underline underline-offset-4">
              Clinician Preview
            </Link>
            {' · '}
            <Link href="/preview/issuer" className="underline underline-offset-4">
              Issuer Preview
            </Link>
            {' · '}
            <Link href="/preview/verifier" className="underline underline-offset-4">
              Verifier Preview
            </Link>
          </p>
        </LandingSection>
      </div>

      <Footer />
    </main>
  );
}
