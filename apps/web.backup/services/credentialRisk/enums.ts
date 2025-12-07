export enum CredentialRiskFactors {
  LICENSE_EXPIRED = 'LICENSE_EXPIRED',
  NPDB_HIT = 'NPDB_HIT',
  SANCTION_ACTIVE = 'SANCTION_ACTIVE',
  PECOS_LAPSE = 'PECOS_LAPSE',
  DEBARMENT_FLAG = 'DEBARMENT_FLAG',
  COMPLIANCE_WARN_NCQA = 'COMPLIANCE_WARN_NCQA',
  COMPLIANCE_FAIL_NCQA = 'COMPLIANCE_FAIL_NCQA',
  COMPLIANCE_WARN_TJC = 'COMPLIANCE_WARN_TJC',
  COMPLIANCE_FAIL_TJC = 'COMPLIANCE_FAIL_TJC',
  MISSING_EVIDENCE = 'MISSING_EVIDENCE',
}

export type CredentialRiskFactor = `${CredentialRiskFactors}`

export const COMPLIANCE_FACTOR_PRIORITY: Record<CredentialRiskFactors, 'moderate' | 'severe' | 'info'> = {
  [CredentialRiskFactors.LICENSE_EXPIRED]: 'severe',
  [CredentialRiskFactors.NPDB_HIT]: 'severe',
  [CredentialRiskFactors.SANCTION_ACTIVE]: 'severe',
  [CredentialRiskFactors.PECOS_LAPSE]: 'moderate',
  [CredentialRiskFactors.DEBARMENT_FLAG]: 'severe',
  [CredentialRiskFactors.COMPLIANCE_WARN_NCQA]: 'moderate',
  [CredentialRiskFactors.COMPLIANCE_FAIL_NCQA]: 'severe',
  [CredentialRiskFactors.COMPLIANCE_WARN_TJC]: 'moderate',
  [CredentialRiskFactors.COMPLIANCE_FAIL_TJC]: 'severe',
  [CredentialRiskFactors.MISSING_EVIDENCE]: 'info',
}

const PRIORITY_WEIGHT: Record<'moderate' | 'severe' | 'info', number> = {
  severe: 35,
  moderate: 18,
  info: 6,
}

export function dedupeFactors(factors: CredentialRiskFactor[]): CredentialRiskFactors[] {
  return Array.from(new Set(factors)) as CredentialRiskFactors[]
}

export function scoreFromFactors(factors: CredentialRiskFactors[]): number {
  if (factors.length === 0) {
    return 0
  }
  const capped = factors.reduce((score, factor) => {
    const priority = COMPLIANCE_FACTOR_PRIORITY[factor] ?? 'info'
    return score + PRIORITY_WEIGHT[priority]
  }, 0)
  return Math.min(100, capped)
}


/**
 * B179A-RISK-002: Enumerated risk factors used by the credentialing risk engine.
 */

export enum CredentialRiskFactors {
  LICENSE_EXPIRED = 'LICENSE_EXPIRED',
  NPDB_HIT = 'NPDB_HIT',
  DEA_EXPIRED = 'DEA_EXPIRED',
  BOARD_EXPIRED = 'BOARD_EXPIRED',
  PECOS_REVOKED = 'PECOS_REVOKED',
  SANCTION_FLAG = 'SANCTION_FLAG',
  LOW_OPPE = 'LOW_OPPE',
  FAILED_FPPE = 'FAILED_FPPE',
  OUT_OF_STATE_WITHOUT_COMPACT = 'OUT_OF_STATE_WITHOUT_COMPACT',
  MULTIPLE_DISCIPLINARY_ACTIONS = 'MULTIPLE_DISCIPLINARY_ACTIONS',
}

export const ALL_CREDENTIAL_RISK_FACTORS: CredentialRiskFactors[] = Object.values(
  CredentialRiskFactors
);

