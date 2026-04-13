import type { SourceRecord } from "../../types";

/** NPPES says "John Smith", STATE says "Jonathan A. Smith" → RESOLVED, chosen=STATE */
export const conflictName: SourceRecord[] = [
  {
    source: "NPPES",
    field: "name",
    value: "John Smith",
    confidence: 0.9,
    verified: true,
    timestamp: 1700000000000,
  },
  {
    source: "STATE",
    field: "name",
    value: "Jonathan A. Smith",
    confidence: 0.85,
    verified: true,
    timestamp: 1700100000000,
  },
];
