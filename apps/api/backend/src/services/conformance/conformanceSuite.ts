/**
 * conformanceSuite.ts — Wave 114: Conformance Test Suite
 *
 * Automated conformance checks for VitalCV standards alignment:
 * - OID4VCI issuance flow
 * - OID4VP presentation flow
 * - SD-JWT VC selective disclosure
 * - Credential revocation lookup
 * - Trust registry resolution
 * - HAIP policy enforcement
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';
import { createIssuerMetadata, createCredentialOffer } from '../oid4vci/issuanceServer';
import { createPresentationRequest } from '../oid4vp/presentationServer';
import { generateSelectiveDisclosure } from '../credentials/selectiveDisclosure';
import { isRevoked } from '../revocation/revocationRegistry';
import {
  getIssuer,
  initializeTrustRegistryPersistence,
  listIssuers,
} from '../registry/trustRegistry';
import { getHAIPPolicySummary } from '../trust/haipProfile';
import type { VerifiableCredential } from '../credentials/credentialModel';

// ── Types ─────────────────────────────────────────────────────────────

export type ConformanceStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

export interface ConformanceCheck {
  id: string;
  name: string;
  spec: string;
  status: ConformanceStatus;
  detail: string;
  durationMs: number;
}

export interface ConformanceReport {
  reportId: string;
  version: string;
  generatedAt: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warned: number;
    skipped: number;
  };
  checks: ConformanceCheck[];
  overallCompliant: boolean;
}

// ── Test helpers ──────────────────────────────────────────────────────

async function runCheck(
  id: string,
  name: string,
  spec: string,
  fn: () => Promise<{ status: ConformanceStatus; detail: string }>,
): Promise<ConformanceCheck> {
  const start = Date.now();
  try {
    const result = await fn();
    return { id, name, spec, ...result, durationMs: Date.now() - start };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return { id, name, spec, status: 'FAIL', detail, durationMs: Date.now() - start };
  }
}

// ── Individual conformance checks ────────────────────────────────────

async function checkOID4VCIMetadata(): Promise<ConformanceCheck> {
  return runCheck(
    'OID4VCI-001',
    'Issuer Metadata Structure',
    'OpenID4VCI §10.2',
    async () => {
      const meta = createIssuerMetadata();
      const required = ['credential_issuer', 'credential_endpoint', 'credentials_supported'];
      const missing = required.filter((k) => !(k in meta));
      if (missing.length > 0) {
        return { status: 'FAIL', detail: `Missing required metadata fields: ${missing.join(', ')}` };
      }
      if (!Array.isArray(meta.credentials_supported) || meta.credentials_supported.length === 0) {
        return { status: 'FAIL', detail: 'credentials_supported must be a non-empty array' };
      }
      for (const cred of meta.credentials_supported) {
        if (!cred.format || !cred.types) {
          return { status: 'FAIL', detail: `Credential ${cred.id} missing format or types` };
        }
      }
      return { status: 'PASS', detail: `Issuer metadata valid. ${meta.credentials_supported.length} credential types supported.` };
    },
  );
}

async function checkOID4VCIOfferCreation(): Promise<ConformanceCheck> {
  return runCheck(
    'OID4VCI-002',
    'Credential Offer — Pre-Authorized Code Flow',
    'OpenID4VCI §4.1',
    async () => {
      const offer = createCredentialOffer(['MedicalLicense', 'BoardCertification']);
      if (!offer.offerId || !offer.grants) {
        return { status: 'FAIL', detail: 'Offer missing offerId or grants' };
      }
      const preAuth = offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'];
      if (!preAuth?.['pre-authorized_code']) {
        return { status: 'FAIL', detail: 'Pre-authorized code not present in offer grants' };
      }
      if (new Date(offer.expiresAt) <= new Date()) {
        return { status: 'FAIL', detail: 'Offer already expired at creation' };
      }
      return { status: 'PASS', detail: `Offer created: ${offer.offerId}, expires ${offer.expiresAt}` };
    },
  );
}

async function checkOID4VPRequestCreation(): Promise<ConformanceCheck> {
  return runCheck(
    'OID4VP-001',
    'Presentation Request Structure',
    'OpenID4VP §6.1',
    async () => {
      const request = createPresentationRequest(
        'did:vitalcv:verifier:test-hospital',
        {
          name: 'Conformance Test',
          purpose: 'Testing presentation request structure',
          input_descriptors: [
            {
              id: 'test_credential',
              name: 'Test Credential',
              constraints: { fields: [{ path: ['$.claims.type'] }] },
            },
          ],
        },
        300,
      );
      if (!request.requestId || !request.nonce || !request.presentation_definition) {
        return { status: 'FAIL', detail: 'Request missing requestId, nonce, or presentation_definition' };
      }
      if (!request.presentation_definition.input_descriptors.length) {
        return { status: 'FAIL', detail: 'Presentation definition has no input_descriptors' };
      }
      if (request.status !== 'PENDING') {
        return { status: 'FAIL', detail: `Expected status PENDING, got ${request.status}` };
      }
      return { status: 'PASS', detail: `Presentation request created: ${request.requestId}` };
    },
  );
}

async function checkSdJwtDisclosure(): Promise<ConformanceCheck> {
  return runCheck(
    'SDJWT-001',
    'SD-JWT Selective Disclosure Field Filtering',
    'IETF SD-JWT §5',
    async () => {
      const mockCred: VerifiableCredential = {
        credentialId: randomUUID(),
        issuer: 'did:vitalcv:issuer:ca-medical-board',
        subject: 'did:vitalcv:clinician:test',
        claims: { licenseType: 'MD', state: 'CA', npi: '1234567890', specialty: 'Cardiology' },
        signature: 'mock.jws.signature',
        status: 'ACTIVE',
        issuedAt: new Date().toISOString(),
        schemaVersion: '1.0',
      };
      const { disclosure } = generateSelectiveDisclosure(mockCred, ['licenseType', 'npi']);
      if (!('licenseType' in disclosure.revealedClaims)) {
        return { status: 'FAIL', detail: 'licenseType should be in revealedClaims' };
      }
      if (!('state' in disclosure.hiddenCommitments)) {
        return { status: 'FAIL', detail: 'state should be in hiddenCommitments' };
      }
      if (disclosure.disclosureFrame.revealFields.length !== 2) {
        return { status: 'FAIL', detail: 'disclosureFrame.revealFields should have 2 entries' };
      }
      return { status: 'PASS', detail: `Selective disclosure: revealed=${Object.keys(disclosure.revealedClaims).length}, hidden=${Object.keys(disclosure.hiddenCommitments).length}` };
    },
  );
}

async function checkRevocationLookup(): Promise<ConformanceCheck> {
  return runCheck(
    'REV-001',
    'Revocation Registry Lookup',
    'W3C VC Data Model §7.3',
    async () => {
      const testId = 'non-existent-credential-' + randomUUID();
      const result = isRevoked(testId);
      if (result !== null && result !== undefined) {
        return { status: 'WARN', detail: `Unexpected revocation entry for new UUID: ${testId}` };
      }
      return { status: 'PASS', detail: 'Revocation registry returns null for unknown credential IDs' };
    },
  );
}

async function checkTrustRegistryResolution(): Promise<ConformanceCheck> {
  return runCheck(
    'TRUST-001',
    'Trust Registry Resolution',
    'VitalCV Trust Protocol §3',
    async () => {
      const issuers = listIssuers();
      if (issuers.length === 0) {
        return { status: 'FAIL', detail: 'Trust registry is empty' };
      }
      const authoritative = issuers.filter((i) => i.trustLevel === 'AUTHORITATIVE');
      if (authoritative.length === 0) {
        return { status: 'WARN', detail: 'No AUTHORITATIVE issuers in trust registry' };
      }
      const caBoard = getIssuer('did:vitalcv:issuer:ca-medical-board');
      if (!caBoard) {
        return { status: 'WARN', detail: 'Seed issuer CA Medical Board not found' };
      }
      return { status: 'PASS', detail: `Registry has ${issuers.length} issuers, ${authoritative.length} authoritative` };
    },
  );
}

async function checkHAIPPolicy(): Promise<ConformanceCheck> {
  return runCheck(
    'HAIP-001',
    'HAIP Policy Definition',
    'OpenID4VC HAIP §4',
    async () => {
      const policy = getHAIPPolicySummary();
      if (!policy.allowedAlgorithms.includes('ES256')) {
        return { status: 'FAIL', detail: 'HAIP policy must allow ES256' };
      }
      if (policy.allowedAlgorithms.some((a) => a.startsWith('RS'))) {
        return { status: 'FAIL', detail: 'HAIP policy must not allow RSA algorithms' };
      }
      if (!policy.revocationCheckRequired) {
        return { status: 'WARN', detail: 'HAIP policy should require revocation checks' };
      }
      return { status: 'PASS', detail: `HAIP policy valid. Algorithms: ${policy.allowedAlgorithms.join(', ')}` };
    },
  );
}

async function checkOID4VCICredentialFormats(): Promise<ConformanceCheck> {
  return runCheck(
    'OID4VCI-003',
    'Credential Formats — jwt_vc_json + vc+sd-jwt',
    'OpenID4VCI §E.1',
    async () => {
      const meta = createIssuerMetadata();
      const formats = new Set(meta.credentials_supported.map((c) => c.format));
      if (!formats.has('jwt_vc_json')) {
        return { status: 'FAIL', detail: 'jwt_vc_json format must be supported' };
      }
      if (!formats.has('vc+sd-jwt')) {
        return { status: 'WARN', detail: 'vc+sd-jwt format recommended but not present' };
      }
      return { status: 'PASS', detail: `Formats supported: ${Array.from(formats).join(', ')}` };
    },
  );
}

// ── Public API ────────────────────────────────────────────────────────

let lastReport: ConformanceReport | null = null;

export async function runConformanceSuite(): Promise<ConformanceReport> {
  await initializeTrustRegistryPersistence();
  log('info', 'conformance_suite_started', {});

  const checks = await Promise.all([
    checkOID4VCIMetadata(),
    checkOID4VCIOfferCreation(),
    checkOID4VCICredentialFormats(),
    checkOID4VPRequestCreation(),
    checkSdJwtDisclosure(),
    checkRevocationLookup(),
    checkTrustRegistryResolution(),
    checkHAIPPolicy(),
  ]);

  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === 'PASS').length,
    failed: checks.filter((c) => c.status === 'FAIL').length,
    warned: checks.filter((c) => c.status === 'WARN').length,
    skipped: checks.filter((c) => c.status === 'SKIP').length,
  };

  const overallCompliant = summary.failed === 0;

  const report: ConformanceReport = {
    reportId: randomUUID(),
    version: '109-114',
    generatedAt: new Date().toISOString(),
    summary,
    checks,
    overallCompliant,
  };

  lastReport = report;

  log('info', 'conformance_suite_complete', {
    reportId: report.reportId,
    passed: summary.passed,
    failed: summary.failed,
    overallCompliant,
  });

  return report;
}

export function getLastConformanceReport(): ConformanceReport | null {
  return lastReport;
}
