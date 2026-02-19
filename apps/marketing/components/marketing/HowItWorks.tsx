const steps = [
  {
    number: '01',
    title: 'Enter NPI',
    description:
      'Look up any clinician by their National Provider Identifier. We pull verified data from NPPES and primary sources.',
  },
  {
    number: '02',
    title: 'Verify & Anchor',
    description:
      'Credentials are verified against primary sources and anchored as W3C Verifiable Credentials with ES256 signatures.',
  },
  {
    number: '03',
    title: 'Share Securely',
    description:
      'Present credentials to any verifier using OpenID4VP. Cryptographic proof replaces phone calls and faxes.',
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          How it works
        </h2>

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
