import type { SourceRecord } from "../../types";

/**
 * NPPES sends " JOHN SMITH ", STATE sends "john smith"
 * After canonicalization both become "john smith" → AGREED
 * Chosen value is STATE's raw value "john smith" (highest rank)
 */
export const canonicalizationMasksConflict: SourceRecord[] = [
  {
    source: "NPPES",
    field: "name",
    value: "  JOHN SMITH  ",
    confidence: 0.9,
    verified: true,
    timestamp: 1700000000000,
  },
  {
    source: "STATE",
    field: "name",
    value: "john smith",
    confidence: 0.95,
    verified: true,
    timestamp: 1700100000000,
  },
];
