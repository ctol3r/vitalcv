import Link from 'next/link';

const bullets = [
  'Reduce redundant PSV across credentialing cycles',
  'Stay within NCQA 180-day timelines automatically',
  'Export audit-ready artifacts for accreditation',
  'Independent cross-check mode for secondary verification',
];

export function VerifierSection() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="max-w-xl">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
            For Verifiers
          </h2>
          <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Accelerate PSV windows.
          </p>

          <ul className="mt-8 space-y-4">
            {bullets.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-base text-muted"
              >
                <span
                  className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-foreground"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <Link
              href="/verifier"
              className="text-sm font-medium text-foreground underline underline-offset-4 decoration-border transition-theme hover:decoration-foreground"
            >
              Explore Verifier Flow &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
