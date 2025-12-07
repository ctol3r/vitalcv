/**
 * B185C-PAYER-004: Graph-based Payer Network Map
 *
 * Builds a multi-hop graph showing clinician → payer → plan → state
 * relationships that downstream UIs use to visualize coverage and gaps.
 */

import { PrismaClient } from '@prisma/client';
import type { PayerRecord } from './models/Payer.js';
import type { PayerEnrollmentV2Record, PayerEnrollmentV2Status } from './models/PayerEnrollmentV2.js';

const prisma = new PrismaClient();

export interface GraphNode {
  id: string;
  type: 'clinician' | 'payer' | 'plan' | 'state';
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'enrolled' | 'offers' | 'covers';
  metadata?: Record<string, unknown>;
}

export interface CoverageGap {
  state: string;
  missingPayers: string[];
  coverageRatio: number;
}

export interface GraphSummary {
  totalPayers: number;
  activeEnrollments: number;
  panelFull: number;
  statesCovered: number;
}

export interface PayerNetworkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: string[];
  coverageGaps: CoverageGap[];
  summary: GraphSummary;
}

export interface FetchPayerNetworkGraphOptions {
  clinicianId: string;
  practiceStates?: string[];
  majorPayerMatrix?: Record<string, string[]>;
}

export interface GraphEnrollmentSnapshot {
  enrollment: PayerEnrollmentV2Record;
  payer: PayerRecord;
}

export interface BuildGraphOptions {
  clinicianId: string;
  enrollments: GraphEnrollmentSnapshot[];
  practiceStates?: string[];
  majorPayerMatrix?: Record<string, string[]>;
}

export async function fetchPayerNetworkGraph(
  options: FetchPayerNetworkGraphOptions
): Promise<PayerNetworkGraph> {
  const raw = await prisma.payerEnrollmentV2.findMany({
    where: {
      clinicianId: options.clinicianId,
    },
    include: {
      payer: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const enrollments: GraphEnrollmentSnapshot[] = raw.map((record) => ({
    enrollment: {
      id: record.id,
      clinicianId: record.clinicianId,
      payerId: record.payerId,
      status: record.status as PayerEnrollmentV2Status,
      effectiveDate: record.effectiveDate,
      panelType: record.panelType as any,
      notes: record.notes,
      metadata: record.metadata as Record<string, unknown> | null,
      lastStatusChange: record.lastStatusChange,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    payer: record.payer as unknown as PayerRecord,
  }));

  return buildPayerNetworkGraph({
    clinicianId: options.clinicianId,
    enrollments,
    practiceStates: options.practiceStates,
    majorPayerMatrix: options.majorPayerMatrix,
  });
}

export function buildPayerNetworkGraph(options: BuildGraphOptions): PayerNetworkGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  const clinicianNode: GraphNode = {
    id: `clinician:${options.clinicianId}`,
    type: 'clinician',
    label: `Clinician ${options.clinicianId}`,
  };
  nodes.set(clinicianNode.id, clinicianNode);

  const stateSet = new Set<string>();

  for (const snapshot of options.enrollments) {
    const { enrollment, payer } = snapshot;
    const payerNodeId = `payer:${payer.id}`;
    if (!nodes.has(payerNodeId)) {
      nodes.set(payerNodeId, {
        id: payerNodeId,
        type: 'payer',
        label: payer.name,
        metadata: {
          payerId: payer.payerId,
          requiresCaqh: payer.requiresCaqh,
          requiresPecos: payer.requiresPecos,
        },
      });
    }

    edges.push({
      id: `edge:${clinicianNode.id}->${payerNodeId}`,
      source: clinicianNode.id,
      target: payerNodeId,
      type: 'enrolled',
      metadata: {
        status: enrollment.status,
        panelType: enrollment.panelType,
        effectiveDate: enrollment.effectiveDate?.toISOString(),
      },
    });

    const planTypes = payer.planTypes.length ? payer.planTypes : ['General'];
    for (const planType of planTypes) {
      const planNodeId = `plan:${payer.id}:${slugify(planType)}`;
      if (!nodes.has(planNodeId)) {
        nodes.set(planNodeId, {
          id: planNodeId,
          type: 'plan',
          label: planType,
          metadata: { payerId: payer.id },
        });
      }

      edges.push({
        id: `edge:${payerNodeId}->${planNodeId}`,
        source: payerNodeId,
        target: planNodeId,
        type: 'offers',
      });

      const states = payer.states.length ? payer.states : ['ALL'];
      for (const state of states) {
        const normalizedState = state.toUpperCase();
        stateSet.add(normalizedState);
        const stateNodeId = `state:${normalizedState}`;
        if (!nodes.has(stateNodeId)) {
          nodes.set(stateNodeId, {
            id: stateNodeId,
            type: 'state',
            label: normalizedState,
          });
        }

        edges.push({
          id: `edge:${planNodeId}->${stateNodeId}`,
          source: planNodeId,
          target: stateNodeId,
          type: 'covers',
        });
      }
    }

    if (enrollment.status === 'REVALIDATION_DUE') {
      warnings.push(`${payer.name} requires revalidation`);
    } else if (enrollment.status === 'PANEL_FULL') {
      warnings.push(`${payer.name} panel is full`);
    }
  }

  const coverageGaps = detectCoverageGaps({
    clinicianId: options.clinicianId,
    enrollments: options.enrollments,
    practiceStates: options.practiceStates ?? Array.from(stateSet),
    majorPayerMatrix: options.majorPayerMatrix ?? DEFAULT_MAJOR_PAYERS_BY_STATE,
  });

  for (const gap of coverageGaps) {
    warnings.push(
      `Missing major payer(s) in ${gap.state}: ${gap.missingPayers.join(', ')}`
    );
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    warnings: Array.from(new Set(warnings)),
    coverageGaps,
    summary: summarizeNetwork(options.enrollments, stateSet),
  };
}

function summarizeNetwork(
  snapshots: GraphEnrollmentSnapshot[],
  states: Set<string>
): GraphSummary {
  const totalPayers = new Set(snapshots.map((s) => s.payer.id)).size;
  const activeEnrollments = snapshots.filter((s) => s.enrollment.status === 'ENROLLED').length;
  const panelFull = snapshots.filter((s) => s.enrollment.status === 'PANEL_FULL').length;

  return {
    totalPayers,
    activeEnrollments,
    panelFull,
    statesCovered: states.size,
  };
}

interface CoverageGapOptions {
  clinicianId: string;
  enrollments: GraphEnrollmentSnapshot[];
  practiceStates: string[];
  majorPayerMatrix: Record<string, string[]>;
}

function detectCoverageGaps(options: CoverageGapOptions): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const enrolledByState = new Map<string, Set<string>>();

  for (const snapshot of options.enrollments) {
    const payerName = snapshot.payer.name.toLowerCase();
    for (const state of snapshot.payer.states) {
      const normalized = state.toUpperCase();
      if (!enrolledByState.has(normalized)) {
        enrolledByState.set(normalized, new Set());
      }
      enrolledByState.get(normalized)!.add(payerName);
    }
  }

  for (const state of options.practiceStates) {
    const normalized = state.toUpperCase();
    const majors = options.majorPayerMatrix[normalized] ?? [];
    if (majors.length === 0) continue;

    const enrolled = enrolledByState.get(normalized) ?? new Set<string>();
    const missing = majors.filter((major) => !enrolled.has(major.toLowerCase()));
    if (missing.length > 0) {
      gaps.push({
        state: normalized,
        missingPayers: missing,
        coverageRatio: (majors.length - missing.length) / majors.length,
      });
    }
  }

  return gaps;
}

export const DEFAULT_MAJOR_PAYERS_BY_STATE: Record<string, string[]> = {
  CA: ['UnitedHealthcare', 'Blue Shield of California', 'Anthem Blue Cross', 'Aetna'],
  TX: ['UnitedHealthcare', 'Blue Cross Blue Shield of Texas', 'Aetna', 'Cigna'],
  NY: ['EmblemHealth', 'Empire BlueCross', 'UnitedHealthcare', 'Aetna'],
  FL: ['Florida Blue', 'UnitedHealthcare', 'Humana', 'Aetna'],
  IL: ['Blue Cross Blue Shield of Illinois', 'Aetna', 'UnitedHealthcare', 'Cigna'],
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

