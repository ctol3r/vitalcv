/**
 * Task 519.21 — Add SDK: neuroEcon.*
 * SDK client for Workforce Neuroeconomic Flow API endpoints
 */

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

export interface NeuroEconomicTensor {
  dimensions: number[];
  values: number[][];
  metadata?: Record<string, unknown>;
}

export interface NeuroEconomicTensorResponse {
  tensor: NeuroEconomicTensor;
  generatedAt: string;
}

export interface EconomicMicroshockResponse {
  shock: unknown;
  probability: number;
}

export interface LaborFlowEmbeddingsResponse {
  graph: unknown;
  embeddings: unknown;
}

export interface SpecialtyRegionMigrationResponse {
  wave: unknown;
  probability: number;
}

export interface RoleEvolutionForecastResponse {
  forecast: unknown;
  confidence: number;
}

/**
 * Get neuroeconomic tensor
 */
export async function getNeuroEconomicTensor(
  region?: string,
  specialty?: string
): Promise<NeuroEconomicTensorResponse> {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (specialty) params.set('specialty', specialty);

  const res = await fetch(`${API_BASE}/api/workforce/neuroecon?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to get neuroeconomic tensor: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Predict economic microshock
 */
export async function predictEconomicMicroshock(
  region?: string,
  specialty?: string
): Promise<EconomicMicroshockResponse> {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (specialty) params.set('specialty', specialty);

  const res = await fetch(`${API_BASE}/api/workforce/neuroecon/microshock?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to predict economic microshock: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Generate labor flow embeddings
 */
export async function generateLaborFlowEmbeddings(): Promise<LaborFlowEmbeddingsResponse> {
  const res = await fetch(`${API_BASE}/api/workforce/neuroecon/embeddings`);
  if (!res.ok) {
    throw new Error(`Failed to generate labor flow embeddings: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Predict specialty-region migration
 */
export async function predictSpecialtyRegionMigration(
  specialty: string,
  fromRegion: string,
  toRegion: string
): Promise<SpecialtyRegionMigrationResponse> {
  const params = new URLSearchParams({
    specialty,
    fromRegion,
    toRegion,
  });

  const res = await fetch(`${API_BASE}/api/workforce/neuroecon/migration?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to predict migration: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Forecast role evolution
 */
export async function forecastRoleEvolution(
  role: string,
  horizon?: number
): Promise<RoleEvolutionForecastResponse> {
  const params = new URLSearchParams({ role });
  if (horizon) params.set('horizon', String(horizon));

  const res = await fetch(`${API_BASE}/api/workforce/neuroecon/role-evolution?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to forecast role evolution: ${res.statusText}`);
  }
  return res.json();
}

// Export all functions as a namespace
export const neuroEcon = {
  getNeuroEconomicTensor,
  predictEconomicMicroshock,
  generateLaborFlowEmbeddings,
  predictSpecialtyRegionMigration,
  forecastRoleEvolution,
};

