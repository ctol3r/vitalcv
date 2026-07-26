import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import { NppesLicensureCard } from '@/components/profile/NppesLicensureCard';
import { cleanDoximityUrl, parseSelfAttested } from '@/lib/clinician-profile/selfAttested';

function render(el: React.ReactElement): string {
  return renderToStaticMarkup(el);
}

describe('NppesLicensureCard', () => {
  it('lists each license number + state, self-reported, with NO status word', () => {
    const html = render(
      <NppesLicensureCard licenses={[{ state: 'CA', licenseNumber: 'G40046' }]} />,
    );
    expect(html).toContain('G40046 · CA');
    expect(html).toContain('Self-reported to NPPES');
    expect(html).toContain('not board-verified');
    // Must never assert a live license status label for a self-reported number.
    expect(html).not.toMatch(/\b(Active|Verified|Expired|Revoked|Suspended|Inactive)\b/);
  });

  it('renders a license with unknown state as just the number', () => {
    const html = render(<NppesLicensureCard licenses={[{ state: null, licenseNumber: 'X1' }]} />);
    expect(html).toContain('X1');
    expect(html).not.toContain('· null');
  });

  it('renders a validated Doximity link as a safe external anchor', () => {
    const html = render(
      <NppesLicensureCard
        licenses={[]}
        doximityUrl="https://www.doximity.com/profiles/jane-doe"
      />,
    );
    expect(html).toContain('https://www.doximity.com/profiles/jane-doe');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('Self-reported link');
  });

  it('renders nothing when there is neither a license nor a Doximity link', () => {
    const html = render(<NppesLicensureCard licenses={[]} doximityUrl={null} />);
    expect(html).toBe('');
  });
});

describe('cleanDoximityUrl (web) + parseSelfAttested', () => {
  it('accepts https doximity.com and rejects everything else', () => {
    expect(cleanDoximityUrl('https://www.doximity.com/profiles/x')).toBe(
      'https://www.doximity.com/profiles/x',
    );
    expect(cleanDoximityUrl('https://doximity.com/pub/x')).toBe('https://doximity.com/pub/x');
    expect(cleanDoximityUrl('https://doximity.com.evil.example/x')).toBeUndefined();
    expect(cleanDoximityUrl('http://www.doximity.com/x')).toBeUndefined();
    expect(cleanDoximityUrl('linkedin.com/in/x')).toBeUndefined();
    expect(cleanDoximityUrl('')).toBeUndefined();
  });

  it('parseSelfAttested keeps a valid doximityUrl and drops an invalid one', () => {
    expect(
      parseSelfAttested({ doximityUrl: 'https://doximity.com/pub/x' }).doximityUrl,
    ).toBe('https://doximity.com/pub/x');
    expect(parseSelfAttested({ doximityUrl: 'https://evil.example/x' }).doximityUrl).toBeUndefined();
  });
});
