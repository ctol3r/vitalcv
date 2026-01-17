/**
 * VC Status List (StatusList2021-style) + Compact Status List
 *
 * S72-STRETCH-A-007: VC status list stub (StatusList2021 style) and revocation proof
 * Provides StatusList VC with bitstring
 * Simple API to mark credential revoked
 * Verifier uses bit to mark status
 */

import { createHash } from 'crypto';
import { Request, Response } from 'express';

const STATUS_API_URL = (
  process.env.PUBLIC_STATUS_URL ||
  process.env.STATUS_URL ||
  'https://status.vitalcv.ai'
).replace(/\/$/, '');
const DEFAULT_LIST_ID = process.env.STATUS_LIST_ID || 'default';
const STATUS_PURPOSE = 'revocation';

/**
 * Status list entry
 */
interface StatusListEntry {
  credentialId: string;
  index: number;
  revoked: boolean;
  revokedAt?: number;
  reason?: string;
}

interface StatusListRecord {
  listId: string;
  statusPurpose: typeof STATUS_PURPOSE;
  entries: StatusListEntry[];
  entriesByCredentialId: Map<string, StatusListEntry>;
  createdAt: number;
  updatedAt: number;
}

/**
 * In-memory status list registry (in production, use database)
 */
const statusLists = new Map<string, StatusListRecord>();

function getStatusListRecord(listId?: string): StatusListRecord {
  const normalized = listId?.trim() || DEFAULT_LIST_ID;
  const existing = statusLists.get(normalized);
  if (existing) {
    return existing;
  }

  const record: StatusListRecord = {
    listId: normalized,
    statusPurpose: STATUS_PURPOSE,
    entries: [],
    entriesByCredentialId: new Map<string, StatusListEntry>(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  statusLists.set(normalized, record);
  return record;
}

function resolveListId(req: Request): string {
  const param = typeof req.params?.listId === 'string' ? req.params.listId : undefined;
  const query = req.query?.list_id ?? req.query?.listId;
  const queryValue = Array.isArray(query)
    ? typeof query[0] === 'string'
      ? query[0]
      : undefined
    : typeof query === 'string'
    ? query
    : undefined;
  return param?.trim() || queryValue?.trim() || DEFAULT_LIST_ID;
}

function allocateEntry(list: StatusListRecord, credentialId: string): StatusListEntry {
  const existing = list.entriesByCredentialId.get(credentialId);
  if (existing) {
    return existing;
  }

  const entry: StatusListEntry = {
    credentialId,
    index: list.entries.length,
    revoked: false,
  };

  list.entries.push(entry);
  list.entriesByCredentialId.set(credentialId, entry);
  list.updatedAt = Date.now();
  return entry;
}

/**
 * Generate bitstring from status list
 */
function generateEncodedList(list: StatusListRecord): string {
  const bits = list.entries.map((entry) => (entry.revoked ? '1' : '0')).join('');
  const paddedBits = bits.padEnd(Math.ceil(bits.length / 8) * 8, '0');

  const bytes: number[] = [];
  for (let i = 0; i < paddedBits.length; i += 8) {
    const byte = parseInt(paddedBits.substring(i, i + 8), 2);
    bytes.push(byte);
  }

  const base64 = Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function computeStatusListEtag(listId: string, encodedList: string): string {
  const hash = createHash('sha256').update(`${listId}:${encodedList}`).digest('hex');
  return `"${hash.substring(0, 16)}"`;
}

function buildCompactStatusUrl(listId: string): string {
  return `${STATUS_API_URL}/status-list/compact/${encodeURIComponent(listId)}`;
}

/**
 * Allocate status list index for issuance
 * POST /status-list/allocate
 */
export function allocateStatusListEntry(req: Request, res: Response): Response {
  const credentialId = req.body?.credential_id as string | undefined;
  const listId = (req.body?.list_id as string | undefined)?.trim() || DEFAULT_LIST_ID;

  if (!credentialId) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing credential_id',
    });
  }

  const list = getStatusListRecord(listId);
  const entry = allocateEntry(list, credentialId);

  const statusUrl = `${STATUS_API_URL}/status-list/compact`;
  const statusListUrl = buildCompactStatusUrl(list.listId);
  const credentialStatus = {
    id: `${statusListUrl}#${entry.index}`,
    type: 'StatusList2021Entry',
    statusPurpose: list.statusPurpose,
    statusListIndex: String(entry.index),
    statusListCredential: statusListUrl,
    statusUrl,
    listId: list.listId,
    index: entry.index,
  };

  return res.status(201).json({
    credential_id: credentialId,
    list_id: list.listId,
    status_url: statusUrl,
    status_list_url: statusListUrl,
    index: entry.index,
    status_purpose: list.statusPurpose,
    credential_status: credentialStatus,
  });
}

/**
 * Mark credential as revoked
 * POST /status-list/revoke
 */
export function revokeCredential(req: Request, res: Response): Response {
  const credentialId = req.body?.credential_id as string | undefined;
  const listId = (req.body?.list_id as string | undefined)?.trim() || DEFAULT_LIST_ID;
  const reason = req.body?.reason as string | undefined;

  if (!credentialId) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing credential_id',
    });
  }

  const list = getStatusListRecord(listId);
  const entry = list.entriesByCredentialId.get(credentialId);
  if (!entry) {
    return res.status(404).json({
      error: 'not_found',
      error_description: 'Credential not found in status list',
    });
  }

  entry.revoked = true;
  entry.revokedAt = Date.now();
  entry.reason = reason || 'Revoked by issuer';
  list.updatedAt = Date.now();

  return res.json({
    success: true,
    credential_id: credentialId,
    list_id: list.listId,
    revoked: true,
    revoked_at: new Date(entry.revokedAt).toISOString(),
    reason: entry.reason,
  });
}

/**
 * Check credential status
 * GET /status-list/status/:credential_id
 */
export function checkCredentialStatus(req: Request, res: Response): Response {
  const credentialId = req.params.credential_id;
  const listId = resolveListId(req);
  const list = getStatusListRecord(listId);
  const entry = list.entriesByCredentialId.get(credentialId);

  if (!entry) {
    return res.json({
      credential_id: credentialId,
      list_id: listId,
      revoked: false,
      status: 'active',
    });
  }

  return res.json({
    credential_id: credentialId,
    list_id: listId,
    revoked: entry.revoked,
    status: entry.revoked ? 'revoked' : 'active',
    ...(entry.revokedAt && { revoked_at: new Date(entry.revokedAt).toISOString() }),
    ...(entry.reason && { reason: entry.reason }),
  });
}

/**
 * Get compact status list
 * GET /status-list/compact
 * GET /status-list/compact/:listId
 */
export function getStatusListCompact(req: Request, res: Response): Response {
  const listId = resolveListId(req);
  const list = getStatusListRecord(listId);
  const encodedList = generateEncodedList(list);
  const etag = computeStatusListEtag(list.listId, encodedList);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  const revokedCount = list.entries.filter((entry) => entry.revoked).length;

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Content-Type', 'application/statuslist+json');

  return res.json({
    status_list: {
      id: list.listId,
      status_purpose: list.statusPurpose,
      encoded_list: encodedList,
    },
    updated_at: new Date(list.updatedAt).toISOString(),
    entry_count: list.entries.length,
    revoked_count: revokedCount,
  });
}

/**
 * Get StatusList2021 VC
 * GET /status-list/2021
 */
export function getStatusListVC(req: Request, res: Response): Response {
  const issuer = process.env.ISSUER_DID || 'did:web:vitalcv.ai';
  const listId = resolveListId(req);
  const list = getStatusListRecord(listId);
  const encodedList = generateEncodedList(list);
  const listHash = createHash('sha256').update(encodedList).digest('hex');
  const statusListUrl = `${STATUS_API_URL}/status-list/2021`;

  const vc = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/vc/status-list/2021/v1',
    ],
    id:
      listId === DEFAULT_LIST_ID
        ? statusListUrl
        : `${statusListUrl}?list_id=${encodeURIComponent(listId)}`,
    type: ['VerifiableCredential', 'StatusList2021Credential'],
    issuer,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: `${statusListUrl}#list`,
      type: 'StatusList2021',
      statusPurpose: list.statusPurpose,
      encodedList,
      listHash,
      listId: list.listId,
    },
  };

  return res.json(vc);
}

/**
 * Get status list bitstring
 * GET /status-list/2021/bitstring
 */
export function getStatusListBitstring(req: Request, res: Response): Response {
  const listId = resolveListId(req);
  const list = getStatusListRecord(listId);
  const encodedList = generateEncodedList(list);
  const etag = computeStatusListEtag(list.listId, encodedList);

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Content-Type', 'application/json');

  return res.json({
    bitstring: encodedList,
    list_hash: createHash('sha256').update(encodedList).digest('hex'),
    list_id: list.listId,
    entry_count: list.entries.length,
    revoked_count: list.entries.filter((entry) => entry.revoked).length,
  });
}

/**
 * Restore credential (unrevoke)
 * POST /status-list/restore
 */
export function restoreCredential(req: Request, res: Response): Response {
  const credentialId = req.body?.credential_id as string | undefined;
  const listId = (req.body?.list_id as string | undefined)?.trim() || DEFAULT_LIST_ID;

  if (!credentialId) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing credential_id',
    });
  }

  const list = getStatusListRecord(listId);
  const entry = list.entriesByCredentialId.get(credentialId);
  if (!entry) {
    return res.status(404).json({
      error: 'not_found',
      error_description: 'Credential not found in status list',
    });
  }

  entry.revoked = false;
  entry.revokedAt = undefined;
  entry.reason = undefined;
  list.updatedAt = Date.now();

  return res.json({
    success: true,
    credential_id: credentialId,
    list_id: list.listId,
    revoked: false,
    restored_at: new Date().toISOString(),
  });
}

export default {
  allocateStatusListEntry,
  revokeCredential,
  checkCredentialStatus,
  getStatusListCompact,
  getStatusListVC,
  getStatusListBitstring,
  restoreCredential,
};
