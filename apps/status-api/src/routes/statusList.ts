/**
 * VC Status List Stub (StatusList2021 style) and Revocation Proof
 *
 * S72-STRETCH-A-007: VC status list stub (StatusList2021 style) and revocation proof
 * Provides StatusList VC with bitstring
 * Simple API to mark credential revoked
 * Verifier uses bit to mark status
 */

import { Request, Response } from 'express';
import { createHash } from 'crypto';

const STATUS_API_URL = process.env.PUBLIC_STATUS_URL || process.env.STATUS_URL || 'https://status.vitalcv.ai';

/**
 * Status list entry
 */
interface StatusListEntry {
  credentialId: string;
  revoked: boolean;
  revokedAt?: number;
  reason?: string;
}

/**
 * In-memory status list (in production, use database)
 * S72-STRETCH-A-007: Simple API to mark credential revoked
 */
const statusList = new Map<string, StatusListEntry>();

/**
 * Generate bitstring from status list
 * S72-STRETCH-A-007: Provides StatusList VC with bitstring
 */
function generateBitstring(entries: StatusListEntry[]): string {
  // Create a bitstring where 1 = revoked, 0 = not revoked
  const bits = entries.map((entry) => (entry.revoked ? '1' : '0')).join('');

  // Convert to base64url for compact representation
  // Pad to byte boundary
  const paddedBits = bits.padEnd(Math.ceil(bits.length / 8) * 8, '0');

  // Convert binary string to bytes
  const bytes: number[] = [];
  for (let i = 0; i < paddedBits.length; i += 8) {
    const byte = parseInt(paddedBits.substring(i, i + 8), 2);
    bytes.push(byte);
  }

  // Convert to base64url
  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Check if credential is revoked from bitstring
 * S72-STRETCH-A-007: Verifier uses bit to mark status
 */
function checkRevokedFromBitstring(bitstring: string, index: number): boolean {
  try {
    // Decode base64url
    const base64 = bitstring.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    const paddedBase64 = base64 + '='.repeat(padding);
    const bytes = Buffer.from(paddedBase64, 'base64');

    // Convert to binary string
    const bits = Array.from(bytes)
      .map((byte) => byte.toString(2).padStart(8, '0'))
      .join('');

    // Check bit at index
    return bits[index] === '1';
  } catch {
    return false;
  }
}

/**
 * Generate StatusList2021 VC
 * S72-STRETCH-A-007: Provides StatusList VC with bitstring
 */
function generateStatusListVC(issuer: string): any {
  const entries = Array.from(statusList.values());
  const bitstring = generateBitstring(entries);
  const listHash = createHash('sha256').update(bitstring).digest('hex');

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/vc/status-list/2021/v1',
    ],
    id: `${STATUS_API_URL}/status-list/2021`,
    type: ['VerifiableCredential', 'StatusList2021Credential'],
    issuer,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: `${STATUS_API_URL}/status-list/2021#list`,
      type: 'StatusList2021',
      statusPurpose: 'revocation',
      encodedList: bitstring,
      listHash,
    },
  };
}

/**
 * Mark credential as revoked
 * POST /status-list/revoke
 *
 * S72-STRETCH-A-007: Simple API to mark credential revoked
 */
export function revokeCredential(req: Request, res: Response): void {
  const { credential_id, reason } = req.body;

  if (!credential_id) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing credential_id',
    });
    return;
  }

  // Mark as revoked
  statusList.set(credential_id, {
    credentialId: credential_id,
    revoked: true,
    revokedAt: Date.now(),
    reason: reason || 'Revoked by issuer',
  });

  res.json({
    success: true,
    credential_id,
    revoked: true,
    revoked_at: new Date().toISOString(),
    reason: reason || 'Revoked by issuer',
  });
}

/**
 * Check credential status
 * GET /status-list/status/:credential_id
 *
 * S72-STRETCH-A-007: Verifier uses bit to mark status
 */
export function checkCredentialStatus(req: Request, res: Response): void {
  const { credential_id } = req.params;

  const entry = statusList.get(credential_id);

  if (!entry) {
    res.json({
      credential_id,
      revoked: false,
      status: 'active',
    });
    return;
  }

  res.json({
    credential_id,
    revoked: entry.revoked,
    status: entry.revoked ? 'revoked' : 'active',
    ...(entry.revokedAt && { revoked_at: new Date(entry.revokedAt).toISOString() }),
    ...(entry.reason && { reason: entry.reason }),
  });
}

/**
 * Get StatusList VC
 * GET /status-list/2021
 *
 * S72-STRETCH-A-007: Provides StatusList VC with bitstring
 */
export function getStatusListVC(req: Request, res: Response): void {
  const issuer = process.env.ISSUER_DID || 'did:web:vitalcv.ai';
  const vc = generateStatusListVC(issuer);

  res.json(vc);
}

/**
 * Get status list bitstring
 * GET /status-list/2021/bitstring
 */
export function getStatusListBitstring(req: Request, res: Response): void {
  const entries = Array.from(statusList.values());
  const bitstring = generateBitstring(entries);

  res.json({
    bitstring,
    list_hash: createHash('sha256').update(bitstring).digest('hex'),
    entry_count: entries.length,
    revoked_count: entries.filter((e) => e.revoked).length,
  });
}

/**
 * Restore credential (unrevoke)
 * POST /status-list/restore
 */
export function restoreCredential(req: Request, res: Response): void {
  const { credential_id } = req.body;

  if (!credential_id) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing credential_id',
    });
    return;
  }

  const entry = statusList.get(credential_id);
  if (!entry) {
    res.status(404).json({
      error: 'not_found',
      error_description: 'Credential not found in status list',
    });
    return;
  }

  // Restore (unrevoke)
  statusList.set(credential_id, {
    ...entry,
    revoked: false,
  });

  res.json({
    success: true,
    credential_id,
    revoked: false,
    restored_at: new Date().toISOString(),
  });
}

export default {
  revokeCredential,
  checkCredentialStatus,
  getStatusListVC,
  getStatusListBitstring,
  restoreCredential,
};
