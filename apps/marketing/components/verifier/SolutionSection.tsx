const steps = [
  {
    number: '01',
    title: 'Submit NPI',
    description:
      'Provide a clinician NPI. VitalCV queries primary sources and returns structured verification data.',
  },
  {
    number: '02',
    title: 'Receive evidence bundle',
    description:
      'Each verification produces a signed, timestamped artifact containing every credential check and its source.',
  },
  {
    number: '03',
    title: 'Store or forward',
    description:
      'Evidence bundles are portable. Cache locally, share with downstream verifiers, or archive for accreditation.',
  },
];

export function SolutionSection() {
  return (
    <section className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          How it works
        </h2>
        <p className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Three steps. Cryptographic proof.
        </p>

        <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <div key={step.number}>
              <span className="text-sm font-medium tabular-nums text-muted">
                {step.number}
              </span>
              <h3 className="mt-3 text-xl font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
