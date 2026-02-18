import type { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { normalizeDid } from '../utils/issuerDid';

export type PublicKeyJwk = {
  kty: string;
  crv: string;
  x: string;
  y: string;
  alg: string;
  use: string;
  kid?: string;
};

export type TrustedIssuerRecord = {
  did: string;
  name: string;
  active: boolean;
  publicKeyJwk: Prisma.JsonValue;
};

export type IssuerRegistrySummary = {
  totalIssuers: number;
  activeIssuers: number;
  issuers: Array<{
    did: string;
    active: boolean;
  }>;
};

const CACHE_TTL_MS = 60_000;

type CachedIssuerSummary = {
  expiresAtMs: number;
  value: IssuerRegistrySummary;
};

let cachedSummary: CachedIssuerSummary | null = null;

function nowMs(): number {
  return Date.now();
}

function isCacheValid(cache: CachedIssuerSummary | null): boolean {
  return cache !== null && cache.expiresAtMs > nowMs();
}

function toJsonWebKey(raw: Prisma.JsonValue): PublicKeyJwk {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid public key value in trusted issuer registry.');
  }

  const key = raw as {
    kty?: unknown;
    crv?: unknown;
    x?: unknown;
    y?: unknown;
    alg?: unknown;
    use?: unknown;
    kid?: unknown;
  };

  const normalized = {
    kty: typeof key.kty === 'string' ? key.kty.trim() : '',
    crv: typeof key.crv === 'string' ? key.crv.trim() : '',
    x: typeof key.x === 'string' ? key.x.trim() : '',
    y: typeof key.y === 'string' ? key.y.trim() : '',
    alg: typeof key.alg === 'string' ? key.alg.trim() : '',
    use: typeof key.use === 'string' ? key.use.trim() : '',
    ...(typeof key.kid === 'string' && key.kid.trim().length > 0
      ? { kid: key.kid.trim() }
      : {}),
  };

  if (
    normalized.kty !== 'EC' ||
    normalized.crv !== 'P-256' ||
    !normalized.x ||
    !normalized.y ||
    normalized.alg !== 'ES256' ||
    normalized.use !== 'sig'
  ) {
    throw new Error('Trusted issuer public key must be EC P-256 ES256/sig.');
  }

  return normalized;
}

function toSummary(rows: TrustedIssuerRecord[]): IssuerRegistrySummary {
  const issuers = rows.map((row) => ({ did: row.did, active: row.active }));
  return {
    totalIssuers: rows.length,
    activeIssuers: rows.filter((row) => row.active).length,
    issuers,
  };
}

async function loadIssuerSummary(): Promise<IssuerRegistrySummary> {
  const rows = await prisma.trustedIssuer.findMany({
    select: {
      did: true,
      name: true,
      active: true,
      publicKeyJwk: true,
    },
    orderBy: { did: 'asc' },
  });

  const normalizedRows: TrustedIssuerRecord[] = rows.map((row) => ({
    did: row.did,
    name: row.name,
    active: row.active,
    publicKeyJwk: row.publicKeyJwk,
  }));

  const summary = toSummary(normalizedRows);
  cachedSummary = {
    expiresAtMs: nowMs() + CACHE_TTL_MS,
    value: summary,
  };

  return summary;
}

async function getSummary(): Promise<IssuerRegistrySummary> {
  if (cachedSummary !== null && isCacheValid(cachedSummary)) {
    return cachedSummary.value;
  }

  return loadIssuerSummary();
}

export async function getIssuerRegistrySummary(): Promise<IssuerRegistrySummary> {
  return getSummary();
}

export async function isTrustedIssuer(did: string): Promise<boolean> {
  const normalizedDid = normalizeDid(did);
  const summary = await getSummary();
  const issuer = summary.issuers.find((entry) => entry.did === normalizedDid);
  return Boolean(issuer?.active);
}

export async function getIssuerPublicKey(did: string): Promise<PublicKeyJwk> {
  const normalizedDid = normalizeDid(did);

  const row = await prisma.trustedIssuer.findUnique({
    where: { did: normalizedDid },
    select: { did: true, active: true, publicKeyJwk: true },
  });

  if (!row) {
    throw new Error(`Issuer not trusted: ${normalizedDid}.`);
  }
  if (!row.active) {
    throw new Error(`Issuer is inactive: ${normalizedDid}.`);
  }

  return toJsonWebKey(row.publicKeyJwk);
}
