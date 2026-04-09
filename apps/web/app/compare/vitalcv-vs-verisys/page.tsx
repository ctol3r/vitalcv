import { ComparisonCTA } from '@/components/compare/ComparisonCTA';
import { ComparisonTable } from '@/components/compare/ComparisonTable';
import {
  JsonLd,
  ORGANIZATION_JSONLD,
  buildFaqJsonLd,
} from '@/components/compare/JsonLd';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VitalCV vs Verisys — Credentialing Verification Comparison',
  description:
    'Compare VitalCV and Verisys for provider credentialing verification. Instant vs batch, portable vs institutional, free vs enterprise-priced.',
  alternates: {
    canonical: 'https://vitalcv.com/compare/vitalcv-vs-verisys',
  },
  openGraph: {
    title: 'VitalCV vs Verisys',
    description:
      'Instant, portable credentialing verification vs enterprise batch processing. See the comparison.',
    url: 'https://vitalcv.com/compare/vitalcv-vs-verisys',
  },
};

const COMPARISON_ROWS = [
  {
    feature: 'Verification speed',
    incumbent: 'Batch processing (hours to days)',
    vitalcv: 'Instant (seconds)',
    highlight: true,
  },
  {
    feature: 'Data ownership',
    incumbent: 'Institutional — employer controls data',
    vitalcv: 'Portable — clinician owns their snapshot',
    highlight: true,
  },
  {
    feature: 'Pricing',
    incumbent: 'Enterprise contracts',
    vitalcv: 'Free for clinicians',
    highlight: true,
  },
  {
    feature: 'Clinician self-service',
    incumbent: 'No — employer-initiated only',
    vitalcv: 'Yes — check readiness anytime',
  },
  {
    feature: 'Federal source checks',
    incumbent: 'NPPES, OIG, state boards, DEA',
    vitalcv: 'NPPES, OIG/LEIE, PECOS',
  },
  {
    feature: 'Continuous monitoring',
    incumbent: 'Yes (ProView)',
    vitalcv: 'Re-check anytime, instant results',
  },
  {
    feature: 'Setup time',
    incumbent: 'Enterprise implementation required',
    vitalcv: 'No setup — enter NPI and go',
  },
  {
    feature: 'Best for',
    incumbent: 'Large health systems, payers, CVO operations',
    vitalcv: 'Clinicians, small practices, staffing agencies',
    highlight: true,
  },
];

const FAQS = [
  {
    question: 'How does VitalCV differ from Verisys ProView?',
    answer:
      'Verisys ProView is an enterprise platform designed for continuous monitoring across large provider networks. VitalCV is an instant, clinician-first tool — any provider can check their readiness in seconds without an enterprise contract or employer involvement.',
  },
  {
    question: 'Does VitalCV do continuous monitoring like Verisys?',
    answer:
      'VitalCV provides instant on-demand verification rather than passive continuous monitoring. Clinicians and employers can re-check at any time and get updated results in seconds from federal sources.',
  },
  {
    question: 'Why choose instant verification over batch processing?',
    answer:
      'Batch processing means waiting hours or days for results. Instant verification lets you make credentialing decisions in real time — critical when onboarding locum tenens, evaluating candidates, or responding to compliance inquiries.',
  },
  {
    question: 'What does "portable" credentialing mean?',
    answer:
      'With VitalCV, clinicians own their verification snapshot and can share it with any employer. Traditional platforms like Verisys are employer-controlled — when a clinician leaves, their verification data stays behind.',
  },
];

export default function VitalCVvsVerisysPage() {
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
            VitalCV vs Verisys
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Verisys processes verifications in batches for enterprises. VitalCV
            delivers instant, portable results for clinicians and employers
            alike.
          </p>
        </header>

        <ComparisonCTA />

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Feature Comparison</h2>
          <ComparisonTable incumbentName="Verisys" rows={COMPARISON_ROWS} />
        </section>

        {/* Key differentiators */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            Three Core Differences
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                title: 'Instant vs Batch',
                body: 'Verisys processes verifications in batch cycles. VitalCV returns results in seconds — critical for time-sensitive credentialing decisions.',
              },
              {
                title: 'Portable vs Institutional',
                body: 'Verisys data lives in employer systems. VitalCV gives clinicians a portable snapshot they own and can share with any employer.',
              },
              {
                title: 'Free vs Enterprise',
                body: 'Verisys requires enterprise contracts. VitalCV is free for every clinician, with affordable plans for employers.',
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
          headline="Why wait for batch results?"
          description="Enter your NPI and get instant, source-backed verification — free for every clinician."
        />
      </div>
    </main>
  );
}
