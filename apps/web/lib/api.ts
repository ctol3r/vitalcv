type ApiPath =
  | '/trust-state'
  | '/ingest/npi'
  | '/ingest/files'
  | '/verification/run'
  | '/acceptances'
  | '/starts'
  | '/verify'
  | '/compliance/emergency/declare'
  | '/compliance/emergency/status'
  | '/api/pilot/activate'
  | '/metrics/public';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  '';
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const DEMO_PATHS: Record<
  Extract<ApiPath, '/trust-state' | '/ingest/npi'>,
  string
> = {
  '/trust-state': '/demo/status',
  '/ingest/npi': '/demo/issue',
};

function normalizeApiBase(base: string): string {
  if (!base) return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function isDemoPath(p: string): p is keyof typeof DEMO_PATHS {
  return p in DEMO_PATHS;
}

export function apiRoute(path: ApiPath): string {
  const resolvedPath = DEMO_MODE && isDemoPath(path) ? DEMO_PATHS[path] : path;
  const base = normalizeApiBase(API_BASE);
  return base ? `${base}${resolvedPath}` : resolvedPath;
}

// ── Trust State Fetcher ──────────────────────────────────────────────
// Fetches clinician trust state from the backend.
// Returns null on any failure — callers must handle the fallback.

import type { TrustStateResponse } from '@/components/trust-state/types';
import { normalizeTrustStateResponse } from '@/components/trust-state/types';

const ORG_HEADER = { 'x-org-id': 'demo-pilot-org-alpha' };

export async function fetchClinicianTrustState(
  npi: string,
): Promise<TrustStateResponse | null> {
  try {
    const url = `${apiRoute('/trust-state')}?clinician_id=${encodeURIComponent(npi)}`;
    const res = await fetch(url, { headers: ORG_HEADER, next: { revalidate: 30 } });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    return normalizeTrustStateResponse(raw);
  } catch {
    return null;
  }
}

// ── Mobile Trust API ─────────────────────────────────────────────────
// Wrappers for mobile-specific trust data flows.

export async function fetchMobileTrustState(
  npi: string,
): Promise<TrustStateResponse | null> {
  return fetchClinicianTrustState(npi);
}

export interface NetworkActivity {
  status: string;
  uptime_seconds: number;
  verifications_performed: number;
  generated_at: string;
}

export async function fetchNetworkActivity(): Promise<NetworkActivity | null> {
  try {
    const res = await fetch(apiRoute('/metrics/public'));
    if (!res.ok) return null;
    return (await res.json()) as NetworkActivity;
  } catch {
    return null;
  }
}

export interface ShareProofResult {
  verifyUrl: string;
  deepLink: string;
  npi: string;
}

export function createShareProof(npi: string): ShareProofResult {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.vitalcv.com';
  return {
    verifyUrl: `${origin}/verify/${encodeURIComponent(npi)}`,
    deepLink: `vitalcv://verify/${encodeURIComponent(npi)}`,
    npi,
  };
}

// ── Knowledge Graph ──────────────────────────────────────────────────
// Fetches the full knowledge graph for a clinician by NPI.

import type { KnowledgeGraphData } from '@/types/graph';

export async function fetchKnowledgeGraph(
  npi: string,
): Promise<KnowledgeGraphData | null> {
  try {
    const base = normalizeApiBase(API_BASE);
    const url = `${base}/api/graph/explorer/${encodeURIComponent(npi)}`;
    const res = await fetch(url, { headers: ORG_HEADER, next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as KnowledgeGraphData;
  } catch {
    return null;
  }
}

export async function fetchGraphNodeData(
  nodeId: string,
): Promise<KnowledgeGraphData | null> {
  try {
    const base = normalizeApiBase(API_BASE);
    const url = `${base}/api/knowledge/${encodeURIComponent(nodeId)}`;
    const res = await fetch(url, { headers: ORG_HEADER, next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as KnowledgeGraphData;
  } catch {
    return null;
  }
}

// ── Revocation Blast Radius ──────────────────────────────────────────
// Read-only analysis of credential revocation impact.

import type { BlastRadiusResult } from '@/types/revocation';

export async function fetchBlastRadius(
  credentialId: string,
): Promise<BlastRadiusResult | null> {
  try {
    const base = normalizeApiBase(API_BASE);
    const url = `${base}/api/decisions/blast-radius/${encodeURIComponent(credentialId)}`;
    const res = await fetch(url, { headers: ORG_HEADER, next: { revalidate: 0 } });
    if (!res.ok) return null;
    return (await res.json()) as BlastRadiusResult;
  } catch {
    return null;
  }
}

export type { ApiPath };
