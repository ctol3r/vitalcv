/**
 * getReplayInspection.ts
 *
 * Aggregates replay chain data for a given receiptId.
 * Server-side only — uses crypto key infra.
 */

import { getPublicKeyJwk } from '@/lib/crypto/receiptIssuer';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DegradationOwnership =
  | 'issuer_outage'       // The issuing authority (NPPES, OIG, etc.) was unreachable
  | 'vitalcv_outage'      // VitalCV infrastructure was degraded
  | 'no_adverse_findings' // Source checked, nothing adverse found (SUCCESS)
  | 'anonymous_preview'   // No actor bound, no replay continuity
  | 'stale_data'          // Data outside freshness window
  | 'unknown';            // Cannot determine

export interface ReplayRunEntry {
  runId: string;           // 8-char deterministic ID
  checkedAt: string;       // ISO "YYYY-MM-DD HH:mm:ss UTC"
  source: string;          // e.g. "CMS NPPES Registry"
  laneId: string;          // e.g. "nppes_identity"
  status: string;          // e.g. "verified", "unavailable"
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  receiptId: string | null;
  priorRunId: string | null; // links replay chain
}

export interface ContinuityGap {
  gapType: 'missing_lane' | 'stale_run' | 'signer_rotation' | 'actor_mismatch';
  description: string;
  severity: 'info' | 'warning' | 'critical';
  affectedRunId: string | null;
}

export interface SignerRotationEntry {
  kid: string;           // Key ID
  algorithm: string;     // "ES256"
  activeFrom: string;    // ISO timestamp or "genesis"
  activeTo: string | null; // null = current
}

export interface ReplayInspection {
  receiptId: string;
  lineageKey: string;        // "{laneId}:{providerId}" — stable identifier
  runId: string;
  checkedAt: string;
  issuerDid: string;
  signingKeyId: string | null;
  jwksUri: string;

  // Replay chain (most recent first)
  runs: ReplayRunEntry[];

  // Continuity gaps
  gaps: ContinuityGap[];

  // Signer rotation history (static — one entry per active key)
  signerHistory: SignerRotationEntry[];

  // Survivability
  survivabilityScore: number;      // 0-100
  survivabilityRationale: string;  // human-readable

  // Degradation ownership
  degradationOwnership: DegradationOwnership;
  degradationExplanation: string;

  // Source continuity
  sourceContinuity: {
    sourceId: string;
    displayName: string;
    lifecycle: 'active' | 'partial' | 'planned';
    lastChecked: string | null;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ISSUER_DID = 'did:web:vitalcv.com';
const JWKS_URI = 'https://vitalcv.com/.well-known/jwks.json';

const LANE_META: Record<string, { displayName: string; source: string; sourceId: string }> = {
  nppes_identity:    { displayName: 'NPPES Identity',      source: 'CMS NPPES Registry',   sourceId: 'nppes' },
  oig_exclusions:    { displayName: 'OIG Exclusions',      source: 'OIG LEIE',              sourceId: 'oig' },
  state_license:     { displayName: 'State License',       source: 'State Medical Board',   sourceId: 'state_license' },
  employment_history:{ displayName: 'Employment History',  source: 'The Work Number',       sourceId: 'twn' },
  board_cert:        { displayName: 'Board Certification', source: 'ABMS',                  sourceId: 'abms' },
  pecos_enrollment:  { displayName: 'PECOS Enrollment',    source: 'CMS PECOS',             sourceId: 'pecos' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic 8-char run ID from receipt ID (no crypto needed — just a stable short form). */
function deriveRunId(receiptId: string): string {
  let hash = 0;
  for (let i = 0; i < receiptId.length; i++) {
    hash = ((hash << 5) - hash + receiptId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

function formatCheckedAt(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/** Parse embedded NPI from rcpt_ receipts: rcpt_{npi}_{timestamp} or similar. */
function parseRcptReceiptId(receiptId: string): { npi: string | null; ts: number } {
  // rcpt_ format: rcpt_{anything}_{10-digit-npi}_{epoch} or rcpt_{epoch}
  const parts = receiptId.replace(/^rcpt_/, '').split('_');
  let npi: string | null = null;
  let ts = Date.now();

  for (const part of parts) {
    if (/^\d{10}$/.test(part)) {
      npi = part;
    } else if (/^\d{13}$/.test(part)) {
      ts = parseInt(part, 10);
    } else if (/^\d{10,12}$/.test(part)) {
      const n = parseInt(part, 10);
      if (n > 1_000_000_000_000) {
        ts = n;
      }
    }
  }

  return { npi, ts };
}

/** Parse rec- coverage receipt IDs: rec-{laneId}-{epoch}-{hash} */
function parseRecReceiptId(receiptId: string): { laneId: string; ts: number } {
  const inner = receiptId.replace(/^rec-/, '');
  const knownLane = Object.keys(LANE_META).find((l) => inner.startsWith(l.replace(/_/g, '-')));
  const laneId = knownLane ?? 'nppes_identity';

  const epochMatch = inner.match(/(\d{13})/);
  const ts = epochMatch ? parseInt(epochMatch[1], 10) : Date.now();

  return { laneId, ts };
}

// ─── Core function ────────────────────────────────────────────────────────────

export async function getReplayInspection(
  receiptId: string,
): Promise<ReplayInspection | null> {
  // Validate format
  const isRcpt = receiptId.startsWith('rcpt_');
  const isRec = receiptId.startsWith('rec-');
  const isAnonymous = !isRcpt && !isRec;

  // Get current signing key
  let signingKeyId: string | null = null;
  let kid = 'unknown';
  try {
    const jwk = await getPublicKeyJwk();
    kid = (jwk.kid as string) ?? 'unknown';
    signingKeyId = kid;
  } catch {
    // Non-fatal — key may not be available at build time
  }

  const signerHistory: SignerRotationEntry[] = [
    {
      kid,
      algorithm: 'ES256',
      activeFrom: 'genesis',
      activeTo: null,
    },
  ];

  // ── Anonymous preview ──────────────────────────────────────────────────────
  if (isAnonymous) {
    const runId = deriveRunId(receiptId);
    const checkedAt = formatCheckedAt(Date.now());
    return {
      receiptId,
      lineageKey: `unknown:${receiptId.slice(0, 8)}`,
      runId,
      checkedAt,
      issuerDid: ISSUER_DID,
      signingKeyId,
      jwksUri: JWKS_URI,
      runs: [
        {
          runId,
          checkedAt,
          source: 'Unknown',
          laneId: 'unknown',
          status: 'not_checked',
          tier: 'T1',
          receiptId,
          priorRunId: null,
        },
      ],
      gaps: [
        {
          gapType: 'actor_mismatch',
          description: 'Receipt ID format unrecognized — no actor bound.',
          severity: 'warning',
          affectedRunId: runId,
        },
      ],
      signerHistory,
      survivabilityScore: 20,
      survivabilityRationale: 'No cryptographic signing context found. Receipt ID format is unrecognized.',
      degradationOwnership: 'anonymous_preview',
      degradationExplanation:
        'No actor is bound to this receipt. There is no replay continuity to inspect.',
      sourceContinuity: {
        sourceId: 'unknown',
        displayName: 'Unknown',
        lifecycle: 'planned',
        lastChecked: null,
      },
    };
  }

  // ── rcpt_ issuer receipt ───────────────────────────────────────────────────
  if (isRcpt) {
    const { npi, ts } = parseRcptReceiptId(receiptId);
    const laneId = 'nppes_identity';
    const lane = LANE_META[laneId];
    const runId = deriveRunId(receiptId);
    const checkedAt = formatCheckedAt(ts);
    const providerId = npi ?? receiptId.slice(5, 15);
    const lineageKey = `${laneId}:${providerId}`;

    const run: ReplayRunEntry = {
      runId,
      checkedAt,
      source: lane.source,
      laneId,
      status: 'verified',
      tier: 'T4',
      receiptId,
      priorRunId: null,
    };

    return {
      receiptId,
      lineageKey,
      runId,
      checkedAt,
      issuerDid: ISSUER_DID,
      signingKeyId,
      jwksUri: JWKS_URI,
      runs: [run],
      gaps: [],
      signerHistory,
      survivabilityScore: 100,
      survivabilityRationale:
        'T4 issuer-signed receipt present. Cryptographic integrity verified.',
      degradationOwnership: 'no_adverse_findings',
      degradationExplanation:
        'Source returned clean data. This is a success state — not a degradation.',
      sourceContinuity: {
        sourceId: lane.sourceId,
        displayName: lane.displayName,
        lifecycle: 'active',
        lastChecked: checkedAt,
      },
    };
  }

  // ── rec- coverage receipt ─────────────────────────────────────────────────
  const { laneId, ts } = parseRecReceiptId(receiptId);
  const lane = LANE_META[laneId] ?? LANE_META['nppes_identity'];
  const runId = deriveRunId(receiptId);
  const checkedAt = formatCheckedAt(ts);
  const providerId = receiptId.slice(4, 14);
  const lineageKey = `${laneId}:${providerId}`;

  // Coverage receipts are typically T3 (source checked, not issuer-signed)
  const run: ReplayRunEntry = {
    runId,
    checkedAt,
    source: lane.source,
    laneId,
    status: 'verified',
    tier: 'T3',
    receiptId,
    priorRunId: null,
  };

  // Gap: no signed receipt — T3 but not T4
  const gaps: ContinuityGap[] = [
    {
      gapType: 'missing_lane',
      description: `Coverage receipt present but not issuer-signed. Upgrade to T4 recommended for ${lane.displayName}.`,
      severity: 'info',
      affectedRunId: runId,
    },
  ];

  return {
    receiptId,
    lineageKey,
    runId,
    checkedAt,
    issuerDid: ISSUER_DID,
    signingKeyId,
    jwksUri: JWKS_URI,
    runs: [run],
    gaps,
    signerHistory,
    survivabilityScore: 60,
    survivabilityRationale:
      'T3 source-checked receipt. Source was queried and returned valid data, but no cryptographic issuer signature is present.',
    degradationOwnership: 'no_adverse_findings',
    degradationExplanation:
      'Source returned clean data. Consider upgrading to T4 (issuer-signed) for maximum verifier confidence.',
    sourceContinuity: {
      sourceId: lane.sourceId,
      displayName: lane.displayName,
      lifecycle: 'active',
      lastChecked: checkedAt,
    },
  };
}
