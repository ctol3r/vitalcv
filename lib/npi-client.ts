/**
 * NPI API client functions
 */

import { NpiRecord, ClaimStatus, ClaimRequest } from './npi-types';

const API_BASE = '/api';

export class NpiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public validationErrors?: Record<string, string>
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new NpiClientError(
        errorData.message || 'Request failed',
        response.status,
        errorData.code,
        errorData.errors
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof NpiClientError) {
      throw error;
    }
    throw new NpiClientError(
      error instanceof Error ? error.message : 'Network error',
      undefined,
      'NETWORK_ERROR'
    );
  }
}

export async function lookupNpi(npi: string): Promise<NpiRecord> {
  return fetchJson<NpiRecord>(`${API_BASE}/npi/lookup?npi=${encodeURIComponent(npi)}`);
}

export async function startBasicClaim(data: ClaimRequest): Promise<{ success: boolean; message: string }> {
  return fetchJson(`${API_BASE}/claim/basic`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function verifyClaimPin(npi: string, pin: string): Promise<{ success: boolean; token?: string }> {
  return fetchJson(`${API_BASE}/claim/verify-pin`, {
    method: 'POST',
    body: JSON.stringify({ npi, pin }),
  });
}

export async function uploadClaimDocuments(
  npi: string,
  files: File[]
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

export async function requestIssuerAttestation(npi: string): Promise<{ success: boolean; requestId: string }> {
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

