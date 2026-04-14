/**
 * hiring.ts — Wave 41 (updated Wave 42): Start Attestation + Billing Engine
 *
 * Closes the ON Loop and triggers usage-based billing.
 *
 * POST /api/hiring/accept
 * ────────────────────────
 * Records an employer's formal decision to hire a clinician.
 * Creates an EmployerAcceptance row.  Unchanged from Wave 41.
 *
 * POST /api/hiring/start  ← UPDATED in Wave 42
 * ────────────────────────
 * Records the clinician's first day.  Wave 42 additions:
 *
 *   ATOMIC TRANSACTION
 *   ─────────────────
 *   StartAttestation + AuditEvent + BillingEvent(PENDING) are written in a
 *   single Prisma transaction.  Either all three are persisted or none are —
 *   preventing orphaned billing records or untracked start events.
 *
 *   ASYNC STRIPE BILLING
 *   ────────────────────
 *   After the transaction commits, `recordSuccessfulHire()` is called
 *   fire-and-forget.  On success the BillingEvent is updated to BILLED.
 *   On failure (network error, Stripe outage) it is updated to ERROR with
 *   the error message, without rolling back the start attestation.
 *   When STRIPE_SECRET_KEY is absent it is set to SKIPPED (dev/test).
 *
 * SECURITY
 * ────────
 * Both routes sit behind apiKeyAuth + publicApiRateLimit.
 */

import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { apiKeyAuth, publicApiRateLimit } from '../middleware/publicSafety';
import { sha256ForPayload } from '../utils/deterministic';
import { recordSuccessfulHire, VERIFIED_HIRE_AMOUNT_CENTS, VERIFIED_HIRE_CURRENCY } from '../services/billing/stripeClient';
import { computeClinicianTrustState } from '../services/trust/trustStateEngine';
import { capsuleEngine } from '../services/decision/capsuleEngine';
import {
  DEFAULT_PILOT_POLICY,
  evaluatePilotReadiness,
  parseOrganizationRequirementsEnvelope,
  type PilotReadinessEvaluation,
} from '../services/employers/pilotPolicy';

// ── Helpers ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NPI_RE  = /^\d{10}$/;

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function isNpi(v: unknown): v is string {
  return typeof v === 'string' && NPI_RE.test(v);
}

// ── Request body shapes ────────────────────────────────────────────────────

interface AcceptBody {
  employerId:   string;
  clinicianNpi: string;
  artifactId?:  string;
}

interface StartBody {
  acceptanceId: string;
  role:         string;
  facility:     string;
  /** ISO 8601 timestamp — may be future-dated for pre-scheduled starts. */
  startedAt:    string;
}

async function getEmployerPilotContext(employerId: string): Promise<{
  organizationId?: string;
  policy: typeof DEFAULT_PILOT_POLICY;
}> {
  const profile = await prisma.organizationProfile.findUnique({
    where: { organizationId: employerId },
    select: { organizationId: true, requirements: true },
  });

  if (!profile) {
    return { policy: DEFAULT_PILOT_POLICY };
  }

  const envelope = parseOrganizationRequirementsEnvelope(profile.requirements, []);
  return {
    organizationId: profile.organizationId,
    policy: {
      pilotMode: envelope.pilotMode,
      organizationAcceptanceRules: envelope.organizationAcceptanceRules,
      trustAcceptanceContracts: envelope.trustAcceptanceContracts,
    },
  };
}

async function buildPilotReadinessEvaluation(
  employerId: string,
  clinicianNpi: string,
): Promise<PilotReadinessEvaluation | null> {
  const { policy } = await getEmployerPilotContext(employerId);
  if (!policy.pilotMode) {
    return null;
  }

  const trustState = await computeClinicianTrustState(clinicianNpi);
  return evaluatePilotReadiness(trustState, policy);
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerHiringRoutes(app: Express): void {

  // ── POST /api/hiring/accept (stubbed: EmployerAcceptance model removed) ──
  app.post(
    '/api/hiring/accept',
    apiKeyAuth,
    publicApiRateLimit,
    (_req: Request, res: Response) => {
      res.status(501).json({ error: 'Not implemented' });
    },
  );

  // ── POST /api/hiring/start (stubbed: StartAttestation + BillingEvent models removed) ──
  app.post(
    '/api/hiring/start',
    apiKeyAuth,
    publicApiRateLimit,
    (_req: Request, res: Response) => {
      res.status(501).json({ error: 'Not implemented' });
    },
  );
}
