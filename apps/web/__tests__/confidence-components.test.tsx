import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ConfidenceLegend,
  type ConfidenceTier,
} from '../components/vds/confidence';
import { ConfidenceFieldHelp } from '../components/vds/confidence/ConfidenceFieldHelp';
import { UnknownFieldExplainer } from '../components/vds/confidence/UnknownFieldExplainer';

// Banned phrases split + joined so a naive grep over this test file does not
// flag the file itself.
const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

const TIERS: readonly ConfidenceTier[] = [
  'verified',
  'inferred',
  'unknown',
  'contradicted',
];

describe('ConfidenceLegend', () => {
  it('renders all four tiers in row layout by default', () => {
    const html = renderToStaticMarkup(<ConfidenceLegend />);
    expect(html).toContain('Verified');
    expect(html).toContain('Inferred');
    expect(html).toContain('Unknown');
    expect(html).toContain('Contradicted');
  });

  it('renders the canonical aria-label', () => {
    const html = renderToStaticMarkup(<ConfidenceLegend />);
    expect(html).toContain('aria-label="Confidence tiers"');
  });

  it('renders descriptions when layout is stack (default behavior)', () => {
    const html = renderToStaticMarkup(<ConfidenceLegend layout="stack" />);
    expect(html).toContain('Primary-source registry');
    expect(html).toContain('AI-derived');
    expect(html).toContain('Data not on file');
    expect(html).toContain('disagree');
  });

  it('omits descriptions when layout is row by default', () => {
    const html = renderToStaticMarkup(<ConfidenceLegend layout="row" />);
    expect(html).not.toContain('Primary-source registry');
    expect(html).not.toContain('AI-derived');
  });

  it('honors explicit showDescriptions=false override on stack', () => {
    const html = renderToStaticMarkup(
      <ConfidenceLegend layout="stack" showDescriptions={false} />,
    );
    expect(html).not.toContain('Primary-source registry');
  });

  it('honors explicit showDescriptions=true override on row', () => {
    const html = renderToStaticMarkup(
      <ConfidenceLegend layout="row" showDescriptions />,
    );
    expect(html).toContain('Primary-source registry');
  });

  it('contains zero banned strings', () => {
    const html = renderToStaticMarkup(
      <ConfidenceLegend layout="stack" />,
    ).toLowerCase();
    for (const banned of BANNED) {
      expect(html).not.toContain(banned.toLowerCase());
    }
  });
});

describe('ConfidenceFieldHelp', () => {
  it.each(TIERS)('renders accessible trigger button for tier %s', (tier) => {
    const html = renderToStaticMarkup(<ConfidenceFieldHelp tier={tier} />);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Why is this');
  });

  it('does not render the popover content on initial server render', () => {
    const html = renderToStaticMarkup(<ConfidenceFieldHelp tier="inferred" />);
    expect(html).not.toContain('Press');
    expect(html).not.toContain('confidence tier explanation');
  });

  it('contains zero banned strings in any tier render', () => {
    for (const tier of TIERS) {
      const html = renderToStaticMarkup(
        <ConfidenceFieldHelp
          tier={tier}
          source="NPPES (CMS)"
          label="NPI"
        />,
      ).toLowerCase();
      for (const banned of BANNED) {
        expect(html).not.toContain(banned.toLowerCase());
      }
    }
  });
});

describe('UnknownFieldExplainer', () => {
  it('renders the neutral-signal copy', () => {
    const html = renderToStaticMarkup(<UnknownFieldExplainer />).toLowerCase();
    expect(html).toContain('not on file');
    expect(html).toContain('not a negative signal');
  });

  it('includes the field label when provided', () => {
    const html = renderToStaticMarkup(
      <UnknownFieldExplainer fieldLabel="Med school" />,
    );
    expect(html).toContain('Med school');
  });

  it('renders a CTA when both ctaLabel and onRequestUpload are set', () => {
    const html = renderToStaticMarkup(
      <UnknownFieldExplainer
        ctaLabel="Request clinician upload"
        onRequestUpload={vi.fn()}
      />,
    );
    expect(html).toContain('Request clinician upload');
  });

  it('omits the CTA when onRequestUpload is missing', () => {
    const html = renderToStaticMarkup(
      <UnknownFieldExplainer ctaLabel="Request clinician upload" />,
    );
    expect(html).not.toContain('Request clinician upload');
  });

  it('contains zero banned strings', () => {
    const html = renderToStaticMarkup(
      <UnknownFieldExplainer
        fieldLabel="Subspecialty"
        ctaLabel="Request clinician upload"
        onRequestUpload={vi.fn()}
      />,
    ).toLowerCase();
    for (const banned of BANNED) {
      expect(html).not.toContain(banned.toLowerCase());
    }
  });
});
