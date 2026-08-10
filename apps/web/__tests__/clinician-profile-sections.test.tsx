/**
 * Wave LIVE-100B — clinician profile + knowledge trust graph tests.
 *
 * Covers:
 *   - all sixteen profile sections render
 *   - every section has a provenance badge
 *   - VERIFIED is reserved for source-of-record fields (NPPES identity,
 *     primary-source licensure)
 *   - USER_ENTERED is used for med school, residency, fellowship
 *   - INFERRED is used for research / publications
 *   - UNKNOWN is used for missing values
 *   - no banned overclaim strings in any render
 */

import * as React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClinicianProfileSections } from '../components/profile/ClinicianProfileSections';
import { PROVENANCE_META, normalizeFieldProvenance } from '../lib/profile/provenance';
import type { PassportData } from '../lib/trust/passport-contract';
import { buildPassport } from './fixtures/passport';

const BANNED = [
  'fully verified',
  'blockchain verified',
  'wallet ready',
  'guaranteed',
  'instant hire',
  'complete credentialing',
  'nppes verified license',
  'board certified',
] as const;

function assertNoBanned(html: string): void {
  const lower = html.toLowerCase();
  for (const phrase of BANNED) {
    expect(lower).not.toContain(phrase);
  }
}


describe('ClinicianProfileSections', () => {
  it('renders all 16 profile sections', () => {
    const html = renderToStaticMarkup(
      <ClinicianProfileSections passport={buildPassport()} />,
    );
    const expected = [
      'identity',
      'contact',
      'locations',
      'specialty',
      'subspecialty',
      'medical-school',
      'residency',
      'fellowship',
      'board-certifications',
      'licenses',
      'work-history',
      'affiliations',
      'research',
      'publications',
      'documents',
      'career-goals',
    ];
    for (const id of expected) {
      expect(html).toContain(`data-testid="profile-section-${id}"`);
    }
  });

  it('reserves VERIFIED for NPPES identity + primary-source licensure', () => {
    const html = renderToStaticMarkup(
      <ClinicianProfileSections passport={buildPassport()} />,
    );
    // Identity section has VERIFIED badges.
    expect(html).toMatch(/profile-section-identity[\s\S]*?data-provenance="VERIFIED"/);
    // Primary-source licensure is VERIFIED.
    expect(html).toMatch(/profile-section-licenses[\s\S]*?data-provenance="VERIFIED"/);
    // User-entered board certification does NOT get VERIFIED.
    const boardBlock = html.match(/profile-section-board-certifications[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(boardBlock).not.toContain('data-provenance="VERIFIED"');
    expect(boardBlock).toContain('data-provenance="USER_ENTERED"');
  });

  it('marks residency / fellowship / medical-school as USER_ENTERED', () => {
    const html = renderToStaticMarkup(
      <ClinicianProfileSections
        passport={buildPassport()}
        extended={{
          medicalSchool: { institutionName: 'UCSF School of Medicine', degree: 'MD', graduationYear: 2015 },
        }}
      />,
    );
    for (const id of ['medical-school', 'residency', 'fellowship']) {
      const block = html.match(new RegExp(`profile-section-${id}[\\s\\S]*?</section>`))?.[0] ?? '';
      expect(block).not.toContain('data-provenance="VERIFIED"');
      expect(block).toContain('data-provenance="USER_ENTERED"');
    }
  });

  it('marks research / publications as INFERRED when populated', () => {
    const html = renderToStaticMarkup(
      <ClinicianProfileSections
        passport={buildPassport()}
        extended={{
          researchSummary: 'Focus on care-transitions outcomes.',
          publicationsCount: 12,
        }}
      />,
    );
    const research = html.match(/profile-section-research[\s\S]*?<\/section>/)?.[0] ?? '';
    const pubs = html.match(/profile-section-publications[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(research).toContain('data-provenance="INFERRED"');
    expect(pubs).toContain('data-provenance="INFERRED"');
    expect(research).not.toContain('data-provenance="VERIFIED"');
  });

  it('falls back to UNKNOWN for missing values regardless of claimed provenance', () => {
    expect(normalizeFieldProvenance(null, 'VERIFIED')).toEqual({
      display: 'Unknown',
      provenance: 'UNKNOWN',
    });

    const html = renderToStaticMarkup(
      <ClinicianProfileSections passport={buildPassport()} />,
    );
    // Contact section has no extended data; every row should be UNKNOWN.
    const contact = html.match(/profile-section-contact[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(contact).toContain('Unknown');
    expect(contact).toContain('data-provenance="UNKNOWN"');
    expect(contact).not.toContain('data-provenance="VERIFIED"');
  });

  it('keeps conflict provenance visible and neutral unknown copy explicit', () => {
    expect(PROVENANCE_META.CONFLICT.label).toBe('Conflict');
    expect(PROVENANCE_META.CONFLICT.description).toContain('sources disagree');
    expect(PROVENANCE_META.UNKNOWN.description).toContain('Neutral');
  });

  it('never emits a banned overclaim string', () => {
    const html = renderToStaticMarkup(
      <ClinicianProfileSections passport={buildPassport()} />,
    );
    assertNoBanned(html);
  });
});

describe('LIVE-100B source copy guard', () => {
  const sourceFiles = [
    'app/page.tsx',
    // /passport retired 2026-08-07 — its surviving redirect stub carries no
    // copy; the guest record surface it pointed to is swept via GetReadySurface.
    'app/passport/page.tsx',
    'app/get-ready/GetReadySurface.tsx',
    'app/p/[slug]/page.tsx',
    'app/holder/readiness/ReadinessSurface.tsx',
    'components/profile/ClinicianProfileSections.tsx',
    'components/trust/TrustGraphXRay.tsx',
    'components/knowledge/KnowledgeExplorer.tsx',
    'components/trust-state/SourceProvenanceDrawer.tsx',
    'components/motion/FloatingCredentials.tsx',
    // components/sandbox/ was deleted 2026-08-07 as dead code (no importers
    // outside this guard since SandboxApp lost its route) — entry dropped, not
    // replaced: the sandbox surface has no successor to sweep.
    'components/explore/ApplyModal.tsx',
    'lib/trust/passport-truth.ts',
    'lib/trust/homepage-public-truth.ts',
    'components/marketing/BentoGrid.tsx',
  ];

  it('keeps visible profile, trust, graph, and CTA copy free of banned overclaims', () => {
    for (const relativePath of sourceFiles) {
      const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
      assertNoBanned(source);
      expect(source).not.toMatch(/license\s+(checked|verified)\s+via\s+NPPES/i);
      expect(source).not.toMatch(/No license attached in NPPES/i);
      expect(source).not.toMatch(/instantly verify[^.]*credentialing status/i);
    }
  });
});
