import type { CredentialGraph, GraphNode } from '../../graph/credential/types.js';
import type {
  ClinicianCompactAuthorization,
  EhrRoleGrant,
  PrivilegeAssignment,
  PayerEnrollmentSnapshot,
} from '../graph/buildSupplyGraph.js';
import { buildSupplyGraph } from '../graph/buildSupplyGraph.js';

type Fixture = {
  clinicianId: string;
  licenseState: string;
  orgId: string;
  payerId: string;
  payerStates: string[];
  compactStates: string[];
  privilegeCode: string;
  ehrSystem: string;
};

const BASE_DATE = new Date('2025-01-01T00:00:00Z');

const FIXTURES: Fixture[] = [
  {
    clinicianId: 'clinician-1',
    licenseState: 'CA',
    orgId: 'alpha',
    payerId: 'payer-uhc',
    payerStates: ['CA', 'NV'],
    compactStates: ['AZ', 'NV'],
    privilegeCode: 'CARDIO_CORE',
    ehrSystem: 'epic',
  },
  {
    clinicianId: 'clinician-2',
    licenseState: 'WA',
    orgId: 'bravo',
    payerId: 'payer-aetna',
    payerStates: ['WA', 'OR'],
    compactStates: ['ID'],
    privilegeCode: 'FPPE_START',
    ehrSystem: 'cerner',
  },
  {
    clinicianId: 'clinician-3',
    licenseState: 'TX',
    orgId: 'charlie',
    payerId: 'payer-cigna',
    payerStates: ['TX'],
    compactStates: ['NM', 'OK'],
    privilegeCode: 'STRUCTURAL_HEART',
    ehrSystem: 'meditech',
  },
  {
    clinicianId: 'clinician-4',
    licenseState: 'FL',
    orgId: 'delta',
    payerId: 'payer-humana',
    payerStates: ['FL', 'GA'],
    compactStates: ['AL'],
    privilegeCode: 'CARDIAC_CATH',
    ehrSystem: 'epic',
  },
  {
    clinicianId: 'clinician-5',
    licenseState: 'NY',
    orgId: 'echo',
    payerId: 'payer-empire',
    payerStates: ['NY', 'NJ'],
    compactStates: [],
    privilegeCode: 'PACEMAKER_IMPLANT',
    ehrSystem: 'cerner',
  },
];

describe('buildSupplyGraph', () => {
  it('builds workforce supply graph for five clinicians using injected sources', async () => {
    const credentialGraphs = Object.fromEntries(
      FIXTURES.map((fixture) => [
        fixture.clinicianId,
        makeCredentialGraph(fixture.clinicianId, fixture.licenseState, fixture.orgId),
      ]),
    );

    const privilegeAssignments = Object.fromEntries(
      FIXTURES.map((fixture, index) => [
        fixture.clinicianId,
        [
          makePrivilegeAssignment({
            clinicianId: fixture.clinicianId,
            orgId: fixture.orgId,
            privilegeCode: fixture.privilegeCode,
            suffix: index,
          }),
        ],
      ]),
    );

    const compactAuthorizations = Object.fromEntries(
      FIXTURES.map((fixture) => [
        fixture.clinicianId,
        fixture.compactStates.length
          ? [makeCompactAuthorization(fixture.clinicianId, fixture.licenseState, fixture.compactStates)]
          : [],
      ]),
    );

    const payerEnrollments = Object.fromEntries(
      FIXTURES.map((fixture) => [
        fixture.clinicianId,
        [makePayerEnrollment(fixture)],
      ]),
    );

    const ehrRoleGrants = Object.fromEntries(
      FIXTURES.map((fixture, index) => [
        fixture.clinicianId,
        [
          makeEhrRoleGrant({
            clinicianId: fixture.clinicianId,
            privilegeCode: fixture.privilegeCode,
            ehrSystem: fixture.ehrSystem,
            suffix: index,
          }),
        ],
      ]),
    );

    const graph = await buildSupplyGraph({
      clinicianIds: FIXTURES.map((fixture) => fixture.clinicianId),
      sources: {
        fetchCredentialGraph: async (clinicianId) => credentialGraphs[clinicianId],
        fetchPrivilegeAssignments: async (clinicianId) => privilegeAssignments[clinicianId] ?? [],
        fetchCompactAuthorizations: async (clinicianId) => compactAuthorizations[clinicianId] ?? [],
        fetchPayerEnrollments: async (clinicianId) => payerEnrollments[clinicianId] ?? [],
        fetchEhrRoleGrants: async (clinicianId) => ehrRoleGrants[clinicianId] ?? [],
      },
    });

    expect(graph.clinicianSummaries).toHaveLength(5);

    const relationTypes = new Set(graph.edges.map((edge) => edge.relationType));
    expect(relationTypes).toEqual(
      new Set([
        'CAN_PRACTICE_IN',
        'ELIGIBLE_VIA_COMPACT',
        'CAN_PERFORM',
        'APPROVED_AT_ORG',
        'COVERED_BY_PAYER',
        'EHR_ROLE_GRANTED',
      ]),
    );

    for (const fixture of FIXTURES) {
      const summary = graph.clinicianSummaries.find(
        (entry) => entry.clinicianId === fixture.clinicianId,
      );
      expect(summary).toBeDefined();
      expect(summary?.statesLicensed).toContain(fixture.licenseState);
      expect(summary?.orgsApproved).toContain(fixture.orgId);
      expect(summary?.payerCoverage).toContain(fixture.payerId);
      expect(summary?.privilegeCodes).toContain(fixture.privilegeCode);
    }
  });
});

function makeCredentialGraph(clinicianId: string, licenseState: string, orgId: string): CredentialGraph {
  const clinicianNodeId = `clinician:${clinicianId}`;
  const stateNodeId = `state:${licenseState}`;
  const licenseNodeId = `license:${clinicianId}:${licenseState}`;
  const orgNodeId = `org:${orgId}`;

  const nodes: GraphNode[] = [
    {
      id: stateNodeId,
      type: 'state',
      label: licenseState,
    },
    {
      id: orgNodeId,
      type: 'org',
      label: `Org ${orgId}`,
      metadata: {
        orgId,
        state: licenseState,
      },
    },
    {
      id: licenseNodeId,
      type: 'license',
      label: `${licenseState} license`,
      metadata: {
        state: licenseState,
        status: 'ACTIVE',
        licenseNumber: `${clinicianId}-${licenseState}`,
        issueDate: BASE_DATE.toISOString(),
        expiryDate: new Date(BASE_DATE.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  ];

  return {
    nodes,
    edges: [],
    warnings: [],
    issues: [],
    metadata: {
      clinicianId,
      clinicianNodeId,
      clinicianName: `Clinician ${clinicianId}`,
      clinicianDid: `did:vital:${clinicianId}`,
      specialty: 'Cardiology',
      homeState: licenseState,
      generatedAt: BASE_DATE.toISOString(),
    },
  };
}

function makePrivilegeAssignment(input: {
  clinicianId: string;
  orgId: string;
  privilegeCode: string;
  suffix: number;
}): PrivilegeAssignment {
  return {
    grantId: `grant-${input.clinicianId}-${input.suffix}`,
    privilegeCode: input.privilegeCode,
    privilegeName: `${input.privilegeCode} Name`,
    privilegeSetId: `set-${input.suffix}`,
    orgId: input.orgId,
    orgName: `Org ${input.orgId}`,
    orgState: 'CA',
    status: 'ACTIVE',
    grantedAt: BASE_DATE,
    expiresAt: new Date(BASE_DATE.getTime() + 60 * 24 * 60 * 60 * 1000),
    dependencyCodes: ['CORE'],
  };
}

function makeCompactAuthorization(
  clinicianId: string,
  homeState: string,
  states: string[],
): ClinicianCompactAuthorization {
  return {
    walletId: `wallet-${clinicianId}`,
    compactType: 'IMLC',
    homeState,
    states,
    participation: undefined,
    aprn: undefined,
    expiresAt: new Date(BASE_DATE.getTime() + 180 * 24 * 60 * 60 * 1000),
  };
}

function makePayerEnrollment(fixture: Fixture): PayerEnrollmentSnapshot {
  return {
    id: `enroll-${fixture.clinicianId}`,
    clinicianId: fixture.clinicianId,
    payerId: fixture.payerId,
    payer: {
      id: fixture.payerId,
      name: fixture.payerId,
      states: fixture.payerStates,
      planTypes: ['Commercial'],
    },
    status: 'ENROLLED',
    panelType: 'OPEN',
    effectiveDate: BASE_DATE,
    metadata: {
      source: 'test',
    },
  };
}

function makeEhrRoleGrant(input: {
  clinicianId: string;
  privilegeCode: string;
  ehrSystem: string;
  suffix: number;
}): EhrRoleGrant {
  return {
    id: `ehr-${input.clinicianId}-${input.suffix}`,
    clinicianId: input.clinicianId,
    ehrSystem: input.ehrSystem,
    privilegeCode: input.privilegeCode,
    orgId: `org-${input.clinicianId}`,
    status: 'SYNCED',
    lastSyncedAt: BASE_DATE,
  };
}

