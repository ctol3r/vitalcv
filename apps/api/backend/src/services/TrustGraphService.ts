/**
 * TrustGraphService — Backend bridge for anchoring verification evidence
 * into the TrustGraph Context Core layer.
 *
 * TrustGraph augments (but does NOT replace) Prisma. Prisma owns user
 * accounts and workflow state. TrustGraph owns the evidence graph.
 *
 * Environment variables required:
 *   TRUSTGRAPH_API_URL  — Base URL of the TrustGraph API
 *   TRUSTGRAPH_API_KEY  — API key for authentication
 */

import { TrustGraphClient } from '@trustgraph/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceEvidencePayload {
  /** Raw artifact data returned by the upstream source (NPPES, state board, OIG, etc.) */
  raw: Record<string, unknown>;
  /** ISO 8601 timestamp when the source was queried */
  fetchedAt: string;
  /** Optional hash of the raw payload for integrity verification */
  payloadHash?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TrustGraphService {
  private readonly client: TrustGraphClient;

  constructor() {
    const apiUrl = process.env.TRUSTGRAPH_API_URL;
    const apiKey = process.env.TRUSTGRAPH_API_KEY;

    if (!apiUrl) {
      throw new Error(
        'TrustGraphService: TRUSTGRAPH_API_URL environment variable is required.',
      );
    }

    this.client = new TrustGraphClient({
      baseUrl: apiUrl,
      ...(apiKey ? { apiKey } : {}),
    });
  }

  /**
   * Anchors a source verification receipt into TrustGraph as an immutable
   * evidence node attached to the NPI's Context Core.
   *
   * This method is currently STUBBED — the shape demonstrates the intended
   * integration pattern before full TrustGraph schema work begins.
   *
   * @param npi     The 10-digit NPI being verified
   * @param source  The data source identifier (e.g. "nppes", "ca_state_board", "oig_exclusion")
   * @param payload The raw evidence payload and metadata
   */
  async anchorSourceEvidence(
    npi: string,
    source: string,
    payload: SourceEvidencePayload,
  ): Promise<{ success: boolean; evidenceId?: string; error?: string }> {
    // Stub: in the full integration this will:
    //   1. Resolve or create the Context Core for this NPI
    //   2. Write a VerificationArtifact node with the evidence payload
    //   3. Link the artifact to the NPI Claim node via a SUPPORTS edge
    //   4. Return the stable evidenceId for audit trail storage in Prisma

    try {
      // Placeholder — replace with real TrustGraph write once schema is finalized
      const evidenceId = `tg:evidence:${npi}:${source}:${Date.now()}`;

      // Log intent for observability until the real write is wired
      console.info('[TrustGraphService] anchorSourceEvidence (stub)', {
        npi,
        source,
        fetchedAt: payload.fetchedAt,
        evidenceId,
      });

      return { success: true, evidenceId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[TrustGraphService] anchorSourceEvidence failed', { npi, source, message });
      return { success: false, error: message };
    }
  }
}

// Singleton export for use across the API service
export const trustGraphService = new TrustGraphService();
