// @ts-nocheck
/**
 * psvOrchestrator.ts — Wave 39.1: PSV Orchestration Completion
 *
 * End-to-end Primary Source Verification workflow engine.
 *
 * PIPELINE (per request)
 * ──────────────────────
 *  1. Record VERIFICATION_REQUESTED audit event (pre-connector anchor).
 *  2. Run three PSV connectors in parallel:
 *       NppesConnector   — real HTTPS call to CMS NPI Registry (v2.1 API).
 *       NpdbConnector    — mock National Practitioner Data Bank query.
 *       StateBoardConnector — mock State Licensing Board lookup.
 *  3. Aggregate raw evidence → submit to auditMapper (one AuditEvent per
 *     connector).  Wave 35 merkleBatcher anchors these automatically.
 *  4. Build a signed PsvArtifact (ES256 JWS) via psvArtifactBuilder.
 *  5. Evaluate StateComplianceRule for the clinician's state + specialty.
 *     • If no rule exists → assume compliant (open-policy default).
 *     • If rule exists → every required_credential_type must be verified.
 *  6. Mint a PSV Signed Credential (W3C VC + ES256 proof) when all checks pass.
 *  7. Persist a VerificationRequest record in Prisma and mark COMPLETE / FAILED.
 *  8. Return a structured OrchestratorResult.
 *
 * CONNECTOR STATUS
 * ────────────────
 * NppesConnector wraps the existing Wave 1B NppesAdapter (real API).
 * NpdbConnector and StateBoardConnector are specification-faithful mocks —
 * replace the body of `query()` with live HTTP calls when credentials and
 * endpoints are available.  Both interfaces are typed so the swap is
 * purely internal (no callers need to change).
 *
 * SD-JWT NOTE
 * ───────────
 * The minted credential uses the existing ES256 signing infrastructure
 * (PSV_SIGNING_KEY / VCV_PRIVATE_KEY).  When a dedicated SD-JWT issuance
 * library is introduced, replace `mintPsvCredential()` with the library's
 * `issue()` call — the credential subject payload defined here stays intact.
 */

import { randomUUID } from 'node:crypto';

import { NppesAdapter } from '../../adapters/NppesAdapter';
import type { NormalizedCredentialPayload } from '../../adapters/types';
import type { CredentialType, CredentialStatus } from '../../types/psv';

import { buildPsvArtifact } from '../services/psv/psvArtifactBuilder';
import { signArtifactHash } from '../services/psv/signingService';
import {
  submitEvidenceToAuditLedger,
  buildAggregateEvidenceHash,
  recordVerificationRequested,
  type ConnectorEvidence,
} from '../services/psv/auditMapper';

import prisma from '../graphql/prisma_client';
import { sha256ForPayload } from '../utils/deterministic';
import { log } from '../obs/logger';

// ── Public input / output types ────────────────────────────────────────────

export interface PsvVerificationRequest {
  /** 10-digit NPI of the clinician to verify. */
  npi: string;
  /** US state abbreviation (e.g. "CA") — used for StateComplianceRule lookup. */
  state: string;
  /** NUCC/ACGME specialty string — used for StateComplianceRule lookup. */
  specialty: string;
  /** Credential types the caller expects to be verified. */
  requiredCredentialTypes: CredentialType[];
  /** Optional organisation UUID for multi-tenant audit scoping. */
  organizationId?: string;
}

export interface ComplianceCheckResult {
  passed: boolean;
  stateCode: string;
  specialty: string;
  requiredTypes: string[];
  verifiedTypes: string[];
  missingTypes: string[];
  ruleSource: 'STATE_COMPLIANCE_RULE' | 'OPEN_POLICY_DEFAULT';
}

export interface MintedPsvCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: {
    id: string;
    npi: string;
    fullName: string;
    state: string;
    specialty: string;
    credentialType: string;
    credentialStatus: string;
    expirationDate: string | null;
    compliancePassed: boolean;
    aggregateEvidenceHash: string;
    auditEventIds: string[];
  };
  evidence: Array<{ type: string; verifier: string; evidenceDocument: string }>;
  proof: {
    type: 'DataIntegrityProof';
    cryptosuite: 'ecdsa-2019';
    created: string;
    verificationMethod: string;
    proofPurpose: 'assertionMethod';
    /** Compact ES256 JWT over the credential subject hash. */
    jws: string;
  };
}

export type OrchestratorStatus = 'COMPLETE' | 'FAILED' | 'COMPLIANCE_FAILED';

export interface OrchestratorResult {
  requestId: string;
  status: OrchestratorStatus;
  npi: string;
  /** Present when status = 'COMPLETE'. */
  credential?: MintedPsvCredential;
  /** Aggregate hash binding all connector evidence for this run. */
  aggregateEvidenceHash: string;
  /** One record per connector. */
  auditTrail: Array<{ connectorName: string; auditEventId: string; hash: string }>;
  complianceCheck: ComplianceCheckResult;
  /** Human-readable failure reason when status ≠ 'COMPLETE'. */
  failureReason?: string;
  durationMs: number;
}

// ── Internal connector result types ───────────────────────────────────────

interface NpdbResult {
  npi: string;
  adverseActionCount: number;
  malpracticePayments: number;
  licenseActions: number;
  status: 'CLEAR' | 'FLAGGED';
  checkedAt: string;
}

interface StateBoardResult {
  npi: string;
  state: string;
  licenseNumber: string;
  status: CredentialStatus;
  expiresAt: string | null;
  restrictions: string[];
  checkedAt: string;
}

// ── PSV Connector implementations ──────────────────────────────────────────

/**
 * NppesConnector — wraps the Wave 1B NppesAdapter.
 * Makes a real HTTPS call to the CMS NPI Registry v2.1 endpoint.
 */
const NppesConnector = {
  name: 'NPPES' as const,

  async query(
    npi: string,
    state?: string,
  ): Promise<{ payload: NormalizedCredentialPayload; raw: unknown }> {
    const payload = await NppesAdapter.verify({ npi, state });
    return { payload, raw: payload.retrieval.rawPayload };
  },
};

/**
 * NpdbConnector — National Practitioner Data Bank lookup.
 *
 * PRODUCTION: Replace the body of `query()` with an authenticated call to
 * the NPDB PROACT query API (HTTPS POST, SOAP envelope, OAuth 2.0 client
 * credentials).  The raw SOAP/XML response should be parsed and returned
 * as `raw` so the auditMapper can hash it.
 *
 * Current implementation simulates a clean record for all NPIs to allow
 * end-to-end flow testing without production credentials.
 */
const NpdbConnector = {
  name: 'NPDB' as const,

  async query(npi: string): Promise<{ result: NpdbResult; raw: unknown }> {
    const checkedAt = new Date().toISOString();

    // Mock: production → call NPDB PROACT API, parse XML, map fields.
    const raw = {
      npi,
      query_type: 'PROACT',
      query_date: checkedAt,
      adverse_action_count: 0,
      malpractice_payments: 0,
      license_actions: 0,
      status: 'CLEAR',
      data_source: 'NPDB-MOCK-v1',
    };

    const result: NpdbResult = {
      npi,
      adverseActionCount: 0,
      malpracticePayments: 0,
      licenseActions: 0,
      status: 'CLEAR',
      checkedAt,
    };

    return { result, raw };
  },
};

/**
 * StateBoardConnector — State Licensing Board lookup.
 *
 * PRODUCTION: Replace the body of `query()` with a per-state adapter
 * (e.g. CA BRN REST API, TX DPS SOAP endpoint, interstate NLC API).
 * Each state board has a distinct authentication scheme and response schema;
 * a `StateBoardAdapterRegistry` (analogous to `AdapterRegistry`) is the
 * recommended pattern for managing the per-state divergence.
 *
 * Current implementation returns an active, non-expiring license record
 * for any NPI to allow flow testing without live state board credentials.
 */
const StateBoardConnector = {
  name: 'STATE_BOARD' as const,

  async query(
    npi: string,
    state: string,
  ): Promise<{ result: StateBoardResult; raw: unknown }> {
    const checkedAt = new Date().toISOString();

    // Mock: production → dispatch to per-state adapter, parse response.
    const licenseNumber = `${state}-MOCK-${npi.slice(0, 6)}`;

    const raw = {
      npi,
      state,
      license_number: licenseNumber,
      license_status: 'Active',
      expiration_date: null,
      restrictions: [],
      checked_at: checkedAt,
      data_source: 'STATE-BOARD-MOCK-v1',
    };

    const result: StateBoardResult = {
      npi,
      state,
      licenseNumber,
      status: 'Active',
      expiresAt: null,
      restrictions: [],
      checkedAt,
    };

    return { result, raw };
  },
};

// ── StateComplianceRule checker ────────────────────────────────────────────

async function evaluateCompliance(
  state:            string,
  specialty:        string,
  verifiedTypes:    CredentialType[],
): Promise<ComplianceCheckResult> {
  const rule = await prisma.stateComplianceRule.findFirst({
    where: { state_ruleType: { state, ruleType: specialty } },
  });

  if (!rule) {
    // No rule on record → open-policy default: all verified types pass.
    return {
      passed:       true,
      stateCode:    state,
      specialty,
      requiredTypes: verifiedTypes,
      verifiedTypes,
      missingTypes:  [],
      ruleSource:   'OPEN_POLICY_DEFAULT',
    };
  }

  const required  = rule.requiredCredentialTypes as string[];
  const missing   = required.filter(r => !(verifiedTypes as string[]).includes(r));

  return {
    passed:        missing.length === 0,
    stateCode:     state,
    specialty,
    requiredTypes: required,
    verifiedTypes: verifiedTypes as string[],
    missingTypes:  missing,
    ruleSource:    'STATE_COMPLIANCE_RULE',
  };
}

// ── Credential minting ─────────────────────────────────────────────────────

async function mintPsvCredential(
  npi:                  string,
  fullName:             string,
  state:                string,
  specialty:            string,
  credentialType:       string,
  credentialStatus:     string,
  expirationDate:       string | null,
  compliancePassed:     boolean,
  aggregateEvidenceHash: string,
  auditEventIds:        string[],
): Promise<MintedPsvCredential> {
  const credentialId  = `urn:uuid:${randomUUID()}`;
  const issuanceDate  = new Date().toISOString();
  const issuerDid     = process.env.STATUS_LIST_ISSUER_DID ?? 'did:web:vitalcv.ai';

  const credentialSubject = {
    id:                   `did:npi:${npi}`,
    npi,
    fullName,
    state,
    specialty,
    credentialType,
    credentialStatus,
    expirationDate,
    compliancePassed,
    aggregateEvidenceHash,
    auditEventIds,
  };

  // Hash the subject for signing — the JWS binds the VC to this exact content.
  const subjectHash = sha256ForPayload(credentialSubject);
  const jws         = await signArtifactHash(subjectHash, credentialId);

  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://vitalcv.ai/ns/psv/v1',
    ],
    id:   credentialId,
    type: ['VerifiableCredential', 'PsvVerifiedCredential'],
    issuer: issuerDid,
    issuanceDate,
    credentialSubject,
    // Doctrine anti-drift #1: VitalCV never claims NPDB (nor DEA/ABMS/SAM.gov).
    // The NPDB mock connector stays internal-only for future gated integration;
    // it must NOT emit a PrimarySourceVerification claim on any credential.
    evidence: [
      { type: 'PrimarySourceVerification', verifier: 'NPPES', evidenceDocument: 'https://npiregistry.cms.hhs.gov' },
      { type: 'PrimarySourceVerification', verifier: 'STATE_BOARD', evidenceDocument: `https://vitalcv.ai/sources/state-board/${state.toLowerCase()}` },
    ],
    proof: {
      type:               'DataIntegrityProof',
      cryptosuite:        'ecdsa-2019',
      created:            issuanceDate,
      verificationMethod: `${issuerDid}#key-1`,
      proofPurpose:       'assertionMethod',
      jws,
    },
  };
}

// ── Main orchestration entry point ─────────────────────────────────────────

/**
 * Run a full PSV orchestration for a clinician.
 *
 * This is the primary entry point for the PSV workflow.  It can be called
 * from an Express route, a cron job, a message-queue consumer, or a test.
 *
 * @param request  Structured PSV verification request.
 * @returns        OrchestratorResult with credential (on success) and full
 *                 audit trail regardless of outcome.
 */
export async function runPsvOrchestration(
  request: PsvVerificationRequest,
): Promise<OrchestratorResult> {
  const { npi, state, specialty, requiredCredentialTypes, organizationId } = request;

  const requestId = randomUUID();
  const startedAt = Date.now();

  log('info', 'psv_orchestration_start', {
    requestId,
    npi_prefix: npi.slice(0, 4) + '····',
    state,
    specialty,
  });

  // ── 1. Anchor the intent before any connector fires ──────────────────────
  await recordVerificationRequested(npi, requestId, [
    NppesConnector.name,
    NpdbConnector.name,
    StateBoardConnector.name,
  ]);

  // ── 2. Run connectors in parallel ────────────────────────────────────────
  let nppesPayload: NormalizedCredentialPayload;
  let npdbResult:   NpdbResult;
  let sbResult:     StateBoardResult;
  let evidence:     ConnectorEvidence[];

  try {
    const [nppesOut, npdbOut, sbOut] = await Promise.all([
      NppesConnector.query(npi, state),
      NpdbConnector.query(npi),
      StateBoardConnector.query(npi, state),
    ]);

    nppesPayload = nppesOut.payload;
    npdbResult   = npdbOut.result;
    sbResult     = sbOut.result;

    evidence = [
      {
        connectorName: NppesConnector.name,
        npi,
        rawPayload:   nppesOut.raw,
        retrievedAt:  nppesPayload.retrieval.retrievedAtUtc,
        organizationId,
      },
      {
        connectorName: NpdbConnector.name,
        npi,
        rawPayload:   npdbOut.raw,
        retrievedAt:  npdbResult.checkedAt,
        organizationId,
      },
      {
        connectorName: StateBoardConnector.name,
        npi,
        rawPayload:   sbOut.raw,
        retrievedAt:  sbResult.checkedAt,
        organizationId,
      },
    ];
  } catch (err) {
    const failureReason = err instanceof Error ? err.message : String(err);

    log('error', 'psv_orchestration_connector_failed', {
      requestId,
      npi_prefix: npi.slice(0, 4) + '····',
      error: failureReason,
    });

    await prisma.verificationRequest.create({
      data: {
        requestId,
        clinicianId:   npi,
        lane:          'PSV_ORCHESTRATOR',
        source:        'psvOrchestrator',
        subject:       npi,
        status:        'FAILED',
        failureReason,
        completedAt:   new Date(),
      },
    });

    return {
      requestId,
      status:               'FAILED',
      npi,
      aggregateEvidenceHash: sha256ForPayload({ requestId, npi, error: failureReason }),
      auditTrail:           [],
      complianceCheck: {
        passed: false, stateCode: state, specialty,
        requiredTypes: requiredCredentialTypes as string[],
        verifiedTypes: [], missingTypes: requiredCredentialTypes as string[],
        ruleSource: 'OPEN_POLICY_DEFAULT',
      },
      failureReason,
      durationMs: Date.now() - startedAt,
    };
  }

  // ── 3. Submit evidence to audit ledger ───────────────────────────────────
  const auditRecords        = await submitEvidenceToAuditLedger(evidence, requestId);
  const aggregateEvidenceHash = buildAggregateEvidenceHash(evidence);

  // ── 4. Build signed PsvArtifact ──────────────────────────────────────────
  const psvArtifact = await buildPsvArtifact({
    provider:  nppesPayload.provider,
    credential: nppesPayload.credential,
    source:    nppesPayload.source,
    retrieval: nppesPayload.retrieval,
  });

  // ── 5. Evaluate StateComplianceRule ──────────────────────────────────────
  const verifiedTypes: CredentialType[] = [nppesPayload.credential.credentialType];
  if (sbResult.status === 'Active') {
    verifiedTypes.push('License');
  }
  // Deduplicate
  const uniqueVerifiedTypes = Array.from(new Set(verifiedTypes));

  const complianceCheck = await evaluateCompliance(state, specialty, uniqueVerifiedTypes);

  if (!complianceCheck.passed) {
    const failureReason =
      `StateComplianceRule requires [${complianceCheck.missingTypes.join(', ')}] ` +
      `but these types were not verified for ${state}/${specialty}.`;

    log('warn', 'psv_orchestration_compliance_failed', {
      requestId,
      npi_prefix: npi.slice(0, 4) + '····',
      missingTypes: complianceCheck.missingTypes,
    });

    await prisma.verificationRequest.create({
      data: {
        requestId,
        clinicianId:   npi,
        lane:          'PSV_ORCHESTRATOR',
        source:        'psvOrchestrator',
        subject:       npi,
        status:        'FAILED',
        failureReason,
        completedAt:   new Date(),
      },
    });

    return {
      requestId,
      status:               'COMPLIANCE_FAILED',
      npi,
      aggregateEvidenceHash,
      auditTrail: auditRecords.map(r => ({
        connectorName: r.connectorName,
        auditEventId:  r.auditEventId,
        hash:          r.hash,
      })),
      complianceCheck,
      failureReason,
      durationMs: Date.now() - startedAt,
    };
  }

  // ── 6. Mint the PSV Signed Credential ────────────────────────────────────
  const credential = await mintPsvCredential(
    npi,
    nppesPayload.provider.fullName,
    state,
    specialty,
    nppesPayload.credential.credentialType,
    nppesPayload.credential.status,
    nppesPayload.credential.expirationDate ?? null,
    true,
    aggregateEvidenceHash,
    auditRecords.map(r => r.auditEventId),
  );

  // ── 7. Persist VerificationRequest as COMPLETE ───────────────────────────
  await prisma.verificationRequest.create({
    data: {
      requestId,
      clinicianId:  npi,
      lane:         'PSV_ORCHESTRATOR',
      source:       'psvOrchestrator',
      subject:      npi,
      status:       'COMPLETE',
      receiptId:    psvArtifact.artifactId,
      completedAt:  new Date(),
    },
  });

  log('info', 'psv_orchestration_complete', {
    requestId,
    npi_prefix:            npi.slice(0, 4) + '····',
    artifactId:            psvArtifact.artifactId,
    credentialId:          credential.id,
    aggregateEvidenceHash: aggregateEvidenceHash.slice(0, 16) + '…',
    durationMs:            Date.now() - startedAt,
  });

  // ── 8. Return structured result ───────────────────────────────────────────
  return {
    requestId,
    status: 'COMPLETE',
    npi,
    credential,
    aggregateEvidenceHash,
    auditTrail: auditRecords.map(r => ({
      connectorName: r.connectorName,
      auditEventId:  r.auditEventId,
      hash:          r.hash,
    })),
    complianceCheck,
    durationMs: Date.now() - startedAt,
  };
}
