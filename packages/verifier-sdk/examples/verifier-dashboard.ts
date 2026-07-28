/**
 * Verifier Dashboard Integration Example
 *
 * Shows how to build a credential verification dashboard backend
 * that aggregates trust data for a list of clinician NPIs.
 */

import { createVerifier, type SubstrateTrustState } from '@vitalcv/verifier-sdk';

const verifier = createVerifier({
  baseUrl: process.env.VITALCV_API_URL ?? 'https://api.vitalcv.com',
  apiKey: process.env.VITALCV_API_KEY,
});

interface DashboardEntry {
  npi: string;
  name?: string;
  trustBand: string;
  haipCompliant: boolean;
  credentialCount: number;
  revokedCount: number;
  federationScore: number;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

/**
 * Aggregate trust data for a batch of NPIs.
 * Useful for hospital credentialing dashboards.
 */
export async function buildDashboard(npis: string[]): Promise<DashboardEntry[]> {
  const results = await Promise.allSettled(
    npis.map((npi) => verifier.getSubstrateTrustState(npi))
  );

  return results.map((result, i) => {
    if (result.status === 'rejected') {
      return {
        npi: npis[i],
        trustBand: 'UNKNOWN',
        haipCompliant: false,
        credentialCount: 0,
        revokedCount: 0,
        federationScore: 0,
        status: 'CRITICAL' as const,
      };
    }

    const state: SubstrateTrustState = result.value;
    const status: DashboardEntry['status'] =
      state.band === 'L3' || state.band === 'L2' ? 'OK'
      : state.band === 'L1' ? 'WARNING'
      : 'CRITICAL';

    return {
      npi: state.subject,
      trustBand: state.band,
      haipCompliant: state.haipCompliance.compliant,
      credentialCount: state.credentialRisk.length,
      revokedCount: state.revocationState.revokedCount,
      federationScore: state.federationTrustHealth.healthScore,
      status,
    };
  });
}

// Example usage
async function main() {
  const dashboard = await buildDashboard([
    '0000000000',
    '1234567890',
    '9876543210',
  ]);

  console.log('\n📊 Verifier Dashboard\n');
  console.log('NPI          | Band | HAIP | Creds | Revoked | Fed Score | Status');
  console.log('-------------|------|------|-------|---------|-----------|-------');
  for (const entry of dashboard) {
    console.log(
      `${entry.npi} | ${entry.trustBand.padEnd(4)} | ${entry.haipCompliant ? '✅  ' : '❌  '} | ${String(entry.credentialCount).padEnd(5)} | ${String(entry.revokedCount).padEnd(7)} | ${String(entry.federationScore).padEnd(9)}% | ${entry.status}`
    );
  }
}

main().catch(console.error);
