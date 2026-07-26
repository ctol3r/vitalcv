/**
 * provider-reference-data.test.ts — the taxonomy/credential decode layer.
 *
 * These tables are what turn a bare NPPES payload into a readable provider
 * record. Two failure modes matter and are pinned here:
 *
 *   1. Silent regression in the generated tables. If a regeneration drops
 *      rows or changes column meaning, specialty labels quietly go blank on
 *      every profile. The reference NPI's expected decode is asserted
 *      literally.
 *
 *   2. Guessing. An unrecognised credential must render as unknown, never as
 *      a plausible expansion — the credential string is self-reported to CMS
 *      and unverified, so inventing meaning for it would manufacture a claim.
 *
 * Truth contract: nothing here asserts a provider HOLDS a credential or
 * licence. It asserts only that we label self-reported text correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  describeTaxonomy,
  describeTaxonomies,
  selfReportedLicenseStates,
  TAXONOMY_LICENSE_PROVENANCE_NOTE,
} from '@/lib/reference/taxonomy';
import {
  decodeCredential,
  CREDENTIAL_PROVENANCE_NOTE,
} from '@/lib/reference/credentials';
import { NUCC_TAXONOMY } from '@/lib/reference/nucc-taxonomy.generated';
import { MEDICARE_CROSSWALK } from '@/lib/reference/medicare-crosswalk.generated';

describe('generated reference tables', () => {
  it('carries the full NUCC code set, not a truncated slice', () => {
    // 883 in NUCC 25.1. A regeneration that silently truncates would show up
    // here long before it showed up as a blank specialty on a profile.
    expect(NUCC_TAXONOMY.size).toBeGreaterThan(800);
  });

  it('carries the Medicare crosswalk', () => {
    expect(MEDICARE_CROSSWALK.size).toBeGreaterThan(400);
  });
});

describe('describeTaxonomy', () => {
  it('resolves the reference NPI taxonomy to its full NUCC hierarchy', () => {
    const t = describeTaxonomy({
      code: '363A00000X',
      desc: 'Physician Assistant',
      primary: true,
    });

    expect(t.grouping).toBe(
      'Physician Assistants & Advanced Practice Nursing Providers',
    );
    expect(t.classification).toBe('Physician Assistant');
    expect(t.specialization).toBe('');
    expect(t.section).toBe('Individual');
    expect(t.definition.length).toBeGreaterThan(0);
  });

  it('maps a taxonomy to its CMS Medicare specialty code', () => {
    const t = describeTaxonomy({ code: '363A00000X', primary: true });
    expect(t.medicareSpecialties).toEqual([
      { specialtyCode: '97', description: 'Physician Assistant' },
    ]);
  });

  it('preserves EVERY Medicare mapping when a code maps to several', () => {
    // Vascular surgery legitimately maps to three Medicare specialties.
    // Collapsing to the first would drop two real classifications.
    const t = describeTaxonomy({ code: '2086S0129X', primary: true });
    const codes = t.medicareSpecialties.map((m) => m.specialtyCode);
    expect(codes).toEqual(['02', '76', '77']);
  });

  it('returns an empty list for taxonomies that are not Medicare enrollable', () => {
    // 424 of the 883 NUCC codes are absent from the crosswalk — Integrative
    // Medicine Physician among them. Empty is the correct answer and must not
    // be confused with an error or rendered as a zero.
    const t = describeTaxonomy({ code: '202D00000X', primary: true });
    expect(t.nucc).not.toBeNull(); // the code IS a real NUCC taxonomy...
    expect(t.medicareSpecialties).toEqual([]); // ...it just isn't enrollable
  });

  it('degrades gracefully on a code absent from the current NUCC vintage', () => {
    const t = describeTaxonomy({ code: '999X99999X', desc: 'Retired Thing' });
    expect(t.nucc).toBeNull();
    expect(t.grouping).toBe('');
    // Falls back to what CMS said rather than blanking the specialty.
    expect(t.displayName).toBe('Retired Thing');
  });

  it('sorts the primary taxonomy first regardless of NPPES ordering', () => {
    const sorted = describeTaxonomies([
      { code: '207R00000X', desc: 'Internal Medicine', primary: false },
      { code: '208M00000X', desc: 'Hospitalist', primary: true },
    ]);
    expect(sorted[0].code).toBe('208M00000X');
    expect(sorted[0].primary).toBe(true);
  });
});

describe('selfReportedLicenseStates', () => {
  const multiState = describeTaxonomies([
    { code: '207R00000X', primary: false, license: 'D0000290', state: 'MD' },
    { code: '207R00000X', primary: false, license: '0101254037', state: 'VA' },
    { code: '208M00000X', primary: true, license: 'MD600003480', state: 'DC' },
  ]);

  it('collects the distinct states a licence number was reported under', () => {
    expect(selfReportedLicenseStates(multiState)).toEqual(['DC', 'MD', 'VA']);
  });

  it('ignores a taxonomy row carrying a state but no licence number', () => {
    // A state with no number is not a licence claim, so it must not appear.
    const withBareState = describeTaxonomies([
      { code: '207R00000X', primary: true, license: '', state: 'CA' },
    ]);
    expect(selfReportedLicenseStates(withBareState)).toEqual([]);
  });
});

describe('decodeCredential', () => {
  it('expands a hyphenated credential the way the abbreviation is used', () => {
    const d = decodeCredential('PA-C');
    expect(d.tokens).toEqual([
      { raw: 'PA-C', expansion: 'Physician Assistant-Certified' },
    ]);
  });

  it('matches through punctuation without altering the displayed token', () => {
    const d = decodeCredential('M.D.');
    expect(d.tokens[0].raw).toBe('M.D.'); // shown exactly as written
    expect(d.tokens[0].expansion).toBe('Doctor of Medicine');
  });

  it('splits multi-credential strings on commas and slashes', () => {
    const d = decodeCredential('MSN/FNP-BC');
    expect(d.tokens.map((t) => t.raw)).toEqual(['MSN', 'FNP-BC']);
    expect(d.tokens[1].expansion).toBe(
      'Family Nurse Practitioner-Board Certified',
    );
  });

  it('never guesses an unrecognised credential', () => {
    const d = decodeCredential('DO, FACC');
    expect(d.tokens[0].expansion).toBe('Doctor of Osteopathic Medicine');
    // FACC is a fellowship designation we do not carry — it must stay null
    // rather than resolve to something plausible-looking.
    expect(d.tokens[1].raw).toBe('FACC');
    expect(d.tokens[1].expansion).toBeNull();
  });

  it('reports anyRecognized false when nothing resolves', () => {
    const d = decodeCredential('XYZQ');
    expect(d.anyRecognized).toBe(false);
    expect(d.tokens[0].expansion).toBeNull();
  });

  it('handles an absent credential without inventing one', () => {
    for (const empty of ['', '   ', null, undefined]) {
      const d = decodeCredential(empty);
      expect(d.tokens).toEqual([]);
      expect(d.anyRecognized).toBe(false);
    }
  });
});

describe('provenance notes', () => {
  // These strings are the guardrail against a rich display reading as
  // verification. If a surface renders decoded credentials or licence
  // numbers, it must render the matching note.
  it('state that the underlying data is self-reported and unchecked', () => {
    expect(CREDENTIAL_PROVENANCE_NOTE).toMatch(/self-reported/i);
    expect(CREDENTIAL_PROVENANCE_NOTE).toMatch(/not checked/i);
    expect(TAXONOMY_LICENSE_PROVENANCE_NOTE).toMatch(/self-reported/i);
    expect(TAXONOMY_LICENSE_PROVENANCE_NOTE).toMatch(/no status/i);
  });

  it('never claim verification', () => {
    const banned = [
      'automatically verified',
      'guaranteed verification',
      'legally accepted',
      'source confirmed before response',
    ];
    for (const note of [
      CREDENTIAL_PROVENANCE_NOTE,
      TAXONOMY_LICENSE_PROVENANCE_NOTE,
    ]) {
      for (const phrase of banned) {
        expect(note.toLowerCase()).not.toContain(phrase);
      }
    }
  });
});
