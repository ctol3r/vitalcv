import { GraphBuilder, GraphBuilderInput } from '../builder/graphBuilder.js';

export function createSampleGraphInput(): GraphBuilderInput {
  return {
    clinician: {
      id: 'clinician-sample',
      npi: '1234567890',
      name: 'Dr. Credential Graph',
      state: 'CA',
      org: {
        id: 'org-bayhealth',
        name: 'Bay Health System',
        state: 'CA',
      },
    },
    licenses: [
      {
        id: 'license-ca',
        state: 'CA',
        number: 'A12345',
        status: 'active',
        boardId: 'board-abim',
        boardName: 'ABIM',
      },
      {
        id: 'license-wa',
        state: 'WA',
        number: 'WA-67890',
        status: 'pending',
        boardName: 'ABFM',
      },
    ],
    boardCertifications: [
      {
        id: 'board-cert-1',
        boardId: 'board-abim',
        name: 'American Board of Internal Medicine',
        licenseIds: ['license-ca'],
      },
    ],
    deaRegistrations: [
      {
        id: 'dea-987',
        licenseId: 'license-ca',
        schedule: 'II',
      },
    ],
    pecosEnrollment: {
      id: 'pecos-555',
      status: 'APPROVED',
    },
    medicaidEnrollments: [
      {
        id: 'medicaid-ca',
        state: 'CA',
      },
    ],
    payerEnrollments: [
      {
        id: 'payer-blue-enrollment',
        payerId: 'payer-blue',
        payerName: 'Blue Shield CA',
        requiresPecos: true,
        requiresMedicaid: true,
        conflictsWith: ['payer-gold'],
      },
      {
        id: 'payer-gold-enrollment',
        payerId: 'payer-gold',
        payerName: 'Golden Health',
        requiresPecos: false,
      },
    ],
    privileges: [
      {
        id: 'priv-icu',
        facilityId: 'org-bayhealth',
        facilityName: 'Bay Health System',
        licenseIds: ['license-ca'],
        payerEnrollmentIds: ['payer-blue-enrollment'],
      },
    ],
    vcs: [
      {
        id: 'vc-license-ca',
        type: 'STATE_LICENSE',
        subjectId: 'license-ca',
        issuerOrgId: 'org-bayhealth',
      },
    ],
    events: [
      {
        id: 'event-license-verified',
        type: 'LICENSE_VERIFIED',
        relatesToId: 'license-ca',
      },
    ],
    compactMemberships: [
      {
        id: 'compact-imlc',
        compactCode: 'IMLC',
        state: 'CA',
      },
    ],
  };
}

export function buildSampleGraph() {
  const builder = new GraphBuilder();
  return builder.build(createSampleGraphInput());
}

