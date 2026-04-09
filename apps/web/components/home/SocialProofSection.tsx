'use client';

const TESTIMONIALS = [
  {
    quote:
      "I used to spend weeks gathering paperwork for every new contract. VitalCV showed me my readiness status before I even started the application.",
    name: 'Dr. Sarah M.',
    role: 'Emergency Medicine, Locum Tenens',
  },
  {
    quote:
      "We piloted VitalCV for our onboarding pipeline. Being able to see source-verified readiness upfront cut our credentialing review time significantly.",
    name: 'James R.',
    role: 'Credentialing Manager, Regional Health System',
  },
] as const;

export function SocialProofSection() {
  return (
    <section className="border-t border-border bg-background px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by healthcare systems that need faster credentialing
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-xl border border-border bg-card p-6"
            >
              <blockquote className="flex-1 text-sm leading-relaxed text-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">
                  {t.name}
                </p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
