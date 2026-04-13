# Conflict Resolution Engine — Design Spec

**Date:** 2026-04-13
**Branch:** `feat/conflict-resolution`
**Package:** `@vitalcv/conflict-resolution` at `packages/conflict-resolution/`

## Problem

Provider data arrives from multiple sources (NPPES, state boards, user submissions, resumes). Fields can disagree — e.g., NPPES says "John Smith" while the state board says "Jonathan A. Smith". The system needs a deterministic, auditable way to detect conflicts, pick a winner, and surface disagreements.

## Architecture

A single pure function at the core:

```ts
resolveConflicts(records: SourceRecord[]): ResolutionResult
```

**Constraints:**
- Zero I/O, zero clock, zero randomness
- Same input → same output, always
- No fuzzy matching — strict equality after minimal canonicalization
- No persistence — engine is stateless
- No provider-specific logic — operates on generic `SourceRecord[]`

**Package location:** `packages/conflict-resolution/` — consumable by both backend and frontend.

## Types

### Source (closed union)

```ts
type Source = "STATE" | "NPPES" | "USER" | "RESUME";
```

Adding a new source forces the priority table to be updated (compiler-enforced exhaustiveness).

### SourceRecord

```ts
type SourceRecord = {
  source: Source;
  field: string;
  value: unknown;
  confidence: number;   // 0..1, output-only annotation
  verified: boolean;     // output-only annotation
  timestamp: number;     // epoch ms, audit only — NOT used for resolution
};
```

### Resolution output

```ts
type FieldStatus = "AGREED" | "RESOLVED" | "UNRESOLVED";
type ConflictReason = "CROSS_SOURCE" | "INTRA_SOURCE_DUPLICATE";

type Candidate = {
  source: Source;
  value: unknown;       // raw, non-canonicalized
  confidence: number;
  verified: boolean;
  timestamp: number;
};

type ResolvedField = {
  field: string;
  status: FieldStatus;
  chosen: Candidate | null;   // null only when UNRESOLVED
  candidates: Candidate[];
  reason?: ConflictReason;
};

type ResolutionResult = {
  fields: Record<string, ResolvedField>;
  conflicts: ResolvedField[];   // projection of non-AGREED fields
};
```

## Priority Rule

Strict lexicographic priority. Source rank alone decides. Confidence, verified, and timestamp are recorded but never influence the choice.

```ts
const RANK: Record<Source, number> = {
  STATE:  3,
  NPPES:  2,
  USER:   1,
  RESUME: 0,
};
```

"We took it from STATE because STATE is the highest-priority source that provided a value" — this is the only explanation the system ever needs.

## Algorithm

1. **Canonicalize** each record's value (trim/lowercase strings, sort arrays, sort object keys).
2. **Group** records by field name.
3. For each field:
   - All canonicalized values equal → `AGREED`. Chosen = highest-rank source's raw value.
   - Multiple distinct values, single source → `UNRESOLVED` (`INTRA_SOURCE_DUPLICATE`).
   - Multiple distinct values, multiple sources:
     - Highest-rank source internally consistent → `RESOLVED` (`CROSS_SOURCE`). Chosen = that source.
     - Highest-rank source internally inconsistent → `UNRESOLVED` (`INTRA_SOURCE_DUPLICATE`).
4. `chosen.value` is always the raw (non-canonicalized) value from the winning record.

## Canonicalization

Minimal representational hygiene. Pure and idempotent.

| Input type | Transform |
|---|---|
| `string` | `.trim().toLowerCase()` |
| `number` | unchanged |
| `boolean`, `null` | unchanged |
| `Array` | recursively canonicalize elements, sort by JSON string |
| `object` | sort keys alphabetically, recursively canonicalize values |
| `undefined` | rejected at input validation |

**Invariant:** `canonicalize(canonicalize(x))` deep-equals `canonicalize(x)`.

**v1 quirk:** NaN !== NaN, so NaN inputs always self-conflict. Documented, not fixed in v1.

## Edge Cases

- **Empty input** → empty result, never throws.
- **Single record** → `AGREED`.
- **`value: null`** → real claim, competes like any other value.
- **Same source, same value** → `AGREED` (duplicate records collapse).
- **Array ordering** → canonicalization sorts, so `["CA","NY"]` equals `["NY","CA"]`.
- **Object key ordering** → canonicalization sorts keys, so `{a:1,b:2}` equals `{b:2,a:1}`.

## Test Fixtures

| Fixture | Expected |
|---|---|
| agreement | AGREED, chosen=STATE |
| conflict-name | RESOLVED, chosen=STATE |
| missing-in-higher-source | AGREED, chosen=NPPES |
| intra-source-duplicate | UNRESOLVED, no chosen |
| canonicalization-masks-conflict | AGREED after canonicalization |
| winning-source-internally-inconsistent | UNRESOLVED |
| array-reorder | AGREED |
| object-key-reorder | AGREED |
| null-as-claim | RESOLVED, chosen=STATE (null wins by rank) |

## Explicit Non-Goals

- No real source adapters (NPPES, state board, etc.)
- No UI component — the "Data inconsistency detected" flag is a separate frontend branch
- No fuzzy matching — future `packages/normalizers/` handles that
- No persistence — callers store `ResolutionResult`
- No integration into existing `CanonicalEntity` / `EntityRole` types
- No new sources in the `Source` union
- No confidence arithmetic — copied verbatim from winning record

## Future Work

- `feat/state-board-adapter` — real state board data source
- `feat/nursys-integration` — nursing license verification
- `packages/normalizers/` — fuzzy pre-processing layer (runs before this engine)
- UI conflict flag component consuming `ResolutionResult`
- Wire-up to `CanonicalEntity` merge layer in `apps/api/`
