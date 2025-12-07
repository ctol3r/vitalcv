import { createHash } from 'node:crypto';

import { WorkforceDemandNode, createWorkforceDemandNode } from '../models/WorkforceDemandNode.js';
import {
  WorkforceDemand,
  WorkforceDemandLocation,
  WorkforceDemandLocationSchema,
  WorkforceDemandUrgency,
  WorkforceShiftTime,
  mergePrivilegeCodes,
  normalizeWorkforceDemand,
} from '../models/WorkforceDemand.js';

export type DemandGraphRelation = 'CONTAINS' | 'ALIGNS_WITH' | 'REQUIRES' | 'POLICY_ENFORCES';

export interface DemandGraphEdge {
  from: string;
  to: string;
  relation: DemandGraphRelation;
  metadata?: Record<string, unknown>;
}

export interface DemandGraph {
  nodes: Map<string, WorkforceDemandNode>;
  edges: DemandGraphEdge[];
  demands: WorkforceDemand[];
}

export interface JobPostDemandSource {
  id: string;
  title: string;
  role: string;
  deptId?: string;
  deptName?: string;
  serviceLine?: string;
  specialty?: string;
  location?: WorkforceDemandLocation;
  privilegeCodes?: string[];
  urgency?: WorkforceDemandUrgency;
  defaultShiftTime?: WorkforceShiftTime;
  metadata?: Record<string, unknown>;
}

export interface ShiftRequest {
  id: string;
  deptId: string;
  deptName?: string;
  serviceLine?: string;
  start: Date | string;
  end: Date | string;
  timezone?: string;
  headcount: number;
  urgency?: WorkforceDemandUrgency;
  roleHint?: string;
  location?: WorkforceDemandLocation;
}

export interface PrivilegeRequirement {
  id: string;
  role: string;
  serviceLine?: string;
  privilegeCodes: string[];
  requiredCompacts?: string[];
  requiredEnrollments?: string[];
  requiredEhrCompetencies?: string[];
}

export interface OrgPolicyRule {
  id: string;
  name: string;
  appliesTo: {
    deptId?: string;
    role?: string;
    serviceLine?: string;
  };
  requiresPrivileges?: string[];
  requiresCompacts?: string[];
  requiresEnrollments?: string[];
  requiresEhrCompetencies?: string[];
  urgencyOverride?: WorkforceDemandUrgency;
  headcountFloor?: number;
}

export interface DemandGraphBuilderInput {
  orgId: string;
  jobPosts: JobPostDemandSource[];
  shiftRequests: ShiftRequest[];
  privilegeRequirements: PrivilegeRequirement[];
  policies?: OrgPolicyRule[];
}

export function buildDemandGraph(input: DemandGraphBuilderInput): DemandGraph {
  if (!input.orgId) {
    throw new Error('buildDemandGraph: orgId is required');
  }

  const nodes = new Map<string, WorkforceDemandNode>();
  const edges: DemandGraphEdge[] = [];
  const edgeKeys = new Set<string>();
  const demands: WorkforceDemand[] = [];
  const policies = input.policies ?? [];

  const deptCapacity = computeDeptCapacity(input.shiftRequests);
  const shiftByDept = groupShiftsByDept(input.shiftRequests);
  const requirementLookup = buildRequirementLookup(input.privilegeRequirements);

  const departmentNodes = new Map<string, WorkforceDemandNode>();
  const shiftNodes = new Map<string, WorkforceDemandNode>();
  const roleNodes = new Map<string, WorkforceDemandNode>();
  const serviceNodes = new Map<string, WorkforceDemandNode>();
  const requirementNodes = new Map<string, WorkforceDemandNode>();

  const ensureEdge = (from: string, to: string, relation: DemandGraphRelation, metadata?: Record<string, unknown>) => {
    const key = `${from}|${relation}|${to}`;
    if (edgeKeys.has(key)) {
      return;
    }
    edges.push({ from, to, relation, metadata });
    edgeKeys.add(key);
  };

  const ensureNode = (cache: Map<string, WorkforceDemandNode>, builder: () => WorkforceDemandNode): WorkforceDemandNode => {
    const candidate = builder();
    const existing = cache.get(candidate.id);
    if (existing) {
      return existing;
    }
    cache.set(candidate.id, candidate);
    nodes.set(candidate.id, candidate);
    return candidate;
  };

  const ensureDepartment = (deptId: string, name?: string): WorkforceDemandNode => {
    return ensureNode(departmentNodes, () =>
      createWorkforceDemandNode({
        id: deptId,
        orgId: input.orgId,
        nodeType: 'DEPARTMENT',
        label: name ?? deptId,
        capacity: deptCapacity.get(deptId),
        headcountTarget: deptCapacity.get(deptId) ?? 0,
      })
    );
  };

  const ensureShift = (dept: WorkforceDemandNode, shift: ShiftRequest): WorkforceDemandNode => {
    const shiftId = `shift:${shift.id}`;
    const cached = shiftNodes.get(shiftId);
    if (cached) {
      return cached;
    }

    const node = createWorkforceDemandNode(
      {
        id: shiftId,
        orgId: input.orgId,
        nodeType: 'SHIFT',
        label: `${dept.label} ${new Date(shift.start).toISOString()}`,
        parentNodeId: dept.id,
        headcountTarget: shift.headcount,
        metadata: {
          start: new Date(shift.start).toISOString(),
          end: new Date(shift.end).toISOString(),
          timezone: shift.timezone,
          urgency: shift.urgency,
        },
      },
      { parentType: 'DEPARTMENT' }
    );

    shiftNodes.set(node.id, node);
    nodes.set(node.id, node);
    ensureEdge(dept.id, node.id, 'CONTAINS', { kind: 'dept_shift' });
    return node;
  };

  const ensureRole = (dept: WorkforceDemandNode, job: JobPostDemandSource): WorkforceDemandNode => {
    const roleKey = `role:${dept.id}:${normalizeKey(job.role)}`;
    const cached = roleNodes.get(roleKey);
    if (cached) {
      return cached;
    }
    const node = createWorkforceDemandNode(
      {
        id: roleKey,
        orgId: input.orgId,
        nodeType: 'ROLE',
        label: job.role,
        parentNodeId: dept.id,
        metadata: {
          title: job.title,
          serviceLine: job.serviceLine,
          specialty: job.specialty,
        },
      },
      { parentType: 'DEPARTMENT' }
    );
    roleNodes.set(node.id, node);
    nodes.set(node.id, node);
    ensureEdge(dept.id, node.id, 'CONTAINS', { kind: 'dept_role' });
    return node;
  };

  const ensureService = (role: WorkforceDemandNode, job: JobPostDemandSource): WorkforceDemandNode => {
    const serviceLabel = job.serviceLine ?? job.specialty ?? job.role;
    const serviceKey = `service:${normalizeKey(serviceLabel)}`;
    const cached = serviceNodes.get(serviceKey);
    if (cached) {
      ensureEdge(role.id, cached.id, 'ALIGNS_WITH', { kind: 'role_service' });
      return cached;
    }
    const node = createWorkforceDemandNode(
      {
        id: serviceKey,
        orgId: input.orgId,
        nodeType: 'SERVICE',
        label: serviceLabel,
        parentNodeId: role.id,
      },
      { parentType: 'ROLE' }
    );
    serviceNodes.set(node.id, node);
    nodes.set(node.id, node);
    ensureEdge(role.id, node.id, 'ALIGNS_WITH', { kind: 'role_service' });
    return node;
  };

  input.jobPosts.forEach((job) => {
    const deptId = job.deptId ?? `dept:${normalizeKey(job.serviceLine ?? job.role)}`;
    const department = ensureDepartment(deptId, job.deptName ?? job.serviceLine);
    const roleNode = ensureRole(department, job);
    const serviceNode = ensureService(roleNode, job);

    const shifts = filterShifts(shiftByDept.get(deptId), job.role);
    const fallbackShift: ShiftRequest | undefined = job.defaultShiftTime
      ? {
          id: `job:${job.id}:default`,
          deptId,
          deptName: job.deptName,
          serviceLine: job.serviceLine,
          start: job.defaultShiftTime.start,
          end: job.defaultShiftTime.end,
          headcount: Number(job.metadata?.headcount ?? 1),
          timezone: job.defaultShiftTime.timezone,
          urgency: job.urgency,
          roleHint: job.role,
          location: job.location,
        }
      : undefined;

    const resolvedShifts: ShiftRequest[] = shifts.length > 0 ? shifts : fallbackShift ? [fallbackShift] : [];

    if (resolvedShifts.length === 0) {
      throw new Error(`No shift request or default shift available for job ${job.id}`);
    }

    resolvedShifts.forEach((shift) => {
      const shiftNode = ensureShift(department, shift);
      ensureEdge(shiftNode.id, roleNode.id, 'CONTAINS', { kind: 'shift_role' });

      const requirementSet = collectRequirements(job, shift, requirementLookup, policies);
      const requirementNode = ensureRequirementNode(
        requirementNodes,
        roleNode,
        serviceNode,
        requirementSet,
        input.orgId
      );

      const demand = buildDemandRecord(input.orgId, job, shift, requirementSet);
      demands.push(demand);

      ensureEdge(serviceNode.id, requirementNode.id, 'REQUIRES', {
        privileges: requirementSet.privileges,
      });
      ensureEdge(roleNode.id, requirementNode.id, 'REQUIRES', {
        privileges: requirementSet.privileges,
      });
    });
  });

  return { nodes, edges, demands };
}

function computeDeptCapacity(shifts: ShiftRequest[]): Map<string, number> {
  const map = new Map<string, number>();
  shifts.forEach((shift) => {
    map.set(shift.deptId, (map.get(shift.deptId) ?? 0) + shift.headcount);
  });
  return map;
}

function groupShiftsByDept(shifts: ShiftRequest[]): Map<string, ShiftRequest[]> {
  const map = new Map<string, ShiftRequest[]>();
  shifts.forEach((shift) => {
    const existing = map.get(shift.deptId) ?? [];
    existing.push(shift);
    map.set(shift.deptId, existing);
  });
  return map;
}

function filterShifts(shifts: ShiftRequest[] | undefined, role: string): ShiftRequest[] {
  if (!shifts || shifts.length === 0) {
    return [];
  }
  return shifts.filter((shift) => {
    if (!shift.roleHint) {
      return true;
    }
    return normalizeKey(shift.roleHint) === normalizeKey(role);
  });
}

function buildRequirementLookup(requirements: PrivilegeRequirement[]) {
  return requirements.map((req) => ({
    ...req,
    roleKey: normalizeKey(req.role),
    serviceKey: req.serviceLine ? normalizeKey(req.serviceLine) : undefined,
  }));
}

function collectRequirements(
  job: JobPostDemandSource,
  shift: ShiftRequest | { headcount: number; urgency?: WorkforceDemandUrgency },
  requirementLookup: ReturnType<typeof buildRequirementLookup>,
  policies: OrgPolicyRule[]
) {
  const roleKey = normalizeKey(job.role);
  const serviceKey = job.serviceLine ? normalizeKey(job.serviceLine) : job.specialty ? normalizeKey(job.specialty) : undefined;

  const matches = requirementLookup.filter((req) => {
    if (req.roleKey === roleKey) {
      return true;
    }
    if (serviceKey && req.serviceKey === serviceKey) {
      return true;
    }
    return false;
  });

  const policyMatches = policies.filter((policy) => appliesPolicy(policy, job, serviceKey));

  const privileges = mergePrivilegeCodes(
    job.privilegeCodes,
    ...matches.map((req) => req.privilegeCodes),
    ...policyMatches.map((policy) => policy.requiresPrivileges ?? [])
  );

  return {
    privileges,
    compacts: dedupeStrings([
      ...matches.flatMap((req) => req.requiredCompacts ?? []),
      ...policyMatches.flatMap((policy) => policy.requiresCompacts ?? []),
    ]),
    enrollments: dedupeStrings([
      ...matches.flatMap((req) => req.requiredEnrollments ?? []),
      ...policyMatches.flatMap((policy) => policy.requiresEnrollments ?? []),
    ]),
    ehrCompetencies: dedupeStrings([
      ...matches.flatMap((req) => req.requiredEhrCompetencies ?? []),
      ...policyMatches.flatMap((policy) => policy.requiresEhrCompetencies ?? []),
    ]),
    urgency: deriveUrgency(job, shift, policyMatches),
    headcount: Math.max(
      Number(shift.headcount ?? 1),
      ...policyMatches.map((policy) => policy.headcountFloor ?? 0)
    ),
  };
}

function appliesPolicy(policy: OrgPolicyRule, job: JobPostDemandSource, serviceKey?: string): boolean {
  if (policy.appliesTo.deptId && policy.appliesTo.deptId !== job.deptId) {
    return false;
  }
  if (policy.appliesTo.role && normalizeKey(policy.appliesTo.role) !== normalizeKey(job.role)) {
    return false;
  }
  if (policy.appliesTo.serviceLine && normalizeKey(policy.appliesTo.serviceLine) !== (serviceKey ?? '')) {
    return false;
  }
  return true;
}

function deriveUrgency(
  job: JobPostDemandSource,
  shift: { urgency?: WorkforceDemandUrgency },
  policies: OrgPolicyRule[]
): WorkforceDemandUrgency {
  const policyUrgency = policies
    .map((policy) => policy.urgencyOverride)
    .filter((value): value is WorkforceDemandUrgency => Boolean(value));
  return (
    policyUrgency[0] ??
    shift.urgency ??
    job.urgency ??
    WorkforceDemandUrgency.ROUTINE
  );
}

function ensureRequirementNode(
  cache: Map<string, WorkforceDemandNode>,
  role: WorkforceDemandNode,
  service: WorkforceDemandNode,
  requirementSet: {
    privileges: string[];
    compacts: string[];
    enrollments: string[];
    ehrCompetencies: string[];
  },
  orgId: string
): WorkforceDemandNode {
  const hash = createHash('sha1')
    .update(
      JSON.stringify({
        role: role.id,
        service: service.id,
        ...requirementSet,
      })
    )
    .digest('hex')
    .slice(0, 16);
  const requirementId = `requirement:${hash}`;

  const cached = cache.get(requirementId);
  if (cached) {
    return cached;
  }

  const node = createWorkforceDemandNode(
    {
      id: requirementId,
      orgId,
      nodeType: 'REQUIREMENT',
      label: `${role.label} requirements`,
      parentNodeId: service.id,
      metadata: requirementSet,
      constraints: {
        privilegeCodes: requirementSet.privileges,
        compacts: requirementSet.compacts,
        enrollments: requirementSet.enrollments,
        ehrCompetencies: requirementSet.ehrCompetencies,
      },
    },
    { parentType: 'SERVICE' }
  );

  cache.set(node.id, node);
  return node;
}

function buildDemandRecord(
  orgId: string,
  job: JobPostDemandSource,
  shift: ShiftRequest | { start: Date | string; end: Date | string; timezone?: string; headcount: number },
  requirementSet: {
    privileges: string[];
    compacts: string[];
    enrollments: string[];
    ehrCompetencies: string[];
    urgency: WorkforceDemandUrgency;
    headcount: number;
  }
): WorkforceDemand {
  const shiftTime: WorkforceShiftTime = {
    start: new Date(shift.start),
    end: new Date(shift.end),
    timezone: shift.timezone,
  };

  const location = WorkforceDemandLocationSchema.parse(job.location ?? shift.location ?? {});

  return normalizeWorkforceDemand({
    id: `demand:${job.id}:${typeof shift === 'object' && 'id' in shift ? shift.id : 'default'}`,
    orgId,
    deptId: job.deptId ?? `dept:${normalizeKey(job.serviceLine ?? job.role)}`,
    role: job.role,
    privilegeCodes: requirementSet.privileges,
    requiredCompacts: requirementSet.compacts,
    requiredEnrollments: requirementSet.enrollments,
    requiredEhrCompetencies: requirementSet.ehrCompetencies,
    shiftTime,
    location,
    urgency: requirementSet.urgency,
    requiredHeadcount: requirementSet.headcount,
  });
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}


