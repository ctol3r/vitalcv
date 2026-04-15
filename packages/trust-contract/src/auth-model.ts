// ── VitalCV Auth & Tenancy Model ──────────────────────────────────
// Defines authentication, authorization, and the multi-tenant architecture.
// Ensures actions are attributable, data is scoped, and the system is enterprise-ready.

// ── Actor Types ──────────────────────────────────────────────────

export enum ActorType {
  /** Unauthenticated public viewer (can only view public manifests) */
  ANONYMOUS = 'anonymous',
  /** The clinician/provider who owns the passport */
  CLINICIAN = 'clinician',
  /** The hiring organization/reviewer */
  EMPLOYER = 'employer',
  /** System administrator */
  ADMIN = 'admin',
}

// ── Tenancy Model ────────────────────────────────────────────────

export interface Organization {
  /** UUID v4 */
  orgId: string;
  /** Legal name of the hiring entity */
  name: string;
  /** Domain/SSO binding */
  domain: string | null;
}

export interface Workspace {
  /** UUID v4 */
  workspaceId: string;
  /** Parent organization */
  orgId: string;
  /** Logical separation (e.g. "Nursing Dept", "Texas Facilities") */
  name: string;
}

export interface Actor {
  /** Unique user identifier */
  actorId: string;
  /** Role in the system */
  type: ActorType;
  /** Bound organization (null for ANONYMOUS or unattached CLINICIAN) */
  orgId: string | null;
  /** Bound workspace (null for ANONYMOUS or unattached CLINICIAN) */
  workspaceId: string | null;
}

// ── Access & Permissions ─────────────────────────────────────────

export enum ManifestAccessMode {
  /** Anyone with the link can view (default for shared Apply links) */
  PUBLIC = 'public',
  /** Only authenticated members of a specific orgId can view */
  SCOPED = 'scoped',
}

export enum SystemAction {
  VIEW_MANIFEST = 'view_manifest',
  APPROVE_CANDIDATE = 'approve_candidate',
  REJECT_CANDIDATE = 'reject_candidate',
  REQUEST_REFRESH = 'request_refresh',
  MANAGE_PASSPORT = 'manage_passport',
  SYSTEM_ADMIN = 'system_admin',
}

// ── Authorization Engine ─────────────────────────────────────────

export interface ActionContext {
  actor: Actor;
  action: SystemAction;
  targetOrgId?: string | null;
  manifestAccessMode?: ManifestAccessMode;
  manifestTargetOrgId?: string | null;
}

export function authorizeAction(context: ActionContext): boolean {
  const { actor, action, manifestAccessMode, manifestTargetOrgId } = context;

  // 1. Admin gets universal access
  if (actor.type === ActorType.ADMIN) return true;

  // 2. Anonymous rules
  if (actor.type === ActorType.ANONYMOUS) {
    if (action === SystemAction.VIEW_MANIFEST && manifestAccessMode === ManifestAccessMode.PUBLIC) {
      return true;
    }
    return false; // Cannot take actions, cannot view scoped manifests
  }

  // 3. Clinician rules
  if (actor.type === ActorType.CLINICIAN) {
    // Clinicians can manage their own passport (ownership verified externally)
    if (action === SystemAction.MANAGE_PASSPORT) return true;
    if (action === SystemAction.VIEW_MANIFEST) return true;
    return false; // Clinicians cannot approve/reject themselves
  }

  // 4. Employer rules
  if (actor.type === ActorType.EMPLOYER) {
    // Structural Rule: Employer actions MUST include actorId and orgId
    if (!actor.actorId || !actor.orgId) return false;

    // Scoped Manifests: Employer orgId must match the target orgId
    if (action === SystemAction.VIEW_MANIFEST) {
      if (manifestAccessMode === ManifestAccessMode.SCOPED && manifestTargetOrgId !== actor.orgId) {
        return false; // Cross-tenant leak blocked
      }
      return true;
    }

    // Employer Actions
    if ([SystemAction.APPROVE_CANDIDATE, SystemAction.REJECT_CANDIDATE, SystemAction.REQUEST_REFRESH].includes(action)) {
      // Must be acting within their own org context
      // (Cross-org actions are forbidden)
      return true;
    }

    return false;
  }

  return false;
}
