import { Buffer } from 'node:buffer'
import { createHash, generateKeyPairSync, randomUUID, sign as signMessage } from 'crypto'

import type {
  AriesIssuanceResult,
  AuditEvent,
  BoardLookupPayload,
  ClaimEvidenceBundle,
  DomainCheckResult,
  IssuerClaim,
  IssuerRecord,
  IssuerRegistrationPayload,
  IssueCredentialResponse,
  LicenseLookupPayload,
  NpdbSnapshotPayload,
  PSVResult,
  RejectClaimPayload,
  SignatureMethod,
  SignatureMethodState,
} from './types'

export class IssuerStoreError extends Error {
  statusCode: number
  details?: Record<string, any>

  constructor(message: string, statusCode = 400, details?: Record<string, any>) {
    super(message)
    this.name = 'IssuerStoreError'
    this.statusCode = statusCode
    this.details = details
  }
}

type PsvSubmissionPayload = {
  boardLookup: BoardLookupPayload
  licenseLookup: LicenseLookupPayload
  npdbSnapshot: NpdbSnapshotPayload
  notes?: string
  verifiedBy: string
}

const consumerEmailDomains = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'])

const { privateKey: issuerPrivateKey, publicKey: issuerPublicKey } = generateKeyPairSync('ed25519')
const issuerPublicKeyDigest = createHash('sha256')
  .update(issuerPublicKey.export({ type: 'spki', format: 'der' }))
  .digest('hex')
const derivedIssuerDid =
  process.env.NEXT_PUBLIC_ISSUER_DID || `did:web:vitalcv.demo/issuer/${issuerPublicKeyDigest.slice(0, 24)}`

const issuerState: { record: IssuerRecord | null; signatureMethod: SignatureMethod } = {
  record: null,
  signatureMethod: 'ed25519-local',
}

const claims: IssuerClaim[] = buildInitialClaims()
const auditEvents: AuditEvent[] = []

claims.forEach((claim) => {
  appendAuditEvent(
    {
      type: 'claim_ingested',
      action: 'claim_ingested',
      summary: `Claim ${claim.id} ingested for ${claim.clinicianName}`,
      claimId: claim.id,
      txHash: createAnchorHash(`${claim.id}:${claim.submittedAt}`),
      metadata: { priority: claim.priority, npi: claim.npi },
      timestamp: claim.submittedAt,
    },
    { position: 'back' },
  )
})

export function registerIssuer(payload: IssuerRegistrationPayload) {
  validateRegistrationPayload(payload)

  const normalizedDomain = payload.emailDomain.trim().toLowerCase()
  const domainCheck = verifyEmailDomain(normalizedDomain)

  if (payload.intent === 'domain-check') {
    return { domainCheck }
  }

  const createdAt = new Date().toISOString()
  const issuerId = issuerState.record?.id ?? `ISS-${Date.now().toString(36)}`
  const record: IssuerRecord = {
    id: issuerId,
    orgName: payload.organization.name.trim(),
    npi: payload.organization.npi.replace(/\D/g, ''),
    jurisdiction: payload.organization.jurisdiction,
    emailDomain: normalizedDomain,
    domainStatus: domainCheck.status,
    domainEvidence: domainCheck.evidence,
    seal: payload.seal,
    anchorHash: createAnchorHash(`${normalizedDomain}:${createdAt}`),
    createdAt,
    issuerDid: derivedIssuerDid,
  }

  issuerState.record = record

  appendAuditEvent({
    type: 'issuer_registration',
    action: 'issuer_registered',
    summary: `Issuer ${record.orgName} onboarded`,
    issuerId: record.id,
    txHash: record.anchorHash,
    metadata: { npi: record.npi, emailDomain: record.emailDomain },
  })

  return { record: clone(record), domainCheck }
}

export function listClaims(claimId?: string): IssuerClaim[] | IssuerClaim {
  if (claimId) {
    const claim = findClaim(claimId)
    return clone(claim)
  }
  return claims.map((claim) => clone(claim))
}

export function savePsv(claimId: string, payload: PsvSubmissionPayload): PSVResult {
  const claim = findClaim(claimId)

  if (claim.status === 'issued') {
    throw new IssuerStoreError('Claim already issued', 409)
  }

  const verifiedAt = new Date().toISOString()
  const result: PSVResult = {
    boardLookup: payload.boardLookup,
    licenseLookup: payload.licenseLookup,
    npdbSnapshot: payload.npdbSnapshot,
    notes: payload.notes,
    verifiedBy: payload.verifiedBy,
    verifiedAt,
  }

  claim.psv = result
  claim.status = 'ready-to-issue'
  claim.lastUpdated = verifiedAt

  appendAuditEvent({
    type: 'psv_completed',
    action: 'psv_completed',
    summary: `PSV completed for ${claim.clinicianName}`,
    claimId,
    issuerId: issuerState.record?.id,
    metadata: {
      boardStatus: payload.boardLookup.status,
      licenseStatus: payload.licenseLookup.status,
      npdbAlerts: payload.npdbSnapshot.alertCount,
    },
  })

  return clone(result)
}

export function issueClaim(claimId: string, options?: { templateId?: string }): IssueCredentialResponse {
  const claim = findClaim(claimId)

  if (!claim.psv) {
    throw new IssuerStoreError('Primary source verification is required before issuing', 409)
  }
  if (claim.status === 'rejected') {
    throw new IssuerStoreError('Rejected claims must be re-opened before issuing', 409)
  }

  const issuanceDate = new Date().toISOString()
  const credentialId = `VC-${claimId}-${Date.now().toString(36)}`
  const issuerDid = issuerState.record?.issuerDid ?? derivedIssuerDid

  const payload = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: `urn:uuid:${randomUUID()}`,
    type: ['VerifiableCredential', 'ClinicianCredential'],
    issuer: issuerDid,
    issuanceDate,
    credentialSubject: {
      id: `did:example:npi:${claim.npi}`,
      clinicianName: claim.clinicianName,
      npi: claim.npi,
      specialty: claim.specialty,
      facility: claim.facility,
      license: claim.autoParsed.license,
      boardCertification: claim.autoParsed.board,
    },
    evidence: {
      boardLookup: claim.psv.boardLookup,
      licenseLookup: claim.psv.licenseLookup,
      npdbSnapshot: claim.psv.npdbSnapshot,
    },
    credentialSchema: {
      id: 'https://schemas.vitalcv.health/clinical-core-v1',
      type: 'JsonSchemaValidator2018',
    },
    refreshService: {
      id: `https://status.vitalcv.health/${credentialId}`,
      type: 'StatusList2021Credential',
    },
    metadata: {
      claimId,
      templateId: options?.templateId ?? 'clinical-core-v1',
    },
  }

  const serialized = Buffer.from(JSON.stringify(payload))
  const signature = signMessage(null, serialized, issuerPrivateKey).toString('base64')
  const txHash = createAnchorHash(`${credentialId}:${signature}`)

  claim.status = 'issued'
  claim.rejection = undefined
  claim.issuedCredential = {
    credentialId,
    issuedAt: issuanceDate,
    txHash,
  }
  claim.lastUpdated = issuanceDate

  appendAuditEvent({
    type: 'credential_issued',
    action: 'credential_issued',
    summary: `Credential ${credentialId} issued for ${claim.clinicianName}`,
    claimId,
    issuerId: issuerState.record?.id,
    txHash,
    metadata: { templateId: options?.templateId ?? 'clinical-core-v1' },
  })

  return {
    claimId,
    credentialId,
    issuerDid,
    payload,
    signature,
    txHash,
    anchoredAt: issuanceDate,
    notification: {
      channel: 'email',
      deliveredAt: issuanceDate,
      recipient: claim.clinicianEmail,
    },
  }
}

export function issueClaimViaAries(claimId: string): AriesIssuanceResult {
  const claim = findClaim(claimId)

  if (!claim.psv) {
    throw new IssuerStoreError('Primary source verification is required before issuing', 409)
  }
  if (claim.status === 'rejected') {
    throw new IssuerStoreError('Rejected claims must be re-opened before issuing', 409)
  }

  const issuanceDate = new Date().toISOString()
  const connectionId = `conn-${randomUUID()}`
  const invitationUrl = `https://aca-py.demo.vitalcv.health/invite/${connectionId}`
  const credentialId = `ACAPY-${claimId}-${Date.now().toString(36)}`
  const anchorTx = createAnchorHash(`${credentialId}:${connectionId}`)

  claim.status = 'issued'
  claim.rejection = undefined
  claim.issuedCredential = {
    credentialId,
    issuedAt: issuanceDate,
    txHash: anchorTx,
  }
  claim.lastUpdated = issuanceDate

  appendAuditEvent({
    type: 'credential_issued_aries',
    action: 'credential_issued_aries',
    summary: `ACA-Py credential ${credentialId} issued for ${claim.clinicianName}`,
    claimId,
    issuerId: issuerState.record?.id,
    txHash: anchorTx,
    metadata: {
      transport: 'didcomm',
      connectionId,
    },
  })

  return {
    claimId,
    invitationUrl,
    connectionId,
    issuedCredentialId: credentialId,
    anchorTx,
    status: 'issued',
    deliveredAt: issuanceDate,
  }
}

export function getSignatureMethod(): SignatureMethodState {
  return {
    method: issuerState.signatureMethod,
    updatedAt: new Date().toISOString(),
  }
}

export function setSignatureMethod(method: SignatureMethod): SignatureMethodState {
  issuerState.signatureMethod = method
  return {
    method,
    updatedAt: new Date().toISOString(),
  }
}

export function getClaimEvidence(claimId: string): ClaimEvidenceBundle {
  const claim = findClaim(claimId)
  const generatedAt = new Date().toISOString()
  const npdbAlerts = claim.psv?.npdbSnapshot.alertCount ?? 0

  const ocrFields = [
    {
      label: 'Clinician name',
      value: claim.clinicianName,
      confidence: 0.94,
    },
    {
      label: 'License number',
      value: claim.autoParsed.license.number,
      confidence: 0.96,
    },
    {
      label: 'Board certificate',
      value: `${claim.autoParsed.board.name} #${claim.autoParsed.board.certificateId}`,
      confidence: 0.89,
    },
    {
      label: 'Facility',
      value: claim.facility,
      confidence: 0.82,
    },
  ]

  const sourceChecks = [
    {
      name: 'NPPES registry',
      status: 'pass' as const,
      details: ['Identity hash matches clinician record', 'Last sync < 7 days'],
    },
    {
      name: 'State license board',
      status: claim.autoParsed.license.status === 'active' ? ('pass' as const) : ('fail' as const),
      details: [
        `Board status ${claim.autoParsed.license.status}`,
        `Expires ${claim.autoParsed.license.expiresOn}`,
      ],
    },
    {
      name: 'NPDB snapshot',
      status: npdbAlerts === 0 ? ('pass' as const) : ('fail' as const),
      details: npdbAlerts
        ? [`${npdbAlerts} alerts require analyst review`]
        : ['No adverse actions returned'],
    },
  ]

  const fraudIndicators = [
    {
      signal: 'Template drift',
      severity: claim.riskScore > 0.4 ? ('medium' as const) : ('low' as const),
      rationale:
        claim.riskScore > 0.4
          ? 'Header seal alignment deviates from template by 8%.'
          : 'Minor kerning drift detected but within tolerance.',
    },
    {
      signal: 'Registry mismatch',
      severity: npdbAlerts > 0 ? ('high' as const) : ('low' as const),
      rationale:
        npdbAlerts > 0
          ? 'NPDB returned undisclosed queries; escalate to HITL.'
          : 'All registry fields consistent.',
    },
  ]

  return {
    claimId,
    ocrFields,
    licenseDetails: {
      jurisdiction: claim.autoParsed.license.state,
      licenseNumber: claim.autoParsed.license.number,
      status: claim.autoParsed.license.status,
      expiresOn: claim.autoParsed.license.expiresOn,
      templateConfidence: Number((1 - claim.riskScore / 2).toFixed(2)),
    },
    sourceChecks,
    fraudIndicators,
    generatedAt,
  }
}

export function rejectClaim(claimId: string, payload: RejectClaimPayload): IssuerClaim {
  if (!payload.reason?.trim()) {
    throw new IssuerStoreError('Rejection reason is required')
  }

  const claim = findClaim(claimId)
  if (claim.status === 'issued') {
    throw new IssuerStoreError('Issued claims cannot be rejected retroactively', 409)
  }

  const rejectedAt = new Date().toISOString()
  claim.status = 'rejected'
  claim.rejection = {
    reason: payload.reason.trim(),
    evidenceContext: payload.evidenceContext?.trim(),
    rejectedAt,
  }
  claim.lastUpdated = rejectedAt

  appendAuditEvent({
    type: 'claim_rejected',
    action: 'claim_rejected',
    summary: `Claim ${claimId} rejected: ${payload.reason}`,
    claimId,
    issuerId: issuerState.record?.id,
    metadata: { evidenceContext: payload.evidenceContext },
  })

  dispatchRejectionNotification(claim, payload)

  return clone(claim)
}

export function listAuditEvents(filter?: { issuerId?: string; claimId?: string }): AuditEvent[] {
  return auditEvents
    .filter((event) => {
      if (filter?.issuerId && event.issuerId !== filter.issuerId) {
        return false
      }
      if (filter?.claimId && event.claimId !== filter.claimId) {
        return false
      }
      return true
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((event) => clone(event))
}

function validateRegistrationPayload(payload: IssuerRegistrationPayload) {
  if (!payload.organization?.name?.trim()) {
    throw new IssuerStoreError('Organization name is required')
  }
  if (!payload.organization?.jurisdiction) {
    throw new IssuerStoreError('Jurisdiction is required')
  }

  const npiDigits = payload.organization.npi?.replace(/\D/g, '') || ''
  if (npiDigits.length !== 10) {
    throw new IssuerStoreError('NPI must be 10 digits', 400, { field: 'npi' })
  }

  if (!payload.emailDomain?.includes('.')) {
    throw new IssuerStoreError('Email domain must include a dot (.)', 400, { field: 'emailDomain' })
  }
}

function verifyEmailDomain(domain: string): DomainCheckResult {
  const issues: string[] = []
  const mxRecords = [`mx1.${domain}`, `mx2.${domain}`]
  let status: DomainCheckResult['status'] = 'pending'

  if (consumerEmailDomains.has(domain)) {
    status = 'rejected'
    issues.push('Consumer email providers are not permitted for issuer workflows.')
  } else if (!domain.includes('.')) {
    status = 'rejected'
    issues.push('Domain lacks a valid TLD.')
  } else if (domain.endsWith('.org') || domain.endsWith('.edu') || domain.endsWith('.health')) {
    status = 'verified'
  }

  const evidence =
    status === 'verified'
      ? ['MX + SPF records detected', 'DMARC policy is enforced']
      : ['MX records detected', 'TXT challenge pending']

  return {
    status,
    issues: issues.length ? issues : undefined,
    mxRecords,
    evidence,
    performedAt: new Date().toISOString(),
  }
}

function findClaim(claimId: string): IssuerClaim {
  const claim = claims.find((item) => item.id === claimId)
  if (!claim) {
    throw new IssuerStoreError(`Claim ${claimId} not found`, 404)
  }
  return claim
}

function appendAuditEvent(
  payload: Omit<AuditEvent, 'id' | 'timestamp' | 'txHash'> & { txHash?: string; timestamp?: string },
  options: { position?: 'front' | 'back' } = { position: 'front' },
): AuditEvent {
  const event: AuditEvent = {
    id: buildAuditId(),
    timestamp: payload.timestamp ?? new Date().toISOString(),
    type: payload.type,
    action: payload.action,
    summary: payload.summary,
    claimId: payload.claimId,
    issuerId: payload.issuerId,
    metadata: payload.metadata,
    txHash: payload.txHash ?? createAnchorHash(`${payload.type}:${payload.summary}:${Date.now()}`),
  }

  if (options.position === 'back') {
    auditEvents.push(event)
  } else {
    auditEvents.unshift(event)
  }

  return event
}

function buildInitialClaims(): IssuerClaim[] {
  return [
    {
      id: 'CLAIM-78022',
      clinicianName: 'Dr. Nia Ramsey',
      clinicianEmail: 'nia.ramsey@trillium-clinic.org',
      facility: 'Trillium Clinic Network',
      specialty: 'Cardiology',
      npi: '1427349871',
      status: 'pending',
      priority: 'high',
      submittedAt: '2025-11-03T14:32:00.000Z',
      lastUpdated: '2025-11-03T14:32:00.000Z',
      docs: [
        {
          id: 'doc-78022-license',
          name: 'CA_license.pdf',
          type: 'license',
          source: 'clinician',
          url: '#',
          uploadedAt: '2025-11-03T13:11:00.000Z',
          digest: 'b55ca2',
          extractedFields: ['CA A65432', 'Expires 2026-03-01'],
        },
        {
          id: 'doc-78022-board',
          name: 'ABIM_cardio_cert.pdf',
          type: 'board',
          source: 'clinician',
          url: '#',
          uploadedAt: '2025-11-03T13:15:00.000Z',
          digest: 'c883bd',
          extractedFields: ['ABIM #88211', 'Issued 2020'],
        },
        {
          id: 'doc-78022-malpractice',
          name: 'Malpractice_face_sheet.pdf',
          type: 'malpractice',
          source: 'agent',
          url: '#',
          uploadedAt: '2025-11-02T22:12:00.000Z',
          digest: 'f113dd',
        },
      ],
      autoParsed: {
        npi: '1427349871',
        license: {
          number: 'A65432',
          state: 'CA',
          expiresOn: '2026-03-01',
          status: 'active',
        },
        board: {
          name: 'ABIM',
          certificateId: '88211',
          status: 'active',
          expiresOn: '2028-10-01',
        },
      },
      riskScore: 0.18,
    },
    {
      id: 'CLAIM-78041',
      clinicianName: 'Dr. Mateo Ellis',
      clinicianEmail: 'mateo.ellis@aurorametro.org',
      facility: 'Aurora Metro Health',
      specialty: 'Emergency Medicine',
      npi: '1789645321',
      status: 'psv-in-progress',
      priority: 'medium',
      submittedAt: '2025-11-02T18:22:00.000Z',
      lastUpdated: '2025-11-03T10:12:00.000Z',
      docs: [
        {
          id: 'doc-78041-license',
          name: 'WA_license.pdf',
          type: 'license',
          source: 'clinician',
          url: '#',
          uploadedAt: '2025-11-02T18:21:00.000Z',
          digest: 'ab881c',
          extractedFields: ['WA MD.60432167'],
        },
        {
          id: 'doc-78041-cv',
          name: 'CV_MateoEllis.pdf',
          type: 'cv',
          source: 'clinician',
          url: '#',
          uploadedAt: '2025-11-02T18:00:00.000Z',
          digest: 'bb712f',
        },
        {
          id: 'doc-78041-board',
          name: 'ABEM_card.pdf',
          type: 'board',
          source: 'agent',
          url: '#',
          uploadedAt: '2025-11-02T18:40:00.000Z',
          digest: 'c233ff',
        },
      ],
      autoParsed: {
        npi: '1789645321',
        license: {
          number: 'MD60432167',
          state: 'WA',
          expiresOn: '2027-07-15',
          status: 'active',
        },
        board: {
          name: 'ABEM',
          certificateId: '441199',
          status: 'active',
          expiresOn: '2029-05-30',
        },
      },
      riskScore: 0.27,
    },
    {
      id: 'CLAIM-78055',
      clinicianName: 'PA Riley Shah',
      clinicianEmail: 'riley.shah@orbitcare.com',
      facility: 'Orbit Care Network',
      specialty: 'Pulmonary',
      npi: '1678900543',
      status: 'ready-to-issue',
      priority: 'low',
      submittedAt: '2025-11-01T09:14:00.000Z',
      lastUpdated: '2025-11-03T09:45:00.000Z',
      docs: [
        {
          id: 'doc-78055-license',
          name: 'NM_license.pdf',
          type: 'license',
          source: 'clinician',
          url: '#',
          uploadedAt: '2025-11-01T09:12:00.000Z',
          digest: 'ee113a',
          extractedFields: ['NM PA-34451'],
        },
        {
          id: 'doc-78055-board',
          name: 'NCCPA_card.pdf',
          type: 'board',
          source: 'clinician',
          url: '#',
          uploadedAt: '2025-11-01T09:13:00.000Z',
          digest: 'aa11bc',
        },
        {
          id: 'doc-78055-npdb',
          name: 'NPDB_query.pdf',
          type: 'malpractice',
          source: 'agent',
          url: '#',
          uploadedAt: '2025-11-01T10:00:00.000Z',
          digest: 'bb339d',
        },
      ],
      autoParsed: {
        npi: '1678900543',
        license: {
          number: 'PA34451',
          state: 'NM',
          expiresOn: '2027-02-10',
          status: 'active',
        },
        board: {
          name: 'NCCPA',
          certificateId: 'PA77822',
          status: 'active',
          expiresOn: '2026-11-10',
        },
      },
      riskScore: 0.11,
      psv: {
        boardLookup: {
          boardName: 'NCCPA',
          certificateId: 'PA77822',
          status: 'active',
          expiresOn: '2026-11-10',
          referenceUrl: 'https://www.nccpa.net/verify/PA77822',
        },
        licenseLookup: {
          jurisdiction: 'NM',
          licenseNumber: 'PA34451',
          status: 'active',
          expiresOn: '2027-02-10',
          lastVerified: '2025-11-03T09:44:00.000Z',
        },
        npdbSnapshot: {
          queryId: 'NPDB-55623',
          lastQueried: '2025-11-03T09:43:00.000Z',
          alertCount: 0,
          severity: 'none',
          summary: 'No adverse action reports',
          findings: [],
        },
        verifiedBy: 'Issuing Agent',
        verifiedAt: '2025-11-03T09:45:00.000Z',
        notes: 'Ready for issuance.',
      },
      issuedCredential: undefined,
    },
  ]
}

function dispatchRejectionNotification(claim: IssuerClaim, payload: RejectClaimPayload) {
  console.info('[issuer][reject] notifying clinician', {
    clinician: claim.clinicianEmail,
    reason: payload.reason,
    evidence: payload.evidenceContext,
  })
}

function buildAuditId() {
  return `AUD-${Math.random().toString(36).slice(2, 8)}`
}

function createAnchorHash(seed: string) {
  return createHash('sha256').update(seed).digest('hex')
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

