import type { SourceRecord } from "../../types";

/** Only NPPES has specialty, STATE is absent → AGREED, chosen=NPPES */
export const missingInHigherSource: SourceRecord[] = [
  {
    source: "NPPES",
    field: "specialty",
    value: "Cardiology",
    confidence: 0.8,
    verified: true,
    timestamp: 1700000000000,
  },
];
