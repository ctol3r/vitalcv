import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * FutureLegitimacyBlock — empty-state-structured placeholders for the
 * legitimacy signals that don't yet exist (pilot logos, testimonials,
 * verification counts, audit activity, provider counts, onboarding
 * reductions).
 *
 * DOES NOT fake traction. Every slot renders the literal placeholder
 * shape until a real value is provided via props. The user-facing copy
 * makes the "no metrics yet" posture explicit so a reviewer sees
 * honesty, not absence.
 *
 * Operator workflow: when real metrics arrive (signed pilot, testimonial
 * quote, real provider count), pass them as props. The shape stays
 * identical; only the content fills in.
 */

export interface LegitimacyMetric {
  label: string;
  value: string | null; // null → empty-state placeholder
  caveat?: string;
}

export interface LegitimacyTestimonial {
  quote: string | null;
  attribution: string | null;
}

export interface LegitimacyPilotLogo {
  name: string;
  /** When null, renders a placeholder badge with the name. */
  href?: string | null;
}

export interface FutureLegitimacyBlockProps {
  eyebrow?: string;
  metrics?: ReadonlyArray<LegitimacyMetric>;
  testimonial?: LegitimacyTestimonial;
  pilots?: ReadonlyArray<LegitimacyPilotLogo>;
  className?: string;
}

const DEFAULT_METRICS: ReadonlyArray<LegitimacyMetric> = [
  { label: 'Providers checked', value: null, caveat: 'will populate after first pilot' },
  { label: 'Verifications confirmed', value: null, caveat: 'will populate after first issuer' },
  { label: 'Onboarding time reduction', value: null, caveat: 'will populate after first measured cycle' },
];

const DEFAULT_TESTIMONIAL: LegitimacyTestimonial = {
  quote: null,
  attribution: null,
};

export function FutureLegitimacyBlock({
  eyebrow = 'Legitimacy posture',
  metrics = DEFAULT_METRICS,
  testimonial = DEFAULT_TESTIMONIAL,
  pilots = [],
  className,
}: FutureLegitimacyBlockProps) {
  return (
    <section className={cn('border-t border-border bg-muted/20', className)}>
      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>

        {/* Metrics row */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-md border border-border bg-card p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {m.label}
              </p>
              {m.value ? (
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {m.value}
                </p>
              ) : (
                <p className="mt-2 text-base font-medium text-muted-foreground italic">
                  no number yet
                </p>
              )}
              {m.caveat && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {m.caveat}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Testimonial slot */}
        <div className="mt-8 rounded-md border border-border bg-card p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Reviewer testimonial
          </p>
          {testimonial.quote && testimonial.attribution ? (
            <>
              <blockquote className="mt-3 text-sm leading-relaxed text-foreground">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <p className="mt-2 text-xs text-muted-foreground">
                — {testimonial.attribution}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground italic">
              No reviewer testimonial yet — this surface waits for a real one
              rather than fabricating one.
            </p>
          )}
        </div>

        {/* Pilot logos row */}
        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pilot partners
          </p>
          {pilots.length > 0 ? (
            <ul className="mt-3 flex flex-wrap items-center gap-3">
              {pilots.map((p) => (
                <li
                  key={p.name}
                  className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground"
                >
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground italic">
              No pilots announced yet. We will list signed partners here, not
              hopeful interest.
            </p>
          )}
        </div>

        <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground">
          This section is structurally permanent. Values become real as real
          pilots, real verifications, and real testimonials arrive. We do not
          backfill with synthetic numbers.
        </p>
      </div>
    </section>
  );
}

export default FutureLegitimacyBlock;
