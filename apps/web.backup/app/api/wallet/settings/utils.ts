import { NextRequest } from 'next/server';

const DEFAULT_CLINICIAN_ENV =
  process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID ||
  process.env.DEFAULT_CLINICIAN_ID ||
  process.env.SEED_CLINICIAN_ID ||
  'demo-clinician';

export function resolveClinicianId(request?: NextRequest, fallback?: string): string {
  if (request) {
    const fromHeader = request.headers.get('x-clinician-id');
    if (fromHeader) return fromHeader;
    const fromQuery = request.nextUrl.searchParams.get('clinicianId');
    if (fromQuery) return fromQuery;
  }
  return fallback ?? DEFAULT_CLINICIAN_ENV;
}

export function parseJson<T>(body: unknown): T {
  if (!body) {
    throw new Error('request body required');
  }
  if (typeof body === 'object') {
    return body as T;
  }
  if (typeof body === 'string') {
    return JSON.parse(body) as T;
  }
  throw new Error('unsupported body payload');
}









