/**
 * clinicianEnrichmentGraph.test.ts — Wave G0-G4 enrichment graph contract tests
 *
 * Tests cover:
 *   1. Enrichment edges are always decisionGrade=false (non-negotiable)
 *   2. Trust-core claim types are NOT mapped to enrichment edges
 *   3. G1 institutional edges: correct edge type, linkage method, confidence
 *   4. G3 publication edges: PMID-keyed, review_required when no corroboration
 *   5. G4 clinical trial edges: PI vs. investigator role distinction
 *   6. Edge deduplication by edgeId
 *   7. EnrichmentSummary counts are accurate
 *   8. Explainability: evidenceSummary is non-empty for every edge
 */


import {
  buildClinicianEnrichmentEdges,
  buildEnrichmentSummary,
} from '../../graph/clinicianEnrichmentGraph';
import type { NormalizedClaim } from '../evidenceModel';

const TEST_NPI = '1234567890';

function makeClaim(overrides: Partial<NormalizedClaim> & { claimType: NormalizedClaim['claimType']; value: NormalizedClaim['value'] }): NormalizedClaim {
  return {
    claimId: 'test-claim-id',
    subjectNpi: TEST_NPI,
    tier: 'GOLD',
    confidence: 'HIGH',
    confidenceScore: 0.9,
    sourceId: 'DOCTORS_CLINICIANS',
    artifactId: 'artifact-1',
    artifactChecksum: 'abc123',
    parserVersion: 'v1.0.0',
    derivedAt: '2026-01-01T00:00:00Z',
    observedAt: '2026-01-01T00:00:00Z',
    validFrom: null,
    validUntil: null,
    expiresAt: null,
    status: 'ACTIVE',
    supersededBy: null,
    supersedes: null,
    reviewRequired: false,
    reviewReason: null,
    humanReviewAt: null,
    ...overrides,
  };
}

// ── G0: Contract enforcement ──────────────────────────────────────────────────

describe('Wave G0: Enrichment edge contract', () => {
  it('all edges are always decisionGrade=false', () => {
    const claims = [
      makeClaim({
        claimType: 'INSTITUTION_AFFILIATION',
        value: {
          _type: 'GENERIC',
          institutionName: 'Mass General Hospital',
          institutionType: 'hospital',
          state: 'MA',
        } as unknown as NormalizedClaim['value'],
      }),
    ];
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, claims);
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.decisionGrade).toBe(false);
    }
  });

  it('every edge has a non-empty evidenceSummary', () => {
    const claims = [
      makeClaim({
        claimType: 'PUBLICATION',
        sourceId: 'OPENALEX',
        reviewRequired: true,
        value: {
          _type: 'GENERIC',
          pmid: '12345678',
          title: 'A Study of Things',
          year: 2023,
        } as unknown as NormalizedClaim['value'],
      }),
    ];
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, claims);
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.evidenceSummary.trim().length).toBeGreaterThan(10);
    }
  });

  it('every edge has a non-empty edgeId', () => {
    const claims = [
      makeClaim({
        claimType: 'CLINICAL_TRIAL',
        sourceId: 'CLINICAL_TRIALS',
        value: {
          _type: 'GENERIC',
          nctId: 'NCT01234567',
          title: 'Phase II Trial of Something',
          role: 'Principal Investigator',
        } as unknown as NormalizedClaim['value'],
      }),
    ];
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, claims);
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.edgeId.trim().length).toBeGreaterThan(0);
    }
  });
});

// ── Trust-core isolation ───────────────────────────────────────────────────────

describe('Trust-core claim types do NOT produce enrichment edges', () => {
  const trustCoreClaims: NormalizedClaim['claimType'][] = [
    'NPI_IDENTITY',
    'PERSONAL_IDENTITY',
    'ENROLLMENT_STATUS',
    'EXCLUSION_STATUS',
    'SANCTION_RECORD',
    'LICENSE',
    'NURSING_LICENSE',
    'BOARD_CERTIFICATION',
  ];

  for (const claimType of trustCoreClaims) {
    it(`claimType=${claimType} produces zero enrichment edges`, () => {
      const claim = makeClaim({
        claimType,
        value: { _type: 'GENERIC', placeholder: true } as unknown as NormalizedClaim['value'],
      });
      const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
      expect(edges).toHaveLength(0);
    });
  }
});

// ── G1: Institutional axis ─────────────────────────────────────────────────────

describe('Wave G1: CMS institutional edges', () => {
  it('maps INSTITUTION_AFFILIATION from DOCTORS_CLINICIANS → linked_verified', () => {
    const claim = makeClaim({
      claimType: 'INSTITUTION_AFFILIATION',
      sourceId: 'DOCTORS_CLINICIANS',
      value: {
        _type: 'GENERIC',
        institutionName: 'Stanford Health Care',
        ccn: '050696',
        state: 'CA',
        institutionType: 'hospital',
      } as unknown as NormalizedClaim['value'],
    });
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
    expect(edges).toHaveLength(1);
    const edge = edges[0];
    expect(edge.graphSourceType).toBe('cms_institutional');
    expect(edge.graphStatus).toBe('linked_verified');
    expect(edge.edgeType).toBe('AFFILIATED_WITH_HOSPITAL');
    expect(edge.reviewRequired).toBe(false);
    expect(edge.edgeConfidence).toBeGreaterThan(0.85);
  });

  it('maps GROUP_AFFILIATION → MEMBER_OF_GROUP_PRACTICE edge', () => {
    const claim = makeClaim({
      claimType: 'GROUP_AFFILIATION',
      sourceId: 'DOCTORS_CLINICIANS',
      value: {
        _type: 'GENERIC',
        groupName: 'Bay Area Medical Group',
        pacId: 'PAC123456',
      } as unknown as NormalizedClaim['value'],
    });
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
    expect(edges).toHaveLength(1);
    expect(edges[0].edgeType).toBe('MEMBER_OF_GROUP_PRACTICE');
    expect(edges[0].linkageMethod).toBe('npi_exact');
  });

  it('skips INSTITUTION_AFFILIATION claims missing institutionName', () => {
    const claim = makeClaim({
      claimType: 'INSTITUTION_AFFILIATION',
      value: {
        _type: 'GENERIC',
        ccn: '050696',
      } as unknown as NormalizedClaim['value'],
    });
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
    expect(edges).toHaveLength(0);
  });
});

// ── G3: Publication axis ──────────────────────────────────────────────────────

describe('Wave G3: Publication and bibliometric edges', () => {
  it('maps PUBLICATION with PMID → AUTHORED_PUBLICATION edge', () => {
    const claim = makeClaim({
      claimType: 'PUBLICATION',
      sourceId: 'OPENALEX',
      reviewRequired: true, // name-matched — not NPI-keyed
      value: {
        _type: 'GENERIC',
        pmid: '34567890',
        title: 'Novel Biomarkers in Cardiology',
        year: 2024,
      } as unknown as NormalizedClaim['value'],
    });
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
    expect(edges).toHaveLength(1);
    const edge = edges[0];
    expect(edge.edgeType).toBe('AUTHORED_PUBLICATION');
    expect(edge.graphSourceType).toBe('publication');
    expect(edge.objectNodeKey).toBe('34567890');
    expect(edge.reviewRequired).toBe(true);
    expect(edge.graphStatus).toBe('linked_inferred');
    expect(edge.decisionGrade).toBe(false);
  });

  it('skips PUBLICATION claims missing PMID', () => {
    const claim = makeClaim({
      claimType: 'PUBLICATION',
      sourceId: 'PUBMED',
      value: {
        _type: 'GENERIC',
        title: 'Article Without PMID',
        year: 2020,
      } as unknown as NormalizedClaim['value'],
    });
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
    expect(edges).toHaveLength(0);
  });

  it('marks ORCID-confirmed publications as linked_high_confidence', () => {
    const claim = makeClaim({
      claimType: 'PUBLICATION',
      sourceId: 'OPENALEX',
      reviewRequired: false,
      value: {
        _type: 'GENERIC',
        pmid: '11223344',
        title: 'ORCID-Verified Study',
        year: 2023,
        orcidConfirmed: true,
      } as unknown as NormalizedClaim['value'],
    });
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
    expect(edges[0].graphStatus).toBe('linked_high_confidence');
    expect(edges[0].linkageMethod).toBe('orcid_bridge');
  });
});

// ── G4: Clinical trials axis ──────────────────────────────────────────────────

describe('Wave G4: Clinical trial edges', () => {
  it('maps PI role → PI_OF_TRIAL with higher edgeStrength', () => {
    const claim = makeClaim({
      claimType: 'CLINICAL_TRIAL',
      sourceId: 'CLINICAL_TRIALS',
      value: {
        _type: 'GENERIC',
        nctId: 'NCT05678901',
        title: 'A Phase III Randomized Trial',
        role: 'Principal Investigator',
        status: 'Active, not recruiting',
      } as unknown as NormalizedClaim['value'],
    });
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
    expect(edges).toHaveLength(1);
    const edge = edges[0];
    expect(edge.edgeType).toBe('PI_OF_TRIAL');
    expect(edge.edgeStrength).toBe(0.85);
    expect(edge.linkageMethod).toBe('nct_bridge');
  });

  it('maps non-PI role → INVESTIGATOR_ON_TRIAL with lower edgeStrength', () => {
    const claim = makeClaim({
      claimType: 'CLINICAL_TRIAL',
      sourceId: 'CLINICAL_TRIALS',
      value: {
        _type: 'GENERIC',
        nctId: 'NCT05678902',
        title: 'Another Trial',
        role: 'Study Coordinator',
      } as unknown as NormalizedClaim['value'],
    });
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
    expect(edges[0].edgeType).toBe('INVESTIGATOR_ON_TRIAL');
    expect(edges[0].edgeStrength).toBe(0.6);
  });

  it('skips CLINICAL_TRIAL claims missing NCT ID', () => {
    const claim = makeClaim({
      claimType: 'CLINICAL_TRIAL',
      sourceId: 'CLINICAL_TRIALS',
      value: {
        _type: 'GENERIC',
        title: 'Trial Without NCT',
        role: 'PI',
      } as unknown as NormalizedClaim['value'],
    });
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, [claim]);
    expect(edges).toHaveLength(0);
  });
});

// ── Edge deduplication ────────────────────────────────────────────────────────

describe('Edge deduplication', () => {
  it('produces one edge for identical source+subject+object+type duplicates', () => {
    const val = {
      _type: 'GENERIC',
      pmid: '99999999',
      title: 'Duplicate Study',
      year: 2023,
    } as unknown as NormalizedClaim['value'];

    const claims = [
      makeClaim({ claimType: 'PUBLICATION', sourceId: 'OPENALEX', value: val }),
      makeClaim({ claimType: 'PUBLICATION', sourceId: 'OPENALEX', value: val }),
    ];
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, claims);
    expect(edges).toHaveLength(1);
  });
});

// ── Enrichment summary ────────────────────────────────────────────────────────

describe('buildEnrichmentSummary', () => {
  it('counts edges by graphSourceType', () => {
    const claims = [
      makeClaim({
        claimType: 'PUBLICATION',
        sourceId: 'OPENALEX',
        value: {
          _type: 'GENERIC',
          pmid: '11111111',
          title: 'Study A',
        } as unknown as NormalizedClaim['value'],
      }),
      makeClaim({
        claimType: 'PUBLICATION',
        sourceId: 'PUBMED',
        value: {
          _type: 'GENERIC',
          pmid: '22222222',
          title: 'Study B',
        } as unknown as NormalizedClaim['value'],
      }),
    ];
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, claims);
    const summary = buildEnrichmentSummary(TEST_NPI, edges);
    expect(summary.counts.publication).toBe(2);
    expect(summary.generatedAt).toBeTruthy();
  });

  it('hasVerifiedLinks=false when all edges are inferred', () => {
    const claims = [
      makeClaim({
        claimType: 'PUBLICATION',
        sourceId: 'OPENALEX',
        reviewRequired: true,
        value: {
          _type: 'GENERIC',
          pmid: '33333333',
          title: 'Inferred Pub',
        } as unknown as NormalizedClaim['value'],
      }),
    ];
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, claims);
    const summary = buildEnrichmentSummary(TEST_NPI, edges);
    expect(summary.hasVerifiedLinks).toBe(false);
  });

  it('summary.edges never contain decisionGrade=true', () => {
    const claims = [
      makeClaim({
        claimType: 'CLINICAL_TRIAL',
        sourceId: 'CLINICAL_TRIALS',
        value: {
          _type: 'GENERIC',
          nctId: 'NCT00000001',
          title: 'Safety Study',
          role: 'PI',
        } as unknown as NormalizedClaim['value'],
      }),
    ];
    const edges = buildClinicianEnrichmentEdges(TEST_NPI, claims);
    const summary = buildEnrichmentSummary(TEST_NPI, edges);
    for (const edge of summary.edges) {
      expect(edge.decisionGrade).toBe(false);
    }
  });
});
