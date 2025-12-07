import { mergePrivilegeCodes, WorkforceDemand } from '../models/WorkforceDemand.js';
import type { OrgPolicyRule } from '../graph/buildDemandGraph.js';
import type { WorkforceDemandNode } from '../models/WorkforceDemandNode.js';

export interface DemandEligibilityAssets {
  privilegeCodes?: string[];
  compactMemberships?: string[];
  enrollments?: string[];
  ehrCompetencies?: string[];
}

export interface DemandEligibilityResult {
  demandId: string;
  privilegeCodes: string[];
  compacts: string[];
  enrollments: string[];
  ehrCompetencies: string[];
  missingPrivileges: string[];
  missingCompacts: string[];
  missingEnrollments: string[];
  missingEhrCompetencies: string[];
  isEligible: boolean;
  status: 'READY' | 'BLOCKED';
}

export interface DemandEligibilityInput {
  demand: WorkforceDemand;
  requirementNode?: WorkforceDemandNode;
  policyOverlays?: OrgPolicyRule[];
  assets?: DemandEligibilityAssets;
}

export function evaluateDemandEligibility({
  demand,
  requirementNode,
  policyOverlays,
  assets,
}: DemandEligibilityInput): DemandEligibilityResult {
  const effectivePrivileges = mergePrivilegeCodes(
    demand.privilegeCodes,
    requirementNode?.constraints?.privilegeCodes,
    requirementNode?.metadata && 'privileges' in requirementNode.metadata
      ? (requirementNode.metadata.privileges as string[])
      : undefined,
    ...(policyOverlays ?? []).map((policy) => policy.requiresPrivileges ?? [])
  );

  const compacts = dedupeStrings([
    ...demand.requiredCompacts,
    ...(requirementNode?.constraints?.compacts ?? []),
    ...(policyOverlays ?? []).flatMap((policy) => policy.requiresCompacts ?? []),
  ]);

  const enrollments = dedupeStrings([
    ...demand.requiredEnrollments,
    ...(requirementNode?.constraints?.enrollments ?? []),
    ...(policyOverlays ?? []).flatMap((policy) => policy.requiresEnrollments ?? []),
  ]);

  const ehrCompetencies = dedupeStrings([
    ...demand.requiredEhrCompetencies,
    ...(requirementNode?.constraints?.ehrCompetencies ?? []),
    ...(policyOverlays ?? []).flatMap((policy) => policy.requiresEhrCompetencies ?? []),
  ]);

  const missingPrivileges = computeMissing(effectivePrivileges, assets?.privilegeCodes);
  const missingCompacts = computeMissing(compacts, assets?.compactMemberships);
  const missingEnrollments = computeMissing(enrollments, assets?.enrollments);
  const missingEhrCompetencies = computeMissing(ehrCompetencies, assets?.ehrCompetencies);

  const isEligible =
    missingPrivileges.length === 0 &&
    missingCompacts.length === 0 &&
    missingEnrollments.length === 0 &&
    missingEhrCompetencies.length === 0;

  return {
    demandId: demand.id ?? `${demand.deptId}:${demand.role}`,
    privilegeCodes: effectivePrivileges,
    compacts,
    enrollments,
    ehrCompetencies,
    missingPrivileges,
    missingCompacts,
    missingEnrollments,
    missingEhrCompetencies,
    isEligible,
    status: isEligible ? 'READY' : 'BLOCKED',
  };
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

function computeMissing(required: string[], owned: string[] | undefined): string[] {
  if (!required.length) {
    return [];
  }
  const ownedSet = new Set((owned ?? []).map((value) => value.trim()));
  return required.filter((value) => !ownedSet.has(value));
}


