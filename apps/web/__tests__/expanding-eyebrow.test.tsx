import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ExpandingEyebrow } from '@/components/home/ExpandingEyebrow';

describe('ExpandingEyebrow', () => {
  const render = () =>
    renderToStaticMarkup(
      <ExpandingEyebrow label="For clinicians" detail="Start with one NPI." />,
    );

  it('keeps its complete orientation cue in the server-rendered document', () => {
    const markup = render();

    expect(markup).toContain('For clinicians');
    expect(markup).toContain('Start with one NPI.');
  });

  it('uses a real keyboard-operable disclosure control', () => {
    const markup = render();

    expect(markup).toContain('<button');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls=');
  });

  it('does not turn editorial chrome into a trust claim', () => {
    expect(render().toLowerCase()).not.toMatch(/verified|cleared|approved|credentialed/);
  });
});
