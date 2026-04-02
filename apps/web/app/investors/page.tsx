import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Investors — VitalCV',
  description:
    'VitalCV is source-backed provider identity infrastructure for healthcare credentialing. Reducing time-to-start from months to days.',
};

const VALUE_PROPS = [
  {
    title: 'Source-backed verification',
    description:
      'Clinician credentials verified against NPPES, OIG/LEIE, and PECOS — with provenance, freshness tracking, and claim-level receipts.',
  },
  {
    title: 'Reusable trust',
    description:
      'Every verification produces a portable, auditable credential passport. Employers accept verified evidence as a head start instead of restarting from zero.',
  },
  {
    title: 'Measurable outcomes',
    description:
      'Time to Start (TTS) and Interview-to-Start Velocity (ISV) are the core metrics. Every pilot proves or disproves the reduction.',
  },
  {
    title: 'Compliance-native',
    description:
      'HIPAA-aligned, audit-first, revocation-aware. Maps to NCQA credentialing expectations and CMS verification requirements.',
  },
];

export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-3xl font-bold text-foreground">Investors</h1>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          VitalCV is source-backed provider identity infrastructure for healthcare
          credentialing. We reduce clinician time-to-start by converting repeated
          verification into reusable, portable, auditable trust.
        </p>

        <section className="mt-16">
          <h2 className="text-lg font-semibold text-foreground">The problem</h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Healthcare employers re-verify the same clinician from scratch every
            hiring cycle because no employer trusts another employer&apos;s verification.
            This is structural — not procedural. The result is months of delay
            between offer and start, wasted credentialing staff hours, and
            operational risk from stale source data.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-foreground">The approach</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {VALUE_PROPS.map((vp) => (
              <div key={vp.title} className="rounded-lg border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground">{vp.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {vp.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-foreground">Current status</h2>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            VitalCV is in active pilot. We are working with early-stage healthcare
            organizations to validate the source-backed verification wedge and
            measure real reductions in time-to-start.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            All reported metrics come from pilot deployments. We do not publish
            projected or illustrative traction figures.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            For investor inquiries:{' '}
            <a
              href="mailto:investors@vitalcv.com"
              className="underline underline-offset-2 text-foreground"
            >
              investors@vitalcv.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
