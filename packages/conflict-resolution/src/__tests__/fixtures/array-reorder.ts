import type { SourceRecord } from "../../types";

/** ["CA","NY"] vs ["NY","CA"] → AGREED after sort canonicalization */
export const arrayReorder: SourceRecord[] = [
  {
    source: "NPPES",
    field: "practiceStates",
    value: ["CA", "NY"],
    confidence: 0.9,
    verified: true,
    timestamp: 1700000000000,
  },
  {
    source: "STATE",
    field: "practiceStates",
    value: ["NY", "CA"],
    confidence: 0.95,
    verified: true,
    timestamp: 1700100000000,
  },
];
