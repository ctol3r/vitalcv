/**
 * GET /api/receipt/[id]
 *
 * Public endpoint — no auth required for read.
 * Returns a signed receipt artifact for verifier inspection.
 *
 * Response shape:
 *   { receipt_id, lane, source, checked_at, signed_payload,
 *     key_fingerprint, issuer_did, jwks_uri }
 *
 * 404 if receipt not found.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiUrl } from '@/lib/api';

export const runtime = 'nodejs';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  return process.env.ISSUER_DID ?? (isDev() ? 'mock (dev)' : 'did:web:vitalcv.com');
}

function resolveJwksUri(req: NextRequest): string {
  const origin = req.nextUrl.origin;
  return `${origin}/.well-known/jwks.json`;
}

function shortKeyId(keyId: string | undefined | null): string | null {
  if (!keyId) return null;
  // Format: "vcv-signing-key-XXXXXXXX" — preserve prefix if already formatted
  if (keyId.startsWith('vcv-signing-key-')) return keyId;
  // Trim to last 8 chars for display
  return `vcv-signing-key-${keyId.slice(-8)}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!id || typeof id !== 'string' || id.length > 256) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  // ── 1. Try backend receipt lookup ──────────────────────────────────────────
  try {
    const backendUrl = apiUrl(`/api/receipts/${encodeURIComponent(id)}`);
    const backendRes = await fetch(backendUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Short timeout — this is a public read
      signal: AbortSignal.timeout(5000),
    });

    if (backendRes.ok) {
      const raw = await backendRes.json() as Record<string, unknown>;
      const receipt = buildPublicReceipt(id, raw, req);
      return NextResponse.json(receipt, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=30',
        },
      });
    }

    if (backendRes.status === 404) {
      return NextResponse.json(
        { error: 'not_found', receipt_id: id },
        { status: 404 },
      );
    }
  } catch {
    // Backend unreachable — fall through to dev mock below
  }

  // ── 2. Dev fallback: return a mock receipt so the surface is verifiable ────
  if (isDev()) {
    const mockReceipt: PublicReceiptResponse = {
      receipt_id: id,
      lane: 'nppes_identity',
      source: 'NPPES Registry (mock)',
      checked_at: Date.now(),
      signed_payload: {
        algorithm: 'ES256',
        payload: Buffer.from(JSON.stringify({ receipt_id: id, mock: true })).toString('base64url'),
        signing_key_id: `vcv-es256-dev`,
        signed_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 86400,
      },
      key_fingerprint: 'vcv-signing-key-devmock0',
      issuer_did: 'mock (dev)',
      jwks_uri: resolveJwksUri(req),
    };
    return NextResponse.json(mockReceipt, { status: 200 });
  }

  return NextResponse.json(
    { error: 'not_found', receipt_id: id },
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
    jwks_uri: resolveJwksUri(req),
  };
}
