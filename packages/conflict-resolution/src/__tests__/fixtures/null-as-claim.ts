import type { SourceRecord } from "../../types";

/**
 * STATE claims null for specialty, NPPES claims "Cardiology"
 * null is a real claim → RESOLVED, chosen=STATE (rank wins even for null)
 */
export const nullAsClaim: SourceRecord[] = [
  {
    source: "NPPES",
    field: "specialty",
    value: "Cardiology",
    confidence: 0.8,
    verified: true,
    timestamp: 1700000000000,
  },
  {
    source: "STATE",
    field: "specialty",
    value: null,
    confidence: 0.7,
    verified: false,
    timestamp: 1700100000000,
  },
];
