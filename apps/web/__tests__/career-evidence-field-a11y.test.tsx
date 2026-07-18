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
