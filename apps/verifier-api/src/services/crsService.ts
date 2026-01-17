export const CRS_REQUIREMENT_KEYS = [
  'license_active',
  'board_certified',
  'background_check_clear',
  'sanctions_clear',
  'enrollment_complete',
  'malpractice_clear',
  'references_verified',
] as const;

export type CRSRequirementKey = (typeof CRS_REQUIREMENT_KEYS)[number];

export interface CRSInput {
  requirements?: Partial<Record<CRSRequirementKey, boolean>>;
  revocationStatus?: 'valid' | 'revoked' | 'unknown';
}

export interface CRSConfig {
  weights: Record<CRSRequirementKey, number>;
}

export interface CRSResult {
  score: number;
  missingRequirements: CRSRequirementKey[];
}

export const DEFAULT_CRS_CONFIG: CRSConfig = {
  weights: CRS_REQUIREMENT_KEYS.reduce<Record<CRSRequirementKey, number>>((acc, key) => {
    acc[key] = 1;
    return acc;
  }, {} as Record<CRSRequirementKey, number>),
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

function normalizeRequirements(
  requirements?: Partial<Record<CRSRequirementKey, boolean>>,
): Record<CRSRequirementKey, boolean> {
  return CRS_REQUIREMENT_KEYS.reduce<Record<CRSRequirementKey, boolean>>((acc, key) => {
    acc[key] = requirements?.[key] === true;
    return acc;
  }, {} as Record<CRSRequirementKey, boolean>);
}

function resolveWeight(weight: number | undefined): number {
  if (typeof weight !== 'number' || !Number.isFinite(weight)) return 0;
  return weight > 0 ? weight : 0;
}

/**
 * Compute the Credential Readiness Score (CRS)
 * Deterministic scoring [0..100]
 */
export function computeCRS(input: CRSInput, config: CRSConfig = DEFAULT_CRS_CONFIG): CRSResult {
  const normalizedRequirements = normalizeRequirements(input.requirements);
  const missingRequirements = CRS_REQUIREMENT_KEYS.filter((key) => !normalizedRequirements[key]);

  const totalWeight = CRS_REQUIREMENT_KEYS.reduce(
    (sum, key) => sum + resolveWeight(config.weights[key]),
    0,
  );
  const earnedWeight = CRS_REQUIREMENT_KEYS.reduce((sum, key) => {
    const weight = resolveWeight(config.weights[key]);
    return sum + (normalizedRequirements[key] ? weight : 0);
  }, 0);

  const score = totalWeight > 0 ? clampScore((earnedWeight / totalWeight) * 100) : 0;

  return {
    score,
    missingRequirements,
  };
}
