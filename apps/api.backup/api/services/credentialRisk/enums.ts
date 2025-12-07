export enum CredentialRiskFactors {
  LICENSE_EXPIRED = 'LICENSE_EXPIRED',
  NPDB_HIT = 'NPDB_HIT',
  EHR_SYNC_FAILURE = 'EHR_SYNC_FAILURE',
  COMPLIANCE_WARN_NCQA = 'COMPLIANCE_WARN_NCQA',
  COMPLIANCE_FAIL_NCQA = 'COMPLIANCE_FAIL_NCQA',
  COMPLIANCE_WARN_TJC = 'COMPLIANCE_WARN_TJC',
  COMPLIANCE_FAIL_TJC = 'COMPLIANCE_FAIL_TJC',
  MISSING_EVIDENCE = 'MISSING_EVIDENCE',
  PREDICTIVE_SAFETY_RISK = 'PREDICTIVE_SAFETY_RISK',
}

export type CredentialRiskFactor = `${CredentialRiskFactors}`
export type EhrSyncSeverity = 'MEDIUM' | 'HIGH'

export const EHR_SEVERITY_SCORE_FLOORS: Record<EhrSyncSeverity, number> = {
  MEDIUM: 55,
  HIGH: 80,
}

export const FACTOR_PRIORITY: Record<CredentialRiskFactors, 'info' | 'moderate' | 'severe'> = {
  [CredentialRiskFactors.LICENSE_EXPIRED]: 'severe',
  [CredentialRiskFactors.NPDB_HIT]: 'severe',
  [CredentialRiskFactors.EHR_SYNC_FAILURE]: 'moderate',
  [CredentialRiskFactors.COMPLIANCE_WARN_NCQA]: 'moderate',
  [CredentialRiskFactors.COMPLIANCE_FAIL_NCQA]: 'severe',
  [CredentialRiskFactors.COMPLIANCE_WARN_TJC]: 'moderate',
  [CredentialRiskFactors.COMPLIANCE_FAIL_TJC]: 'severe',
  [CredentialRiskFactors.MISSING_EVIDENCE]: 'info',
  [CredentialRiskFactors.PREDICTIVE_SAFETY_RISK]: 'moderate',
}

const PRIORITY_WEIGHT: Record<'info' | 'moderate' | 'severe', number> = {
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
    const priority = FACTOR_PRIORITY[factor] ?? 'info'
    return score + PRIORITY_WEIGHT[priority]
  }, 0)
  return Math.min(100, capped)
}
