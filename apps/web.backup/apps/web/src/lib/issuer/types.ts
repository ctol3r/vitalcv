export type ClaimPriority = 'high' | 'medium' | 'low'
export type ClaimStatus = 'pending' | 'psv-in-progress' | 'ready-to-issue' | 'issued' | 'rejected'
export type SignatureMethod = 'ed25519-local' | 'kms-managed'

export interface UploadedSeal {
  fileName: string
  size: number
  mimeType: string
  previewDataUrl?: string
}

export interface DomainCheckResult {
  status: 'verified' | 'pending' | 'rejected'
  issues?: string[]
  mxRecords: string[]
  evidence: string[]
  performedAt: string
}

export interface OrganizationProfile {
  name: string
  npi: string
  jurisdiction: string
  contactName?: string
  contactEmail?: string
}

export interface IssuerRegistrationPayload {
  organization: OrganizationProfile
  emailDomain: string
  seal?: UploadedSeal
  intent?: 'register' | 'domain-check'
}

export interface IssuerRecord {
  id: string
  orgName: string
  npi: string
  jurisdiction: string
  emailDomain: string
  domainStatus: DomainCheckResult['status']
  domainEvidence: string[]
  seal?: UploadedSeal
  anchorHash: string
  createdAt: string
  issuerDid: string
}

export interface ClinicianDocument {
  id: string
  name: string
  type: string
  source: 'clinician' | 'agent' | 'auto'
  url?: string
  uploadedAt: string
  digest: string
  extractedFields?: string[]
}

export interface AutoParsedFields {
  npi: string
  license: {
    number: string
    state: string
    expiresOn: string
    status: 'active' | 'expired' | 'suspended'
  }
  board: {
    name: string
    certificateId: string
    status: 'active' | 'expiring' | 'lapsed'
    expiresOn: string
  }
}

export interface BoardLookupPayload {
  boardName: string
  certificateId: string
  status: 'active' | 'expired' | 'revoked' | 'probation'
  expiresOn: string
  referenceUrl?: string
  notes?: string
}

export interface LicenseLookupPayload {
  jurisdiction: string
  licenseNumber: string
  status: 'active' | 'expired' | 'restricted' | 'probation'
  expiresOn: string
  lastVerified: string
  disciplinaryAction?: string
}

export interface NpdbSnapshotPayload {
  queryId: string
  lastQueried: string
  alertCount: number
  severity: 'none' | 'low' | 'medium' | 'high'
  summary: string
  findings: string[]
}

export interface PSVResult {
  boardLookup: BoardLookupPayload
  licenseLookup: LicenseLookupPayload
  npdbSnapshot: NpdbSnapshotPayload
  notes?: string
  verifiedBy: string
  verifiedAt: string
  attachments?: string[]
}

export interface IssuerClaim {
  id: string
  clinicianName: string
  clinicianEmail: string
  facility: string
  specialty: string
  npi: string
  status: ClaimStatus
  priority: ClaimPriority
  submittedAt: string
  lastUpdated: string
  docs: ClinicianDocument[]
  autoParsed: AutoParsedFields
  riskScore: number
  psv?: PSVResult
  issuedCredential?: {
    credentialId: string
    issuedAt: string
    txHash: string
  }
  rejection?: {
    reason: string
    evidenceContext?: string
    rejectedAt: string
  }
}

export interface AuditEvent {
  id: string
  timestamp: string
  type:
    | 'issuer_registration'
    | 'psv_completed'
    | 'credential_issued'
    | 'credential_issued_aries'
    | 'claim_ingested'
    | 'claim_rejected'
  action: string
  summary: string
  txHash: string
  claimId?: string
  issuerId?: string
  metadata?: Record<string, any>
}

export interface IssueCredentialResponse {
  claimId: string
  credentialId: string
  issuerDid: string
  payload: Record<string, any>
  signature: string
  txHash: string
  anchoredAt: string
  notification: {
    channel: 'email' | 'sms'
    deliveredAt: string
    recipient: string
  }
}

export interface ClaimEvidenceField {
  label: string
  value: string
  confidence: number
}

export interface ClaimEvidenceBundle {
  claimId: string
  ocrFields: ClaimEvidenceField[]
  licenseDetails: {
    jurisdiction: string
    licenseNumber: string
    status: string
    expiresOn: string
    templateConfidence: number
  }
  sourceChecks: Array<{
    name: string
    status: 'pass' | 'fail' | 'pending'
    details: string[]
  }>
  fraudIndicators: Array<{
    signal: string
    severity: 'low' | 'medium' | 'high'
    rationale: string
  }>
  generatedAt: string
}

export interface SignatureMethodState {
  method: SignatureMethod
  updatedAt: string
}

export interface AriesIssuanceResult {
  claimId: string
  invitationUrl: string
  connectionId: string
  issuedCredentialId: string
  anchorTx: string
  status: 'queued' | 'issued'
  deliveredAt: string
}

export interface RejectClaimPayload {
  reason: string
  evidenceContext?: string
}

