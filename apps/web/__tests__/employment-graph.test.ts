import { describe, expect, it } from 'vitest';
import {
  buildEmploymentGraph,
  buildEmploymentGraphFromIdentityClaims,
  type EmploymentClaim,
} from '@/lib/intelligence/employment-graph';

describe('buildEmploymentGraph', () => {
  it('keeps multiple active employers, groups employers, and sorts current before history', () => {
    const claims: EmploymentClaim[] = [
      {
        id: 'claim-1',
        employerName: 'Mercy General',
        title: 'Hospitalist',
        department: 'Medicine',
        startDate: '2024-01-01',
        endDate: null,
        observedAt: '2026-04-10T12:00:00.000Z',
        confidenceScore: 0.94,
        sourceId: 'CA_HOSPITAL_DIRECTORY',
        tier: 'GOLD',
        reviewRequired: false,
        reviewReason: null,
        status: 'ACTIVE',
      },
      {
        id: 'claim-2',
        employerName: 'Pacific Telehealth',
        title: 'Telehospitalist',
        department: null,
        startDate: '2025-03-01',
        endDate: null,
        observedAt: '2026-04-09T12:00:00.000Z',
        confidenceScore: 0.88,
        sourceId: 'HOSPITAL_WEB_DIRECTORY',
        tier: 'SILVER',
        reviewRequired: false,
        reviewReason: null,
        status: 'ACTIVE',
      },
      {
        id: 'claim-3',
        employerName: 'Community Medical Center',
        title: 'Resident',
        department: null,
        startDate: '2020-07-01',
        endDate: '2023-06-30',
        observedAt: '2024-01-15T12:00:00.000Z',
        confidenceScore: 0.81,
        sourceId: 'ORCID',
        tier: 'BRONZE',
        reviewRequired: true,
        reviewReason: 'Derived from ORCID employment history.',
        status: 'EXPIRED',
      },
    ];

    const graph = buildEmploymentGraph(claims);

    expect(graph.currentEmployers.map((node) => node.employerName)).toEqual([
      'Pacific Telehealth',
      'Mercy General',
    ]);
    expect(graph.groupedEmployers.map((node) => node.employerName)).toEqual([
      'Pacific Telehealth',
      'Mercy General',
      'Community Medical Center',
    ]);
    expect(graph.groupedEmployers[0]?.current).toBe(true);
    expect(graph.groupedEmployers[2]?.current).toBe(false);
  });

  it('flags same-employer conflicts without treating multiple active employers as conflicts', () => {
    const graph = buildEmploymentGraph([
      {
        id: 'claim-1',
        employerName: 'Mercy General',
        title: 'Hospitalist',
        department: 'Medicine',
        startDate: '2024-01-01',
        endDate: null,
        observedAt: '2026-04-10T12:00:00.000Z',
        confidenceScore: 0.95,
        sourceId: 'CA_HOSPITAL_DIRECTORY',
        tier: 'GOLD',
        reviewRequired: false,
        reviewReason: null,
        status: 'ACTIVE',
      },
      {
        id: 'claim-2',
        employerName: 'Mercy General',
        title: 'Chief Hospitalist',
        department: 'Medicine',
        startDate: '2022-01-01',
        endDate: '2025-02-01',
        observedAt: '2026-04-08T12:00:00.000Z',
        confidenceScore: 0.84,
        sourceId: 'OPENALEX',
        tier: 'BRONZE',
        reviewRequired: true,
        reviewReason: 'Derived from author profile, not verified.',
        status: 'EXPIRED',
      },
      {
        id: 'claim-3',
        employerName: 'Mercy General',
        title: 'Hospitalist',
        department: 'Medicine',
        startDate: '2023-05-01',
        endDate: null,
        observedAt: '2026-04-09T12:00:00.000Z',
        confidenceScore: 0.9,
        sourceId: 'ORCID',
        tier: 'BRONZE',
        reviewRequired: true,
        reviewReason: 'Derived from ORCID employment history.',
        status: 'ACTIVE',
      },
      {
        id: 'claim-4',
        employerName: 'Pacific Telehealth',
        title: 'Consulting Physician',
        department: null,
        startDate: '2025-01-01',
        endDate: null,
        observedAt: '2026-04-07T12:00:00.000Z',
        confidenceScore: 0.86,
        sourceId: 'HOSPITAL_WEB_DIRECTORY',
        tier: 'SILVER',
        reviewRequired: false,
        reviewReason: null,
        status: 'ACTIVE',
      },
    ]);

    const mercy = graph.groupedEmployers.find((node) => node.employerName === 'Mercy General');
    const pacific = graph.groupedEmployers.find((node) => node.employerName === 'Pacific Telehealth');

    expect(mercy?.conflictFlags.map((flag) => flag.kind)).toEqual([
      'status_mismatch',
      'title_mismatch',
      'start_date_mismatch',
    ]);
    expect(pacific?.conflictFlags).toEqual([]);
    expect(graph.currentEmployers).toHaveLength(2);
  });
});

describe('buildEmploymentGraphFromIdentityClaims', () => {
  it('maps real identity-claim payload shape into employment nodes', () => {
    const graph = buildEmploymentGraphFromIdentityClaims([
      {
        claimId: 'claim-real-1',
        claimType: 'INSTITUTION_AFFILIATION',
        status: 'ACTIVE',
        sourceId: 'CA_HOSPITAL_DIRECTORY',
        tier: 'GOLD',
        confidenceScore: 0.93,
        reviewRequired: false,
        reviewReason: null,
        observedAt: '2026-04-10T12:00:00.000Z',
        value: {
          _type: 'INSTITUTION_AFFILIATION',
          institution: 'Mercy General',
          title: 'Hospitalist',
          department: 'Medicine',
          affiliationType: 'EMPLOYER',
          startDate: '2024-01-01',
          endDate: null,
          source: 'CA_HOSPITAL_DIRECTORY',
        },
      },
      {
        claimId: 'claim-real-2',
        claimType: 'INSTITUTION_AFFILIATION',
        status: 'ACTIVE',
        sourceId: 'OPENALEX',
        tier: 'BRONZE',
        confidenceScore: 0.61,
        reviewRequired: true,
        reviewReason: 'OpenAlex institution affiliation derived from author profile, not verified.',
        observedAt: '2026-03-15T12:00:00.000Z',
        value: {
          _type: 'INSTITUTION_AFFILIATION',
          institution: 'Stanford Medicine',
          title: 'Clinical Faculty',
          department: null,
          affiliationType: 'FACULTY',
          startDate: '2021-06-01',
          endDate: null,
          source: 'OPENALEX',
        },
      },
    ]);

    expect(graph.groupedEmployers).toHaveLength(1);
    expect(graph.groupedEmployers[0]?.employerName).toBe('Mercy General');
    expect(graph.groupedEmployers[0]?.verified).toBe(true);
    expect(graph.groupedEmployers[0]?.confidence).toBe(93);
  });
});
