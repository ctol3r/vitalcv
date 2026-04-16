import { ComparisonCTA } from '@/components/compare/ComparisonCTA';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import {
  JsonLd,
  ORGANIZATION_JSONLD,
  buildFaqJsonLd,
} from '@/components/compare/JsonLd';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VitalCV vs Symplr — Credentialing Comparison',
  description:
    'Compare VitalCV and Symplr for healthcare credentialing. See how VitalCV complements enterprise solutions with instant, clinician-first verification.',
  alternates: {
    canonical: 'https://vitalcv.com/compare/vitalcv-vs-symplr',
  },
  openGraph: {
    title: 'VitalCV vs Symplr',
    description:
      'Fast, clinician-first credentialing verification that complements enterprise platforms like Symplr.',
    url: 'https://vitalcv.com/compare/vitalcv-vs-symplr',
  },
};

const COMPARISON_ROWS = [
  {
    feature: 'Primary audience',
    incumbent: 'Enterprise credentialing teams',
    vitalcv: 'Clinicians + employers',
  },
  {
    feature: 'Time to first result',
    incumbent: 'Days (workflow-dependent)',
    vitalcv: 'Seconds',
    highlight: true,
  },
  {
    feature: 'Clinician self-service',
    incumbent: 'No — employer-initiated only',
    vitalcv: 'Yes — any clinician, no signup',
    highlight: true,
  },
  {
    feature: 'Setup & onboarding',
    incumbent: 'Months-long enterprise implementation',
    vitalcv: 'Enter an NPI and go',
  },
  {
    feature: 'Pricing model',
    incumbent: 'Enterprise contract ($$$$)',
    vitalcv: 'Free for clinicians, affordable for employers',
    highlight: true,
  },
  {
    feature: 'Portability',
    incumbent: 'Data stays in employer system',
    vitalcv: 'Clinician owns their snapshot',
  },
  {
    feature: 'Federal source checks',
    incumbent: 'NPPES, OIG, state boards (within platform)',
    vitalcv: 'NPPES, OIG/LEIE, PECOS — instant',
  },
  {
    feature: 'Workflow management',
    incumbent: 'Full credentialing lifecycle',
    vitalcv: 'Focused on verification speed',
  },
  {
    feature: 'Best for',
    incumbent: 'Large health systems with dedicated CVO staff',
    vitalcv: 'Clinicians, small practices, staffing agencies',
    highlight: true,
  },
];

const FAQS = [
  {
    question: 'Is VitalCV a replacement for Symplr?',
    answer:
      'No. Symplr is a comprehensive enterprise credentialing platform with workflow management, committee tracking, and payer enrollment. VitalCV is a fast, clinician-first verification layer. Many organizations use VitalCV for instant pre-screening before a full credentialing workflow.',
  },
  {
    question: 'Can VitalCV and Symplr work together?',
    answer:
      'Yes. VitalCV can serve as the clinician-facing entry point — providers check their own readiness, then share their VitalCV snapshot with employers who use Symplr for the full credentialing lifecycle.',
  },
  {
    question: 'Why would a clinician use VitalCV instead of waiting for their employer to credential them?',
    answer:
      'VitalCV empowers clinicians to proactively verify their own readiness before applying to positions. A clean VitalCV snapshot shows employers which sources have already been checked, so they can move faster with fewer unknowns.',
  },
  {
    question: 'How does VitalCV pricing compare to Symplr?',
    answer:
      'VitalCV is free for individual clinicians. Employer plans are significantly more affordable than enterprise credentialing platforms. Symplr typically requires a multi-year enterprise contract.',
  },
];

export default function VitalCVvsSymplrPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <JsonLd data={ORGANIZATION_JSONLD} />
      <JsonLd data={buildFaqJsonLd(FAQS)} />

      <div className="mx-auto max-w-4xl space-y-12">
        <header className="text-center space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Comparison
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            VitalCV vs Symplr
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Symplr powers enterprise credentialing workflows. VitalCV is the
            fast, clinician-first entry point that gets providers verified in
            seconds.
          </p>
        </header>

        <ComparisonCTA />

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Feature Comparison</h2>
          <ComparisonTable incumbentName="Symplr" rows={COMPARISON_ROWS} />
        </section>

        {/* Positioning */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            Different Tools for Different Needs
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <h3 className="font-semibold">Symplr&apos;s Strength</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Symplr excels at managing the full credentialing lifecycle for
                large health systems — committee reviews, payer enrollment,
                privileging workflows, and compliance tracking across hundreds or
                thousands of providers.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <h3 className="font-semibold">VitalCV&apos;s Advantage</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                VitalCV is built for speed and accessibility. Any clinician can
                check their readiness in seconds — no enterprise contract, no
                setup, no waiting. It&apos;s the clinician-side entry point to
                credentialing.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h3 className="font-semibold">Better Together</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use VitalCV as the front door: clinicians verify their readiness
              before applying, then share their source-backed snapshot with
              employers. Credentialing teams using Symplr get a head start with
              pre-verified data — reducing time-to-credential by days.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-semibold">
            Frequently Asked Questions
          </h2>
          <dl className="space-y-4">
            {FAQS.map((faq) => (
              <div
                key={faq.question}
                className="rounded-xl border border-border bg-card p-5"
              >
                <dt className="font-semibold">{faq.question}</dt>
                <dd className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <ComparisonCTA
          headline="See what Symplr can&apos;t show you in seconds"
          description="Enter your NPI and get a source-backed credentialing snapshot — instantly, for free."
        />
      </div>
    </main>
  );
}
