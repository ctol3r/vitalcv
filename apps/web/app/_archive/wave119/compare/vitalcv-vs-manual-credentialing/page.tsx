import { ComparisonCTA } from '@/components/compare/ComparisonCTA';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import {
  JsonLd,
  ORGANIZATION_JSONLD,
  buildFaqJsonLd,
} from '@/components/compare/JsonLd';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VitalCV vs Manual Credentialing — Side-by-Side Comparison',
  description:
    'Compare VitalCV automated credentialing verification against manual processes. See how instant NPI checks, OIG screening, and PECOS lookups save days of work.',
  alternates: {
    canonical: 'https://vitalcv.com/compare/vitalcv-vs-manual-credentialing',
  },
  openGraph: {
    title: 'VitalCV vs Manual Credentialing',
    description:
      'Instant credentialing verification vs weeks of manual paperwork. See the side-by-side comparison.',
    url: 'https://vitalcv.com/compare/vitalcv-vs-manual-credentialing',
  },
};

const COMPARISON_ROWS = [
  {
    feature: 'Time to verify NPI',
    incumbent: '2–5 days',
    vitalcv: '10 seconds',
    highlight: true,
  },
  {
    feature: 'OIG/LEIE exclusion check',
    incumbent: 'Manual OIG website search',
    vitalcv: 'Automatic, every check',
  },
  {
    feature: 'Medicare enrollment (PECOS)',
    incumbent: 'Manual PECOS lookup',
    vitalcv: 'Automatic verification',
  },
  {
    feature: 'Re-verification',
    incumbent: 'Start from scratch every time',
    vitalcv: 'Instant re-check',
    highlight: true,
  },
  {
    feature: 'Cost per provider',
    incumbent: '$500–$2,000',
    vitalcv: 'Free for clinicians',
    highlight: true,
  },
  {
    feature: 'Portability',
    incumbent: 'None — locked to one employer',
    vitalcv: 'Carry your snapshot to any employer',
  },
  {
    feature: 'Data sources',
    incumbent: 'Varies by staff knowledge',
    vitalcv: 'NPPES, OIG/LEIE, PECOS — every time',
  },
  {
    feature: 'Audit trail',
    incumbent: 'Paper files, spreadsheets',
    vitalcv: 'Source-backed, timestamped record',
  },
];

const FAQS = [
  {
    question: 'How long does manual credentialing take?',
    answer:
      'Manual credentialing typically takes 90–120 days from application to approval. Primary source verification alone can take 2–5 days per provider, and the process involves checking multiple federal and state databases individually.',
  },
  {
    question: 'What does VitalCV check automatically?',
    answer:
      'VitalCV checks NPPES (NPI registry), OIG/LEIE (federal exclusion list), and PECOS (Medicare enrollment) in real time. Results are returned in seconds with source-backed evidence.',
  },
  {
    question: 'Is VitalCV free for clinicians?',
    answer:
      'Yes. Individual clinicians can run readiness checks and generate a shareable credentialing snapshot at no cost. Employer plans are available for organizations that need bulk verification and dashboards.',
  },
  {
    question: 'Does VitalCV replace the full credentialing process?',
    answer:
      'VitalCV accelerates the primary source verification portion of credentialing — the most time-consuming part. It complements your existing credentialing workflow by providing instant, source-backed checks that would otherwise take days.',
  },
];

export default function VitalCVvsManualPage() {
  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <JsonLd data={ORGANIZATION_JSONLD} />
      <JsonLd data={buildFaqJsonLd(FAQS)} />

      <div className="mx-auto max-w-4xl space-y-12">
        {/* Hero */}
        <header className="text-center space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Comparison
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            VitalCV vs Manual Credentialing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Manual credentialing takes 90–120 days. VitalCV checks federal
            sources in seconds. See how they compare.
          </p>
        </header>

        {/* CTA above the fold */}
        <ComparisonCTA />

        {/* Comparison table */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Feature Comparison</h2>
          <ComparisonTable
            incumbentName="Manual Process"
            rows={COMPARISON_ROWS}
          />
        </section>

        {/* Why it matters */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            Why Manual Credentialing Falls Short
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: 'Human error compounds',
                body: 'Staff manually searching OIG, NPPES, and state boards introduces transcription errors and missed checks. One oversight can mean onboarding an excluded provider.',
              },
              {
                title: 'No portability',
                body: 'Every time a clinician moves to a new employer, the entire verification process starts from scratch — even if nothing has changed.',
              },
              {
                title: 'Costly delays',
                body: 'The average time-to-start for a credentialed provider is 90–120 days. Each day of delay costs organizations revenue from unfilled positions.',
              },
              {
                title: 'Inconsistent sources',
                body: 'Manual processes depend on individual staff knowledge of which databases to check. VitalCV checks NPPES, OIG/LEIE, and PECOS on every single verification.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-xl border border-border bg-card p-5 space-y-2"
              >
                <h3 className="font-semibold">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
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

        {/* Bottom CTA */}
        <ComparisonCTA
          headline="Stop spending days on what takes seconds"
          description="Enter your NPI and see your source-backed credentialing snapshot instantly."
        />
      </div>
    </main>
  );
}
