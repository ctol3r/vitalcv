import { getTrustWeightSnapshot } from '../trust/weights';
import { listTrustBreaches } from '../trust/breach';
import { evaluateWarrantyRisk, type WarrantyRiskInput, type WarrantyRiskResult } from './risk';

export type WarrantyBreachType = 'false_issuance' | 'expired_coverage' | 'issuer_misconduct';

export interface WarrantyBreach {
  type: WarrantyBreachType;
  severity: 'info' | 'warning' | 'critical';
  detail: string;
  detectedAt: string;
}

export interface WarrantyBreachInput extends WarrantyRiskInput {
  expiresAt: string | Date;
  baselineRisk?: WarrantyRiskResult;
}

export interface WarrantyBreachResult {
  breaches: WarrantyBreach[];
  summary: string;
  checkedAt: string;
  risk: WarrantyRiskResult;
}

const MISCONDUCT_THRESHOLD = Number(process.env.WARRANTY_MISCONDUCT_THRESHOLD ?? 0.35);
const FALSE_ISSUANCE_THRESHOLD = Number(process.env.WARRANTY_FALSE_ISSUANCE_THRESHOLD ?? 0.7);

export async function detectWarrantyBreaches(input: WarrantyBreachInput): Promise<WarrantyBreachResult> {
  const expiresAt = new Date(input.expiresAt);
  const risk = input.baselineRisk ?? (await evaluateWarrantyRisk(input));
  const breaches: WarrantyBreach[] = [];
  const detectedAt = new Date().toISOString();

  if (expiresAt.getTime() < Date.now()) {
    breaches.push({
      type: 'expired_coverage',
      severity: 'warning',
      detail: 'Coverage period has lapsed',
      detectedAt,
    });
  }

  if (risk.compositeRisk >= FALSE_ISSUANCE_THRESHOLD || risk.revocationHistory >= 0.8) {
    breaches.push({
      type: 'false_issuance',
      severity: 'critical',
      detail: `Composite risk ${risk.compositeRisk.toFixed(2)} exceeds threshold`,
      detectedAt,
    });
  }

  const trustSnapshot = await getTrustWeightSnapshot(input.issuerDid);
  const trustBreaches = listTrustBreaches().find((entry) => entry.issuerDid === input.issuerDid);

  if (trustSnapshot.normalizedWeight < MISCONDUCT_THRESHOLD || trustBreaches) {
    breaches.push({
      type: 'issuer_misconduct',
      severity: trustBreaches ? 'critical' : 'warning',
      detail: trustBreaches
        ? `Issuer breach history: ${trustBreaches.reasons.join(', ')}`
        : `Trust weight ${trustSnapshot.normalizedWeight.toFixed(2)} below threshold`,
      detectedAt,
    });
  }

  const summary =
    breaches.length === 0
      ? 'no_breaches_detected'
      : breaches.map((breach) => `${breach.type}:${breach.severity}`).join('|');

  return {
    breaches,
    summary,
    checkedAt: detectedAt,
    risk,
  };
}










