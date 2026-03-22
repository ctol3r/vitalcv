/**
 * opportunities.ts — Wave 227
 *
 * Routes:
 *   POST   /api/employer/setup          — upsert org profile (verifier onboarding)
 *   GET    /api/employer/profile        — get current org profile
 *   POST   /api/opportunities           — post a new opportunity
 *   GET    /api/opportunities           — list public active opportunities
 *   GET    /api/employer/opportunities  — list my org's opportunities
 *   GET    /api/candidates              — list verified clinicians (for verifiers)
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { seedLaunchOpportunities } from '../services/opportunities/launchOpportunitySeed';
import {
  createOpportunity,
  getPublicOpportunityById,
  getOrgProfile,
  listCandidates,
  listOpportunitiesForOrg,
  listPublicOpportunities,
  upsertOrgProfile,
} from '../services/opportunities/opportunityService';
import { HttpError } from '../utils/httpError';
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
        requirementLevel?: string;
        description?: string;
        remote?: boolean;
      };

      if (!body.title?.trim()) throw new HttpError(400, 'title is required.');
      if (!body.specialty?.trim()) throw new HttpError(400, 'specialty is required.');
      if (!body.hiringType?.trim()) throw new HttpError(400, 'hiringType is required.');
      if (!body.state?.trim()) throw new HttpError(400, 'state is required.');

      const opp = await createOpportunity(clerkUserId, {
        title: body.title.trim(),
        specialty: body.specialty.trim(),
        hiringType: body.hiringType.trim(),
        state: body.state.trim(),
        payRange: body.payRange?.trim(),
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
      const { specialty, state, hiringType, organizationSlug, payModel, visaSponsorship, benefits, employerType, startUrgency, readinessStatus, missingRequirement, npi, remote } = req.query;
      const result = await listPublicOpportunities({
        specialty: typeof specialty === 'string' ? specialty : undefined,
        state: typeof state === 'string' ? state : undefined,
        hiringType: typeof hiringType === 'string' ? hiringType : undefined,
        organizationSlug: typeof organizationSlug === 'string' ? organizationSlug : undefined,
        remote: remote === 'true' || remote === '1',
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

      const opportunity = await getPublicOpportunityById(opportunityId, {
        clinicianNpi: typeof req.query.npi === 'string' ? req.query.npi : undefined,
        clerkUserId: (req.headers['x-clerk-user-id'] as string | undefined)?.trim() ?? null,
      });
      if (!opportunity) {
        throw new HttpError(404, 'Opportunity not found.');
      }

      res.json({ opportunity });
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

  app.get(
    '/api/candidates',
    asyncHandler(async (req, res) => {
      const { specialty, state } = req.query;
      const result = await listCandidates({
        specialty: typeof specialty === 'string' ? specialty : undefined,
        state: typeof state === 'string' ? state : undefined,
        limit: parsePositiveInt(req.query.limit, 20),
        offset: parsePositiveInt(req.query.offset, 0),
      });
      res.json(result);
    }),
  );

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
}
