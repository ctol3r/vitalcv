/**
 * VC 2.0 Bitstring Status List routes (launch blocker #11).
 *
 * Port of the StatusList2021 predecessor (S72-STRETCH-A-007) to the W3C
 * Bitstring Status List v1.0 data model:
 * https://www.w3.org/TR/vc-bitstring-status-list/
 *
 *  - GET  /status-list/bitstring            → BitstringStatusListCredential (VC 2.0)
 *  - GET  /status-list/entry/:credential_id → BitstringStatusListEntry for embedding
 *  - GET  /status-list/status/:credential_id→ registry view of one credential
 *  - GET  /status-list/summary              → entry/revocation counts
 *  - POST /status-list/revoke               → flip a credential's bit to 1
 *  - POST /status-list/restore              → flip a credential's bit back to 0
 *
 * The predecessor's /status-list/2021* routes are REMOVED, not aliased:
 * the service has never been deployed and the repo contains no live
 * consumer of those routes (see PR notes). Verifier-side checking lives
 * in ../lib/verifyStatus.ts and FAILS CLOSED.
 */

import { Request, Response } from 'express';
import {
  buildStatusListCredential,
  buildStatusListEntry,
  getEntry,
  restore,
  revoke,
  summary,
} from '../lib/statusListRegistry';

/** W3C VC data-model media type for the status list credential. */
const VC_MEDIA_TYPE = 'application/vc+ld+json';

/**
 * Mark credential as revoked.
 * POST /status-list/revoke  { credential_id, reason? }
 */
export function revokeCredential(req: Request, res: Response): void {
  const { credential_id, reason } = req.body ?? {};

  if (!credential_id || typeof credential_id !== 'string') {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing credential_id',
    });
    return;
  }

  try {
    const entry = revoke(credential_id, typeof reason === 'string' ? reason : undefined);
    res.json({
      success: true,
      credential_id,
      revoked: true,
      status_list_index: entry.statusListIndex,
      revoked_at: new Date(entry.revokedAt ?? Date.now()).toISOString(),
      reason: entry.reason,
    });
  } catch (err) {
    res.status(507).json({
      error: 'status_list_exhausted',
      error_description: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Restore credential (unrevoke).
 * POST /status-list/restore  { credential_id }
 */
export function restoreCredential(req: Request, res: Response): void {
  const { credential_id } = req.body ?? {};

  if (!credential_id || typeof credential_id !== 'string') {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing credential_id',
    });
    return;
  }

  const entry = restore(credential_id);
  if (!entry) {
    res.status(404).json({
      error: 'not_found',
      error_description: 'Credential not found in status list',
    });
    return;
  }

  res.json({
    success: true,
    credential_id,
    revoked: false,
    status_list_index: entry.statusListIndex,
    restored_at: new Date().toISOString(),
  });
}

/**
 * Registry view of one credential.
 * GET /status-list/status/:credential_id
 */
export function checkCredentialStatus(req: Request, res: Response): void {
  const { credential_id } = req.params;

  const entry = getEntry(credential_id);
  if (!entry) {
    res.json({
      credential_id,
      known: false,
      revoked: false,
      status: 'unknown',
    });
    return;
  }

  res.json({
    credential_id,
    known: true,
    revoked: entry.revoked,
    status: entry.revoked ? 'revoked' : 'not_revoked',
    status_list_index: entry.statusListIndex,
    ...(entry.revokedAt && { revoked_at: new Date(entry.revokedAt).toISOString() }),
    ...(entry.reason && { reason: entry.reason }),
  });
}

/**
 * The W3C VC 2.0 BitstringStatusListCredential.
 * GET /status-list/bitstring
 */
export async function getStatusListVC(_req: Request, res: Response): Promise<void> {
  try {
    const credential = await buildStatusListCredential();
    res.setHeader('Content-Type', VC_MEDIA_TYPE);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.status(200).send(JSON.stringify(credential));
  } catch (err) {
    res.status(500).json({
      error: 'internal_error',
      error_description: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * BitstringStatusListEntry for embedding as `credentialStatus` in an
 * issued VC. Assigns a bit index on first request.
 * GET /status-list/entry/:credential_id
 */
export function getStatusListEntry(req: Request, res: Response): void {
  const { credential_id } = req.params;
  try {
    res.json(buildStatusListEntry(credential_id));
  } catch (err) {
    res.status(507).json({
      error: 'status_list_exhausted',
      error_description: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Operational counts.
 * GET /status-list/summary
 */
export function getStatusListSummary(_req: Request, res: Response): void {
  res.json(summary());
}

export default {
  revokeCredential,
  restoreCredential,
  checkCredentialStatus,
  getStatusListVC,
  getStatusListEntry,
  getStatusListSummary,
};
