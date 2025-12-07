/**
 * Batch 214 — Holistic Workforce Graph v5
 * National graph of clinicians, specialties, credentials, privileges, readiness, and shortages.
 */

import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';

export interface WorkforceGraphNode {
  id: string;
  type: 'clinician' | 'specialty' | 'credential' | 'privilege' | 'org' | 'region';
  label: string;
  metadata: Record<string, unknown>;
}

export interface WorkforceGraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface WorkforceGraphData {
  nodes: WorkforceGraphNode[];
  edges: WorkforceGraphEdge[];
}

/**
 * Task 214.2 — Build clinician node with NPIs, credentials, privileges, roles
 */
export async function buildClinicianNode(clinicianId: string): Promise<WorkforceGraphNode> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      licenses: true,
      credentials: true,
    },
  });

  if (!clinician) {
    throw new Error(`Clinician not found: ${clinicianId}`);
  }

  return {
    id: `clinician:${clinicianId}`,
    type: 'clinician',
    label: clinician.name || `Clinician ${clinicianId}`,
    metadata: {
      npi: clinician.npi,
      specialties: clinician.specialties || [],
      licenses: clinician.licenses?.map((l) => ({ state: l.state, number: l.licenseNumber })) || [],
      credentials: clinician.credentials?.length || 0,
    },
  };
}

/**
 * Task 214.3 — Cluster clinicians by specialty and experience depth
 */
export async function buildSpecialtyGraph(specialty: string): Promise<WorkforceGraphData> {
  const clinicians = await prisma.clinicianProfile.findMany({
    where: {
      specialties: {
        has: specialty,
      },
    },
    include: {
      licenses: true,
      credentials: true,
    },
  });

  const nodes: WorkforceGraphNode[] = [
    {
      id: `specialty:${specialty}`,
      type: 'specialty',
      label: specialty,
      metadata: { clinicianCount: clinicians.length },
    },
  ];

  const edges: WorkforceGraphEdge[] = [];

  for (const clinician of clinicians) {
    const clinicianNode = await buildClinicianNode(clinician.id);
    nodes.push(clinicianNode);

    edges.push({
      source: `specialty:${specialty}`,
      target: clinicianNode.id,
      type: 'practices',
      weight: 1,
    });
  }

  return { nodes, edges };
}

/**
 * Task 214.4 — Map clinicians to regional availability
 */
export async function buildGeographicLayer(region: string): Promise<WorkforceGraphData> {
  const clinicians = await prisma.clinicianProfile.findMany({
    where: {
      OR: [
        { state: region },
        { licenses: { some: { state: region } } },
      ],
    },
    include: {
      licenses: true,
    },
  });

  const nodes: WorkforceGraphNode[] = [
    {
      id: `region:${region}`,
      type: 'region',
      label: region,
      metadata: { clinicianCount: clinicians.length },
    },
  ];

  const edges: WorkforceGraphEdge[] = [];

  for (const clinician of clinicians) {
    const clinicianNode = await buildClinicianNode(clinician.id);
    if (!nodes.find((n) => n.id === clinicianNode.id)) {
      nodes.push(clinicianNode);
    }

    edges.push({
      source: clinicianNode.id,
      target: `region:${region}`,
      type: 'available_in',
      weight: 1,
    });
  }

  return { nodes, edges };
}

/**
 * Task 214.5 — Highlight critical shortages by specialty + region
 */
export async function buildShortageOverlay(
  specialty: string,
  region: string
): Promise<{ shortages: Array<{ specialty: string; region: string; severity: 'low' | 'moderate' | 'high' | 'critical'; shortage: number }> }> {
  const available = await prisma.clinicianProfile.count({
    where: {
      specialties: { has: specialty },
      OR: [{ state: region }, { licenses: { some: { state: region } } }],
    },
  });

  // Mock demand calculation - in production, this would use real demand data
  const estimatedDemand = available * 1.5; // Assume 50% more demand than supply
  const shortage = Math.max(0, estimatedDemand - available);
  const shortageRatio = available > 0 ? shortage / available : 1;

  let severity: 'low' | 'moderate' | 'high' | 'critical';
  if (shortageRatio < 0.2) severity = 'low';
  else if (shortageRatio < 0.4) severity = 'moderate';
  else if (shortageRatio < 0.6) severity = 'high';
  else severity = 'critical';

  return {
    shortages: [
      {
        specialty,
        region,
        severity,
        shortage,
      },
    ],
  };
}

/**
 * Task 214.7 — Forecast upcoming staffing gaps
 */
export async function predictStabilityGaps(
  orgId: string,
  horizonMonths: number = 6
): Promise<{ gaps: Array<{ specialty: string; month: number; projectedShortage: number }> }> {
  // This would integrate with historical data, turnover rates, etc.
  // For now, return mock data structure
  return {
    gaps: [],
  };
}

/**
 * Task 214.8 — Graph who works where, historically & currently
 */
export async function buildOrgConnectivity(orgId: string): Promise<WorkforceGraphData> {
  const nodes: WorkforceGraphNode[] = [
    {
      id: `org:${orgId}`,
      type: 'org',
      label: `Organization ${orgId}`,
      metadata: {},
    },
  ];

  const edges: WorkforceGraphEdge[] = [];

  // In production, this would query employment history
  // For now, return basic structure
  return { nodes, edges };
}

/**
 * Task 214.9 — Track interstate compact movements
 */
export async function buildCrossStateMobility(): Promise<WorkforceGraphData> {
  const nodes: WorkforceGraphNode[] = [];
  const edges: WorkforceGraphEdge[] = [];

  // Query clinicians with multiple state licenses
  const multiStateClinicians = await prisma.clinicianProfile.findMany({
    where: {
      licenses: {
        some: {},
      },
    },
    include: {
      licenses: true,
    },
  });

  for (const clinician of multiStateClinicians) {
    const licenses = clinician.licenses || [];
    if (licenses.length > 1) {
      const clinicianNode = await buildClinicianNode(clinician.id);
      nodes.push(clinicianNode);

      // Create edges between states
      for (let i = 0; i < licenses.length; i++) {
        for (let j = i + 1; j < licenses.length; j++) {
          const state1 = licenses[i].state;
          const state2 = licenses[j].state;

          if (!nodes.find((n) => n.id === `region:${state1}`)) {
            nodes.push({
              id: `region:${state1}`,
              type: 'region',
              label: state1,
              metadata: {},
            });
          }

          if (!nodes.find((n) => n.id === `region:${state2}`)) {
            nodes.push({
              id: `region:${state2}`,
              type: 'region',
              label: state2,
              metadata: {},
            });
          }

          edges.push({
            source: `region:${state1}`,
            target: `region:${state2}`,
            type: 'compact_movement',
            weight: 1,
            metadata: { clinicianId: clinician.id },
          });
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Task 214.10 — Anchor workforce graph snapshot
 */
export async function anchorWorkforceGraph(data: WorkforceGraphData): Promise<void> {
  await prisma.workforceGraph.create({
    data: {
      nodes: data.nodes,
      edges: data.edges,
      updatedAt: new Date(),
    },
  });

  anchorEvent('workforceGraphAnchored', {
    nodeCount: data.nodes.length,
    edgeCount: data.edges.length,
    graphHash: JSON.stringify(data),
    timestamp: new Date().toISOString(),
  });
}

