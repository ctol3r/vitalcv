import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About VitalCV',
  description:
    'VitalCV builds source-backed credentialing infrastructure for healthcare. Learn about our mission, team, and approach to clinician readiness verification.',
  openGraph: {
    title: 'About VitalCV',
    description:
      'Source-backed credentialing infrastructure for healthcare professionals and employers.',
    url: 'https://vitalcv.com/about',
  },
};

export default function AboutPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-3xl space-y-12">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">About VitalCV</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            VitalCV is building the credentialing infrastructure healthcare deserves — fast,
            source-backed, and transparent.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            Healthcare credentialing is broken. It takes weeks to verify what should take seconds.
            VitalCV connects directly to federal and state sources — NPPES, OIG/LEIE, PECOS, and
            state medical boards — to give clinicians and employers an instant, verifiable snapshot
            of readiness.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            We believe every clinician deserves a portable, source-backed credential that follows
            them across employers. And every employer deserves to make credentialing decisions
            based on real data, not paperwork.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">How It Works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { step: '1', title: 'Enter NPI', description: 'Start with your 10-digit National Provider Identifier' },
              { step: '2', title: 'Verify Sources', description: 'We check NPPES, OIG/LEIE, PECOS, and state boards in real time' },
              { step: '3', title: 'Get Your Passport', description: 'Receive a source-backed readiness snapshot you can share with employers' },
            ].map(item => (
              <div key={item.step} className="rounded-xl border border-border bg-card p-5">
                <span className="text-2xl font-bold text-muted-foreground/30">{item.step}</span>
                <h3 className="mt-2 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Get in Touch</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Questions about VitalCV? We&apos;d love to hear from you.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="mailto:hello@vitalcv.com"
              className="inline-flex rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium transition hover:bg-card"
            >
              hello@vitalcv.com
            </a>
            <Link
              href="/pilot"
              className="inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Start a pilot
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
