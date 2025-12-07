/**
 * B160A-RISK-004: Risk score model helpers
 */

export const RISK_SCORE_MIN = 0;
export const RISK_SCORE_MAX = 100;

export const KNOWN_RISK_REASON_TAGS = [
  'HIGH_VELOCITY',
  'MULTIPLE_ACCOUNTS',
  'SUSPICIOUS_UA',
  'BAD_IP',
  'IMPROBABLE_GEO',
  'DEVICE_BLOCKLIST',
  'IP_BLOCKLIST',
  'TOR_EXIT_NODE',
  'REPUTATION_LOW',
  'REPUTATION_MEDIUM',
  'REPUTATION_HIGH',
  'REPUTATION_BLOCK',
] as const;

export type KnownRiskReasonTag = (typeof KNOWN_RISK_REASON_TAGS)[number];

export interface RiskScoreRecord {
  deviceId: string;
  ipHash: string;
  score: number;
  reasonTags: string[];
  createdAt: Date;
  lastUpdatedAt: Date;
}

export function clampRiskScore(score: number): number {
  if (!Number.isFinite(score)) {
    return RISK_SCORE_MIN;
  }
  return Math.max(RISK_SCORE_MIN, Math.min(RISK_SCORE_MAX, Math.round(score)));
}

export function mergeReasonTags(
  ...reasonLists: Array<string[] | undefined>
): string[] {
  const seen = new Set<string>();

  for (const list of reasonLists) {
    if (!list) continue;
    for (const reason of list) {
      if (!reason) continue;
      seen.add(reason);
    }
  }

  return Array.from(seen);
}

