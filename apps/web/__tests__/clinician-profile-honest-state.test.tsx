import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import ClinicianProfilePage from '../app/clinician/profile/page';

const BANNED_PHRASES = [
  /automatically verified/i,
  /guaranteed verification/i,
  /\bcomplete credentialing\b/i,
  /instant credentialing/i,
  /legally accepted/i,
  /risk transferred/i,
  /HIPAA compliant/i,
  /SOC ?2 certified/i,
  /NCQA certified/i,
  /certified compliant/i,
  /final verification without review/i,
  /source confirmed before response/i,
];

function renderPage(): string {
  return renderToStaticMarkup(React.createElement(ClinicianProfilePage));
}

describe('/clinician/profile — honest preview state', () => {
  it('renders the preview-only banner with the canonical copy', () => {
    const html = renderPage();
    expect(html).toContain('Preview only');
    expect(html).toContain(
      'Profile editing is not enabled on this preview page yet. Use onboarding to start a readiness preview.',
    );
    expect(html).toContain('data-testid="clinician-profile-preview-banner"');
  });

  it('links to /clinician/onboarding', () => {
    const html = renderPage();
    expect(html).toContain('href="/clinician/onboarding"');
    expect(html).toContain('data-testid="clinician-profile-onboarding-link"');
  });

  it('renders zero input / textarea / select / button elements (no fake editable chrome)', () => {
    const html = renderPage();
    // Use word-boundary regex so attribute names like `data-testid="..."`
    // that happen to contain the substring "input" do not cause false
    // positives (none exist today, but the test should stay honest).
    expect(html).not.toMatch(/<input\b/i);
    expect(html).not.toMatch(/<textarea\b/i);
    expect(html).not.toMatch(/<select\b/i);
    expect(html).not.toMatch(/<button\b/i);
  });

  it('does not render a submit handler hint or saved-state language', () => {
    const html = renderPage();
    expect(html).not.toMatch(/\bSave\b/);
    expect(html).not.toMatch(/\bSubmit\b/);
    expect(html).not.toMatch(/Saved/i);
    expect(html).not.toMatch(/localStorage/i);
    // No "ships next week" / "coming soon" launch-date promises.
    expect(html).not.toMatch(/(launch date|ships next|coming soon|by end of|next quarter)/i);
  });

  it('renders display rows for every planned field (provenance + description preserved)', () => {
    const html = renderPage();
    // Spot-check a few known field labels to confirm the page still
    // enumerates the planned profile sections.
    expect(html).toContain('Legal name');
    expect(html).toContain('Primary email');
    expect(html).toContain('Specialty and subspecialty');
    // Display rows are tagged for assertion.
    expect(html).toMatch(/data-testid="clinician-profile-field-row"/);
  });

  it('contains no banned phrases', () => {
    const html = renderPage();
    for (const re of BANNED_PHRASES) {
      expect(html, `page contains banned phrase ${re}`).not.toMatch(re);
    }
  });

  it('contains no bare-Verified label or JSX text content', () => {
    const html = renderPage();
    expect(html).not.toMatch(/(label|status)\s*[:=]\s*['"]Verified['"]/);
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });
});
