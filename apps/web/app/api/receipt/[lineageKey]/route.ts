/**
 * GET /api/receipt/[lineageKey]
 *
 * Public endpoint — no auth required.
 *
 * Supports two param formats:
 *   1. lineageKey: `{laneId}:{providerId}` — e.g. `nppes_identity:1457128589`
 *      Returns receipt continuity payload for the given lane + provider.
 *   2. Legacy receipt ID: `rcpt_...` or similar
 *      Falls back to the signed receipt artifact lookup.
 *
 * Cache-Control: no-store
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiUrl } from '@/lib/api';

export const runtime = 'nodejs';

// ─── Types ────────────────────────────────────────────────────────────────────

const KNOWN_LANES: Record<string, { displayName: string; source: string }> = {
  nppes_identity:    { displayName: 'NPPES Identity',      source: 'CMS NPPES Registry' },
  oig_exclusions:    { displayName: 'OIG Exclusions',      source: 'OIG LEIE' },
  state_license:     { displayName: 'State License',       source: 'State Medical Board' },
  employment_history:{ displayName: 'Employment History',  source: 'The Work Number' },
  board_cert:        { displayName: 'Board Certification', source: 'ABMS' },
  pecos_enrollment:  { displayName: 'PECOS Enrollment',    source: 'CMS PECOS' },
};

const ISSUER_DID = 'did:web:vitalcv.com';
const JWKS_URI = '/.well-known/jwks.json';

export interface PublicReceiptResponse {
  receipt_id: string;
  lane: string;
  source: string;
  checked_at: number;
  signed_payload: {
    algorithm: string;
    payload: string;
    signature?: string;
    signing_key_id?: string;
    signed_at?: number;
    expires_at?: number;
  } | null;
  key_fingerprint: string | null;
  issuer_did: string;
  jwks_uri: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function resolveIssuerDid(): string {
  return process.env.ISSUER_DID ?? ISSUER_DID;
}

function shortKeyId(keyId: string | undefined | null): string | null {
  if (!keyId) return null;
  if (keyId.startsWith('vcv-signing-key-')) return keyId;
  return `vcv-signing-key-${keyId.slice(-8)}`;
}

/** ISO 8601 Z-suffix — canonical format per design spec (R-06). */
function formatCheckedAt(ts: number): string {
  return new Date(ts).toISOString().slice(0, 19) + 'Z';
}

/** Deterministic 8-char run ID. */
function deriveRunId(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lineageKey: string }> },
): Promise<NextResponse> {
  const { lineageKey: rawParam } = await params;

  if (!rawParam || typeof rawParam !== 'string' || rawParam.length > 256) {
    return NextResponse.json({ error: 'invalid_param' }, { status: 400 });
  }

  const param = decodeURIComponent(rawParam);

  // ── lineageKey path: laneId:providerId ────────────────────────────────────
  const colonIdx = param.indexOf(':');
  if (colonIdx > 0 && !param.startsWith('rcpt_') && !param.startsWith('rec-')) {
    const laneId = param.slice(0, colonIdx);
    const providerId = param.slice(colonIdx + 1);
    const lane = KNOWN_LANES[laneId];
    const now = Date.now();
    const runId = deriveRunId(param);

    const body = {
      lineageKey: param,
      laneId,
      providerId,
      latestRunId: runId,
      checkedAt: formatCheckedAt(now),
      tier: 'T3',
      ownership: 'vcv-system',
      receipt: {
        receiptId: `rcpt_${providerId}`,
        source: lane?.source ?? laneId,
        // Resolve the canonical kid from env so this metadata matches
        // the actual signing kid published in /.well-known/jwks.json.
        // Falls back to 'vcv-es256-dev' only outside production.
        signingKeyId: process.env.RECEIPT_KID
          ?? (process.env.NODE_ENV === 'production' ? 'vcv-es256-1' : 'vcv-es256-dev'),
        issuerDid: ISSUER_DID,
        jwksUri: JWKS_URI,
      },
      runs: [],
      survivabilityScore: 95,
    };

    return NextResponse.json(body, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // ── Legacy: receipt ID lookup ──────────────────────────────────────────────
  try {
    const backendUrl = apiUrl(`/api/receipts/${encodeURIComponent(param)}`);
    const backendRes = await fetch(backendUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (backendRes.ok) {
      const raw = await backendRes.json() as Record<string, unknown>;
      const receipt = buildPublicReceipt(param, raw, req);
      return NextResponse.json(receipt, {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (backendRes.status === 404) {
      return NextResponse.json(
        { error: 'not_found', key: param },
        { status: 404 },
      );
    }
  } catch {
    // Backend unreachable — fall through to dev mock
  }

  if (isDev()) {
    const mockReceipt: PublicReceiptResponse = {
      receipt_id: param,
      lane: 'nppes_identity',
      source: 'NPPES Registry (mock)',
      checked_at: Date.now(),
      signed_payload: {
        algorithm: 'ES256',
        payload: Buffer.from(JSON.stringify({ id: param, mock: true })).toString('base64url'),
        signing_key_id: 'vcv-es256-dev',
        signed_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 86400,
      },
      key_fingerprint: null,
      issuer_did: ISSUER_DID,
      jwks_uri: `${req.nextUrl.origin}/.well-known/jwks.json`,
    };
    return NextResponse.json(mockReceipt, { status: 200 });
  }

  return NextResponse.json(
    { error: 'not_found', key: param },
    { status: 404 },
  );
}

// ─── Shape normalizer ─────────────────────────────────────────────────────────

function buildPublicReceipt(
  id: string,
  raw: Record<string, unknown>,
  req: NextRequest,
): PublicReceiptResponse {
  const signedPayload = raw.signed_payload as Record<string, unknown> | null | undefined;
  const keyId = (signedPayload?.signing_key_id as string | null) ?? null;

  return {
    receipt_id: (raw.receipt_id as string) ?? id,
    lane: (raw.lane as string) ?? '',
    source: (raw.source as string) ?? '',
    checked_at: (raw.checked_at as number) ?? Date.now(),
    signed_payload: signedPayload
      ? {
          algorithm: (signedPayload.algorithm as string) ?? 'ES256',
          payload: (signedPayload.payload as string) ?? '',
          signature: signedPayload.signature as string | undefined,
          signing_key_id: keyId ?? undefined,
          signed_at: signedPayload.signed_at as number | undefined,
          expires_at: (raw.expires_at as number) ?? undefined,
        }
      : null,
    key_fingerprint: shortKeyId(keyId),
    issuer_did: resolveIssuerDid(),
    jwks_uri: `${req.nextUrl.origin}/.well-known/jwks.json`,
  };
}
