/**
 * API Client for VitalCV Backend
 *
 * Handles all API communication with robust error handling and flexible configuration
 */

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
const base = API_BASE || ''; // same-origin fallback if unset

/**
 * Health check ping for diagnostics
 */
export async function pingHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${base}/api/health`, { cache: 'no-store' });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Parse response with graceful error handling
 */
async function parseResponse(res: Response) {
  const text = await res.text().catch(() => '');
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    if (res.status === 404 && /not\s*found/i.test(data?.message || '')) {
      throw new Error('NPI not found. Please check the number or try a known test NPI.');
    }
    if (res.status === 502 || res.status === 503) {
      throw new Error('Upstream service unavailable. Try again shortly.');
    }
    throw new Error(data?.message || `Request failed (HTTP ${res.status}).`);
  }

  return data;
}

/**
 * Lookup NPI from NPPES registry
 */
export async function lookupNpi(npi: string) {
  try {
    const res = await fetch(`${base}/api/npi/lookup?npi=${encodeURIComponent(npi)}`, {
      cache: 'no-store',
    });
    return await parseResponse(res);
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error('Network error: frontend cannot reach the API. Check environment/CORS.');
    }
    throw err;
  }
}

/**
 * Get claim status for an NPI
 */
export async function getClaimStatus(npi: string) {
  const res = await fetch(`${base}/api/claim/status?npi=${encodeURIComponent(npi)}`, {
    cache: 'no-store',
  });
  return parseResponse(res);
}

/**
 * Start basic claim (Level 1) with email
 */
export async function startBasicClaim(npi: string, email: string, phone?: string) {
  const res = await fetch(`${base}/api/claim/basic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npi, email, phone }),
  });
  return parseResponse(res);
}

/**
 * Verify PIN for claim
 */
export async function verifyPin(npi: string, pin: string) {
  const res = await fetch(`${base}/api/claim/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npi, pin }),
  });
  return parseResponse(res);
}

/**
 * Upload documents for Level 2 verification
 */
export async function uploadDocuments(npi: string, files: File[]) {
  const fd = new FormData();
  fd.append('npi', npi);
  files.forEach((f, i) => fd.append(`file${i}`, f));
  const res = await fetch(`${base}/api/claim/doc`, { method: 'POST', body: fd });
  return parseResponse(res);
}

/**
 * Request issuer attestation (Level 3)
 */
export async function requestAttestation(npi: string) {
  const res = await fetch(`${base}/api/issuer/attest-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npi }),
  });
  return parseResponse(res);
}

/**
 * Poll claim status (with abort signal support for polling)
 */
export async function pollClaimStatus(npi: string, signal?: AbortSignal) {
  const res = await fetch(`${base}/api/claim/status?npi=${encodeURIComponent(npi)}`, {
    cache: 'no-store',
    signal,
  });
  return parseResponse(res);
}

/**
 * List agent runs (optionally filtered by NPI)
 */
export async function listAgentRuns(npi?: string) {
  const u = npi ? `${base}/api/agents/runs?npi=${encodeURIComponent(npi)}` : `${base}/api/agents/runs`;
  const res = await fetch(u, { cache: 'no-store' });
  return parseResponse(res);
}

/**
 * Trigger agent run manually
 */
export async function triggerAgent(npi: string, type = 'NPLOOKUP_VIEW') {
  const res = await fetch(`${base}/api/agents/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npi, type }),
  });
  return parseResponse(res);
}
