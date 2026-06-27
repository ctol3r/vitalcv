import { NextRequest, NextResponse } from 'next/server';
import { evaluateExchange, EVIDENCE_EXCHANGE_SCHEMA, type EvidenceExchange } from '@/lib/exchange/exchange';
import { memberCanActAs } from '@/lib/exchange/federation';
import { demoFederation, exchangeSecret } from '@/lib/exchange/config';

export const runtime = 'nodejs';

/**
 * POST /api/exchange/verify — Verifier API (Wave 800, C2).
 *
 * Body: `{ exchange: EvidenceExchange, verifier: string, state?, specialty? }`.
 *
 * Verifies the envelope signature, then RE-DERIVES trust and readiness from the
 * exchanged evidence — the verifier's own conclusion, never a value copied from
 * the issuer. Fails closed on a bad signature (no trust returned). The optional
 * state/specialty let the verifier apply its own readiness policy, which is why
 * two verifiers can honestly differ on the same exchange.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { exchange?: unknown; verifier?: unknown; state?: unknown; specialty?: unknown }
      | null;

    const exchange = body?.exchange as EvidenceExchange | undefined;
    if (!exchange || exchange.schema !== EVIDENCE_EXCHANGE_SCHEMA) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: `exchange with schema "${EVIDENCE_EXCHANGE_SCHEMA}" is required.` },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Federation authorization: the caller must be a member with the verifier role.
    const verifier = typeof body?.verifier === 'string' ? body.verifier.trim() : '';
    if (!verifier || !memberCanActAs(demoFederation(), verifier, 'verifier')) {
      return NextResponse.json(
        { error: 'verifier_not_authorized', error_description: `verifier "${verifier}" is not an authorized federation member.` },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const state = typeof body?.state === 'string' ? body.state : undefined;
    const specialty = typeof body?.specialty === 'string' ? body.specialty : undefined;

    const verdict = evaluateExchange(exchange, exchangeSecret(), { state, specialty });
    // A failed signature is a legitimate verdict (signatureValid:false), not a 500.
    return NextResponse.json(verdict, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Exchange verification failed.';
    return NextResponse.json(
      { error: 'verify_failed', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
