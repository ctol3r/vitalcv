/**
 * GET /api/decisions/:npi — list decision capsules for a clinician.
 * Conforms to canonical envelope: { result, blockers, explanation, timestamp }.
 */
import { NextRequest } from 'next/server';
import { respondOk, respondFail, sanitize, explainBackend } from '@/lib/api-envelope';

export const runtime = 'nodejs';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) {
    return respondFail('Invalid NPI format', 400, ['npi must be 10 digits']);
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/decisions/${npi}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      return respondFail(explainBackend(res.status), res.status);
    }
    return respondOk(sanitize(raw));
  } catch (err) {
    console.error('[api/decisions/[npi] GET] backend unreachable', err);
    return respondFail('The system is temporarily unavailable. Please retry.', 502);
  }
}
