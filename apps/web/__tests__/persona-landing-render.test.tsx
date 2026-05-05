import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PersonaLandingPage } from '@/components/personas/PersonaLandingPage';
import { PERSONA_LANDING_PAGES } from '@/lib/personas/landingContent';

function renderFor(slug: string): string {
  const content = PERSONA_LANDING_PAGES.find((p) => p.slug === slug);
  if (!content) throw new Error(`unknown slug: ${slug}`);
  return renderToStaticMarkup(<PersonaLandingPage content={content} />);
}

describe.each(['cvo', 'payer', 'staffing-exchange'])(
  'PersonaLandingPage — %s',
  (slug) => {
    it('renders the persona-landing testid and the slug data attribute', () => {
      const html = renderFor(slug);
      expect(html).toContain('data-testid="persona-landing"');
      expect(html).toContain(`data-persona-slug="${slug}"`);
    });

    it('renders both CTA buttons pointing at /contact?persona=<intakePersona>', () => {
      const html = renderFor(slug);
      const content = PERSONA_LANDING_PAGES.find((p) => p.slug === slug)!;
      expect(html).toContain(`data-intake-persona="${content.intakePersona}"`);
      expect(html).toContain(`href="/contact?persona=${content.intakePersona}"`);
      expect(html).toContain('data-testid="persona-hero-cta"');
      expect(html).toContain('data-testid="persona-footer-cta"');
    });

    it('renders all three value-prop cards and all three flow steps', () => {
      const html = renderFor(slug);
      const content = PERSONA_LANDING_PAGES.find((p) => p.slug === slug)!;
      for (const prop of content.valueProps) {
        expect(html).toContain(prop.title);
      }
      for (const step of content.flow) {
        expect(html).toContain(step.title);
      }
    });

    it('renders the hero headline as an h1', () => {
      const html = renderFor(slug);
      const content = PERSONA_LANDING_PAGES.find((p) => p.slug === slug)!;
      expect(html).toMatch(
        new RegExp(`<h1[^>]*>${escapeRegex(content.hero.headline)}</h1>`),
      );
    });
  },
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
