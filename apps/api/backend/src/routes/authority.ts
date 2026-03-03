/**
 * authority.ts — Wave 29: Professional Authority State (PAS) Engine
 *
 * GET /api/authority/state/:npi
 *
 * Returns the canonical PAS object — a deterministic, cryptographically-
 * anchored JSON document that represents a clinician's complete clearance
 * state at a single point in time.
 *
 * The PAS object is designed to be:
 *  - Machine-readable by downstream systems (EHR, scheduling, HR)
 *  - Human-verifiable (every field has a cryptographic anchor)
 *  - Zero-PII on transit (no SSN, DOB, home address)
 *  - Idempotent: same NPI + same DB state → same response
 *
 * RESPONSE SCHEMA (vitalcv.pas.v1):
 * {
 *   schema, generated_at, npi_checksum,
 *   subject:         { npi, name },
 *   authority_state: { status, as_of, score, band, changes_since_last },
 *   credentials:     [{ type, issuer, license_id, status, verified_at,
 *                       expires_at, source_authority, immutable_hash,
 *                       ttl_remaining_days }],
 *   psv_receipts:    [{ receipt_id, source_authority, fetched_at,
 *                       ttl_seconds, revoked, response_hash }],
 *   audit_trail_pointer: { merkle_root, latest_artifact_id,
 *                          snapshot_count, generated_at }
 * }
 */

import type { Express, Request, Response } from 'express';
import { CrsEngine } from '@vitalcv/crs';
import type { TrustStateReceiptRecord } from '@vitalcv/psv';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { sha256Hex } from '../utils/deterministic';
import { publicApiRateLimit } from '../middleware/publicSafety';

// ── Response types ────────────────────────────────────────────────────────

type PASStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface PASCredential {
  type: string;
  issuer: string;
  license_id: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';
  verified_at: string;
  expires_at: string | null;
  source_authority: string;
  /** SHA-256 of the PSV response — immutable, tamper-evident */
  immutable_hash: string;
  ttl_remaining_days: number | null;
}

export interface PASPsvReceipt {
  receipt_id: string;
  source_authority: string;
  fetched_at: string;
  ttl_seconds: number;
  revoked: boolean;
  response_hash: string;
}

export interface PASObject {
  schema: 'vitalcv.pas.v1';
  generated_at: string;
  /** SHA-256 of the NPI — identifies the subject without exposing NPI in logs */
  npi_checksum: string;
  subject: {
    npi: string;
    name: string;
  };
  authority_state: {
    status: PASStatus;
    as_of: string;
    score: number;
    band: 'GREEN' | 'YELLOW' | 'RED';
    /** Whether the state has changed since the prior artifact */
    changes_since_last: 'NONE' | 'SCORE_CHANGE' | 'STATUS_CHANGE' | 'NEW_CREDENTIALS';
  };
  credentials: PASCredential[];
  psv_receipts: PASPsvReceipt[];
  audit_trail_pointer: {
    merkle_root: string | null;
    latest_artifact_id: string;
    snapshot_count: number;
    generated_at: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function ttlRemainingDays(fetchedAt: Date, ttlSeconds: number): number | null {
  const expiresMs = fetchedAt.getTime() + ttlSeconds * 1000;
  const nowMs = Date.now();
  if (expiresMs <= nowMs) return 0;
  return Math.ceil((expiresMs - nowMs) / 86_400_000);
}

function mapSourceToCredentialType(sourceAuthority: string): string {
  const upper = sourceAuthority.toUpperCase();
  if (upper.includes('NURSYS') || upper.includes('NCSBN'))   return 'NURSING_LICENSE';
  if (upper.includes('FSMB') || upper.includes('STATE'))      return 'STATE_LICENSE';
  if (upper.includes('DEA'))                                  return 'DEA_REGISTRATION';
  if (upper.includes('ABMS') || upper.includes('BOARD'))      return 'BOARD_CERTIFICATION';
  if (upper.includes('NPI') || upper.includes('NPPES'))       return 'NPI_ENROLLMENT';
  if (upper.includes('LEIE') || upper.includes('OIG'))        return 'SANCTIONS_CHECK';
  if (upper.includes('SAM'))                                  return 'SAM_EXCLUSIONS_CHECK';
  return 'PRIMARY_SOURCE_VERIFICATION';
}

function identityName(data: unknown): string {
  if (typeof data !== 'object' || data === null) return 'Verified Clinician';
  const r = data as Record<string, unknown>;
  const first = typeof r['first_name'] === 'string' ? r['first_name'].trim() : '';
  const last  = typeof r['last_name']  === 'string' ? r['last_name'].trim()  : '';
  return [first, last].filter(Boolean).join(' ') || 'Verified Clinician';
}

function detectChanges(
  latest: { trustState: string; checksum: string } | null,
  prior:  { trustState: string; checksum: string } | null,
): PASObject['authority_state']['changes_since_last'] {
  if (!prior) return 'NEW_CREDENTIALS';
  if (latest?.trustState !== prior.trustState) return 'STATUS_CHANGE';
  if (latest?.checksum   !== prior.checksum)   return 'SCORE_CHANGE';
  return 'NONE';
}

// ── Core handler ──────────────────────────────────────────────────────────

async function buildPASObject(npi: string): Promise<PASObject> {
  // ── Fetch all required data in parallel ──────────────────────────────
  const [artifacts, receipts, identity, snapshots] = await Promise.all([
    prisma.verificationArtifact.findMany({
      where: { npi },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        source: true,
        status: true,
        trustState: true,
        checksum: true,
        merkleRoot: true,
        claimHashes: true,
        verifiedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
    prisma.psvReceipt.findMany({
      where: { clinicianId: npi },
      orderBy: { fetchedAt: 'desc' },
      take: 10,
      select: {
        receiptId: true,
        sourceAuthority: true,
        licenseId: true,
        fetchedAt: true,
        ttlSeconds: true,
        revoked: true,
        responseHash: true,
      },
    }),
    prisma.clinicianIdentity.findUnique({
      where: { clinicianId: npi },
      select: { data: true },
    }),
    prisma.auditSnapshot.findMany({
      where: {
        artifact: { npi },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { id: true, createdAt: true, artifactId: true },
    }),
  ]);

  // ── CRS computation ──────────────────────────────────────────────────
  const crsEngine = new CrsEngine({
    receipts: {
      async listByClinician(clinician_id: string): Promise<readonly TrustStateReceiptRecord[]> {
        const rows = await prisma.psvReceipt.findMany({
          where: { clinicianId: clinician_id },
          select: {
            receiptId: true, fetchedAt: true, ttlSeconds: true, revoked: true,
            lane: true, verificationCheck: true, verificationOutcome: true,
            failureReason: true, source: true, attestorId: true, verificationRequestId: true,
          },
        });
        return rows.map((r): TrustStateReceiptRecord => ({
          receipt_id: r.receiptId,
          fetched_at: r.fetchedAt.toISOString(),
          ttl_seconds: r.ttlSeconds,
          revoked: r.revoked,
          lane: (r.lane as TrustStateReceiptRecord['lane']) ?? undefined,
          verification_check: r.verificationCheck ?? undefined,
          verification_outcome: (r.verificationOutcome as TrustStateReceiptRecord['verification_outcome']) ?? undefined,
          failure_reason: r.failureReason ?? undefined,
          source: (r.source as TrustStateReceiptRecord['source']) ?? undefined,
          attestor_id: r.attestorId ?? undefined,
          verification_request_id: r.verificationRequestId ?? undefined,
        }));
      },
    },
    acceptances: {
      async existsForClinician(clinician_id: string): Promise<boolean> {
        const row = await prisma.acceptance.findFirst({ where: { subjectId: clinician_id }, select: { id: true } });
        return row !== null;
      },
    },
  });

  const crsOutput = await crsEngine.computeForClinician({
    clinician_id: npi,
    as_of: new Date().toISOString(),
  });

  // ── Map PAS status from CRS band ─────────────────────────────────────
  const pasStatus: PASStatus = crsOutput.band;

  // ── Build credentials from PSV receipts ──────────────────────────────
  const credentials: PASCredential[] = receipts.map((r): PASCredential => ({
    type: mapSourceToCredentialType(r.sourceAuthority),
    issuer: r.sourceAuthority,
    license_id: r.licenseId,
    status: r.revoked ? 'REVOKED' : 'ACTIVE',
    verified_at: r.fetchedAt.toISOString(),
    expires_at: r.ttlSeconds
      ? new Date(r.fetchedAt.getTime() + r.ttlSeconds * 1000).toISOString()
      : null,
    source_authority: r.sourceAuthority,
    immutable_hash: r.responseHash,
    ttl_remaining_days: r.ttlSeconds ? ttlRemainingDays(r.fetchedAt, r.ttlSeconds) : null,
  }));

  // ── PSV receipt list (raw) ────────────────────────────────────────────
  const psvReceipts: PASPsvReceipt[] = receipts.map((r): PASPsvReceipt => ({
    receipt_id: r.receiptId,
    source_authority: r.sourceAuthority,
    fetched_at: r.fetchedAt.toISOString(),
    ttl_seconds: r.ttlSeconds,
    revoked: r.revoked,
    response_hash: r.responseHash,
  }));

  // ── Detect changes between latest and prior artifact ─────────────────
  const latest = artifacts[0] ?? null;
  const prior  = artifacts[1] ?? null;
  const changesSinceLast = detectChanges(latest, prior);

  // ── Audit trail pointer ───────────────────────────────────────────────
  const snapshotCount = await prisma.auditSnapshot.count({
    where: { artifact: { npi } },
  });

  const auditTrailPointer = {
    merkle_root: latest?.merkleRoot ?? null,
    latest_artifact_id: latest?.id ?? 'none',
    snapshot_count: snapshotCount,
    generated_at: new Date().toISOString(),
  };

  const generatedAt = new Date().toISOString();

  return {
    schema: 'vitalcv.pas.v1',
    generated_at: generatedAt,
    npi_checksum: sha256Hex(npi),
    subject: {
      npi,
      name: identityName(identity?.data ?? null),
    },
    authority_state: {
      status: pasStatus,
      as_of: crsOutput.last_verified_at,
      score: crsOutput.score,
      band: crsOutput.band,
      changes_since_last: changesSinceLast,
    },
    credentials,
    psv_receipts: psvReceipts,
    audit_trail_pointer: auditTrailPointer,
  };
}

// ── Route registration ────────────────────────────────────────────────────

export function registerAuthorityRoutes(app: Express): void {
  app.get(
    '/api/authority/state/:npi',
    publicApiRateLimit,
    (req: Request, res: Response): void => {
      const { npi } = req.params;

      if (typeof npi !== 'string' || !/^\d{10}$/.test(npi)) {
        res.status(400).json({ error: 'NPI must be exactly 10 digits.' });
        return;
      }

      buildPASObject(npi)
        .then((pas): void => {
          // PAS objects are short-lived; 30s cache is safe (score changes slowly)
          res.setHeader('cache-control', 'public, max-age=30, stale-while-revalidate=120');
          res.setHeader('x-pas-status', pas.authority_state.status);
          res.setHeader('x-pas-score',  String(pas.authority_state.score));
          res.json(pas);
        })
        .catch((err: unknown): void => {
          log('error', 'PAS build failed', { npi, err: String(err) });
          if (!res.headersSent) res.status(500).json({ error: 'Failed to build PAS object' });
        });
    },
  );
}
