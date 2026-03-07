/**
 * ATS Webhook Integration Example
 *
 * Demonstrates how to integrate VitalCV credential verification
 * into an Applicant Tracking System (ATS) webhook pipeline.
 *
 * When a candidate applies, the ATS fires a webhook to this handler,
 * which verifies their NPI trust band and credentials in real-time.
 */

import { createVerifier } from '@vitalcv/verifier-sdk';

const verifier = createVerifier({
  baseUrl: process.env.VITALCV_API_URL ?? 'https://api.vitalcv.com',
  apiKey: process.env.VITALCV_API_KEY,
});

interface ATSWebhookPayload {
  event: 'application.submitted';
  candidateId: string;
  candidateName: string;
  npi: string;
  positionId: string;
  requiredCredentials: string[];
}

interface ATSWebhookResponse {
  verified: boolean;
  trustBand: string;
  haipCompliant: boolean;
  credentialStatus: Array<{
    type: string;
    valid: boolean;
    issuer: string;
  }>;
  recommendedAction: 'PROCEED' | 'MANUAL_REVIEW' | 'REJECT';
}

/**
 * Handle incoming ATS webhook — verify candidate credentials.
 *
 * Mount this as: POST /webhooks/vitalcv/verify
 */
export async function handleATSWebhook(
  payload: ATSWebhookPayload
): Promise<ATSWebhookResponse> {
  // 1. Quick trust band check
  const band = await verifier.getTrustBand(payload.npi);

  // 2. If L0 (untrusted), recommend rejection
  if (band.band === 'L0') {
    return {
      verified: false,
      trustBand: band.band,
      haipCompliant: false,
      credentialStatus: [],
      recommendedAction: 'REJECT',
    };
  }

  // 3. Full substrate evaluation for L1+
  const state = await verifier.getSubstrateTrustState(payload.npi);

  // 4. Check individual credential risks
  const credentialStatus = state.credentialRisk.map((cr) => ({
    type: cr.issuer,
    valid: cr.status === 'VALID' && !cr.revoked && !cr.expired,
    issuer: cr.issuer,
  }));

  // 5. Determine recommended action
  const allValid = credentialStatus.every((c) => c.valid);
  const recommendedAction: ATSWebhookResponse['recommendedAction'] =
    band.band === 'L3' && allValid ? 'PROCEED'
    : band.band >= 'L2' ? 'MANUAL_REVIEW'
    : 'MANUAL_REVIEW';

  return {
    verified: allValid,
    trustBand: state.band,
    haipCompliant: state.haipCompliance.compliant,
    credentialStatus,
    recommendedAction,
  };
}
