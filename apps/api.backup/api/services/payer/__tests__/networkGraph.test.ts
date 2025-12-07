import { describe, expect, it } from '@jest/globals';
import { buildPayerNetworkGraph } from '../networkGraph.js';

const enrollmentSnapshot = {
  clinicianId: 'clinician-1',
  payer: {
    id: 'payer-a',
    payerId: 'AETNA',
    name: 'Aetna',
    planTypes: ['HMO'],
    enrollmentEndpoint: null,
    x12SubmitEndpoint: null,
    contactInfo: null,
    requiresCaqh: true,
    requiresPecos: true,
    specialty: [],
    states: ['CA'],
    metadata: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  enrollment: {
    id: 'enroll-a',
    clinicianId: 'clinician-1',
    payerId: 'payer-a',
    status: 'ENROLLED',
    panelType: 'OPEN',
    effectiveDate: new Date(),
    notes: null,
    metadata: null,
    lastStatusChange: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

const panelFullSnapshot = {
  clinicianId: 'clinician-1',
  payer: {
    id: 'payer-b',
    payerId: 'REGIONAL',
    name: 'Regional Health',
    planTypes: ['PPO'],
    enrollmentEndpoint: null,
    x12SubmitEndpoint: null,
    contactInfo: null,
    requiresCaqh: true,
    requiresPecos: false,
    specialty: [],
    states: ['TX'],
    metadata: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  enrollment: {
    id: 'enroll-b',
    clinicianId: 'clinician-1',
    payerId: 'payer-b',
    status: 'PANEL_FULL',
    panelType: 'CLOSED',
    effectiveDate: null,
    notes: null,
    metadata: null,
    lastStatusChange: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('buildPayerNetworkGraph', () => {
  it('creates graph nodes and edges for clinician payer network', () => {
    const graph = buildPayerNetworkGraph({
      clinicianId: 'clinician-1',
      enrollments: [enrollmentSnapshot, panelFullSnapshot],
      practiceStates: ['CA', 'TX'],
      majorPayerMatrix: {
        CA: ['Aetna', 'Blue Shield of California'],
        TX: ['UnitedHealthcare'],
      },
    });

    expect(graph.summary.totalPayers).toBe(2);
    expect(graph.summary.activeEnrollments).toBe(1);
    expect(graph.nodes.some((node) => node.type === 'plan')).toBe(true);
    expect(graph.nodes.some((node) => node.type === 'state' && node.label === 'CA')).toBe(true);
    expect(graph.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('panel is full')])
    );
    expect(graph.coverageGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ state: 'CA', missingPayers: ['Blue Shield of California'] }),
        expect.objectContaining({ state: 'TX', missingPayers: ['UnitedHealthcare'] }),
      ])
    );
  });
});

