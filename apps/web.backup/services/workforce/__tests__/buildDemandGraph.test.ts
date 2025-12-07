import { describe, expect, it } from '@jest/globals';

import { buildDemandGraph } from '../graph/buildDemandGraph.js';
import { WorkforceDemandUrgency } from '../models/WorkforceDemand.js';

describe('DemandGraphBuilder', () => {
  it('builds a demand graph with requirements derived from policies and privilege mappings', () => {
    const graph = buildDemandGraph({
      orgId: 'org-1',
      jobPosts: [
        {
          id: 'job-icu-night',
          title: 'Night ICU RN',
          role: 'RN',
          deptId: 'dept-icu',
          deptName: 'ICU',
          serviceLine: 'ICU',
          specialty: 'critical-care',
          privilegeCodes: ['ICU_CORE'],
          location: {
            state: 'CA',
            city: 'San Francisco',
            departmentName: 'ICU',
          },
          urgency: WorkforceDemandUrgency.PRIORITY,
        },
      ],
      shiftRequests: [
        {
          id: 'shift-1',
          deptId: 'dept-icu',
          deptName: 'ICU',
          serviceLine: 'ICU',
          start: '2025-11-16T06:00:00Z',
          end: '2025-11-16T14:00:00Z',
          headcount: 2,
          urgency: WorkforceDemandUrgency.CRITICAL,
          roleHint: 'RN',
          location: {
            state: 'CA',
            unit: 'ICU',
          },
        },
      ],
      privilegeRequirements: [
        {
          id: 'req-icu',
          role: 'RN',
          serviceLine: 'ICU',
          privilegeCodes: ['ACLS', 'CRRT'],
          requiredCompacts: ['IMLC'],
          requiredEnrollments: ['PAYER_A'],
          requiredEhrCompetencies: ['EPIC_ICU'],
        },
      ],
      policies: [
        {
          id: 'policy-night',
          name: 'Night coverage escalation',
          appliesTo: {
            deptId: 'dept-icu',
          },
          requiresPrivileges: ['ICU_NIGHT'],
          requiresEhrCompetencies: ['NIGHT_SHIFT'],
          urgencyOverride: WorkforceDemandUrgency.CRITICAL,
          headcountFloor: 3,
        },
      ],
    });

    const nodes = Array.from(graph.nodes.values());
    expect(nodes.find((node) => node.id === 'dept-icu')).toBeDefined();
    expect(nodes.find((node) => node.id === 'shift:shift-1')).toBeDefined();
    expect(nodes.find((node) => node.id.startsWith('requirement:'))).toBeDefined();

    const demand = graph.demands[0];
    expect(demand.privilegeCodes).toEqual(
      expect.arrayContaining(['ACLS', 'CRRT', 'ICU_CORE', 'ICU_NIGHT'])
    );
    expect(demand.requiredCompacts).toEqual(['IMLC']);
    expect(demand.requiredEnrollments).toEqual(['PAYER_A']);
    expect(demand.requiredEhrCompetencies).toEqual(expect.arrayContaining(['EPIC_ICU', 'NIGHT_SHIFT']));
    expect(demand.requiredHeadcount).toBe(3);
    expect(demand.urgency).toBe(WorkforceDemandUrgency.CRITICAL);

    const requiresEdges = graph.edges.filter((edge) => edge.relation === 'REQUIRES');
    expect(requiresEdges.length).toBeGreaterThan(0);
  });
});


