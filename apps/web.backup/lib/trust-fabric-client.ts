/**
 * Task 517.31 — Add SDK: trustFabric.*
 * SDK client for Trust Fabric API endpoints
 */

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

export interface TrustFabricNode {
  id: string;
  type: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface TrustFlow {
  from: string;
  to: string;
  weight: number;
  path?: string[];
}

export interface TrustFabricData {
  nodes: TrustFabricNode[];
  flows: TrustFlow[];
  weights: Record<string, number>;
}

export interface TrustFabricResponse {
  fabric: TrustFabricData;
  generatedAt: string;
}

export interface TrustDepthResponse {
  identityId: string;
  chainId?: string;
  depth: number;
}

export interface TrustDiffusionResponse {
  intensity: number;
  spread: number;
}

export interface VeracityNexusResponse {
  synthesized: unknown;
  confidence: number;
}

/**
 * Get trust fabric
 */
export async function getTrustFabric(options?: {
  region?: string;
  global?: boolean;
}): Promise<TrustFabricResponse> {
  const params = new URLSearchParams();
  if (options?.region) params.set('region', options.region);
  if (options?.global !== undefined) params.set('global', String(options.global));

  const res = await fetch(`${API_BASE}/api/trust/fabric?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to get trust fabric: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Get trust depth for an identity
 */
export async function getTrustDepth(
  identityId: string,
  chainId?: string
): Promise<TrustDepthResponse> {
  const params = new URLSearchParams({ identityId });
  if (chainId) params.set('chainId', chainId);

  const res = await fetch(`${API_BASE}/api/trust/fabric/depth?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to get trust depth: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Get trust diffusion field
 */
export async function getTrustDiffusion(): Promise<TrustDiffusionResponse> {
  const res = await fetch(`${API_BASE}/api/trust/fabric/diffusion`);
  if (!res.ok) {
    throw new Error(`Failed to get trust diffusion: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Synthesize veracity nexus from proofs
 */
export async function synthesizeVeracity(proofs: unknown[]): Promise<VeracityNexusResponse> {
  const res = await fetch(`${API_BASE}/api/trust/fabric/veracity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proofs }),
  });
  if (!res.ok) {
    throw new Error(`Failed to synthesize veracity: ${res.statusText}`);
  }
  return res.json();
}

// Export all functions as a namespace
export const trustFabric = {
  getTrustFabric,
  getTrustDepth,
  getTrustDiffusion,
  synthesizeVeracity,
};

