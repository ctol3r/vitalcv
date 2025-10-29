/**
 * NPI API client functions
 */

import { ClaimRequest, ClaimStatus, NpiRecord } from './npi-types';

/**
 * API base resolution:
 * 1) NEXT_PUBLIC_BACKEND_URL if set (recommended for hosted frontends like Vercel)
 * 2) Same-origin fallback for local dev (proxy to /api)
 */
function resolveApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_BACKEND_URL || '').trim();
  if (env) return env.replace(/\/+$/, '');
  // same-origin fallback
  return '';
}
const API_BASE = resolveApiBase() || '/api';

// cheap health ping for diagnostics (optional export)
export async function pingHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export class NpiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public validationErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'NpiClientError';
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    // Try parse JSON, but allow plain text/HTML fallbacks (common when hitting a 404 HTML page in hosting)
    let data: any = null;
    const text = await response.text().catch(() => '');
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      // Map frequently-seen cases to clean messages
      const code = (data && data.code) || '';
      if (
        response.status === 404 &&
        (data?.message?.match(/not\s*found/i) || code === 'NPI_NOT_FOUND')
      ) {
        throw new NpiClientError(
          'NPI not found. Please check the number or try a known test NPI.',
          response.status,
          code,
        );
      }
      if (response.status === 502 || response.status === 503) {
        throw new NpiClientError(
          'Upstream service unavailable. Try again in a minute.',
          response.status,
          code,
        );
      }
      throw new NpiClientError(
        data?.message || `Request failed (HTTP ${response.status}).`,
        response.status,
        code,
        data.errors,
      );
    }
    return data ?? {};
  } catch (error) {
    if (error instanceof NpiClientError) {
      throw error;
    }
    // If the fetch itself failed (network/CORS), surface a clean hint
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Failed to fetch')) {
      throw new NpiClientError(
        'Network error: frontend cannot reach the API. Check NEXT_PUBLIC_BACKEND_URL and CORS.',
        undefined,
        'NETWORK_ERROR',
      );
    }
    throw new NpiClientError(errorMessage, undefined, 'NETWORK_ERROR');
  }
}

export async function lookupNpi(npi: string): Promise<NpiRecord> {
  return fetchJson<NpiRecord>(`${API_BASE}/npi/lookup?npi=${encodeURIComponent(npi)}`);
}

export async function startBasicClaim(
  data: ClaimRequest,
): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${API_BASE}/claim/basic`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function verifyClaimPin(
  npi: string,
  pin: string,
): Promise<{ success: boolean; token?: string }> {
  return fetchJson(`${API_BASE}/claim/verify-pin`, {
    method: 'POST',
    body: JSON.stringify({ npi, pin }),
  });
}

export async function uploadClaimDocuments(
  npi: string,
  files: File[],
): Promise<{ success: boolean; uploadedCount: number }> {
  const formData = new FormData();
  formData.append('npi', npi);
  files.forEach((file, index) => {
    formData.append(`file${index}`, file);
  });

  const response = await fetch(`${API_BASE}/claim/doc`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new NpiClientError(errorData.message || 'Upload failed', response.status);
  }

  return await response.json();
}

export async function requestIssuerAttestation(
  npi: string,
): Promise<{ success: boolean; requestId: string }> {
  return fetchJson(`${API_BASE}/issuer/attest-request`, {
    method: 'POST',
    body: JSON.stringify({ npi }),
  });
}

export async function getClaimStatus(npi: string): Promise<ClaimStatus> {
  return fetchJson<ClaimStatus>(`${API_BASE}/claim/status?npi=${encodeURIComponent(npi)}`);
}

export function isValidNpi(npi: string): boolean {
  // NPI must be exactly 10 digits
  return /^\d{10}$/.test(npi);
}

export function formatNpi(npi: string): string {
  // Format as XXX-XXX-XXXX for display
  const cleaned = npi.replace(/\D/g, '');
  if (cleaned.length !== 10) return npi;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}
