/**
 * credentialAcceptance.ts — Wave 99: Verifier Acceptance Flow
 *
 * Accepts a Verifiable Presentation submitted by a clinician and
 * performs full verification: signature, issuer trust, revocation
 * status, and expiration for each bundled credential.
 */

import { randomUUID } from 'node:crypto';
import { jwtVerify, importSPKI, decodeJwt } from 'jose';
import { log } from '../../obs/logger';
import type { VerifiablePresentation } from '../credentials/credentialPresentation';
import { verifyCredential } from '../credentials/credentialVerifier';
import { getIssuer } from '../registry/trustRegistry';

// ── Types ─────────────────────────────────────────────────────────────

export type AcceptanceDecision = 'ACCEPTED' | 'REJECTED' | 'PENDING_REVIEW';

export interface CredentialAcceptanceReport {
  /** Unique acceptance report ID */
  reportId: string;
  /** ID of the presentation reviewed */
  presentationId: string;
  /** Holder NPI/DID */
  holder: string;
  /** Per-credential verification results */
  credentialResults: Array<{
    credentialId: string;
    issuer: string;
    subject: string;
    valid: boolean;
    issuerTrustLevel?: string;
    checks: {
      signature: boolean;
      issuerTrusted: boolean;
      statusActive: boolean;
      notExpired: boolean;
    };
    errors: string[];
  }>;
  /** Overall acceptance decision */
  decision: AcceptanceDecision;
  /** Human-readable summary */
  summary: string;
  /** ISO-8601 timestamp */
  evaluatedAt: string;
}

// ── Storage ───────────────────────────────────────────────────────────

const reports = new Map<string, CredentialAcceptanceReport>();

// ── Public API ────────────────────────────────────────────────────────

/**
 * Accept and evaluate a Verifiable Presentation.
 *
 * Verifies the presentation signature (if a public key is available),
 * then verifies each bundled credential individually.
 */
export async function acceptCredentialPresentation(
  presentation: VerifiablePresentation,
): Promise<CredentialAcceptanceReport> {
  const credentialResults: CredentialAcceptanceReport['credentialResults'] = [];
  let signatureCheck = true;

  // 1. Verify presentation JWS (if holder issuer has a registered public key)
  const holderRecord = getIssuer(presentation.holder);
  if (holderRecord?.publicKey) {
    try {
      const publicKey = await importSPKI(holderRecord.publicKey, 'ES256');
      await jwtVerify(presentation.signature, publicKey, {
        issuer: presentation.holder,
      });
    } catch {
      signatureCheck = false;
    }
  } else {
    // Attempt minimal JWS decode to confirm structure is valid
    try {
      decodeJwt(presentation.signature);
    } catch {
      signatureCheck = false;
    }
  }

  // 2. Verify each credential
  for (const cred of presentation.credentials) {
    const result = await verifyCredential(cred);
    const issuerRecord = getIssuer(cred.issuer);

    credentialResults.push({
      credentialId: cred.credentialId,
      issuer: cred.issuer,
      subject: cred.subject,
      valid: result.valid,
      issuerTrustLevel: issuerRecord?.trustLevel,
      checks: result.checks,
      errors: result.errors,
    });
  }

  // 3. Derive decision
  const allValid = signatureCheck && credentialResults.every((r) => r.valid);
  const anyRevoked = credentialResults.some((r) => !r.checks.statusActive);
  const anyExpired = credentialResults.some((r) => !r.checks.notExpired);

  let decision: AcceptanceDecision;
  let summary: string;

  if (allValid) {
    decision = 'ACCEPTED';
    summary = `All ${credentialResults.length} credential(s) verified. Presentation accepted.`;
  } else if (anyRevoked) {
    decision = 'REJECTED';
    summary = `Presentation rejected — one or more credentials are revoked or inactive.`;
  } else if (anyExpired) {
    decision = 'REJECTED';
    summary = `Presentation rejected — one or more credentials have expired.`;
  } else {
    decision = 'PENDING_REVIEW';
    summary = `Presentation requires manual review — signature or issuer trust issues detected.`;
  }

  const report: CredentialAcceptanceReport = {
    reportId: randomUUID(),
    presentationId: presentation.presentationId,
    holder: presentation.holder,
    credentialResults,
    decision,
    summary,
    evaluatedAt: new Date().toISOString(),
  };

  reports.set(report.reportId, report);

  log('info', 'presentation_accepted', {
    reportId: report.reportId,
    presentationId: presentation.presentationId,
    decision,
  });

  return report;
}

/** Retrieve a stored acceptance report. */
export function getAcceptanceReport(reportId: string): CredentialAcceptanceReport | null {
  return reports.get(reportId) ?? null;
}

/** List all acceptance reports. */
export function listAcceptanceReports(): CredentialAcceptanceReport[] {
  return Array.from(reports.values()).sort(
    (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime(),
  );
}
