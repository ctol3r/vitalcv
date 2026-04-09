import { ComparisonCTA } from '@/components/compare/ComparisonCTA';
import {
  JsonLd,
  ORGANIZATION_JSONLD,
  buildFaqJsonLd,
} from '@/components/compare/JsonLd';
import { STATES, getStateBySlug } from '@/lib/credentialing-states';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/** Pre-render all 50 states + DC at build time. */
export function generateStaticParams() {
  return STATES.map((s) => ({ state: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>;
}): Promise<Metadata> {
  const { state: slug } = await params;
  const state = getStateBySlug(slug);
  if (!state) return {};

  return {
    title: `Medical Credentialing in ${state.name} (${state.abbr}) — Requirements & Timeline`,
    description: `Everything you need to know about medical credentialing in ${state.name}. Licensing timeline: ${state.licensureTimeline}. Credentialing timeline: ${state.credentialingTimeline}. Check your readiness with VitalCV.`,
    alternates: {
      canonical: `https://vitalcv.com/credentialing/${state.slug}`,
    },
    openGraph: {
      title: `Medical Credentialing in ${state.name}`,
      description: `${state.name} medical licensing takes ${state.licensureTimeline}. VitalCV checks your readiness in seconds.`,
      url: `https://vitalcv.com/credentialing/${state.slug}`,
    },
  };
}

export default async function StateCredentialingPage({
  params,
}: {
  params: Promise<{ state: string }>;
}) {
  const { state: slug } = await params;
  const state = getStateBySlug(slug);
  if (!state) notFound();

  const faqs = [
    {
      question: `How long does medical credentialing take in ${state.name}?`,
      answer: `Initial medical licensure in ${state.name} typically takes ${state.licensureTimeline}. Hospital and payer credentialing adds another ${state.credentialingTimeline}. VitalCV can verify your federal source data (NPI, OIG/LEIE, PECOS) in seconds to accelerate the process.`,
    },
    {
      question: `What is the ${state.name} medical licensing board?`,
      answer: `The ${state.boardName} oversees medical licensure in ${state.name}. You can find applications and requirements at their website.`,
    },
    {
      question: `Does VitalCV work for ${state.name} providers?`,
      answer: `Yes. VitalCV checks federal sources (NPPES, OIG/LEIE, PECOS) that apply to all US providers regardless of state. Enter your NPI to get a free readiness snapshot.`,
    },
    {
      question: `How can I speed up credentialing in ${state.name}?`,
      answer: `Start by verifying your federal data is clean using VitalCV — issues with NPI, OIG exclusions, or PECOS enrollment are common blockers. Having a source-backed readiness snapshot ready when you apply can shave days off the process.`,
    },
  ];

  // Neighboring states for internal linking (show up to 6 nearby in the list)
  const stateIndex = STATES.findIndex((s) => s.slug === slug);
  const nearbyStates = STATES.filter(
    (_, i) => i !== stateIndex && Math.abs(i - stateIndex) <= 3
  ).slice(0, 6);

  return (
    <main className="bg-background px-6 py-16 text-foreground">
      <JsonLd data={ORGANIZATION_JSONLD} />
      <JsonLd data={buildFaqJsonLd(faqs)} />

      <div className="mx-auto max-w-4xl space-y-12">
        {/* Hero */}
        <header className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            State Credentialing Guide
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Medical Credentialing in {state.name}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Everything you need to know about getting credentialed in{' '}
            {state.name} — licensing timelines, board requirements, and how
            VitalCV can help you get ready faster.
          </p>
        </header>

        {/* CTA above the fold */}
        <ComparisonCTA
          headline={`Check your readiness for ${state.name}`}
          description={`Enter your NPI and get a free, source-backed credentialing snapshot in seconds.`}
        />

        {/* Key facts */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            {state.name} Credentialing at a Glance
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Licensure Timeline
              </p>
              <p className="text-2xl font-bold">{state.licensureTimeline}</p>
              <p className="text-xs text-muted-foreground">
                Initial medical license
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Credentialing Timeline
              </p>
              <p className="text-2xl font-bold">
                {state.credentialingTimeline}
              </p>
              <p className="text-xs text-muted-foreground">
                Hospital / payer credentialing
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                With VitalCV
              </p>
              <p className="text-2xl font-bold text-trust-green">Seconds</p>
              <p className="text-xs text-muted-foreground">
                Federal source verification
              </p>
            </div>
          </div>
        </section>

        {/* Licensing board */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            {state.name} Medical Licensing Board
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <p className="font-semibold">{state.boardName}</p>
            <p className="text-sm text-muted-foreground">
              The {state.boardName} oversees medical licensure, renewals, and
              disciplinary actions for physicians practicing in {state.name}.
            </p>
            <a
              href={state.boardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-sm font-medium underline underline-offset-2 hover:text-foreground text-muted-foreground"
            >
              Visit {state.boardName} website
            </a>
          </div>
        </section>

        {/* State-specific notes */}
        {state.notes.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Key Facts for {state.name}
            </h2>
            <ul className="space-y-2">
              {state.notes.map((note) => (
                <li key={note} className="flex items-start gap-2 text-sm">
                  <span className="text-trust-green mt-0.5">&#10003;</span>
                  <span className="text-muted-foreground">{note}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* How VitalCV helps */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            How VitalCV Accelerates {state.name} Credentialing
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Enter your NPI',
                body: 'Start with your 10-digit National Provider Identifier.',
              },
              {
                step: '2',
                title: 'Instant verification',
                body: 'VitalCV checks NPPES, OIG/LEIE, and PECOS in seconds.',
              },
              {
                step: '3',
                title: 'Share your snapshot',
                body: `Send your source-backed readiness snapshot to ${state.name} employers.`,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-border bg-card p-5"
              >
                <span className="text-2xl font-bold text-muted-foreground/30">
                  {item.step}
                </span>
                <h3 className="mt-2 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">
            {state.name} Credentialing FAQ
          </h2>
          <dl className="space-y-4">
            {faqs.map((faq) => (
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

        {/* Internal links to other states */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">
            Credentialing in Other States
          </h2>
          <div className="flex flex-wrap gap-2">
            {nearbyStates.map((s) => (
              <Link
                key={s.slug}
                href={`/credentialing/${s.slug}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-background"
              >
                {s.name}
              </Link>
            ))}
            <Link
              href="/credentialing/california"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-card"
            >
              View all states &rarr;
            </Link>
          </div>
        </section>

        {/* Bottom CTA */}
        <ComparisonCTA />
      </div>
    </main>
  );
}
