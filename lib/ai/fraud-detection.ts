/**
 * AI Fraud Detection for VitalCV
 *
 * Hybrid approach: Rule-based heuristics + ML-ready infrastructure
 * Detects potentially fraudulent credentials using pattern analysis
 */

import { VerifiableCredential } from '@/lib/credentials/types'

/**
 * Fraud detection result
 */
export interface FraudDetectionResult {
  score: number // 0-1 (0 = legitimate, 1 = highly suspicious)
  risk: 'low' | 'medium' | 'high' | 'critical'
  confidence: number // 0-1 (confidence in the assessment)
  reasons: FraudReason[]
  metadata: {
    timestamp: Date
    version: string
    model: string
  }
}

/**
 * Fraud reason
 */
export interface FraudReason {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  evidence: string
  weight: number // 0-1 (contribution to overall score)
}

/**
 * Fraud detection features
 */
interface FraudFeatures {
  // Issuer reputation
  issuerAge?: number // Days since issuer created
  issuerCredentialCount?: number // Total credentials issued
  issuerRevocationRate?: number // % of credentials revoked
  issuerTrustScore?: number // Trust score from registry

  // Credential characteristics
  expirationWindow?: number // Days until expiration
  issuanceSpeed?: number // Seconds since credential creation
  claimCount?: number // Number of claims
  claimComplexity?: number // Complexity score

  // Pattern analysis
  duplicateFields?: number // Duplicate field values
  suspiciousPatterns?: string[] // Known fraud patterns
  anomalyScore?: number // Statistical anomaly detection
}

/**
 * Rule-based fraud detection
 * Uses heuristics to detect suspicious patterns
 */
export async function detectFraud(
  credential: VerifiableCredential,
  context?: {
    issuerHistory?: {
      totalIssued: number
      totalRevoked: number
      accountAge: number
    }
  }
): Promise<FraudDetectionResult> {
  const reasons: FraudReason[] = []
  let totalWeight = 0

  // Extract features
  const features = extractFeatures(credential, context)

  // Rule 1: Check issuer reputation
  if (features.issuerAge !== undefined && features.issuerAge < 30) {
    const reason: FraudReason = {
      type: 'new_issuer',
      severity: 'medium',
      description: 'Issuer account is very new',
      evidence: `Account created ${features.issuerAge} days ago`,
      weight: 0.3,
    }
    reasons.push(reason)
    totalWeight += reason.weight
  }

  // Rule 2: High revocation rate
  if (features.issuerRevocationRate !== undefined && features.issuerRevocationRate > 0.3) {
    const reason: FraudReason = {
      type: 'high_revocation_rate',
      severity: 'high',
      description: 'Issuer has high credential revocation rate',
      evidence: `${(features.issuerRevocationRate * 100).toFixed(1)}% of credentials revoked`,
      weight: 0.6,
    }
    reasons.push(reason)
    totalWeight += reason.weight
  }

  // Rule 3: Suspicious expiration
  if (features.expirationWindow !== undefined) {
    if (features.expirationWindow < 1) {
      const reason: FraudReason = {
        type: 'expired_credential',
        severity: 'critical',
        description: 'Credential is expired or about to expire',
        evidence: `Expires in ${features.expirationWindow} days`,
        weight: 0.9,
      }
      reasons.push(reason)
      totalWeight += reason.weight
    } else if (features.expirationWindow > 3650) {
      // > 10 years
      const reason: FraudReason = {
        type: 'unusually_long_validity',
        severity: 'low',
        description: 'Credential has unusually long validity period',
        evidence: `Valid for ${(features.expirationWindow / 365).toFixed(1)} years`,
        weight: 0.2,
      }
      reasons.push(reason)
      totalWeight += reason.weight
    }
  }

  // Rule 4: Rapid issuance (possible automation/bot)
  if (features.issuanceSpeed !== undefined && features.issuanceSpeed < 60) {
    const reason: FraudReason = {
      type: 'rapid_issuance',
      severity: 'medium',
      description: 'Credential issued very quickly after creation',
      evidence: `Issued ${features.issuanceSpeed} seconds after creation`,
      weight: 0.4,
    }
    reasons.push(reason)
    totalWeight += reason.weight
  }

  // Rule 5: Duplicate/common field values
  if (features.duplicateFields && features.duplicateFields > 0) {
    const reason: FraudReason = {
      type: 'duplicate_values',
      severity: 'medium',
      description: 'Credential contains duplicate or common field values',
      evidence: `${features.duplicateFields} duplicate field patterns detected`,
      weight: 0.3,
    }
    reasons.push(reason)
    totalWeight += reason.weight
  }

  // Rule 6: Missing critical fields
  const missingFields = checkMissingFields(credential)
  if (missingFields.length > 0) {
    const reason: FraudReason = {
      type: 'missing_fields',
      severity: 'high',
      description: 'Credential missing critical fields',
      evidence: `Missing: ${missingFields.join(', ')}`,
      weight: 0.7,
    }
    reasons.push(reason)
    totalWeight += reason.weight
  }

  // Rule 7: Suspicious patterns in claims
  const suspiciousPatterns = detectSuspiciousPatterns(credential)
  if (suspiciousPatterns.length > 0) {
    const reason: FraudReason = {
      type: 'suspicious_patterns',
      severity: 'high',
      description: 'Credential contains known fraud patterns',
      evidence: suspiciousPatterns.join(', '),
      weight: 0.8,
    }
    reasons.push(reason)
    totalWeight += reason.weight
  }

  // Calculate final fraud score (0-1)
  const score = Math.min(totalWeight, 1)

  // Determine risk level
  let risk: 'low' | 'medium' | 'high' | 'critical'
  if (score < 0.3) risk = 'low'
  else if (score < 0.5) risk = 'medium'
  else if (score < 0.7) risk = 'high'
  else risk = 'critical'

  // Confidence based on number of signals
  const confidence = Math.min(reasons.length * 0.2, 0.95)

  return {
    score,
    risk,
    confidence,
    reasons,
    metadata: {
      timestamp: new Date(),
      version: '1.0.0',
      model: 'rule-based-heuristics',
    },
  }
}

/**
 * Extract features from credential for analysis
 */
function extractFeatures(
  credential: VerifiableCredential,
  context?: any
): FraudFeatures {
  const features: FraudFeatures = {}

  // Issuer features
  if (context?.issuerHistory) {
    features.issuerAge = context.issuerHistory.accountAge
    features.issuerCredentialCount = context.issuerHistory.totalIssued
    if (context.issuerHistory.totalIssued > 0) {
      features.issuerRevocationRate =
        context.issuerHistory.totalRevoked / context.issuerHistory.totalIssued
    }
  }

  // Expiration window
  if (credential.expirationDate) {
    const now = new Date()
    const expiry = new Date(credential.expirationDate)
    features.expirationWindow = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Issuance speed
  const issuanceDate = new Date(credential.issuanceDate)
  const now = new Date()
  features.issuanceSpeed = Math.floor((now.getTime() - issuanceDate.getTime()) / 1000)

  // Claim analysis
  const claims = Object.keys(credential.credentialSubject).filter(k => k !== 'id')
  features.claimCount = claims.length
  features.duplicateFields = detectDuplicates(credential.credentialSubject)

  return features
}

/**
 * Check for missing critical fields
 */
function checkMissingFields(credential: VerifiableCredential): string[] {
  const missing: string[] = []

  // Check critical credential fields
  if (!credential.id) missing.push('id')
  if (!credential.issuer) missing.push('issuer')
  if (!credential.issuanceDate) missing.push('issuanceDate')
  if (!credential.credentialSubject) missing.push('credentialSubject')
  if (!credential.credentialSubject.id) missing.push('credentialSubject.id')
  if (!credential.proof) missing.push('proof')

  return missing
}

/**
 * Detect duplicate/common field values
 */
function detectDuplicates(credentialSubject: any): number {
  let duplicateCount = 0

  const values = Object.values(credentialSubject).filter(v => typeof v === 'string')
  const valueSet = new Set(values)

  // If fewer unique values than total values, we have duplicates
  duplicateCount = values.length - valueSet.size

  // Check for common placeholder values
  const commonPlaceholders = ['test', 'example', 'sample', 'demo', '123', 'N/A', 'null', 'undefined']
  for (const value of values) {
    if (typeof value === 'string' && commonPlaceholders.includes(value.toLowerCase())) {
      duplicateCount++
    }
  }

  return duplicateCount
}

/**
 * Detect known suspicious patterns
 */
function detectSuspiciousPatterns(credential: VerifiableCredential): string[] {
  const patterns: string[] = []

  const subject = credential.credentialSubject

  // Pattern 1: All fields are sequential numbers
  const values = Object.values(subject).filter(v => typeof v === 'string' || typeof v === 'number')
  const allNumbers = values.every(v => !isNaN(Number(v)))
  if (allNumbers && values.length > 3) {
    patterns.push('All numeric values (possible generated data)')
  }

  // Pattern 2: Repeated characters
  for (const [key, value] of Object.entries(subject)) {
    if (typeof value === 'string') {
      // Check for repeated characters (e.g., "aaaa", "1111")
      if (/(.)\1{4,}/.test(value)) {
        patterns.push(`Repeated characters in ${key}`)
      }
    }
  }

  // Pattern 3: Sequential data (1, 2, 3, 4...)
  const numberValues = values.map(v => Number(v)).filter(n => !isNaN(n))
  if (numberValues.length >= 3) {
    let isSequential = true
    for (let i = 1; i < numberValues.length; i++) {
      if (numberValues[i] !== numberValues[i - 1] + 1) {
        isSequential = false
        break
      }
    }
    if (isSequential) {
      patterns.push('Sequential number pattern detected')
    }
  }

  // Pattern 4: Too many similar credentials from same issuer in short time
  // (This would require database query in production)

  return patterns
}

/**
 * Get fraud risk level description
 */
export function getRiskDescription(risk: 'low' | 'medium' | 'high' | 'critical'): string {
  const descriptions = {
    low: 'Low risk - Credential appears legitimate with no significant red flags',
    medium: 'Medium risk - Some suspicious indicators detected, manual review recommended',
    high: 'High risk - Multiple fraud indicators detected, verification strongly recommended',
    critical: 'Critical risk - Highly likely to be fraudulent, reject or investigate immediately',
  }
  return descriptions[risk]
}

/**
 * Get recommended actions based on risk level
 */
export function getRecommendedActions(risk: 'low' | 'medium' | 'high' | 'critical'): string[] {
  const actions = {
    low: [
      'Proceed with standard verification process',
      'Monitor for future suspicious activity',
    ],
    medium: [
      'Perform additional verification checks',
      'Verify issuer identity',
      'Contact credential subject for confirmation',
    ],
    high: [
      'Do not accept credential without manual review',
      'Investigate issuer reputation',
      'Request additional supporting documents',
      'Report to fraud prevention team',
    ],
    critical: [
      'Reject credential immediately',
      'Flag issuer for investigation',
      'Report to authorities if applicable',
      'Alert other verifiers in network',
    ],
  }
  return actions[risk]
}

/**
 * ML Model placeholder
 * In production, this would call a trained TensorFlow model
 */
export async function detectFraudML(
  credential: VerifiableCredential
): Promise<FraudDetectionResult> {
  // Placeholder for ML-based detection
  // Would use TensorFlow.js model here

  // For now, fallback to rule-based
  return detectFraud(credential)
}
