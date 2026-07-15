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
    // Calm Wave, verifier persona (institutional buyers: CVOs / payers / staffing)
    // on full-width paper — the same design language as the homepage + /employers,
    // replacing the prior raw-Tailwind (sans, rounded-2xl, no accent) treatment.
    <div className="mz mz-paper mz-persona-verifier min-h-screen">
      <main
        className="mx-auto w-full max-w-[1120px] px-5 py-16 sm:py-20"
        data-testid="persona-landing"
        data-persona-slug={content.slug}
        data-intake-persona={content.intakePersona}
      >
        <section aria-labelledby="persona-hero-headline">
          <p className="mz-eyebrow">{content.hero.eyebrow}</p>
          <h1 id="persona-hero-headline" className="mz-h1" style={{ marginTop: 14, maxWidth: 760 }}>
            {content.hero.headline}
          </h1>
          <p className="mz-lede" style={{ marginTop: 16, maxWidth: 640 }}>
            {content.hero.subhead}
          </p>
          <div style={{ marginTop: 24 }}>
            <Link href={ctaHref} className="mz-btn" data-testid="persona-hero-cta">
              {content.cta.button}
            </Link>
          </div>
        </section>

        <section aria-labelledby="persona-value-props" data-testid="persona-value-props" className="mt-16">
          <h2 id="persona-value-props" className="mz-eyebrow">
            What changes for you
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {content.valueProps.map((prop) => (
              <li
                key={prop.title}
                className="mz-interactive flex flex-col gap-2 rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-5 py-5"
              >
                <h3 className="text-[15px] font-semibold leading-snug text-[var(--vt-text-primary)]">
                  {prop.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                  {prop.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="persona-flow" data-testid="persona-flow" className="mt-16">
          <h2 id="persona-flow" className="mz-eyebrow">
            How VitalCV fits your flow
          </h2>
          <ol className="mt-5 border-y border-[var(--vt-border-subtle)]">
            {content.flow.map((step, i) => (
              <li
                key={step.step}
                className={`flex gap-4 py-4 ${i > 0 ? 'border-t border-[var(--vt-border-subtle)]' : ''}`}
              >
                <span className="mz-mono shrink-0 text-[13px] font-semibold text-[var(--vt-text-muted)]" style={{ minWidth: 24 }}>
                  {step.step}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold leading-snug text-[var(--vt-text-primary)]">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="persona-cta"
          className="mz-card mt-16"
          style={{ padding: '28px' }}
          data-testid="persona-cta-section"
        >
          <h2 id="persona-cta" className="mz-h2">
            {content.cta.headline}
          </h2>
          <p className="mz-body" style={{ marginTop: 8 }}>
            {content.cta.body}
          </p>
          <div style={{ marginTop: 20 }}>
            <Link href={ctaHref} className="mz-btn" data-testid="persona-footer-cta">
              {content.cta.button}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
