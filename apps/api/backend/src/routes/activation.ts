/**
 * ACT-7.3 — the HTTP surface for the activation requirement ledger and
 * start-state lifecycle.
 *
 * The ACT-1.3 / ACT-1.4 service layers (`activationRequirementService`,
 * `startEventService`) were built, tested, and left unmounted — nothing under
 * `routes/` or `apps/web` imported them, so a clinician's "remaining work to a
 * qualified start" and the start-ready/started lifecycle had no way to be read
 * or driven by a real request. This module mounts them, application-scoped.
 *
 * Trust contract:
 *   - Audit-before-success is enforced INSIDE the services (every consequential
 *     write emits an AuditEvent before it returns). These handlers add no
 *     second audit path; they must not return 2xx on a service failure.
 *   - Tenant scope is authorization, NOT defense-in-depth. Every route resolves
 *     the CALLER's org from the membership store using their verified Clerk id
 *     and requires it to equal the owning org of the application's opportunity.
 *     A caller outside that org gets the same 404 as an unknown id.
 *
 *     This replaces the original contract, which claimed the services'
 *     `wrong_tenant` guard was a second line of defence. It was not: the route
 *     reads `organizationId` off the TARGET application and passes that same
 *     value down, so `row.organizationId !== input.organizationId` can never be
 *     true for a cross-tenant caller. A tenant check is only meaningful against
 *     the caller's own org. Before this was fixed (#951), any caller who sent
 *     `x-org-role: admin` could read and mutate any organization's applications,
 *     and the write was attributed to the victim org.
 *   - Employer mutations sit behind `requireOrgRole(VERIFIER_MUTATION_ROLES)`,
 *     which governs role capability WITHIN an org. It is stacked on top of the
 *     membership check above, never used in its place: `requireOrgRole` answers
 *     "does the caller claim an allowed role?" and is satisfied by a header, so
 *     it is not a tenant boundary at any VERIFIER_RBAC_MODE, including enforce.
 *   - start-ready is gated by the readiness predicate: `markStartReady` refuses
 *     while any REQUIRED requirement is open and names the blockers, so 409
 *     always points at an actionable requirement.
 *
 * The application-scoped command (applicationStartCommandService) is the one
 * authoritative start writer: POST /start below runs it directly, and the
 * machine lane (POST /api/hiring/start) adapts onto it. The entity-scoped
 * `POST /api/employer-review/:entityId/confirm-start` path still writes through
 * the legacy startWriter — migrating it is recorded as a follow-up in ADR 0007,
 * not solved here.
 */

import type { Express, NextFunction, Request, Response } from 'express';

import prisma from '../graphql/prisma_client';
import { HttpError } from '../utils/httpError';
import { requireOrgRole, VERIFIER_MUTATION_ROLES } from '../middleware/orgRoleGuard';
import type { VerifiedAuth } from '../middleware/verifiedIdentity';
import {
  instantiateActivationRequirements,
  resolveActivationRequirement,
  type RequirementSeed,
} from '../services/activation/activationRequirementService';
import {
  getApplicationStartState,
  markStartReady,
  cancelStart,
  type StartActionResult,
} from '../services/activation/startEventService';
import { confirmApplicationStart } from '../services/activation/applicationStartCommandService';
import type {
  ActivationRequirementCategory,
  ActivationRequirementNecessity,
  ActivationRequirementOwner,
  ActivationRequirementStatus,
} from '../services/activation/requirementLifecycle';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

/**
 * Identity for every route in this module.
 *
 * These handlers read and mutate the start lifecycle of a real hire, so they use
 * the same boundary as the packet read in `applications.ts`: a cryptographically
 * verified Clerk session, never the forgeable `x-clerk-user-id` header, even
 * while CLERK_JWT_VERIFICATION is in shadow rollout.
 *
 * Consequence to know before wiring a caller: `verifiedIdentity` only populates
 * `req.verifiedAuth` when the mode is `shadow` or `enforce`. With the flag `off`
 * (the local/test default) every route here 401s. That is deliberate — fail
 * closed — and it is why web callers must forward the bearer token via
 * `applyIdentityHeaders` (apps/web/lib/auth/forwardIdentity.ts), which sends
 * `Authorization: Bearer <clerk jwt>` alongside the identity header.
 */
function requireVerifiedClerkUserId(req: Request): string {
  const verifiedUserId = (req as Request & { verifiedAuth?: VerifiedAuth })
    .verifiedAuth?.verifiedUserId?.trim();
  if (!verifiedUserId) {
    throw new HttpError(401, 'Verified Clerk session required.');
  }
  return verifiedUserId;
}

// Application.id / ActivationRequirement.id are Postgres uuid columns — querying
// them with a non-uuid string makes Prisma throw (a 500) instead of returning
// null, so validate the shape before it reaches a query.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuidParam(value: string | undefined, label: string): string {
  const id = value?.trim();
  if (!id || !UUID_RE.test(id)) throw new HttpError(404, `${label} not found.`);
  return id;
}

/**
 * Resolve the caller's organization from the membership store, keyed on their
 * VERIFIED Clerk id. This is the only acceptable source of org scope here:
 * `x-org-id` and `x-org-role` are both caller-supplied, and `requireOrgRole`
 * answers "does the caller claim an allowed role?", never "is the caller in the
 * org that owns this record?".
 */
async function resolveCallerOrganizationId(clerkUserId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

const REQUIREMENT_STATUSES = new Set<ActivationRequirementStatus>([
  'not_started', 'requested', 'submitted', 'under_review',
  'met', 'waived', 'not_applicable', 'blocked', 'expired',
]);
const REQUIREMENT_CATEGORIES = new Set<ActivationRequirementCategory>([
  'evidence', 'policy', 'onboarding', 'contract', 'manual_review',
]);
const REQUIREMENT_NECESSITIES = new Set<ActivationRequirementNecessity>(['required', 'preferred']);
const REQUIREMENT_OWNERS = new Set<ActivationRequirementOwner>(['clinician', 'employer', 'both', 'system']);

/** Render a start-lifecycle failure. `not_start_ready` names the blocking
 *  requirements; every other failure carries the current derived state. Always
 *  409 — the request was well-formed but the lifecycle forbids the transition. */
function sendStartFailure(res: Response, result: Extract<StartActionResult, { ok: false }>): void {
  if (result.reason === 'not_start_ready') {
    res.status(409).json({ ok: false, reason: result.reason, blocking: result.blocking });
    return;
  }
  res.status(409).json({ ok: false, reason: result.reason, state: result.state });
}

interface ResolvedApplication {
  readonly organizationId: string;
  readonly clinicianNpi: string | null;
  readonly applicantClerkUserId: string;
}

/** Resolve an application to the org that owns its opportunity (the tenant the
 *  services enforce) plus the applicant, or 404 if it does not exist. */
async function resolveApplication(applicationId: string): Promise<ResolvedApplication> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      clerkUserId: true,
      npi: true,
      opportunity: { select: { organizationId: true } },
    },
  });
  if (!application) throw new HttpError(404, `Application ${applicationId} not found.`);
  return {
    organizationId: application.opportunity.organizationId,
    clinicianNpi: application.npi,
    applicantClerkUserId: application.clerkUserId,
  };
}

/**
 * A caller outside the owning org gets the SAME 404 as an unknown id, so these
 * endpoints cannot be used to enumerate other organizations' applications —
 * matching the uniform-404 contract on the ACT-7.1 clinician read.
 */
function notFound(applicationId: string): HttpError {
  return new HttpError(404, `Application ${applicationId} not found.`);
}

/**
 * Membership gate for the employer surface: the caller must belong to the org
 * that owns the application's opportunity.
 *
 * This is the check whose absence made every route in this module cross-tenant.
 * Note that the services' own `wrong_tenant` guard could never catch it: the
 * route reads `organizationId` off the TARGET application and passes that same
 * value down, so `row.organizationId !== input.organizationId` is always false.
 * A tenant check is only meaningful against the CALLER's org, which is why it
 * has to happen here.
 */
async function assertCallerInOwningOrg(
  clerkUserId: string,
  resolved: ResolvedApplication,
  applicationId: string,
): Promise<void> {
  const callerOrganizationId = await resolveCallerOrganizationId(clerkUserId);
  if (!callerOrganizationId || callerOrganizationId !== resolved.organizationId) {
    throw notFound(applicationId);
  }
}

/** Reads are visible to the owning clinician, or to a member of the owning org. */
async function resolveReadableApplication(req: Request, applicationId: string): Promise<ResolvedApplication> {
  const caller = requireVerifiedClerkUserId(req);
  const resolved = await resolveApplication(applicationId);
  if (resolved.applicantClerkUserId === caller) return resolved;

  await assertCallerInOwningOrg(caller, resolved, applicationId);
  return resolved;
}

/**
 * Employer-side mutations: verified identity, then membership in the owning org.
 * `requireOrgRole` still runs as route middleware and remains the right place
 * for role capability WITHIN an org — it is stacked on top of this check, never
 * used in place of it.
 */
async function resolveMutableApplication(
  req: Request,
  applicationId: string,
): Promise<{ resolved: ResolvedApplication; actorId: string }> {
  const actorId = requireVerifiedClerkUserId(req);
  const resolved = await resolveApplication(applicationId);
  await assertCallerInOwningOrg(actorId, resolved, applicationId);
  return { resolved, actorId };
}

function validateRequirementSeeds(value: unknown): RequirementSeed[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, 'requirements must be a non-empty array.');
  }
  return value.map((raw, i) => {
    const seed = raw as Record<string, unknown>;
    const category = seed.category as ActivationRequirementCategory;
    const necessity = seed.necessity as ActivationRequirementNecessity;
    const owner = seed.owner as ActivationRequirementOwner;
    const label = typeof seed.label === 'string' ? seed.label.trim() : '';
    if (!label) throw new HttpError(400, `requirements[${i}].label is required.`);
    if (!REQUIREMENT_CATEGORIES.has(category)) throw new HttpError(400, `requirements[${i}].category is invalid.`);
    if (!REQUIREMENT_NECESSITIES.has(necessity)) throw new HttpError(400, `requirements[${i}].necessity is invalid.`);
    if (!REQUIREMENT_OWNERS.has(owner)) throw new HttpError(400, `requirements[${i}].owner is invalid.`);
    return {
      sourceRequirementId: typeof seed.sourceRequirementId === 'string' ? seed.sourceRequirementId : undefined,
      category,
      label,
      necessity,
      owner,
      evidenceRule: typeof seed.evidenceRule === 'string' ? seed.evidenceRule : undefined,
      dependencyIds: Array.isArray(seed.dependencyIds)
        ? seed.dependencyIds.filter((d): d is string => typeof d === 'string')
        : undefined,
      policyVersion: typeof seed.policyVersion === 'string' ? seed.policyVersion : undefined,
    } satisfies RequirementSeed;
  });
}

export function registerActivationRoutes(app: Express): void {
  // The ledger READ — GET /api/applications/:appId/activation — is owned by
  // ACT-7.1 (`applications.ts`, #805). This module adds only the mutation and
  // start-state surface below; it must not re-register that read.

  // ── Instantiate the ledger for an application (employer, once, after a decision) ──
  app.post(
    '/api/applications/:appId/activation/instantiate',
    requireOrgRole(VERIFIER_MUTATION_ROLES),
    asyncHandler(async (req, res) => {
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const { resolved: { organizationId, clinicianNpi } } = await resolveMutableApplication(req, applicationId);

      const body = (req.body ?? {}) as { requirements?: unknown; acceptedEvidenceKeys?: unknown };
      const requirements = validateRequirementSeeds(body.requirements);
      const acceptedEvidenceKeys = Array.isArray(body.acceptedEvidenceKeys)
        ? body.acceptedEvidenceKeys.filter((k): k is string => typeof k === 'string')
        : undefined;

      const result = await instantiateActivationRequirements({
        applicationId,
        organizationId,
        clinicianNpi,
        requirements,
        acceptedEvidenceKeys,
      });
      res.status(result.skipped ? 200 : 201).json(result);
    }),
  );

  // ── Resolve a single requirement to a new status ──
  app.patch(
    '/api/applications/:appId/activation/requirements/:requirementId',
    requireOrgRole(VERIFIER_MUTATION_ROLES),
    asyncHandler(async (req, res) => {
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const requirementId = requireUuidParam(req.params.requirementId, 'Requirement');
      const { resolved: { organizationId }, actorId } = await resolveMutableApplication(req, applicationId);

      const { toStatus, reason, policyVersion } = (req.body ?? {}) as {
        toStatus?: string; reason?: string; policyVersion?: string;
      };
      if (!toStatus || !REQUIREMENT_STATUSES.has(toStatus as ActivationRequirementStatus)) {
        throw new HttpError(400, 'toStatus is required and must be a valid requirement status.');
      }

      const result = await resolveActivationRequirement({
        requirementId,
        organizationId,
        toStatus: toStatus as ActivationRequirementStatus,
        actorId,
        reason,
        policyVersion,
      });
      if (result.ok) {
        res.json({ ok: true });
        return;
      }
      // Unknown and foreign requirement ids are deliberately indistinguishable:
      // a 403 here would confirm to a foreign org that the requirement exists.
      const status = result.reason === 'not_found' || result.reason === 'wrong_tenant' ? 404 : 409;
      res.status(status).json({ ok: false, reason: result.reason });
    }),
  );

  // ── Read the start-state ──
  app.get(
    '/api/applications/:appId/start-state',
    asyncHandler(async (req, res) => {
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      await resolveReadableApplication(req, applicationId);
      const state = await getApplicationStartState(applicationId);
      res.json({ state });
    }),
  );

  // ── Mark start-ready (gated: refuses while a required requirement is open) ──
  app.post(
    '/api/applications/:appId/start-ready',
    requireOrgRole(VERIFIER_MUTATION_ROLES),
    asyncHandler(async (req, res) => {
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const { resolved: { organizationId }, actorId } = await resolveMutableApplication(req, applicationId);

      const result = await markStartReady({ applicationId, organizationId, actorId });
      if (result.ok) {
        res.json({ ok: true, state: result.state });
        return;
      }
      sendStartFailure(res, result);
    }),
  );

  // ── Record that the clinician actually started ──
  app.post(
    '/api/applications/:appId/start',
    requireOrgRole(VERIFIER_MUTATION_ROLES),
    asyncHandler(async (req, res) => {
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const { resolved: { organizationId }, actorId } = await resolveMutableApplication(req, applicationId);

      const { startedAt } = (req.body ?? {}) as { startedAt?: string };
      if (!startedAt || Number.isNaN(Date.parse(startedAt))) {
        throw new HttpError(400, 'startedAt is required and must be a valid ISO date.');
      }

      const result = await confirmApplicationStart({
        applicationId,
        organizationId,
        actorId,
        startedAt: new Date(startedAt),
      });
      res.status(result.duplicate ? 200 : 201).json({
        ok: true,
        state: result.state,
        duplicate: result.duplicate,
        startAttestationId: result.attestation.id,
        actualFirstDay: result.attestation.startedAt.toISOString(),
        lifecycleAuditEventId: result.lifecycleAuditEventId,
        attestationAuditEventId: result.attestationAuditEventId,
      });
    }),
  );

  // ── Cancel / withdraw (records a reason, never deletes history) ──
  app.post(
    '/api/applications/:appId/start/cancel',
    requireOrgRole(VERIFIER_MUTATION_ROLES),
    asyncHandler(async (req, res) => {
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const { resolved: { organizationId }, actorId } = await resolveMutableApplication(req, applicationId);

      const { reasonCode } = (req.body ?? {}) as { reasonCode?: string };
      if (!reasonCode?.trim()) throw new HttpError(400, 'reasonCode is required.');

      const result = await cancelStart({ applicationId, organizationId, actorId, reasonCode: reasonCode.trim() });
      if (result.ok) {
        res.json({ ok: true, state: result.state });
        return;
      }
      sendStartFailure(res, result);
    }),
  );
}
