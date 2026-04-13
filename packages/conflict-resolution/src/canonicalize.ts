/**
 * Minimal canonical normalization for comparison only.
 *
 * Rules:
 * - string  → trim + lowercase
 * - number  → unchanged (NaN stays NaN — documented v1 quirk)
 * - boolean → unchanged
 * - null    → unchanged
 * - Array   → recursively canonicalize elements, then sort by stable stringification
 * - object  → new object with sorted keys, each value recursively canonicalized
 *
 * Invariant: canonicalize(canonicalize(x)) deep-equals canonicalize(x)
 *
 * This is NOT fuzzy matching — it is representational hygiene.
 * Fuzzy logic belongs in a future normalizers/ pre-processing layer.
 */
export function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (value === undefined) return undefined;

  switch (typeof value) {
    case "string":
      return value.trim().toLowerCase();

    case "number":
    case "boolean":
      return value;

    case "object": {
      if (Array.isArray(value)) {
        const canonicalized = value.map(canonicalize);
        return canonicalized.sort(stableCompare);
      }

      // Plain object — sort keys, recurse values
      const obj = value as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      const keys = Object.keys(obj).sort();
      for (const key of keys) {
        sorted[key] = canonicalize(obj[key]);
      }
      return sorted;
    }

    default:
      return value;
  }
}

/**
 * Stable total order over canonicalized values.
 * Uses JSON stringification as the comparison key.
 */
function stableCompare(a: unknown, b: unknown): number {
  const sa = JSON.stringify(a) ?? "";
  const sb = JSON.stringify(b) ?? "";
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

/**
 * Compares two canonicalized values for deep equality.
 * Uses stable stringification — safe because both inputs are already canonicalized
 * (sorted keys, sorted arrays, trimmed/lowercased strings).
 */
export function canonicalEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
