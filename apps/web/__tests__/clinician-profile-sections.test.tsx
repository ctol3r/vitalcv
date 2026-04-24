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
 *   - KnowledgeTrustGraphPanel renders all 9 nodes and honest copy rules
 *   - no banned overclaim strings in any render
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClinicianProfileSections } from '../components/profile/ClinicianProfileSections';
import { KnowledgeTrustGraphPanel } from '../components/trust/KnowledgeTrustGraphPanel';
import type { PassportData } from '../lib/trust/passport-contract';

const BANNED = [
  'blockchain verified',
  'wallet ready',
  'fully verified',
  'guaranteed',
  'instant hire',
  'legally accepted',
  'risk transferred',
  'complete credentialing',
  'on-chain proof',
  'zero-touch credentialing',
] as const;

function assertNoBanned(html: string): void {
  const lower = html.toLowerCase();
  for (const phrase of BANNED) {
    expect(lower).not.toContain(phrase);
  }
}

function buildPassport(): PassportData {
  return {
    entityId: 'entity_test',
    npi: '1234567890',
    identity: {
      displayName: 'Dr. Test Clinician',
      specialty: 'Internal Medicine',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: {
      credentials: [
        {
          id: 'lic-1',
          domain: 'LICENSURE',
          type: 'STATE_LICENSE',
          status: 'ACTIVE',
          verificationLevel: 'PRIMARY_SOURCE',
          jurisdiction: 'CA',
          expiresAt: '2027-12-31',
          stale: false,
          confidenceLabel: 'HIGH',
          claimConfidenceLabel: 'HIGH',
          dataFreshness: 'CURRENT',
          dataFreshnessLabel: 'Current',
          reviewRequired: false,
          statusLabel: 'Active',
        },
        {
          id: 'board-1',
          domain: 'BOARD_CERTIFICATION',
          type: 'ABIM',
          status: 'ACTIVE',
          verificationLevel: 'USER_ENTERED',
          issuerName: 'ABIM',
          expiresAt: '2028-06-30',
          stale: false,
          confidenceLabel: 'MEDIUM',
          claimConfidenceLabel: 'MEDIUM',
          dataFreshness: 'CURRENT',
          dataFreshnessLabel: 'Current',
          reviewRequired: false,
          statusLabel: 'Active (self-reported)',
        },
      ],
      summary: { active: 2, expired: 0, stale: 0, missing: [] },
    },
    training: {
      records: [
        {
          id: 'res-1',
          recordType: 'RESIDENCY',
          programName: 'UCSF Internal Medicine',
          specialty: 'Internal Medicine',
          institutionName: 'UCSF',
          endYear: 2018,
          completed: true,
          verificationLevel: 'USER_ENTERED',
        },
        {
          id: 'fel-1',
          recordType: 'FELLOWSHIP',
          programName: 'Stanford Hospitalist Fellowship',
          specialty: 'Hospital Medicine',
          institutionName: 'Stanford',
          endYear: 2019,
          completed: true,
          verificationLevel: 'USER_ENTERED',
        },
      ],
      hasDegree: true,
      degreeVerified: false,
      hasResidency: true,
      fellowshipCount: 1,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS public',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: null,
      negativeFindings: [],
    },
    readiness: {
      status: 'READY',
      score: 90,
      readiness_score: 90,
      level: 'L3',
      blockers: [],
      gaps: [],
      estimatedStartDays: 5,
      nextActions: [],
    },
    sources: { checked: [], lastFetch: {} },
    sourceCoverage: { checks: [], summary: {} } as unknown as PassportData['sourceCoverage'],
    trustPosture: {
      freshness: { state: 'current', label: 'Current', items: [] },
    } as unknown as PassportData['trustPosture'],
    lastCheckedAt: '2026-04-24T00:00:00.000Z',
  } as PassportData;
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
    const html = renderToStaticMarkup(
      <ClinicianProfileSections passport={buildPassport()} />,
    );
    // Contact section has no extended data; every row should be UNKNOWN.
    const contact = html.match(/profile-section-contact[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(contact).toContain('data-provenance="UNKNOWN"');
    expect(contact).not.toContain('data-provenance="VERIFIED"');
  });

  it('never emits a banned overclaim string', () => {
    const html = renderToStaticMarkup(
      <ClinicianProfileSections passport={buildPassport()} />,
    );
    assertNoBanned(html);
  });
});

describe('KnowledgeTrustGraphPanel', () => {
  it('renders all 9 nodes in order', () => {
    const html = renderToStaticMarkup(<KnowledgeTrustGraphPanel />);
    for (const key of [
      'clinician',
      'npi',
      'claims',
      'sources',
      'receipts',
      'passport',
      'proofPack',
      'employerReview',
      'auditEvents',
    ]) {
      expect(html).toContain(`data-testid="ktg-node-${key}"`);
    }
  });

  it('surfaces all four copy rules', () => {
    const html = renderToStaticMarkup(<KnowledgeTrustGraphPanel />);
    expect(html).toContain('CRS is derived from evidence, not evidence itself.');
    expect(html).toContain('The trust container does not upgrade proof tier.');
    expect(html).toContain('Audit events prove action history, not clinical truth.');
    expect(html).toContain('Partial proof stays partial.');
  });

  it('never emits a banned overclaim string', () => {
    const html = renderToStaticMarkup(<KnowledgeTrustGraphPanel expanded />);
    assertNoBanned(html);
  });
});
