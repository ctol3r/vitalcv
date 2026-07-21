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
 *   - Tenant scope is defense-in-depth: the org is resolved here from
 *     `application → opportunity → organizationId` and passed to the service,
 *     which independently rejects a cross-tenant requirement (`wrong_tenant`).
 *   - Employer mutations sit behind `requireOrgRole(VERIFIER_MUTATION_ROLES)`.
 *     Until G1 (verified identity) is at enforce, org-role is a header-trust
 *     boundary — the same boundary every other verifier mutation route accepts.
 *   - start-ready is gated by the readiness predicate: `markStartReady` refuses
 *     while any REQUIRED requirement is open and names the blockers, so 409
 *     always points at an actionable requirement.
 *
 * NOT in scope here (ACT-7.4, needs a founder/architect decision — see
 * docs/design/act-7-activation-http-surface.md): reconciling this
 * application-scoped START_* lifecycle with the live entity-scoped
 * `POST /api/employer-review/:entityId/confirm-start` attestation path. This
 * module does not touch confirm-start.
 */

import type { Express, NextFunction, Request, Response } from 'express';

import prisma from '../graphql/prisma_client';
import { HttpError } from '../utils/httpError';
import { requireOrgRole, VERIFIER_MUTATION_ROLES } from '../middleware/orgRoleGuard';
import {
  instantiateActivationRequirements,
  resolveActivationRequirement,
  type RequirementSeed,
} from '../services/activation/activationRequirementService';
import {
  getApplicationStartState,
  markStartReady,
  recordStart,
  cancelStart,
  type StartActionResult,
} from '../services/activation/startEventService';
import type {
  ActivationRequirementCategory,
  ActivationRequirementNecessity,
  ActivationRequirementOwner,
  ActivationRequirementStatus,
} from '../services/activation/requirementLifecycle';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
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

const ORG_ROLES = new Set(['admin', 'reviewer', 'read_only']);

function hasOrgRole(req: Request): boolean {
  const role = (req.headers['x-org-role'] as string | undefined)?.trim();
  return role != null && ORG_ROLES.has(role);
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

/** Reads are visible to the owning clinician or any org member (employer side).
 *  The read services do not enforce tenant, so authorization happens here. */
async function resolveReadableApplication(req: Request, applicationId: string): Promise<ResolvedApplication> {
  const caller = requireClerkUserId(req);
  const resolved = await resolveApplication(applicationId);
  const isApplicant = resolved.applicantClerkUserId === caller;
  if (!isApplicant && !hasOrgRole(req)) {
    throw new HttpError(403, 'Not authorized to view this application activation.');
  }
  return resolved;
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
      requireClerkUserId(req);
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const { organizationId, clinicianNpi } = await resolveApplication(applicationId);

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
      const actorId = requireClerkUserId(req);
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const requirementId = requireUuidParam(req.params.requirementId, 'Requirement');
      const { organizationId } = await resolveApplication(applicationId);

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
      const status = result.reason === 'not_found' ? 404 : result.reason === 'wrong_tenant' ? 403 : 409;
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
      const actorId = requireClerkUserId(req);
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const { organizationId } = await resolveApplication(applicationId);

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
      const actorId = requireClerkUserId(req);
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const { organizationId } = await resolveApplication(applicationId);

      const { startedAt } = (req.body ?? {}) as { startedAt?: string };
      if (!startedAt || Number.isNaN(Date.parse(startedAt))) {
        throw new HttpError(400, 'startedAt is required and must be a valid ISO date.');
      }

      const result = await recordStart({ applicationId, organizationId, actorId, startedAt });
      if (result.ok) {
        res.json({ ok: true, state: result.state });
        return;
      }
      sendStartFailure(res, result);
    }),
  );

  // ── Cancel / withdraw (records a reason, never deletes history) ──
  app.post(
    '/api/applications/:appId/start/cancel',
    requireOrgRole(VERIFIER_MUTATION_ROLES),
    asyncHandler(async (req, res) => {
      const actorId = requireClerkUserId(req);
      const applicationId = requireUuidParam(req.params.appId, 'Application');
      const { organizationId } = await resolveApplication(applicationId);

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
