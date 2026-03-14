/**
 * LicenseVerificationAgent.ts
 *
 * Verifies state medical/nursing licenses via:
 *   - Nursys (multi-state compact, nursing)
 *   - StateBoardConnector (per-state medical boards)
 *
 * Extracts: license number, state, expiry, compact status, disciplinary actions.
 * Monitors: status changes (Active → Suspended), expiry within 90 days.
 */

import { BaseVerificationAgent } from './BaseVerificationAgent';
import { lookupStateBoard } from '../providers/connectors/stateBoardConnector';
import type { EvidenceBundle, Anomaly } from './types';
import { log } from '../../obs/logger';

// US states to check for license verification
const LICENSE_CHECK_STATES = [
  'CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI',
  'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'CO',
];

const NURSYS_SOURCE = 'NURSYS';
const STATE_BOARD_SOURCE = 'STATE_BOARD';

export class LicenseVerificationAgent extends BaseVerificationAgent {
  readonly name = 'license_verification' as const;
  readonly description = 'Verifies state medical and nursing licenses via Nursys and state medical boards';

  protected async fetchEvidence(npi: string): Promise<EvidenceBundle[]> {
    const bundles: EvidenceBundle[] = [];
    const now = new Date().toISOString();

    // ── Nursys (nursing license compact) ─────────────────────────────────────
    const nursysKey = process.env['NURSYS_API_KEY'];
    if (nursysKey) {
      try {
        // Real Nursys API call when key is available
        const resp = await fetch(
          `https://www.nursys.com/LQC/LQCSearch.aspx?npi=${npi}&apiKey=${nursysKey}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (resp.ok) {
          const data = await resp.json() as Record<string, unknown>;
          const licenses = Array.isArray(data.licenses) ? data.licenses : [data];
          for (const lic of licenses as Record<string, unknown>[]) {
            bundles.push({
              agentName: this.name,
              npi,
              source: NURSYS_SOURCE,
              credentialType: 'NURSING_LICENSE',
              status: String(lic.status ?? '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'UNKNOWN',
              confidence: 'HIGH',
              rawData: lic,
              normalizedFields: {
                licenseNumber: String(lic.licenseNumber ?? ''),
                state: String(lic.state ?? ''),
                issuingBody: 'Nursys',
                expiryDate: lic.expirationDate ? String(lic.expirationDate) : undefined,
              },
              extractedAt: now,
              sourceUrl: 'https://www.nursys.com',
              ttlHours: 24 * 30,
            });
          }
        }
      } catch (err) {
        log('warn', 'LicenseAgent: Nursys lookup failed', { npi, error: String(err) });
        // Emit STUB for monitoring awareness
        bundles.push({
          agentName: this.name, npi,
          source: NURSYS_SOURCE, credentialType: 'NURSING_LICENSE',
          status: 'UNKNOWN', confidence: 'STUB',
          rawData: { error: String(err) },
          normalizedFields: { issuingBody: 'Nursys' },
          extractedAt: now, ttlHours: 6,
        });
      }
    }

    // ── State Board checks (parallel, top 5 states) ───────────────────────────
    // We check a subset to stay under latency budget; monitoring expands to all
    const statesToCheck = LICENSE_CHECK_STATES.slice(0, 5);
    const stateResults = await Promise.allSettled(
      statesToCheck.map(state => lookupStateBoard(npi, state, 'live')),
    );

    for (let i = 0; i < stateResults.length; i++) {
      const result = stateResults[i];
      const state = statesToCheck[i]!;

      if (result.status === 'rejected') {
        log('warn', 'LicenseAgent: state board lookup failed', { npi, state, error: String(result.reason) });
        continue;
      }

      const sbResult = result.value;
      if (!sbResult || sbResult.licenseStatus === 'NOT_AVAILABLE' || sbResult.licenseStatus === 'NOT_FOUND') continue;

      const licStatus = sbResult.licenseStatus;
      const statusMapped: EvidenceBundle['status'] =
        licStatus === 'ACTIVE' ? 'ACTIVE' :
        licStatus === 'EXPIRED' ? 'EXPIRED' :
        licStatus === 'SUSPENDED' ? 'SUSPENDED' :
        licStatus === 'REVOKED' ? 'REVOKED' : 'UNKNOWN';

      if (statusMapped === 'UNKNOWN') continue;

      bundles.push({
        agentName: this.name,
        npi,
        source: STATE_BOARD_SOURCE,
        credentialType: `STATE_LICENSE_${state}`,
        status: statusMapped,
        confidence: 'HIGH',
        rawData: sbResult as unknown as Record<string, unknown>,
        normalizedFields: {
          licenseNumber: sbResult.licenseNumber ?? '',
          state,
          issuingBody: sbResult.boardName ?? `${state} Medical Board`,
          expiryDate: sbResult.expirationDate ?? undefined,
        },
        extractedAt: now,
        ttlHours: 24 * 30,
      });
    }

    log('info', 'LicenseAgent: evidence collected', { npi, bundles: bundles.length });
    return bundles;
  }

  protected async detectInconsistencies(
    npi: string,
    newEvidence: EvidenceBundle[],
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const now = new Date().toISOString();

    // Load existing state board artifacts
    const existing = await this.loadExistingArtifacts(npi, [STATE_BOARD_SOURCE, NURSYS_SOURCE]);

    for (const bundle of newEvidence) {
      if (bundle.confidence === 'STUB') continue;

      // Check: status downgrade (Active → Suspended/Revoked)
      const previous = existing.find(a => a.source === bundle.source);
      if (previous) {
        const prevStatus = (previous.status ?? '').toUpperCase();
        const newStatus = bundle.status;

        if (prevStatus === 'VERIFIED' && (newStatus === 'SUSPENDED' || newStatus === 'REVOKED')) {
          anomalies.push(this.anomaly(npi, {
            severity: 'CRITICAL',
            description: `License status downgraded from ${prevStatus} to ${newStatus}`,
            field: 'license.status',
            sourceA: { name: 'previous_artifact', value: prevStatus },
            sourceB: { name: bundle.source, value: newStatus },
            recommendation: 'Immediately notify verifiers and pause hiring workflows. Trigger manual review.',
          }));
        }
      }

      // Check: expiry within 90 days
      if (bundle.normalizedFields.expiryDate) {
        const expiryMs = new Date(bundle.normalizedFields.expiryDate).getTime();
        const daysUntilExpiry = (expiryMs - Date.now()) / 86_400_000;
        if (daysUntilExpiry > 0 && daysUntilExpiry < 90) {
          anomalies.push(this.anomaly(npi, {
            severity: daysUntilExpiry < 30 ? 'HIGH' : 'MEDIUM',
            description: `License expiring in ${Math.round(daysUntilExpiry)} days (${bundle.normalizedFields.state ?? ''})`,
            field: 'license.expiryDate',
            sourceA: { name: bundle.source, value: bundle.normalizedFields.expiryDate },
            sourceB: { name: 'current_date', value: now },
            recommendation: 'Notify clinician to initiate renewal. Update trust state after renewal.',
          }));
        }
      }
    }

    return anomalies;
  }
}
