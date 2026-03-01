/**
 * poe.ts — Wave 31: HTM Proof of Experience (PoE) Issuance & Verification
 *
 * PHI ISOLATION GUARANTEE
 * ───────────────────────
 * Raw encounter data (dates, CPT codes, risk outcomes) is accepted ONLY in
 * the POST /api/issuer/issue-poe handler and exists exclusively inside a
 * block scope.  After `generateEncounterRoot()` computes the Merkle tree,
 * the raw data variable falls out of scope and is eligible for GC.
 *
 * From that point forward, only opaque SHA-256 leaf hashes and the Merkle
 * root survive.  No raw clinical data is persisted, logged, or returned.
 */

import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { generateEncounterRoot, verifyEncounterRoot } from '@vitalcv/poe-engine';
import type { EncounterRecord } from '@vitalcv/poe-engine';
import { apiKeyAuth } from '../middleware/publicSafety';
import { proofRateLimit } from '../middleware/rateLimitFactory';
import { getRequestOrganizationId } from '../middleware/organizationContext';
import { buildPoeVc, computePoeVcHash, attachPoeSignature } from '../services/poeCredential';
import { signAuditBundleHash } from '../services/auditBundleSigning';
import { log } from '../obs/logger';

// ── Helpers ──────────────────────────────────────────────────

function parseEncounters(body: Record<string, unknown>): EncounterRecord[] {
  const raw = body.encounters;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('encounters must be a non-empty array');
  }

  return raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`encounters[${index}] must be an object`);
    }
    const e = entry as Record<string, unknown>;
    return {
      date: String(e.date ?? ''),
      cptCode: String(e.cptCode ?? ''),
      riskOutcome: String(e.riskOutcome ?? ''),
      facilityHash: typeof e.facilityHash === 'string' ? e.facilityHash : undefined,
    };
  });
}

// ── Route Registration ───────────────────────────────────────

export function registerPoeRoutes(app: Express): void {
  /**
   * POST /api/issuer/issue-poe
   *
   * Issue a Proof of Experience credential.
   * Accepts raw encounter data, hashes it into a Merkle tree,
   * DISCARDS the raw data, and returns a signed VC.
   */
  app.post(
    '/api/issuer/issue-poe',
    proofRateLimit,
    apiKeyAuth,
    async (req: Request, res: Response) => {
      try {
        const organizationId = getRequestOrganizationId(req);
        if (!organizationId) {
          return res.status(401).json({
            error: 'organization_context_required',
            error_description: 'Organization context is required.',
          });
        }

        const body = (req.body ?? {}) as Record<string, unknown>;

        const procedureType = typeof body.procedure_type === 'string'
          ? body.procedure_type.trim()
          : '';
        if (procedureType.length === 0) {
          return res.status(400).json({ error: 'procedure_type is required' });
        }

        const volumeWindow = typeof body.volume_window === 'string'
          ? body.volume_window.trim()
          : '';
        if (volumeWindow.length === 0) {
          return res.status(400).json({ error: 'volume_window is required' });
        }

        const clinicianDid = typeof body.clinician_did === 'string'
          ? body.clinician_did.trim()
          : undefined;

        // ── PHI ISOLATION BLOCK ───────────────────────────────
        // Raw encounters exist ONLY within this block scope.
        // After generateEncounterRoot() returns, the encounters
        // variable falls out of scope → eligible for GC.
        let encounterResult: ReturnType<typeof generateEncounterRoot>;
        {
          const encounters = parseEncounters(body);
          encounterResult = generateEncounterRoot(encounters);
        }

        // Build the VC — only opaque hashes from here on
        const vc = buildPoeVc({
          procedureType,
          volumeWindow,
          merkleRoot: encounterResult.merkleRoot,
          volumeCount: encounterResult.volumeCount,
          leafHashes: encounterResult.leafHashes,
          computedAt: encounterResult.computedAt,
          clinicianDid,
        });

        // Sign using existing ES256 infrastructure
        const vcHash = computePoeVcHash(vc);
        const bundleId = randomUUID();
        const signature = await signAuditBundleHash({
          bundleHash: vcHash,
          bundleId,
          artifactId: vc.id,
        });

        const signedVc = attachPoeSignature(vc, signature);

        log('info', 'poe_credential_issued', {
          event: 'poe_credential_issued',
          credentialId: vc.id,
          procedureType,
          volumeCount: encounterResult.volumeCount,
          organizationId,
        });

        return res.status(201).json({
          credential: signedVc,
          metadata: {
            volumeCount: encounterResult.volumeCount,
            merkleRoot: encounterResult.merkleRoot,
            issuedAt: vc.issuanceDate,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to issue PoE credential';
        log('error', 'poe_issuance_error', {
          event: 'poe_issuance_error',
          error: message,
        });
        return res.status(400).json({ error: message });
      }
    },
  );

  /**
   * POST /api/poe/verify
   *
   * Verify a PoE credential's Merkle root integrity.
   * Stateless — any party can call this without API key auth.
   */
  app.post(
    '/api/poe/verify',
    proofRateLimit,
    async (req: Request, res: Response) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;

        const leafHashes = body.leaf_hashes;
        if (!Array.isArray(leafHashes) || leafHashes.length === 0) {
          return res.status(400).json({ error: 'leaf_hashes must be a non-empty array' });
        }

        for (const hash of leafHashes) {
          if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) {
            return res.status(400).json({ error: 'Each leaf_hash must be a 64-char hex string' });
          }
        }

        const claimedRoot = body.merkle_root;
        if (typeof claimedRoot !== 'string' || !/^[0-9a-f]{64}$/.test(claimedRoot)) {
          return res.status(400).json({ error: 'merkle_root must be a 64-char hex string' });
        }

        const result = verifyEncounterRoot(leafHashes, claimedRoot);

        return res.status(200).json({
          valid: result.valid,
          volume_count: result.volumeCount,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed';
        log('error', 'poe_verification_error', {
          event: 'poe_verification_error',
          error: message,
        });
        return res.status(400).json({ error: message });
      }
    },
  );
}
