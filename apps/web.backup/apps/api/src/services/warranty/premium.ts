const DEFAULT_BASE_RATE = Number(process.env.WARRANTY_BASE_RATE ?? 0.0085);
const MIN_PREMIUM = Number(process.env.WARRANTY_MIN_PREMIUM ?? 125);
const RISK_LOADING = Number(process.env.WARRANTY_RISK_LOADING ?? 1.5);

const WARRANTY_TYPE_LOADINGS: Record<string, number> = {
  accuracy: 1,
  timeliness: 0.9,
  liability: 1.25,
  default: 1,
};

export interface WarrantyPremiumInput {
  coverage: number;
  warrantyType: string;
  riskScore: number;
  tenorMonths?: number;
}

export interface WarrantyPremiumEstimate {
  coverage: number;
  rate: number;
  premium: number;
  tenorMonths: number;
  warrantyType: string;
  riskScore: number;
  breakdown: {
    baseRate: number;
    riskLoading: number;
    typeLoading: number;
    tenorFactor: number;
  };
  generatedAt: string;
}

export function estimateWarrantyPremium(input: WarrantyPremiumInput): WarrantyPremiumEstimate {
  const coverage = Number.isFinite(input.coverage) && input.coverage > 0 ? input.coverage : 25000;
  const riskScore = clamp01(input.riskScore);
  const warrantyType = (input.warrantyType ?? 'accuracy').toLowerCase();
  const tenorMonths = Number.isFinite(input.tenorMonths) && input.tenorMonths! > 0 ? input.tenorMonths! : 12;

  const baseRate = DEFAULT_BASE_RATE;
  const riskFactor = 1 + riskScore * RISK_LOADING;
  const typeLoading = WARRANTY_TYPE_LOADINGS[warrantyType] ?? WARRANTY_TYPE_LOADINGS.default;
  const tenorFactor = clampRange(tenorMonths / 12, 0.5, 2);

  const rate = clamp01(baseRate * riskFactor * typeLoading * tenorFactor);
  const premium = Math.max(MIN_PREMIUM, Number((coverage * rate).toFixed(2)));

  return {
    coverage,
    rate: Number(rate.toFixed(4)),
    premium,
    tenorMonths,
    warrantyType,
    riskScore,
    breakdown: {
      baseRate,
      riskLoading: Number(riskFactor.toFixed(3)),
      typeLoading,
      tenorFactor: Number(tenorFactor.toFixed(3)),
    },
    generatedAt: new Date().toISOString(),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}










