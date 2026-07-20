/**
 * career-evidence-field-a11y.test.tsx — VHS fast-follow.
 *
 * The hero's Career Evidence Field is decorative, but its honest source-state
 * legend must NOT be hidden from assistive tech (VHS-1 §7: the field's meaning
 * lives in nearby semantic HTML). Guards that only the decorative visual layer
 * is aria-hidden and the legend stays exposed.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { CareerEvidenceField } from '@/components/home/CareerEvidenceField';
import { FIELD_ANCHORS } from '@/components/home/evidence-field/model';

const html = () => renderToStaticMarkup(<CareerEvidenceField />);

describe('CareerEvidenceField — legend is exposed to assistive tech', () => {
  it('does not aria-hide the whole field wrapper', () => {
    const wrapper = html().match(/<div[^>]*data-home-evidence-field[^>]*>/)?.[0] ?? '';
    expect(wrapper, 'field wrapper renders').toBeTruthy();
    expect(wrapper).not.toContain('aria-hidden');
  });

  it('exposes the honest source-state legend with a label', () => {
    const out = html();
    expect(out).toContain('data-field-legend');
    expect(out).toMatch(/aria-label="Evidence states[^"]*"/);
    for (const label of ['Source-backed', 'Checked', 'Access required', 'Employer decision']) {
      expect(out).toContain(label);
    }
  });

  it('keeps the decorative poster + canvas layer aria-hidden', () => {
    const out = html();
    expect(out).toContain('data-field-poster');
    // a decorative aria-hidden layer wraps the visual (poster/canvas)
    expect(out).toContain('aria-hidden="true"');
  });
});

describe('CareerEvidenceField — visible designed baseline (HERO-RESET-1)', () => {
  it('names the three real public sources and the abstract roles via the shared overlay', () => {
    const out = html();
    for (const id of ['nppes', 'oig-leie', 'pecos', 'record', 'opportunity']) {
      expect(out).toContain(`data-field-label="${id}"`);
    }
    for (const label of ['NPPES', 'OIG / LEIE', 'PECOS', 'Your career record', 'Opportunity']) {
      expect(out).toContain(label);
    }
    // The overlay is rendered OUTSIDE the tier switch, so it exists in SSR —
    // meaning no tier (static, canvas2d, webgpu) can drop the names.
    expect(out).toContain('data-field-labels');
  });

  it('renders exactly one bounded employer-decision ring in the static poster', () => {
    expect(html().split('data-poster-ring').length - 1).toBe(1);
  });

  it('poster uses responsive percentage geometry, never a cropped viewBox', () => {
    const out = html();
    const poster = out.match(/<svg[^>]*data-field-poster[^>]*>/)?.[0] ?? '';
    expect(poster, 'poster svg renders').toBeTruthy();
    // The old `viewBox` + `slice` cropped ~40% of the composition out of the
    // tall desktop panel — the "present but invisible" failure. Percentage
    // coordinates keep every anchor on screen at any panel aspect.
    expect(poster).not.toContain('viewBox');
    expect(out).toContain('cx="10.00%"'); // the NPPES station, in-pane at any aspect
  });

  it('every named anchor sits safely inside the panel at any aspect ratio', () => {
    for (const anchor of FIELD_ANCHORS) {
      expect(anchor.x, `${anchor.id} x`).toBeGreaterThanOrEqual(0.05);
      expect(anchor.x, `${anchor.id} x`).toBeLessThanOrEqual(0.95);
      expect(anchor.y, `${anchor.id} y`).toBeGreaterThanOrEqual(0.05);
      expect(anchor.y, `${anchor.id} y`).toBeLessThanOrEqual(0.95);
    }
  });

  it('labels never fabricate people, employers, or outcomes', () => {
    const allowed = new Set(['NPPES', 'OIG / LEIE', 'PECOS', 'Your career record', 'Opportunity']);
    for (const anchor of FIELD_ANCHORS) {
      expect(allowed.has(anchor.label), `unexpected label "${anchor.label}"`).toBe(true);
    }
  });

  it('tells assistive tech the composition is illustrative structure', () => {
    const out = html();
    expect(out).toContain('Named public sources shown: NPPES, OIG/LEIE, and PECOS');
    expect(out).toContain('no real people or employers');
  });
});
