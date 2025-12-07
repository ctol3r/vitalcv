import { describe, expect, it } from '@jest/globals';

import { evaluateDemandEligibility } from '../eligibility/demandEligibility.js';
import { createWorkforceDemandNode } from '../models/WorkforceDemandNode.js';
import { WorkforceDemandUrgency, normalizeWorkforceDemand } from '../models/WorkforceDemand.js';

const baseDemand = normalizeWorkforceDemand({
  id: 'demand-1',
  orgId: 'org-1',
  deptId: 'dept-icu',
  role: 'ICU RN',
  privilegeCodes: ['ACLS'],
  requiredCompacts: ['IMLC'],
  shiftTime: {
    start: '2025-11-16T06:00:00Z',
    end: '2025-11-16T14:00:00Z',
  },
  location: {
    state: 'CA',
  },
  urgency: WorkforceDemandUrgency.PRIORITY,
  requiredHeadcount: 2,
});

const requirementNode = createWorkforceDemandNode(
  {
    id: 'requirement-icu',
    orgId: 'org-1',
    nodeType: 'REQUIREMENT',
    label: 'ICU RN requirements',
    parentNodeId: 'service:icu',
    constraints: {
      privilegeCodes: ['CRRT'],
      compacts: ['NLC'],
      enrollments: ['PAYER_A'],
      ehrCompetencies: ['EPIC_ICU'],
    },
  },
  { parentType: 'SERVICE' }
);

describe('DemandEligibilityRules', () => {
  it('identifies missing requirements against available assets', () => {
    const result = evaluateDemandEligibility({
      demand: baseDemand,
      requirementNode,
      assets: {
        privilegeCodes: ['ACLS'],
        compactMemberships: ['IMLC'],
        enrollments: [],
        ehrCompetencies: [],
      },
    });

    expect(result.missingPrivileges).toEqual(['CRRT']);
    expect(result.missingCompacts).toEqual(['NLC']);
    expect(result.missingEnrollments).toEqual(['PAYER_A']);
    expect(result.missingEhrCompetencies).toEqual(['EPIC_ICU']);
    expect(result.isEligible).toBe(false);
  });

  it('returns READY when all requirements are satisfied', () => {
    const result = evaluateDemandEligibility({
      demand: baseDemand,
      requirementNode,
      assets: {
        privilegeCodes: ['ACLS', 'CRRT'],
        compactMemberships: ['IMLC', 'NLC'],
        enrollments: ['PAYER_A'],
        ehrCompetencies: ['EPIC_ICU'],
      },
    });

    expect(result.isEligible).toBe(true);
    expect(result.status).toBe('READY');
  });
});


