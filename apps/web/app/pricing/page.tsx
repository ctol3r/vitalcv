import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'VitalCV pricing for clinicians and healthcare employers. Free readiness checks for individuals, employer plans for organizations.',
  openGraph: {
    title: 'Pricing',
    description:
      'Free readiness checks for clinicians. Employer plans for healthcare organizations.',
    url: 'https://vitalcv.com/pricing',
  },
};

export default function PricingPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-4xl space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Free readiness checks for clinicians. Scalable plans for healthcare employers.
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Clinician */}
          <div className="rounded-2xl border border-border bg-card p-8 space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                For Clinicians
              </p>
              <p className="mt-2 text-3xl font-bold">Free</p>
              <p className="mt-1 text-sm text-muted-foreground">Always free for individual use</p>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                'NPI readiness checks',
                'Source-backed credentialing snapshot',
                'NPPES, OIG/LEIE, PECOS verification',
                'Shareable passport link',
                'No signup required to preview',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-trust-green mt-0.5 text-xs">✓</span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/passport"
              className="block w-full rounded-xl border border-border bg-background py-3 text-center text-sm font-semibold transition hover:bg-card"
            >
              Check readiness — free
            </Link>
          </div>

          {/* Employer */}
          <div className="rounded-2xl border-2 border-foreground/20 bg-card p-8 space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                For Employers
              </p>
              <p className="mt-2 text-3xl font-bold">Custom</p>
              <p className="mt-1 text-sm text-muted-foreground">Contact us for employer pricing</p>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                'Everything in Clinician, plus:',
                'Bulk credentialing verification',
                'Employer review dashboard',
                'API access for integrations',
                'Custom source configurations',
                'Dedicated support',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-trust-green mt-0.5 text-xs">✓</span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/pilot"
              className="block w-full rounded-xl bg-foreground py-3 text-center text-sm font-semibold text-background transition hover:opacity-90"
            >
              Start a pilot
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Questions?{' '}
          <a href="mailto:hello@vitalcv.com" className="underline underline-offset-2 hover:text-foreground">
            Contact us
          </a>
        </p>
      </div>
    </main>
  );
}
