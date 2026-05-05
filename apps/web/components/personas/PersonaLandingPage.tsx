import * as React from 'react';
import Link from 'next/link';

import type { PersonaLandingContent } from '@/lib/personas/landingContent';

interface PersonaLandingPageProps {
  content: PersonaLandingContent;
}

/**
 * Shared persona landing surface. Single component renders every
 * /for/<slug> page so the structural a11y + copy review applies
 * uniformly. Persona-specific content lives in
 * apps/web/lib/personas/landingContent.ts.
 */
export function PersonaLandingPage({ content }: PersonaLandingPageProps) {
  const ctaHref = `/contact?persona=${encodeURIComponent(content.intakePersona)}`;

  return (
    <main
      className="mx-auto max-w-4xl px-4 py-16 space-y-20"
      data-testid="persona-landing"
      data-persona-slug={content.slug}
      data-intake-persona={content.intakePersona}
    >
      <section aria-labelledby="persona-hero-headline">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          {content.hero.eyebrow}
        </p>
        <h1
          id="persona-hero-headline"
          className="mt-2 text-3xl font-semibold leading-tight text-foreground sm:text-4xl"
        >
          {content.hero.headline}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          {content.hero.subhead}
        </p>
        <div className="mt-6">
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            data-testid="persona-hero-cta"
          >
            {content.cta.button}
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="persona-value-props"
        data-testid="persona-value-props"
      >
        <h2
          id="persona-value-props"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          What changes for you
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {content.valueProps.map((prop) => (
            <li
              key={prop.title}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <h3 className="text-base font-semibold text-foreground">
                {prop.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {prop.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="persona-flow"
        data-testid="persona-flow"
      >
        <h2
          id="persona-flow"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          How VitalCV fits your flow
        </h2>
        <ol className="mt-6 space-y-4">
          {content.flow.map((step) => (
            <li
              key={step.step}
              className="flex gap-4 rounded-2xl border border-border/60 bg-background/40 p-5"
            >
              <span className="text-2xl font-bold text-muted-foreground/50">
                {step.step}
              </span>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="persona-cta"
        className="rounded-2xl border border-border bg-card p-8"
        data-testid="persona-cta-section"
      >
        <h2
          id="persona-cta"
          className="text-xl font-semibold text-foreground"
        >
          {content.cta.headline}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{content.cta.body}</p>
        <div className="mt-5">
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            data-testid="persona-footer-cta"
          >
            {content.cta.button}
          </Link>
        </div>
      </section>
    </main>
  );
}
