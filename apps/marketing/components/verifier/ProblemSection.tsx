const problems = [
  {
    metric: '90+ days',
    label: 'Average credentialing cycle',
    detail:
      'Manual PSV requires phone calls, faxes, and portal logins across dozens of primary sources.',
  },
  {
    metric: '20+',
    label: 'Sources per clinician',
    detail:
      'Each credential — license, board cert, DEA, OIG, SAM — requires independent verification.',
  },
  {
    metric: 'Zero',
    label: 'Portability',
    detail:
      'Verifications expire and restart from scratch. Nothing transfers between organizations.',
  },
];

export function ProblemSection() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
          The problem
        </h2>
        <p className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Credentialing is broken by design.
        </p>

        <div className="mt-12 grid gap-12 md:grid-cols-3 md:gap-8">
          {problems.map((item) => (
            <div key={item.metric}>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {item.metric}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
