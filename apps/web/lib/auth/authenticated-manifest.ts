import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';

export const AUTHENTICATED_MANIFEST_SCHEMA = 'vitalcv.authenticated-manifest.v1' as const;

type ManifestEnforcementStatus = 'issued' | 'blocked';
type ManifestEnforcementBlocker =
  | 'AUTH_REQUIRED'
  | 'INVALID_NPI'
  | 'OWNERSHIP_LOOKUP_FAILED'
  | 'OWNERSHIP_NOT_VERIFIED';

interface OwnershipRecord {
  npi?: unknown;
  claimedAt?: unknown;
  verificationMethod?: unknown;
  revokedAt?: unknown;
}

export interface AuthenticatedManifestEnforcement {
  schema: typeof AUTHENTICATED_MANIFEST_SCHEMA;
  status: ManifestEnforcementStatus;
  actorId: string | null;
  clinicianNpi: string;
  ownershipVerified: boolean;
  ownershipContinuityScore: number;
  blocker: ManifestEnforcementBlocker | null;
  ownership: {
    claimedAt: string | null;
    verificationMethod: string | null;
  } | null;
  replayAttribution: {
    lineageKey: string;
    attributionSource: 'clerk_session+npi_ownership';
  };
}

export interface AuthenticatedManifestOwnership {
  actorId: string;
  clinicianNpi: string;
  enforcement: AuthenticatedManifestEnforcement;
}

type OwnershipResult =
  | { ok: true; ownership: AuthenticatedManifestOwnership }
  | { ok: false; response: NextResponse };

const NPI_RE = /^\d{10}$/;

function lineageKey(input: {
  actorId: string | null;
  npi: string;
  status: ManifestEnforcementStatus | 'owned';
  claimedAt?: string | null;
}): string {
  return [
    AUTHENTICATED_MANIFEST_SCHEMA,
    input.actorId ?? 'anonymous',
    input.npi,
    input.status,
    input.claimedAt ?? 'unclaimed',
  ].join('|');
}

function enforcement(input: {
  status: ManifestEnforcementStatus;
  actorId: string | null;
  npi: string;
  blocker: ManifestEnforcementBlocker | null;
  claimedAt?: string | null;
  verificationMethod?: string | null;
}): AuthenticatedManifestEnforcement {
  const ownershipVerified = input.status === 'issued' && input.blocker === null;
  return {
    schema: AUTHENTICATED_MANIFEST_SCHEMA,
    status: input.status,
    actorId: input.actorId,
    clinicianNpi: input.npi,
    ownershipVerified,
    ownershipContinuityScore: ownershipVerified ? 100 : 0,
    blocker: input.blocker,
    ownership: ownershipVerified
      ? {
          claimedAt: input.claimedAt ?? null,
          verificationMethod: input.verificationMethod ?? null,
        }
      : null,
    replayAttribution: {
      lineageKey: lineageKey({
        actorId: input.actorId,
        npi: input.npi,
        status: ownershipVerified ? 'owned' : input.status,
        claimedAt: input.claimedAt,
      }),
      attributionSource: 'clerk_session+npi_ownership',
    },
  };
}

function blockedResponse(
  status: number,
  error: string,
  errorDescription: string,
  manifestEnforcement: AuthenticatedManifestEnforcement,
): NextResponse {
  return NextResponse.json(
    {
      error,
      error_description: errorDescription,
      manifestEnforcement,
    },
    {
      status,
      headers: authenticatedManifestHeaders(manifestEnforcement),
    },
  );
}

function readOwnerships(payload: unknown): OwnershipRecord[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const ownerships = (payload as { ownerships?: unknown }).ownerships;
  return Array.isArray(ownerships)
    ? ownerships.filter((entry): entry is OwnershipRecord => Boolean(entry) && typeof entry === 'object')
    : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function findActiveOwnership(ownerships: readonly OwnershipRecord[], npi: string): OwnershipRecord | null {
  return ownerships.find((ownership) => (
    stringValue(ownership.npi) === npi
    && stringValue(ownership.revokedAt) === null
  )) ?? null;
}

export function authenticatedManifestHeaders(enforcementState: AuthenticatedManifestEnforcement): HeadersInit {
  return {
    'X-VitalCV-Manifest-Actor': enforcementState.actorId ?? 'anonymous',
    'X-VitalCV-Owned-NPI': enforcementState.clinicianNpi,
    'X-VitalCV-Ownership-Lineage': enforcementState.replayAttribution.lineageKey,
  };
}

export function authenticatedManifestUpstreamHeaders(
  ownership: AuthenticatedManifestOwnership,
  init?: HeadersInit,
): Headers {
  const headers = new Headers(init);
  headers.set('x-clerk-user-id', ownership.actorId);
  headers.set('x-vitalcv-manifest-actor', ownership.actorId);
  headers.set('x-vitalcv-owned-npi', ownership.clinicianNpi);
  headers.set('x-vitalcv-ownership-lineage', ownership.enforcement.replayAttribution.lineageKey);
  return headers;
}

export function bindAuthenticatedManifest<T>(body: T, ownership: AuthenticatedManifestOwnership): T {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }

  const record = body as Record<string, unknown>;
  const manifest = record.manifest;

  return {
    ...record,
    authenticatedManifest: ownership.enforcement,
    ...(manifest && typeof manifest === 'object' && !Array.isArray(manifest)
      ? {
          manifest: {
            ...(manifest as Record<string, unknown>),
            authenticatedActor: {
              schema: AUTHENTICATED_MANIFEST_SCHEMA,
              actorId: ownership.actorId,
              clinicianNpi: ownership.clinicianNpi,
              ownershipVerified: true,
              ownershipContinuityScore: ownership.enforcement.ownershipContinuityScore,
              replayAttribution: ownership.enforcement.replayAttribution,
            },
          },
        }
      : {}),
  } as T;
}

export async function requireAuthenticatedManifestOwnership(npi: string): Promise<OwnershipResult> {
  if (!NPI_RE.test(npi)) {
    const manifestEnforcement = enforcement({
      status: 'blocked',
      actorId: null,
      npi,
      blocker: 'INVALID_NPI',
    });
    return {
      ok: false,
      response: blockedResponse(
        400,
        'invalid_npi',
        'A valid 10-digit clinician NPI is required before manifest issuance.',
        manifestEnforcement,
      ),
    };
  }

  const session = await auth();
  const actorId = session.userId ?? null;

  if (!actorId) {
    const manifestEnforcement = enforcement({
      status: 'blocked',
      actorId: null,
      npi,
      blocker: 'AUTH_REQUIRED',
    });
    return {
      ok: false,
      response: blockedResponse(
        401,
        'unauthorized',
        'Sign in as the clinician owner before issuing a proof manifest.',
        manifestEnforcement,
      ),
    };
  }

  let ownershipPayload: unknown = null;
  try {
    const ownershipResponse = await fetch(`${getBackendBase()}/api/ownership/me`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'x-clerk-user-id': actorId,
      },
      signal: AbortSignal.timeout(8_000),
    });

    ownershipPayload = await ownershipResponse.json().catch(() => null);
    if (!ownershipResponse.ok) {
      const manifestEnforcement = enforcement({
        status: 'blocked',
        actorId,
        npi,
        blocker: 'OWNERSHIP_LOOKUP_FAILED',
      });
      return {
        ok: false,
        response: blockedResponse(
          503,
          'ownership_lookup_failed',
          'NPI ownership could not be verified, so manifest issuance failed closed.',
          manifestEnforcement,
        ),
      };
    }
  } catch {
    const manifestEnforcement = enforcement({
      status: 'blocked',
      actorId,
      npi,
      blocker: 'OWNERSHIP_LOOKUP_FAILED',
    });
    return {
      ok: false,
      response: blockedResponse(
        503,
        'ownership_lookup_failed',
        'NPI ownership could not be verified, so manifest issuance failed closed.',
        manifestEnforcement,
      ),
    };
  }

  const activeOwnership = findActiveOwnership(readOwnerships(ownershipPayload), npi);
  if (!activeOwnership) {
    const manifestEnforcement = enforcement({
      status: 'blocked',
      actorId,
      npi,
      blocker: 'OWNERSHIP_NOT_VERIFIED',
    });
    return {
      ok: false,
      response: blockedResponse(
        403,
        'ownership_not_verified',
        'This signed-in actor does not have active ownership for the requested NPI.',
        manifestEnforcement,
      ),
    };
  }

  const manifestEnforcement = enforcement({
    status: 'issued',
    actorId,
    npi,
    blocker: null,
    claimedAt: stringValue(activeOwnership.claimedAt),
    verificationMethod: stringValue(activeOwnership.verificationMethod),
  });

  return {
    ok: true,
    ownership: {
      actorId,
      clinicianNpi: npi,
      enforcement: manifestEnforcement,
    },
  };
}

