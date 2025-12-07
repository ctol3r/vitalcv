/**
 * Task 518.27 — Add SDK: frictionPhysics.*
 * SDK client for Employer Friction Physics API endpoints
 */

const API_BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

export interface FrictionMatrix {
  drag: number;
  kineticResistance: number;
  matrix: Record<string, number>;
}

export interface FrictionMatrixResponse {
  matrix: FrictionMatrix;
  generatedAt: string;
}

export interface HiringFrictionRequest {
  orgId: string;
  atsId?: string;
  outcomeMismatch: number;
}

export interface HiringFrictionResponse {
  frictionScore: number;
}

export interface PrivilegeFrictionResponse {
  friction: number;
}

export interface ComplianceResonanceResponse {
  resonance: number;
  wave: unknown;
}

export interface SafetyPrivilegeReactorResponse {
  safetyScore: number;
  privilegeScore: number;
}

/**
 * Get friction matrix
 */
export async function getFrictionMatrix(orgId?: string): Promise<FrictionMatrixResponse> {
  const params = new URLSearchParams();
  if (orgId) params.set('orgId', orgId);

  const res = await fetch(`${API_BASE}/api/employer/friction?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to get friction matrix: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Detect hiring friction
 */
export async function detectHiringFriction(
  request: HiringFrictionRequest
): Promise<HiringFrictionResponse> {
  const res = await fetch(`${API_BASE}/api/employer/friction/hiring`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`Failed to detect hiring friction: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Get privilege friction
 */
export async function getPrivilegeFriction(
  orgId: string,
  privilegeCode: string
): Promise<PrivilegeFrictionResponse> {
  const params = new URLSearchParams({ orgId, privilegeCode });

  const res = await fetch(`${API_BASE}/api/employer/friction/privilege?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to get privilege friction: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Get compliance resonance
 */
export async function getComplianceResonance(
  orgId?: string,
  region?: string
): Promise<ComplianceResonanceResponse> {
  const params = new URLSearchParams();
  if (orgId) params.set('orgId', orgId);
  if (region) params.set('region', region);

  const res = await fetch(`${API_BASE}/api/employer/friction/compliance-resonance?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to get compliance resonance: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Get safety-privilege reactor
 */
export async function getSafetyPrivilegeReactor(
  orgId?: string,
  clinicianId?: string
): Promise<SafetyPrivilegeReactorResponse> {
  const params = new URLSearchParams();
  if (orgId) params.set('orgId', orgId);
  if (clinicianId) params.set('clinicianId', clinicianId);

  const res = await fetch(`${API_BASE}/api/employer/friction/safety-privilege?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to get safety-privilege reactor: ${res.statusText}`);
  }
  return res.json();
}

// Export all functions as a namespace
export const frictionPhysics = {
  getFrictionMatrix,
  detectHiringFriction,
  getPrivilegeFriction,
  getComplianceResonance,
  getSafetyPrivilegeReactor,
};

