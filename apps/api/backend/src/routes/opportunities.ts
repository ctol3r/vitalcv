/**
 * opportunities.ts — Wave 227
 *
 * Routes:
 *   POST   /api/employer/setup          — upsert org profile (verifier onboarding)
 *   GET    /api/employer/profile        — get current org profile
 *   POST   /api/opportunities           — post a new opportunity
 *   GET    /api/opportunities           — list public active opportunities
 *   GET    /api/employer/opportunities  — list my org's opportunities
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { seedLaunchOpportunities } from '../services/opportunities/launchOpportunitySeed';
import { ingestAllFeeds } from '../services/ingestion/ingestionRunner';
import {
  createOpportunity,
  getPublicOpportunityById,
  getOrgProfile,
  listOpportunitiesForOrg,
  listPublicOpportunities,
  updateOpportunity,
  upsertOrgProfile,
} from '../services/opportunities/opportunityService';
import type { UpdateOpportunityInput } from '../services/opportunities/opportunityService';
import { HttpError } from '../utils/httpError';
import { emitLearningEvent } from '../services/feedback/prismaEventStore';
import prisma from '../graphql/prisma_client';
import { sha256ForPayload } from '../utils/deterministic';
import type { EmployerRequirementSpec } from '../services/employers/employerCatalog';
import type {
  AutomationRules,
  OrganizationAcceptanceRules,
  TrustAcceptanceContracts,
} from '../services/employers/pilotPolicy';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

// Opportunity.id is a Postgres uuid column — querying it with a non-uuid
// string makes Prisma throw (a 500) instead of returning null.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function registerOpportunityRoutes(app: Express): void {
  /* ── Employer org setup ── */

  app.post(
    '/api/employer/setup',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const body = req.body as {
        name?: string;
        npi?: string;
        facilityType?: string;
        specialties?: string[];
        statesCovered?: string[];
        tagline?: string;
        description?: string;
        website?: string;
        hiringTypes?: string[];
        requirements?: EmployerRequirementSpec[];
        pilotMode?: boolean;
        organizationAcceptanceRules?: OrganizationAcceptanceRules;
        trustAcceptanceContracts?: TrustAcceptanceContracts;
        automationRules?: AutomationRules;
      };

      if (!body.name?.trim()) throw new HttpError(400, 'Organization name is required.');

      const result = await upsertOrgProfile(clerkUserId, {
        name: body.name.trim(),
        npi: body.npi,
        facilityType: body.facilityType,
        specialties: body.specialties,
        statesCovered: body.statesCovered,
        tagline: body.tagline,
        description: body.description,
        website: body.website,
        hiringTypes: body.hiringTypes,
        requirements: body.requirements,
        pilotMode: body.pilotMode,
        organizationAcceptanceRules: body.organizationAcceptanceRules,
        trustAcceptanceContracts: body.trustAcceptanceContracts,
        automationRules: body.automationRules,
      });

      if (
        body.pilotMode !== undefined
        || body.organizationAcceptanceRules !== undefined
        || body.trustAcceptanceContracts !== undefined
        || body.automationRules !== undefined
      ) {
        await prisma.auditEvent.create({
          data: {
            type: 'PILOT_POLICY_UPDATED',
            hash: sha256ForPayload({
              organizationId: result.organizationId,
              pilotMode: body.pilotMode ?? false,
              organizationAcceptanceRules: body.organizationAcceptanceRules ?? null,
              trustAcceptanceContracts: body.trustAcceptanceContracts ?? null,
              automationRules: body.automationRules ?? null,
            }),
            organizationId: result.organizationId,
            metadata: JSON.parse(JSON.stringify({
              pilotMode: body.pilotMode ?? false,
              organizationAcceptanceRules: body.organizationAcceptanceRules ?? null,
              trustAcceptanceContracts: body.trustAcceptanceContracts ?? null,
              automationRules: body.automationRules ?? null,
            })),
          },
        }).catch((error: unknown) => {
          throw new HttpError(500, `Failed to persist pilot policy audit event: ${String(error)}`);
        });
      }

      res.status(201).json(result);
    }),
  );

  app.get(
    '/api/employer/profile',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const profile = await getOrgProfile(clerkUserId);
      if (!profile) return void res.status(404).json({ error: 'No organization profile found.' });
      res.json(profile);
    }),
  );

  /* ── Opportunities ── */

  app.post(
    '/api/opportunities',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const body = req.body as {
        title?: string;
        specialty?: string;
        hiringType?: string;
        state?: string;
        payRange?: string;
        payMin?: number;
        payMax?: number;
        employerType?: string;
        startUrgency?: string;
        requirementLevel?: string;
        description?: string;
        remote?: boolean;
      };

      if (!body.title?.trim()) throw new HttpError(400, 'title is required.');
      if (!body.specialty?.trim()) throw new HttpError(400, 'specialty is required.');
      if (!body.hiringType?.trim()) throw new HttpError(400, 'hiringType is required.');
      if (!body.state?.trim()) throw new HttpError(400, 'state is required.');

      const toPosInt = (v: unknown): number | undefined => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
      };

      const opp = await createOpportunity(clerkUserId, {
        title: body.title.trim(),
        specialty: body.specialty.trim(),
        hiringType: body.hiringType.trim(),
        state: body.state.trim(),
        payRange: body.payRange?.trim(),
        payMin: toPosInt(body.payMin),
        payMax: toPosInt(body.payMax),
        employerType: body.employerType?.trim() || undefined,
        startUrgency: body.startUrgency?.trim() || undefined,
        requirementLevel: body.requirementLevel ?? 'L1',
        description: body.description?.trim(),
        remote: Boolean(body.remote),
      });

      res.status(201).json(opp);
    }),
  );

  app.get(
    '/api/opportunities',
    asyncHandler(async (req, res) => {
      const { q, specialty, profession, schedule, state, hiringType, organizationSlug, payModel, visaSponsorship, benefits, employerType, startUrgency, readinessStatus, missingRequirement, npi, remote } = req.query;
      const result = await listPublicOpportunities({
        // Free-text keyword, matched against the Postgres tsvector. Length-capped
        // so a pathological query cannot make the text-search parser do
        // unbounded work on an unauthenticated route.
        q: typeof q === 'string' ? q.slice(0, 200) : undefined,
        specialty: typeof specialty === 'string' ? specialty : undefined,
        profession: typeof profession === 'string'
          ? profession as 'physician' | 'advanced_practice' | 'nursing' | 'behavioral_health' | 'allied_health' | 'not_stated'
          : undefined,
        schedule: typeof schedule === 'string'
          ? schedule as 'full_time' | 'part_time' | 'per_diem' | 'flexible' | 'not_stated'
          : undefined,
        state: typeof state === 'string' ? state : undefined,
        hiringType: typeof hiringType === 'string' ? hiringType : undefined,
        organizationSlug: typeof organizationSlug === 'string' ? organizationSlug : undefined,
        remote: remote === 'true' || remote === '1'
          ? true
          : remote === 'false' || remote === '0'
            ? false
            : undefined,
        payModel: typeof payModel === 'string' ? payModel as 'salary' | 'hourly' | 'locums' | 'shift' | 'unknown' : undefined,
        payMin: parseOptionalNumber(req.query.payMin),
        payMax: parseOptionalNumber(req.query.payMax),
        visaSponsorship: typeof visaSponsorship === 'string'
          ? visaSponsorship as 'available' | 'case_by_case' | 'not_available' | 'not_stated'
          : undefined,
        benefits: typeof benefits === 'string'
          ? benefits as 'listed' | 'limited' | 'not_listed'
          : undefined,
        employerType: typeof employerType === 'string' ? employerType : undefined,
        startUrgency: typeof startUrgency === 'string'
          ? startUrgency as 'immediate' | 'within_2_weeks' | 'within_month' | 'flexible' | 'unknown'
          : undefined,
        readinessStatus: typeof readinessStatus === 'string'
          ? readinessStatus as 'ready_now' | 'needs_review' | 'requirements_missing'
          : undefined,
        missingRequirement: typeof missingRequirement === 'string' ? missingRequirement : undefined,
        clinicianNpi: typeof npi === 'string' ? npi : undefined,
        clerkUserId: (req.headers['x-clerk-user-id'] as string | undefined)?.trim() ?? null,
        limit: parsePositiveInt(req.query.limit, 20),
        offset: parsePositiveInt(req.query.offset, 0),
      });
      res.json(result);
    }),
  );

  app.get(
    '/api/opportunities/:id',
    asyncHandler(async (req, res) => {
      const opportunityId = req.params.id?.trim();
      if (!opportunityId) {
        throw new HttpError(400, 'Opportunity id is required.');
      }
      if (!UUID_RE.test(opportunityId)) {
        throw new HttpError(404, 'Opportunity not found.');
      }

      const opportunity = await getPublicOpportunityById(opportunityId, {
        clinicianNpi: typeof req.query.npi === 'string' ? req.query.npi : undefined,
        clerkUserId: (req.headers['x-clerk-user-id'] as string | undefined)?.trim() ?? null,
      });
      if (!opportunity) {
        throw new HttpError(404, 'Opportunity not found.');
      }

      // Learning: track job viewed event (fire-and-forget)
      const viewerNpi = typeof req.query.npi === 'string' ? req.query.npi : undefined;
      if (viewerNpi) {
        emitLearningEvent({ type: 'JOB_VIEWED', providerId: viewerNpi, jobId: opportunityId, payload: {}, metadata: {} });
      }

      res.json({ opportunity });
    }),
  );

  app.patch(
    '/api/opportunities/:id',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);

      const opportunityId = req.params.id?.trim();
      if (!opportunityId) {
        throw new HttpError(400, 'Opportunity id is required.');
      }
      if (!UUID_RE.test(opportunityId)) {
        throw new HttpError(404, 'Opportunity not found.');
      }

      const body = req.body as {
        title?: string;
        specialty?: string;
        hiringType?: string;
        state?: string;
        payRange?: string | null;
        payMin?: number | string | null;
        payMax?: number | string | null;
        employerType?: string | null;
        startUrgency?: string | null;
        requirementLevel?: string;
        description?: string | null;
        remote?: boolean;
        status?: string;
      };

      const toPosInt = (v: unknown): number | undefined => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
      };
      const requireTrimmed = (value: unknown, label: string): string => {
        const s = typeof value === 'string' ? value.trim() : '';
        if (!s) throw new HttpError(400, `${label} cannot be empty.`);
        return s;
      };
      const trimmedOrNull = (value: unknown): string | null => {
        const s = typeof value === 'string' ? value.trim() : '';
        return s || null;
      };

      if (
        body.status !== undefined
        && body.status !== 'ACTIVE'
        && body.status !== 'CLOSED'
      ) {
        throw new HttpError(400, "status must be 'ACTIVE' or 'CLOSED'.");
      }

      // Build a partial patch: only keys present on the body are forwarded.
      const fields: UpdateOpportunityInput = {};
      if (body.title !== undefined) fields.title = requireTrimmed(body.title, 'title');
      if (body.specialty !== undefined) fields.specialty = requireTrimmed(body.specialty, 'specialty');
      if (body.hiringType !== undefined) fields.hiringType = requireTrimmed(body.hiringType, 'hiringType');
      if (body.state !== undefined) fields.state = requireTrimmed(body.state, 'state');
      if (body.payRange !== undefined) fields.payRange = trimmedOrNull(body.payRange);
      if (body.payMin !== undefined) fields.payMin = toPosInt(body.payMin) ?? null;
      if (body.payMax !== undefined) fields.payMax = toPosInt(body.payMax) ?? null;
      if (body.employerType !== undefined) fields.employerType = trimmedOrNull(body.employerType);
      if (body.startUrgency !== undefined) fields.startUrgency = trimmedOrNull(body.startUrgency);
      if (body.requirementLevel !== undefined) fields.requirementLevel = trimmedOrNull(body.requirementLevel) ?? 'L1';
      if (body.description !== undefined) fields.description = trimmedOrNull(body.description);
      if (body.remote !== undefined) fields.remote = Boolean(body.remote);
      // Validated to be one of the two literals by the guard above.
      if (body.status !== undefined) fields.status = body.status as 'ACTIVE' | 'CLOSED';

      const opp = await updateOpportunity(clerkUserId, opportunityId, fields);
      res.json(opp);
    }),
  );

  app.get(
    '/api/employer/opportunities',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const opps = await listOpportunitiesForOrg(clerkUserId);
      res.json({ opportunities: opps, total: opps.length });
    }),
  );

  /* ── Candidates ── */

  /*
   * `/api/candidates` is REMOVED, not merely guarded.
   *
   * The handler served clinician records to any caller: it performed no
   * identity check, while every sibling route in this file calls
   * `requireClerkUserId` first. The Next.js proxy in front of it did require a
   * session, which is why the gap was invisible from inside the app — the
   * proxy was the only enforcement, and it is bypassable by addressing the API
   * host directly.
   *
   * It is deleted rather than rebuilt behind authorization because its only
   * consumer was an archived page. Re-adding an authorized candidate listing
   * would restore attack surface that no shipping surface asks for. A future
   * candidate-list API needs its own security and product review.
   *
   * `candidates-route-removed.test.ts` asserts this route stays absent.
   */

  /* ── Admin: Seed launch opportunities ── */
  app.post(
    '/api/admin/seed-opportunities',
    asyncHandler(async (req, res, _next) => {
      const authHeader = req.headers.authorization ?? '';
      const expected = process.env.ADMIN_SEED_TOKEN;
      if (!expected || authHeader !== `Bearer ${expected}`) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const logs: string[] = [];
      const summary = await seedLaunchOpportunities(
        undefined!,
        (level, message) => { logs.push(`[${level}] ${message}`); },
      );
      res.json({ ...summary, logs });
    }),
  );

  /**
   * Run the job-feed ingestion.
   *
   * Admin-token gated and manually triggered rather than on a timer: the first
   * runs of a new feed should be looked at by a person before anything is put
   * on a schedule. A connector whose credentials are unset reports itself
   * skipped with the variables it needs, so an unconfigured feed is visible in
   * the response instead of looking like a feed with no jobs.
   */
  app.post(
    '/api/admin/ingest-opportunities',
    asyncHandler(async (req, res) => {
      const authHeader = req.headers.authorization ?? '';
      const expected = process.env.ADMIN_SEED_TOKEN;
      if (!expected || authHeader !== `Bearer ${expected}`) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      const limit = parsePositiveInt(req.query.limit, 200);
      const reports = await ingestAllFeeds({ limit });

      res.json({
        reports,
        configured: reports.filter((report) => report.ran).map((report) => report.feed),
        skipped: reports
          .filter((report) => !report.ran)
          .map((report) => ({ feed: report.feed, reason: report.skippedReason })),
      });
    }),
  );
}
