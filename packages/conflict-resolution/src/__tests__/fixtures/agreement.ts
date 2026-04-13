import type { SourceRecord } from "../../types";

/** NPPES and STATE both say "John Smith" → AGREED, chosen=STATE (higher rank) */
export const agreement: SourceRecord[] = [
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
    value: "John Smith",
    confidence: 0.95,
    verified: true,
    timestamp: 1700100000000,
  },
];
