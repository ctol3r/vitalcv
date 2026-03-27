import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/motion/ScrollMotion', () => ({
  SectionReveal: ({ children }: { children: React.ReactNode }) => children,
}));

import { InterviewModeTeaser, TrustStrip } from '../components/home/PublicTruthSections';

describe('homepage public truth', () => {
  it('renders the canonical source contract without overstating unsupported coverage', () => {
    const markup = renderToStaticMarkup(<TrustStrip />);

    expect(markup).toContain('NPPES');
    expect(markup).toContain('OIG / LEIE');
    expect(markup).toContain('CMS PECOS');
    expect(markup).toContain('CA State Board / FSMB');
    expect(markup).toContain('Checked');
    expect(markup).toContain('Access required');
    expect(markup).toContain('Homepage preview starts with NPPES and OIG.');
    expect(markup).not.toContain('Verified');
  });

  it('keeps synthetic labels visible when the proof card uses synthetic data', () => {
    const markup = renderToStaticMarkup(<InterviewModeTeaser />);

    expect(markup).toContain('Synthetic preview');
    expect(markup).toContain('Synthetic layout');
    expect(markup).toContain('not live data');
    expect(markup).toContain('Preview only');
    expect(markup).toContain('Preview Passport Proof');
    expect(markup).toContain('Registry record only');
    expect(markup).toContain('Institutional access');
  });
});
