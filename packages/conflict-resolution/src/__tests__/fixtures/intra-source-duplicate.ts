import type { SourceRecord } from "../../types";

/** Two NPPES records for `state` with different values → UNRESOLVED */
export const intraSourceDuplicate: SourceRecord[] = [
  {
    source: "NPPES",
    field: "state",
    value: "CA",
    confidence: 0.9,
    verified: true,
    timestamp: 1700000000000,
  },
  {
    source: "NPPES",
    field: "state",
    value: "NY",
    confidence: 0.9,
    verified: true,
    timestamp: 1700050000000,
  },
];
