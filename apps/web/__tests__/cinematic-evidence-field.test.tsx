import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CinematicEvidenceField } from '@/components/home/cinematic/CinematicEvidenceField';

const html = renderToStaticMarkup(React.createElement(CinematicEvidenceField));

describe('cinematic evidence field', () => {
  it('is decorative and cannot be mistaken for a live source result', () => {
    expect(html).toContain('data-home-cinematic-field');
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/cinematic-evidence-field__source/g)?.length ?? 0).toBe(4);

    const lower = html.toLowerCase();
    for (const forbidden of [
      'verified',
      'available',
      'source-backed',
      'clear result',
      'live result',
      'ready score',
    ]) {
      expect(lower).not.toContain(forbidden);
    }
  });

  it('expresses the product model without fabricating a clinician', () => {
    expect(html).toContain('ONE NPI');
    expect(html).toContain('YOUR');
    expect(html).toContain('RECORD');
    expect(html).toContain('evidence gathers · permission travels · decisions stay human');
    expect(html).not.toMatch(/\bDr\.\s|\bMD\b|\bRN\b|\d+\s*%/);
  });

  it('ships a finite-motion, reduced-motion-safe stylesheet', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const css = readFileSync(join(__dirname, '..', 'styles', 'cinematic-home.css'), 'utf8');

    expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.cinematic-evidence-field');
    expect(css).toContain('.spine[data-enhanced] .spine-panel:not([hidden])');
    expect(css).not.toMatch(/animation[^;]*infinite/);
    expect(css).not.toContain('scroll-snap-type');
  });
});
