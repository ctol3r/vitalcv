import type { SourceRecord } from "../../types";

/**
 * STATE has two distinct names, NPPES has one.
 * STATE is highest-rank but internally inconsistent → UNRESOLVED
 */
export const winningSourceInternallyInconsistent: SourceRecord[] = [
  {
    source: "STATE",
    field: "name",
    value: "John Smith",
    confidence: 0.9,
    verified: true,
    timestamp: 1700000000000,
  },
  {
    source: "STATE",
    field: "name",
    value: "Jonathan Smith",
    confidence: 0.85,
    verified: true,
    timestamp: 1700050000000,
  },
  {
    source: "NPPES",
    field: "name",
    value: "John Smith",
    confidence: 0.9,
    verified: true,
    timestamp: 1700100000000,
  },
];
