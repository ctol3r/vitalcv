import { auth } from '@clerk/nextjs/server';
import { getBackendBase } from '@/lib/api';

export const MARKETPLACE_BACKEND = getBackendBase();

export function buildMarketplaceHeaders(
  session: Awaited<ReturnType<typeof auth>>,
  init?: HeadersInit,
): Headers {
  const headers = new Headers(init);
  headers.set('Accept', 'application/json');

  if (session.userId) {
    headers.set('x-clerk-user-id', session.userId);
  }

  const emailClaim = (session.sessionClaims as Record<string, unknown> | undefined)?.email;
  if (typeof emailClaim === 'string' && emailClaim.length > 0) {
    headers.set('x-clerk-user-email', emailClaim);
  }

  return headers;
}

export function getServerApiKey(): string | null {
  const raw = process.env.VERIFIER_WALLET_API_KEYS ?? process.env.API_KEYS ?? '';
  const apiKey = raw
    .split(',')
    .map((value) => value.trim())
    .find((value) => value.length > 0);

  return apiKey ?? null;
}
