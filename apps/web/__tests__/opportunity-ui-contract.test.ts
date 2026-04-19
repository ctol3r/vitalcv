import { describe, expect, it } from 'vitest';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import {
  assertOpportunityCardUiContract,
  buildOpportunityPassportHandoff,
  buildOpportunityPassportHref,
  parseOpportunityPassportHandoff,
} from '@/lib/launch/opportunity-ui-contract';

function makeOpportunity(overrides: Partial<OpportunitySummary> = {}): OpportunitySummary {
  return {
    id: 'opp_1',
    canonical_org_id: 'northwest-locums-alliance',
    canonical_role_id: 'family-medicine-physician|family-medicine',
    source_last_seen_at: '2026-03-20T00:00:00.000Z',
    freshness_status: 'fresh',
    active_status: 'active',
    employerId: 'org_1',
    organizationId: 'org_1',
    organizationName: 'Northwest Locums Alliance',
    organizationSlug: 'northwest-locums-alliance',
    title: 'Family Medicine Physician',
    roleType: 'locums',
    specialty: 'Family Medicine',
    hiringType: 'locums',
    state: 'WA',
    payRange: '$180-$220/hr',
    requirementLevel: 'L3',
    description: 'Rural coverage role.',
    remote: false,
    status: 'ACTIVE',
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    payModel: 'hourly',
    compensation_disclosure_status: 'disclosed',
    freshness: {
      listingStatus: 'fresh',
      employerDataStatus: 'complete',
      completenessScore: 96,
      isStale: false,
      isUncertain: false,
      lastUpdatedAt: '2026-03-20T00:00:00.000Z',
      compensationVerifiedAt: '2026-03-20T00:00:00.000Z',
      benefitsVerifiedAt: '2026-03-20T00:00:00.000Z',
      visaVerifiedAt: null,
    },
    source: {
      kind: 'opportunity',
      label: 'Employer listing',
      updatedAt: '2026-03-20T00:00:00.000Z',
    },
    comparison: {
      clinicianNpi: '1234567890',
      status: 'ready_now',
      satisfied: [{ label: 'WA license', detail: 'Active', key: 'state_license', level: 'L3', nextStep: null }],
      missing: [],
      unknown: [],
      fitIndicators: ['State aligned'],
      estimatedGap: '0 days',
      shortestPath: 'Ready now',
    },
    readiness_preview: {
      clinician_npi: '1234567890',
      readiness_status: 'ready_now',
      satisfied_units: 1,
      blocker_units: 0,
      unknown_units: 0,
      blockers: [],
      estimated_gap: '0 days',
      shortest_path: 'Ready now',
    },
    explanation: {
      whyThisMayFit: ['State aligned'],
      whatMayBlockYou: [],
      resolveNext: [],
      stillUnknown: [],
    },
    ...overrides,
  };
}

describe('opportunity UI contract', () => {
  it('fails card rendering when canonical identity or freshness fields are missing', () => {
    expect(() => assertOpportunityCardUiContract(makeOpportunity({
      canonical_org_id: '',
    }))).toThrow('missing canonical_org_id');

    expect(() => assertOpportunityCardUiContract(makeOpportunity({
      canonical_role_id: '',
    }))).toThrow('missing canonical_role_id');

    expect(() => assertOpportunityCardUiContract(makeOpportunity({
      source_last_seen_at: '',
    }))).toThrow('missing source_last_seen_at');
  });

  it('guarantees an explanation hook for L2/L3 and rejects ambiguous compensation labels', () => {
    const contract = assertOpportunityCardUiContract(makeOpportunity({
      requirementLevel: 'L3',
    }));

    expect(contract.levelExplanation).toContain('L3:');

    expect(() => assertOpportunityCardUiContract(makeOpportunity({
      payRange: null,
      compensation_disclosure_status: 'disclosed',
    }))).toThrow('compensation label is ambiguous');
  });

  it('rejects duplicate normalized fields before they reach the card UI', () => {
    expect(() => assertOpportunityCardUiContract(makeOpportunity({
      title: 'Locums · Locums',
    }))).toThrow('duplicate normalized title survived to UI');
  });

  it('preserves org identity, role identity, and readiness linkage across the passport handoff', () => {
    const href = buildOpportunityPassportHref(makeOpportunity());
    const params = new URL(href, 'https://vitalcv.test').searchParams;
    const handoff = parseOpportunityPassportHandoff(params);

    expect(handoff).toEqual(buildOpportunityPassportHandoff(makeOpportunity()));
  });

  it('fails when passport handoff identity drifts', () => {
    const params = new URLSearchParams({
      role: 'opp_1',
      roleTitle: 'Family Medicine Physician',
      employer: 'northwest-locums-alliance',
      employerName: 'Northwest Locums Alliance',
      canonicalOrgId: 'mindbridge-health',
      canonicalRoleId: 'family-medicine-physician|family-medicine',
      readinessPreviewLink: 'opp_1',
    });

    expect(() => parseOpportunityPassportHandoff(params)).toThrow('org identity drift detected');

    params.set('canonicalOrgId', 'northwest-locums-alliance');
    params.set('canonicalRoleId', 'telepsychiatry-director|psychiatry');

    expect(() => parseOpportunityPassportHandoff(params)).toThrow('role identity drift detected');
  });
});
