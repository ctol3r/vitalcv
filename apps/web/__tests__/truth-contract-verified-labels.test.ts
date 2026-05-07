/**
 * truth-contract-verified-labels.test.ts
 *
 * Wave Truth-1 — restoration test. Locks two assertions in place:
 *
 *   1. The two surfaces fixed in this PR no longer render bare
 *      `>Verified<` / `>VERIFIED<` text. Replacement labels
 *      (`Source-verified`, `Source-confirmed at`) carry semantic
 *      qualifiers per VITALCV_OPERATING_DOCTRINE.md §2.7.
 *
 *   2. CLAUDE.md banned strings remain absent from the two surfaces.
 *      Regression guard — the test fails if a future edit reintroduces
 *      any of the eleven banned phrases into the touched files.
 *
 * Test pattern: file-content scan via fs.readFileSync. No DOM render
 * needed — the violations are static text in source files. This keeps
 * the test fast and survives prop / state changes.
 *
 * Banned strings are split with `+` operator so this test file itself
 * does not contain a literal banned phrase that a CI banned-string
 * sweep would flag.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RESEARCH_PAGE = resolve(__dirname, '../app/clinician/research/page.tsx');
const WALLET_PASSPORT = resolve(__dirname, '../components/wallet/WalletPassport.tsx');

const TARGET_FILES = [
  { label: '/clinician/research', path: RESEARCH_PAGE },
  { label: 'WalletPassport (used by /holder)', path: WALLET_PASSPORT },
] as const;

describe('truth-contract: bare Verified / VERIFIED labels removed (Wave Truth-1)', () => {
  it('research page: <dt> reads "Source-verified", not bare "Verified"', () => {
    const src = readFileSync(RESEARCH_PAGE, 'utf-8');
    // The fixed wording must be present on the dt.
    expect(src).toMatch(/<dt[^>]*>Source-verified<\/dt>/);
    // The bare term in <dt> form must NOT be present.
    expect(src).not.toMatch(/<dt[^>]*>Verified<\/dt>/);
  });

  it('WalletPassport: heading reads "Source-confirmed at", not bare "Verified"', () => {
    const src = readFileSync(WALLET_PASSPORT, 'utf-8');
    // The fixed wording must be present.
    expect(src).toContain('>Source-confirmed at<');
    // The bare bare-status form must NOT be present as a rendered <p>.
    expect(src).not.toMatch(/className="[^"]*"\s*>Verified</);
  });
});

describe('truth-contract: no CLAUDE.md banned strings reintroduced (Wave Truth-1)', () => {
  // Split with `+` so the test file itself doesn't contain a literal
  // banned phrase. CI banned-string sweep will not flag this file.
  const BANNED_PHRASES: ReadonlyArray<string> = [
    'automatically' + ' verified',
    'guaranteed' + ' verification',
    'complete' + ' credentialing',
    'instant' + ' credentialing',
    'legally' + ' accepted',
    'risk' + ' transferred',
    'final verification' + ' without review',
    'source confirmed' + ' before response',
    'certified' + ' compliant',
    'HIPAA' + ' compliant',
    'SOC2' + ' certified',
    'NCQA' + ' certified',
  ];

  for (const target of TARGET_FILES) {
    it(`${target.label}: no banned phrase present`, () => {
      const src = readFileSync(target.path, 'utf-8').toLowerCase();
      for (const phrase of BANNED_PHRASES) {
        expect(
          src,
          `banned phrase reintroduced into ${target.label}: "${phrase}"`,
        ).not.toContain(phrase.toLowerCase());
      }
    });
  }
});

describe('truth-contract: semantic-label parallel preserved (Wave Truth-1)', () => {
  it('research page readiness grid keeps the four semantic categories with consistent qualifiers', () => {
    const src = readFileSync(RESEARCH_PAGE, 'utf-8');
    // The four parallel <dt> terms must all carry semantic qualifiers,
    // not bare status words. Names taken from the existing copy on main.
    const expectedTerms = [
      'Candidates',
      'Match pending review',
      'User-entered',
      'Source-verified',
    ];
    for (const term of expectedTerms) {
      expect(src, `readiness grid must surface "${term}" term`).toContain(`>${term}</dt>`);
    }
  });
});
