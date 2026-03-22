/**
 * workflowContext.ts — Workflow Context Routing
 *
 * Resolves the correct workflow context for an entity + intent combination.
 * Replaces ad-hoc "user type" thinking with a structured context model.
 *
 * A workflow context answers: "what is this entity trying to DO right now?"
 * It is not a role (what the entity IS) but a task (what it's doing).
 *
 * Usage:
 *   const ctx = resolveWorkflowContext(npiResolution, requestedContext);
 *   → returns permitted actions, primary surface, and validation errors
 */

import {
  WORKFLOW_ROUTING,
  NPI_TYPE_ROUTING,
  ENTITY_ROLE_PATTERNS,
  type WorkflowContext,
  type WorkflowAction,
  type WorkflowSurface,
  type NpiResolution,
  type RoleType,
  type EntityType,
  type ResolvedWorkflowContext,
  type EntityRolePattern,
} from './types';

// ── Context resolution ────────────────────────────────────────────────────────

export interface WorkflowContextResult {
  context:          WorkflowContext;
  entityType:       EntityType;
  roles:            RoleType[];
  permittedActions: WorkflowAction[];
  primarySurface:   WorkflowSurface;
  fallbackSurface:  WorkflowSurface;
  pattern:          EntityRolePattern | null;   // matched role pattern if any
  description:      string;
  valid:            boolean;
  validationErrors: string[];
}

/**
 * Resolve the workflow context for a given NPI resolution.
 *
 * If requestedContext is provided, validates that the entity is eligible
 * for that context and returns validation errors if not.
 *
 * If requestedContext is not provided, infers from NPI type routing.
 */
export function resolveWorkflowContext(
  resolution:        NpiResolution,
  requestedContext?: WorkflowContext,
  claimedRoles?:     RoleType[],
): WorkflowContextResult {
  const routing     = NPI_TYPE_ROUTING[resolution.npiType];
  const inferredCtx = routing.workflowContext;
  const context     = requestedContext ?? inferredCtx;
  const ctxConfig   = WORKFLOW_ROUTING[context];
  const errors:     string[] = [];

  // Determine effective roles: claimed > NPI-derived
  const effectiveRoles: RoleType[] = claimedRoles?.length
    ? claimedRoles
    : routing.primaryRoles;

  // Validate: does the entity type support any of the context's suggested roles?
  const eligibleForContext = ctxConfig.suggestedRoles.some(r =>
    effectiveRoles.includes(r),
  );

  if (!eligibleForContext && requestedContext) {
    errors.push(
      `Entity type '${resolution.entityType}' with roles [${effectiveRoles.join(', ')}] ` +
      `is not eligible for context '${context}'. ` +
      `Context requires one of: [${ctxConfig.suggestedRoles.join(', ')}].`,
    );
  }

  // Find matching role pattern
  const pattern = ENTITY_ROLE_PATTERNS.find(p =>
    p.contexts.includes(context) &&
    p.entityTypes.includes(resolution.entityType) &&
    effectiveRoles.some(r => p.roles.includes(r)),
  ) ?? null;

  return {
    context,
    entityType:       resolution.entityType,
    roles:            effectiveRoles,
    permittedActions: ctxConfig.permittedActions,
    primarySurface:   ctxConfig.primarySurface,
    fallbackSurface:  ctxConfig.fallbackSurface,
    pattern,
    description:      ctxConfig.description,
    valid:            errors.length === 0,
    validationErrors: errors,
  };
}

// ── Context-to-route mapping ──────────────────────────────────────────────────

/**
 * Given a workflow context, return the canonical API route prefix
 * and the UI surface path.
 */
export function contextToRouting(context: WorkflowContext): {
  apiPrefix:     string;
  primarySurface: WorkflowSurface;
  fallbackSurface: WorkflowSurface;
} {
  const cfg = WORKFLOW_ROUTING[context];
  const prefixMap: Record<WorkflowContext, string> = {
    prove_readiness:      '/api/identity',
    review_clinician:     '/api/verifier',
    issue_credential:     '/api/credentials',
    monitor_standing:     '/api/trust-state',
    evaluate_organization:'/api/identity',
    manage_training:      '/api/identity',
    request_verification: '/api/identity',
    inspect_lineage:      '/api/audit',
  };
  return {
    apiPrefix:      prefixMap[context],
    primarySurface: cfg.primarySurface,
    fallbackSurface: cfg.fallbackSurface,
  };
}

// ── Action gating ─────────────────────────────────────────────────────────────

/**
 * Check whether a given action is permitted in the current context.
 */
export function isActionPermitted(
  action:  WorkflowAction,
  context: WorkflowContext,
): boolean {
  return WORKFLOW_ROUTING[context].permittedActions.includes(action);
}

/**
 * List all contexts where a given role is applicable.
 */
export function contextsForRole(role: RoleType): WorkflowContext[] {
  return (Object.entries(WORKFLOW_ROUTING) as [WorkflowContext, typeof WORKFLOW_ROUTING[WorkflowContext]][])
    .filter(([, cfg]) => cfg.suggestedRoles.includes(role))
    .map(([ctx]) => ctx);
}

/**
 * List all contexts where a given entity type is applicable.
 */
export function contextsForEntityType(entityType: EntityType): WorkflowContext[] {
  return ENTITY_ROLE_PATTERNS
    .filter(p => p.entityTypes.includes(entityType))
    .flatMap(p => p.contexts)
    .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate
}
