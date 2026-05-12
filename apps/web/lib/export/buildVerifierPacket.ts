/**
 * buildVerifierPacket.ts
 *
 * Pure function — no async, no side effects.
 * Assembles a portable verifier packet from receipts, replay runs, and issuer info.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerifierPacket {
  // Summary
  packetId: string;
  exportedAt: string;
  issuerDid: string;

  // Receipt continuity
  receipts: Array<{
    receiptId: string;
    lane: string;
    source: string;
    checkedAt: string;
    tier: 'T1' | 'T2' | 'T3' | 'T4';
    status: string;
    signingKeyId: string | null;
  }>;

  // Replay export
  replaySummary: {
    runCount: number;
    signerCount: number;
    survivabilityScore: number;
    continuityGaps: number;
    latestRunId: string | null;
    latestCheckedAt: string | null;
  };

  // Issuer continuity
  issuer: {
    did: string;
    jwksUri: string;
    signingKeyId: string | null;
    algorithm: string;
  };

  // Verification instructions
  verificationInstructions: string[];
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildVerifierPacket(params: {
  receipts: Array<{
    receiptId: string;
    lane: string;
    source: string;
    checkedAt: string;
    tier: 'T1' | 'T2' | 'T3' | 'T4';
    status: string;
    signingKeyId: string | null;
  }>;
  runs: Array<{
    runId: string;
    signerKid: string | null;
    checkedAt?: string;
  }>;
  gaps: number;
  survivabilityScore: number;
  issuerDid: string;
  signingKeyId: string | null;
}): VerifierPacket {
  const { receipts, runs, gaps, survivabilityScore, issuerDid, signingKeyId } = params;

  const now = new Date();
  const packetId = now.getTime().toString(36);
  const exportedAt = now.toISOString();

  // Count unique signers across runs
  const signerCount = new Set(runs.map((r) => r.signerKid ?? '__unsigned__')).size;

  // Latest run by checkedAt (if provided)
  const latestRun =
    runs.length > 0
      ? runs.reduce<{ runId: string; checkedAt?: string } | null>((best, r) => {
          if (!best) return r;
          if (!r.checkedAt) return best;
          if (!best.checkedAt) return r;
          return r.checkedAt > best.checkedAt ? r : best;
        }, null)
      : null;

  const verificationInstructions = [
    `1. Fetch public key from https://vitalcv.com/.well-known/jwks.json`,
    `2. Match key where kid = "${signingKeyId ?? '<key-id>'}"`,
    `3. Verify ES256 signature using EC P-256 public key`,
    `4. Confirm iss = "https://vitalcv.com" and exp is in the future`,
    `5. Inspect vcv.actor_id for issuance attribution`,
    `6. Inspect vcv.provider_id for NPI binding`,
  ];

  return {
    packetId,
    exportedAt,
    issuerDid,
    receipts,
    replaySummary: {
      runCount: runs.length,
      signerCount,
      survivabilityScore,
      continuityGaps: gaps,
      latestRunId: latestRun?.runId ?? null,
      latestCheckedAt: latestRun?.checkedAt ?? null,
    },
    issuer: {
      did: issuerDid,
      jwksUri: 'https://vitalcv.com/.well-known/jwks.json',
      signingKeyId,
      algorithm: 'ES256',
    },
    verificationInstructions,
  };
}
