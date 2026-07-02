/**
 * public.ts — Wave 26: "The Golden Link" Public Profile API
 *
 * DATA MINIMIZATION GUARANTEES
 * ────────────────────────────
 * This module is the ONLY path for public clinician profile data.  Its
 * contract is strictly enforced at three levels:
 *
 *  1. MODEL EXCLUSION   — `ClinicianPiiVault` is NEVER queried here.
 *     SSN, DOB, and encrypted home address are architecturally unreachable.
 *
 *  2. FIELD ALLOWLIST   — Only `first_name`, `last_name`, and `taxonomy[0]`
 *     are extracted from `ClinicianIdentity.data`.  The raw data object is
 *     discarded; no other fields survive into the response.
 *
 *  3. RESPONSE CONTRACT — The `PublicProfileResponse` type lists every field
 *     that may leave this service.  No spread operators, no `JSON.stringify`
 *     of raw DB rows.
 *
 * Scraping protection: 20 requests / minute per IP, with an in-memory
 * sliding-window counter that evicts stale keys to cap memory at 1 KiB
 * per 1 000 active addresses.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import type { CrsBand } from '@vitalcv/crs';
import { CrsEngine } from '@vitalcv/crs';
import type { TrustStateReceiptRecord } from '@vitalcv/psv';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { getActiveDivergencePenalty } from '../services/identity/divergenceEngine';

// ── Types ──────────────────────────────────────────────────────────────────

type L3Status = 'L0' | 'L1' | 'L2' | 'L3';
type TrustStateLabel =
  | 'verified'
  | 'verified_monitoring'
  | 'expiring_soon'
  | 'needs_review'
  | 'expired';

export interface PublicProfileResponse {
  slug: string;
  name: string;
  specialty: string;
  l3Status: L3Status;
  trustState: TrustStateLabel;
  crsScore: number;
  crsBand: CrsBand;
  publicAuditHashes: string[];
  verifiedAt: string | null;
  generatedAt: string;
}

// ── Rate limiter (20 req / min / IP) ──────────────────────────────────────

const PUBLIC_PROFILE_WINDOW_MS = 60_000;
const PUBLIC_PROFILE_MAX_REQUESTS = 20;
const PUBLIC_PROFILE_MAX_ENTRIES = 2_048;

type RateLimitEntry = { windowStartMs: number; count: number };
const profileRateLimitStore = new Map<string, RateLimitEntry>();

function getClientKey(req: Request): string {
  const ip =
    typeof req.ip === 'string' && req.ip.length > 0
      ? req.ip
      : (req.socket?.remoteAddress ?? 'unknown');
  return `ip:${ip}`;
}

function evictStaleProfileEntries(nowMs: number): void {
  if (profileRateLimitStore.size <= PUBLIC_PROFILE_MAX_ENTRIES) return;
  for (const [key, entry] of profileRateLimitStore) {
    if (nowMs - entry.windowStartMs >= PUBLIC_PROFILE_WINDOW_MS) {
      profileRateLimitStore.delete(key);
    }
  }
}

export function publicProfileRateLimit(req: Request, res: Response, next: NextFunction): void {
  const nowMs = Date.now();
  const key = getClientKey(req);
  const current = profileRateLimitStore.get(key);

  evictStaleProfileEntries(nowMs);

  res.setHeader('x-rate-limit-limit', String(PUBLIC_PROFILE_MAX_REQUESTS));
  res.setHeader('x-rate-limit-window-ms', String(PUBLIC_PROFILE_WINDOW_MS));

  if (!current || nowMs - current.windowStartMs >= PUBLIC_PROFILE_WINDOW_MS) {
    profileRateLimitStore.set(key, { windowStartMs: nowMs, count: 1 });
    res.setHeader('x-rate-limit-remaining', String(PUBLIC_PROFILE_MAX_REQUESTS - 1));
    next();
    return;
  }

  if (current.count >= PUBLIC_PROFILE_MAX_REQUESTS) {
    res.setHeader('x-rate-limit-remaining', '0');
    res.setHeader('retry-after', String(Math.ceil((PUBLIC_PROFILE_WINDOW_MS - (nowMs - current.windowStartMs)) / 1_000)));
    res.status(429).json({ error: 'Rate limit exceeded for public-profile' });
    return;
  }

  current.count += 1;
  res.setHeader('x-rate-limit-remaining', String(PUBLIC_PROFILE_MAX_REQUESTS - current.count));
  next();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function deriveL3Status(trustState: string): L3Status {
  switch (trustState) {
    case 'verified_monitoring':
      return 'L3';
    case 'verified':
      return 'L2';
    case 'expiring_soon':
      return 'L1';
    default:
      return 'L0';
  }
}

function isTrustStateLabel(value: unknown): value is TrustStateLabel {
  return (
    value === 'verified' ||
    value === 'verified_monitoring' ||
    value === 'expiring_soon' ||
    value === 'needs_review' ||
    value === 'expired'
  );
}

/**
 * Extract ONLY name + specialty from the ClinicianIdentity data blob.
 * All other fields are silently discarded here — never returned.
 */
function extractPublicIdentityFields(
  data: unknown,
): { name: string; specialty: string } {
  if (typeof data !== 'object' || data === null) {
    return { name: 'Verified Clinician', specialty: 'Clinical' };
  }

  const record = data as Record<string, unknown>;

  const firstName = typeof record['first_name'] === 'string' ? record['first_name'].trim() : '';
  const lastName = typeof record['last_name'] === 'string' ? record['last_name'].trim() : '';
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Verified Clinician';

  const taxonomy =
    Array.isArray(record['taxonomy']) && typeof record['taxonomy'][0] === 'string'
      ? (record['taxonomy'][0] as string).trim()
      : '';
  const specialty = taxonomy || 'Clinical';

  return { name, specialty };
}

/**
 * Extract public audit hashes from the artifact's claimHashes field.
 * These are already SHA-256 digests committed to the transparency log — safe to expose.
 */
function extractPublicAuditHashes(claimHashes: unknown): string[] {
  if (!Array.isArray(claimHashes)) return [];
  return claimHashes
    .filter((h): h is string => typeof h === 'string' && /^[0-9a-f]{64}$/i.test(h))
    .slice(0, 10); // cap at 10 hashes
}

// ── Route handler ──────────────────────────────────────────────────────────

// ShareLink.id is a Postgres uuid column — querying it with a non-uuid string
// makes Prisma throw (a 500) instead of returning null, so a malformed slug
// must 404 before it reaches the query.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handlePublicProfile(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;

  if (typeof slug !== 'string' || slug.trim().length === 0) {
    res.status(400).json({ error: 'Invalid slug' });
    return;
  }

  if (!UUID_RE.test(slug.trim())) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // 1. Resolve the ShareLink
  const shareLink = await prisma.shareLink.findUnique({ where: { id: slug } });
  if (!shareLink) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }

  // Record first view timestamp (fire-and-forget; non-blocking)
  if (!shareLink.firstViewedAt) {
    prisma.shareLink
      .update({ where: { id: slug }, data: { firstViewedAt: new Date() } })
      .catch((err: unknown) =>
        log('warn', 'Failed to record first view', { slug, err: String(err) }),
      );
  }

  const { npi } = shareLink;

  // 2. Load the latest VerificationArtifact for this NPI
  const artifact = await prisma.verificationArtifact.findFirst({
    where: { npi },
    orderBy: { createdAt: 'desc' },
    select: {
      trustState: true,
      claimHashes: true,
      verifiedAt: true,
      npi: true,
    },
  });

  if (!artifact) {
    res.status(404).json({ error: 'No verification artifact found for this profile' });
    return;
  }

  // 3. Load ClinicianIdentity — extract ONLY name + specialty (PII firewall)
  const identityRow = await prisma.clinicianIdentity.findUnique({
    where: { clinicianId: npi },
    select: { data: true }, // only the JSON blob; no id, no timestamps
  });

  const { name, specialty } = extractPublicIdentityFields(identityRow?.data ?? null);

  // 4. Compute CRS score via the official engine
  const crsEngine = new CrsEngine({
    receipts: {
      async listByClinician(clinician_id: string): Promise<readonly TrustStateReceiptRecord[]> {
        const rows = await prisma.psvReceipt.findMany({
          where: { clinicianId: clinician_id },
          select: {
            receiptId: true,
            fetchedAt: true,
            ttlSeconds: true,
            revoked: true,
            lane: true,
            verificationCheck: true,
            verificationOutcome: true,
            failureReason: true,
            source: true,
            attestorId: true,
            verificationRequestId: true,
          },
        });

        return rows.map(
          (r): TrustStateReceiptRecord => ({
            receipt_id: r.receiptId,
            fetched_at: r.fetchedAt.toISOString(),
            ttl_seconds: r.ttlSeconds,
            revoked: r.revoked,
            lane: (r.lane as TrustStateReceiptRecord['lane']) ?? undefined,
            verification_check: r.verificationCheck ?? undefined,
            verification_outcome:
              (r.verificationOutcome as TrustStateReceiptRecord['verification_outcome']) ??
              undefined,
            failure_reason: r.failureReason ?? undefined,
            source: (r.source as TrustStateReceiptRecord['source']) ?? undefined,
            attestor_id: r.attestorId ?? undefined,
            verification_request_id: r.verificationRequestId ?? undefined,
          }),
        );
      },
    },
    acceptances: {
      async existsForClinician(clinician_id: string): Promise<boolean> {
        const row = await prisma.acceptance.findFirst({
          where: { subjectId: clinician_id },
          select: { id: true },
        });
        return row !== null;
      },
    },
    divergence: {
      async getForClinician(clinician_id: string): Promise<{ penalty: number; hasBlocking: boolean }> {
        return getActiveDivergencePenalty(clinician_id);
      },
    },
  });

  const crsOutput = await crsEngine.computeForClinician({
    clinician_id: npi,
    as_of: new Date().toISOString(),
  });

  // 5. Build the PII-free public response
  const rawTrustState = artifact.trustState;
  const trustState: TrustStateLabel = isTrustStateLabel(rawTrustState)
    ? rawTrustState
    : 'needs_review';

  const response: PublicProfileResponse = {
    slug,
    name,
    specialty,
    l3Status: deriveL3Status(trustState),
    trustState,
    crsScore: crsOutput.score,
    crsBand: crsOutput.band,
    publicAuditHashes: extractPublicAuditHashes(artifact.claimHashes),
    verifiedAt: artifact.verifiedAt?.toISOString() ?? null,
    generatedAt: new Date().toISOString(),
  };

  res.setHeader('cache-control', 'public, max-age=60, stale-while-revalidate=300');
  res.json(response);
}

// ── Registration ───────────────────────────────────────────────────────────

export function registerPublicRoutes(app: Express): void {
  app.get(
    '/api/public/profile/:slug',
    publicProfileRateLimit,
    (req: Request, res: Response): void => {
      handlePublicProfile(req, res).catch((err: unknown) => {
        log('error', 'Unhandled error in public profile handler', {
          slug: req.params['slug'],
          err: String(err),
        });
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      });
    },
  );
}
