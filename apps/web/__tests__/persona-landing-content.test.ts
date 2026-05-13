import { describe, expect, it } from 'vitest';

import {
  PERSONA_LANDING_PAGES,
  getPersonaLandingContent,
} from '@/lib/personas/landingContent';

const ALLOWED_INTAKE_PERSONAS = new Set([
  'cvo',
  'payer',
  'staffing_exchange',
  'health_system',
  'individual_clinician',
  'other',
]);

// Banned-phrase split-join constants per CLAUDE.md so a naive grep
// over this file does not flag it.
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

function gather(content: unknown): string {
  return JSON.stringify(content);
}

describe('PERSONA_LANDING_PAGES — registry shape', () => {
  it('has exactly the three Wave H2 personas in the expected order', () => {
    const slugs = PERSONA_LANDING_PAGES.map((p) => p.slug);
    expect(slugs).toEqual(['cvo', 'payer', 'staffing-exchange']);
  });

  it('every entry has all required fields', () => {
    for (const entry of PERSONA_LANDING_PAGES) {
      expect(entry.title).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.hero.eyebrow).toBeTruthy();
      expect(entry.hero.headline).toBeTruthy();
      expect(entry.hero.subhead).toBeTruthy();
      expect(entry.cta.button).toBeTruthy();
      expect(entry.cta.headline).toBeTruthy();
      expect(entry.valueProps.length).toBe(3);
      expect(entry.flow.length).toBe(3);
    }
  });

  it("every entry's intakePersona is a literal accepted by the validate helper", () => {
    for (const entry of PERSONA_LANDING_PAGES) {
      expect(ALLOWED_INTAKE_PERSONAS.has(entry.intakePersona)).toBe(true);
    }
  });
});

describe('PERSONA_LANDING_PAGES — copy compliance', () => {
  it.each(PERSONA_LANDING_PAGES.map((p) => [p.slug, p]))(
    '%s contains no banned phrases',
    (_slug, entry) => {
      const haystack = gather(entry).toLowerCase();
      for (const phrase of BANNED) {
        expect(haystack).not.toContain(phrase.toLowerCase());
      }
    },
  );

  it.each(PERSONA_LANDING_PAGES.map((p) => [p.slug, p]))(
    '%s does not use the bare "Verified" status label',
    (_slug, entry) => {
      // Reject the bare standalone word "Verified" used as a label.
      // Phrases like "verifications" or "source-verified" remain
      // allowed; this targets the exact bare label per CLAUDE.md.
      const text = gather(entry);
      expect(text).not.toMatch(/[\s">]Verified[\s"<,.]/);
    },
  );
});

describe('getPersonaLandingContent', () => {
  it('returns the entry by slug', () => {
    const cvo = getPersonaLandingContent('cvo');
    expect(cvo?.intakePersona).toBe('cvo');
    const payer = getPersonaLandingContent('payer');
    expect(payer?.intakePersona).toBe('payer');
    const staffing = getPersonaLandingContent('staffing-exchange');
    expect(staffing?.intakePersona).toBe('staffing_exchange');
  });

  it('returns undefined for an unknown slug', () => {
    expect(getPersonaLandingContent('unknown')).toBeUndefined();
    expect(getPersonaLandingContent('')).toBeUndefined();
  });
});
