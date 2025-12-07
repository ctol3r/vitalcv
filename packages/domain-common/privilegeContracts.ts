/**
 * B196B-CONTRACT-009
 * Privilege graph contracts shared by graph builder, EHR sync, and OPPE/FPPE modules.
 */

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export const PRIVILEGE_CATEGORY_VALUES = ['surgical', 'procedural', 'diagnostic', 'admin'] as const;
export type PrivilegeCategory = (typeof PRIVILEGE_CATEGORY_VALUES)[number];

export const PRIVILEGE_DEPENDENCY_TYPE_VALUES = [
  'REQUIRES',
  'ENHANCES',
  'CONFLICTS_WITH',
  'MUTUALLY_EXCLUSIVE',
] as const;
export type PrivilegeDependencyType = (typeof PRIVILEGE_DEPENDENCY_TYPE_VALUES)[number];

export interface PrivilegeNodeContract {
  id: string;
  privilegeCode: string;
  name: string;
  description: string;
  category: PrivilegeCategory;
  specialty: string;
  tags: string[];
  metadata?: JsonValue;
  createdAt: string;
  updatedAt: string;
}

export interface PrivilegeDependencyEdge {
  id: string;
  parentPrivilegeId: string;
  childPrivilegeId: string;
  dependencyType: PrivilegeDependencyType;
  rationale?: string;
  metadata?: JsonValue;
  createdAt: string;
  updatedAt: string;
}

export type EligibilitySeverity = 'info' | 'warning' | 'error';

export interface PrivilegeEligibilityFinding {
  code: string;
  message: string;
  severity?: EligibilitySeverity;
  metadata?: JsonValue;
}

export interface PrivilegeEligibilityResult {
  privilegeCode: string;
  eligible: boolean;
  evaluatedAt: string;
  blockers: PrivilegeEligibilityFinding[];
  warnings: PrivilegeEligibilityFinding[];
  satisfiedDependencies?: string[];
  missingDependencies?: string[];
  context?: JsonObject;
}


