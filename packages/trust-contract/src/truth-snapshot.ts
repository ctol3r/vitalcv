// ── VitalCV Time-Locked Truth Snapshot ───────────────────────────
// Captures an immutable snapshot of all inputs used at the moment of decision.
// Once created, a snapshot MUST NOT change.

import { SourceStatus } from './index';
import { FreshnessState } from './freshness-engine';

export interface SourceStateSnapshot {
  sourceId: string;
  status: SourceStatus;
  verifiedAt: string;
}

export interface ClaimSnapshot {
  claimId: string;
  type: string;
  value: string | number | boolean | null;
  issuerId: string;
}

export interface ReceiptSnapshot {
  sourceId: string;
  receiptHash: string;
}

export interface FreshnessSnapshot {
  sourceId: string;
  state: FreshnessState;
  ageMs: number;
}

export interface ArbitrationSnapshot {
  conflictsResolved: number;
  finalValues: Record<string, any>;
}

export interface TruthSnapshot {
  snapshotId: string;
  npi: string;
  timestamp: string;
  sourceStates: SourceStateSnapshot[];
  claims: ClaimSnapshot[];
  receipts: ReceiptSnapshot[];
  freshnessStates: FreshnessSnapshot[];
  arbitrationResult: ArbitrationSnapshot;
}
