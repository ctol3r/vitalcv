import type { SourceRecord } from "../../types";

/** {a:1,b:2} vs {b:2,a:1} → AGREED after key-sort canonicalization */
export const objectKeyReorder: SourceRecord[] = [
  {
    source: "NPPES",
    field: "address",
    value: { street: "123 Main St", city: "Springfield" },
    confidence: 0.9,
    verified: true,
    timestamp: 1700000000000,
  },
  {
    source: "STATE",
    field: "address",
    value: { city: "Springfield", street: "123 Main St" },
    confidence: 0.95,
    verified: true,
    timestamp: 1700100000000,
  },
];
