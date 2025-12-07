import { mergeCredentialRisk } from './riskService'
import { CredentialRiskFactors, type CredentialRiskFactor } from './enums'

export type ComplianceFramework = 'NCQA' | 'TJC'
export type ComplianceStatus = 'PASS' | 'WARN' | 'FAIL'

export interface ComplianceSignal {
  framework: ComplianceFramework
  ruleId: string
  label: string
  status: ComplianceStatus
  updatedAt: string
  evidenceRef?: string
  owner?: string
}

export interface ComplianceRiskUpdateInput {
  clinicianId: string
  signals: ComplianceSignal[]
  source?: string
}

export interface ComplianceRiskUpdateResult {
  clinicianId: string
  added: CredentialRiskFactor[]
  removed: CredentialRiskFactor[]
  summary: {
    failCount: number
    warnCount: number
    lastEvaluatedAt: string
  }
}

const COMPLIANCE_FACTORS: CredentialRiskFactor[] = [
  CredentialRiskFactors.COMPLIANCE_FAIL_NCQA,
  CredentialRiskFactors.COMPLIANCE_WARN_NCQA,
  CredentialRiskFactors.COMPLIANCE_FAIL_TJC,
  CredentialRiskFactors.COMPLIANCE_WARN_TJC,
]

export async function syncComplianceSignalsToRisk(input: ComplianceRiskUpdateInput): Promise<ComplianceRiskUpdateResult> {
  if (!input.clinicianId) {
    throw new Error('syncComplianceSignalsToRisk: clinicianId is required')
  }

  const now = new Date().toISOString()
  const failSignals = input.signals.filter((signal) => signal.status === 'FAIL')
  const warnSignals = input.signals.filter((signal) => signal.status === 'WARN')

  const hasNcqaFail = failSignals.some((signal) => signal.framework === 'NCQA')
  const hasNcqaWarn = warnSignals.some((signal) => signal.framework === 'NCQA')
  const hasTjcFail = failSignals.some((signal) => signal.framework === 'TJC')
  const hasTjcWarn = warnSignals.some((signal) => signal.framework === 'TJC')

  const add: CredentialRiskFactor[] = []
  if (hasNcqaFail) {
    add.push(CredentialRiskFactors.COMPLIANCE_FAIL_NCQA)
  } else if (hasNcqaWarn) {
    add.push(CredentialRiskFactors.COMPLIANCE_WARN_NCQA)
  }

  if (hasTjcFail) {
    add.push(CredentialRiskFactors.COMPLIANCE_FAIL_TJC)
  } else if (hasTjcWarn) {
    add.push(CredentialRiskFactors.COMPLIANCE_WARN_TJC)
  }

  const remove = COMPLIANCE_FACTORS.filter((factor) => !add.includes(factor))

  await mergeCredentialRisk(input.clinicianId, {
    add,
    remove,
    details: {
      lastEvaluatedAt: now,
      source: input.source ?? 'compliance/sync',
      signals: input.signals.map((signal) => ({
        framework: signal.framework,
        ruleId: signal.ruleId,
        label: signal.label,
        status: signal.status,
        updatedAt: signal.updatedAt,
        evidenceRef: signal.evidenceRef,
        owner: signal.owner,
      })),
    },
  })

  return {
    clinicianId: input.clinicianId,
    added: add,
    removed: remove,
    summary: {
      failCount: failSignals.length,
      warnCount: warnSignals.length,
      lastEvaluatedAt: now,
    },
  }
}


