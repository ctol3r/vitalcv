import { getControlledIssuerDID } from '../utils/didGenerator';
import { getPublicSigningJwk } from './signingKeyProvider';

type IssuerPublicJwk = {
  kty: string;
  crv: string;
  x: string;
  y: string;
  alg: string;
  use: string;
  kid?: string;
};

const ISSUER_REGISTRY_TTL_MS = 60_000;

type TrustedIssuer = {
  did: string;
  active: boolean;
};

type IssuerRegistrySummary = {
  totalIssuers: number;
  activeIssuers: number;
  issuers: TrustedIssuer[];
};

type CachedSummary = {
  summary: IssuerRegistrySummary;
  expiresAtMs: number;
};

let cachedSummary: CachedSummary | null = null;

function normalizeDid(did: string): string {
  const normalized = did.trim();
  if (!normalized) {
    throw new Error('DID is required.');
  }
  return normalized;
}

function toString(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : '';
}

function resolveIssuerRegistryBaseUrl(): string {
  const configured =
    toString(process.env.TRUSTED_ISSUER_REGISTRY_BASE_URL) ||
    toString(process.env.BACKEND_INTERNAL_API_BASE_URL) ||
    toString(process.env.BACKEND_PUBLIC_BASE_URL) ||
    'https://vitalcv.com';
  return configured.endsWith('/') ? configured.slice(0, -1) : configured;
}

function isCacheValid(cache: CachedSummary | null): boolean {
  return cache !== null && cache.expiresAtMs > Date.now();
}

function parseRegistryResponse(payload: unknown): IssuerRegistrySummary {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid trusted issuer registry payload.');
  }
  const body = payload as {
    totalIssuers?: unknown;
    activeIssuers?: unknown;
    issuers?: unknown;
  };

  const totalIssuers = Number(body.totalIssuers);
  const activeIssuers = Number(body.activeIssuers);
  if (!Number.isFinite(totalIssuers) || totalIssuers < 0) {
    throw new Error('Invalid trusted issuer registry payload.');
  }
  if (!Number.isFinite(activeIssuers) || activeIssuers < 0) {
    throw new Error('Invalid trusted issuer registry payload.');
  }

  const issuersRaw = Array.isArray(body.issuers) ? body.issuers : [];
  const issuers: TrustedIssuer[] = [];
  for (const entry of issuersRaw) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const candidate = entry as { did?: unknown; active?: unknown };
    const did = toString(typeof candidate.did === 'string' ? candidate.did : undefined);
    if (!did) {
      continue;
    }
    issuers.push({ did, active: candidate.active === true });
  }

  return { totalIssuers, activeIssuers, issuers };
}

async function fetchIssuerRegistrySummary(): Promise<IssuerRegistrySummary> {
  const response = await fetch(`${resolveIssuerRegistryBaseUrl()}/api/internal/trusted-issuers`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...(toString(process.env.MONITORING_SECRET).length > 0
        ? { 'x-monitoring-secret': toString(process.env.MONITORING_SECRET) }
        : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch issuer registry: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as unknown;
  return parseRegistryResponse(payload);
}

async function getCachedSummary(): Promise<IssuerRegistrySummary> {
  if (isCacheValid(cachedSummary) && cachedSummary !== null) {
    return cachedSummary.summary;
  }

  const summary = await fetchIssuerRegistrySummary();
  cachedSummary = {
    summary,
    expiresAtMs: Date.now() + ISSUER_REGISTRY_TTL_MS,
  };
  return summary;
}

export async function isTrustedIssuer(did: string): Promise<boolean> {
  const normalizedDid = normalizeDid(did);
  const summary = await getCachedSummary();
  const issuer = summary.issuers.find((entry) => entry.did === normalizedDid);
  return Boolean(issuer?.active);
}

export async function getIssuerPublicKey(did: string): Promise<IssuerPublicJwk> {
  const normalizedDid = normalizeDid(did);
  const trusted = await isTrustedIssuer(normalizedDid);
  if (!trusted) {
    throw new Error(`Issuer not trusted: ${normalizedDid}.`);
  }

  const controlledDid = getControlledIssuerDID();
  if (normalizedDid !== controlledDid) {
    throw new Error(`No stored public key available for unconfigured issuer ${normalizedDid}.`);
  }

  const publicJwk = getPublicSigningJwk();
  const normalizedPublicJwk = { ...publicJwk } as IssuerPublicJwk;
  if (
    normalizedPublicJwk.kty !== 'EC' ||
    normalizedPublicJwk.crv !== 'P-256' ||
    normalizedPublicJwk.alg !== 'ES256' ||
    normalizedPublicJwk.use !== 'sig'
  ) {
    throw new Error(`Invalid public key configuration for issuer ${normalizedDid}.`);
  }

  return normalizedPublicJwk;
}
