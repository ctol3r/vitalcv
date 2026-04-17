// ── VitalCV Universal Access Layer ─────────────────────────────────
// Ensures VitalCV is universally callable via API, embeddable in SDKs,
// and accessible via mobile/web without structural divergence.

// ALL CHANNELS MUST RETURN THE EXACT SAME MANIFEST OBJECT.
// Alternate formats and channel-specific abstractions are FORBIDDEN.

import { buildManifest, type ProofManifest } from '../../source-adapters/src/manifest-engine';
import { extractClaims } from '../../source-adapters/src/claim-engine';
import { NppesAdapter, OigLeieAdapter, PecosOrderingAdapter, PecosEnrollmentAdapter, CaPaBoardAdapter } from '../../source-adapters/src/index';

// ── 1. The Universal API Route ───────────────────────────────────
// GET /api/manifest/:npi

/**
 * The single universal endpoint for fetching a clinician's trust state.
 * Used by the Web frontend (/p/:npi), Mobile apps, and third-party API integrations.
 */
export async function handleGetManifest(npi: string): Promise<ProofManifest> {
  // In a real system, this would fetch from the database or trigger a live check.
  // For the architectural contract, we guarantee it always returns a formal ProofManifest.
  
  const adapters = [
    new NppesAdapter(),
    new OigLeieAdapter(),
    new PecosOrderingAdapter(),
    new PecosEnrollmentAdapter(),
    new CaPaBoardAdapter(),
  ];

  // (Mocking the execution for contract validation)
  const results = await Promise.all(adapters.map(a => a.fetch(npi)));
  const claimsBatch = extractClaims(results, npi);

  const coverageLanes = results.map(r => ({
    source: r.sourceId,
    laneType: r.laneType,
    status: r.status,
    checkedAt: r.checkedAt,
    observedAt: r.observedAt,
    ttl: adapters.find(a => a.sourceId === r.sourceId)!.freshnessTtl,
    errorClass: r.errorClass,
  }));

  const receipts = results
    .filter(r => r.rawHash)
    .map(r => ({
      receiptId: crypto.randomUUID(),
      source: r.sourceId,
      version: r.parserVersion,
      payload: {}, // Mock payload
      rawHash: r.rawHash!,
    }));

  return buildManifest({
    subjectNpi: npi,
    coverageLanes,
    claims: claimsBatch.claims,
    receipts,
    limitations: claimsBatch.limitations,
  });
}

// ── 2. The SDK Contract ──────────────────────────────────────────
// verifyClinician(npi)

/**
 * The official VitalCV SDK method for third-party integrations (e.g. Workday, GHX).
 * Wraps the Universal API and returns the exact same Manifest object.
 */
export class VitalCVSdk {
  constructor(private apiKey: string, private baseUrl = 'https://api.vitalcv.com/v1') {}

  async verifyClinician(npi: string): Promise<ProofManifest> {
    const res = await fetch(`${this.baseUrl}/manifest/${npi}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
      }
    });

    if (!res.ok) {
      throw new Error(`VitalCV API Error: ${res.statusText}`);
    }

    return res.json();
  }
}

// ── 3. Web & Mobile Deep Links ───────────────────────────────────

/**
 * Mobile App / Lightweight Web Viewer
 * Route: https://vitalcv.com/p/:npi
 * 
 * Deep Link handling simply parses the NPI and passes it to `handleGetManifest()`.
 * The UI is responsible for rendering the Manifest, never deriving logic.
 */
export function parseDeepLink(url: string): string | null {
  const match = url.match(/\/p\/(\d{10})/);
  return match ? match[1] : null;
}
