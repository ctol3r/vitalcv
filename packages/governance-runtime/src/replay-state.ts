/**
 * Replay-state primitives.
 *
 * Doctrine: docs/ops/replay-taxonomy-map.md §1
 *
 * 5 replay states:
 *   R-OBSERVED   — replay observed AND processed (IDEMPOTENT_REPLAY)
 *   R-DENIED     — replay denied at gate (<base>.duplicate_request)
 *   R-ACCEPTED   — replay processed as if new (NO marker; forensic detection only)
 *   R-COLLAPSED  — concurrency mechanism prevented duplicate (CONCURRENCY_GUARD_TRIGGERED)
 *   R-AMBIGUOUS  — insufficient signal; SOC disambiguation required
 *
 * Per TRUST_GUARANTEE_LEXICON.md §1.3: replay observability is NOT replay
 * prevention. The phrases "replay protected", "replay-resistant",
 * "replay-secure" are FORBIDDEN. This module exposes ONLY observability-grade
 * primitives.
 */

export const REPLAY_STATES = [
  "R-OBSERVED",
  "R-DENIED",
  "R-ACCEPTED",
  "R-COLLAPSED",
  "R-AMBIGUOUS",
] as const;

export type ReplayState = (typeof REPLAY_STATES)[number];

export function parseReplayState(value: unknown): ReplayState | null {
  if (typeof value !== "string") return null;
  for (const state of REPLAY_STATES) {
    if (state === value) return state;
  }
  return null;
}

/**
 * Lexicon-aligned wording per state. Operators see this in dashboards + audits.
 */
export function replayStateDescription(state: ReplayState): string {
  switch (state) {
    case "R-OBSERVED":
      return "Idempotent-replay event recorded; operation processed once and replay acknowledged with the original outcome";
    case "R-DENIED":
      return "Best-effort idempotency-check denied audit; correlationId or content-match within 24h window";
    case "R-ACCEPTED":
      return "Operation processed; replay-detection requires forensic payloadHash clustering";
    case "R-COLLAPSED":
      return "Concurrency-guard event recorded; concurrency mechanism prevented duplicate state";
    case "R-AMBIGUOUS":
      return "Replay state ambiguous; disambiguation queries required (see replay-taxonomy-map §6)";
  }
}

/**
 * Classify an audit row into a replay state.
 * Returns R-AMBIGUOUS if the signals are insufficient (NEVER returns null;
 * R-AMBIGUOUS is the explicit ambiguity-visible state per W2-PR19A rule #4).
 *
 * Per docs/ops/replay-taxonomy-map.md §7 query templates.
 */
export function classifyReplayState(row: {
  type: string | null | undefined;
  metadata: Record<string, unknown> | null | undefined;
}): ReplayState {
  const type = row.type;
  const metadata = row.metadata ?? {};

  if (type === "IDEMPOTENT_REPLAY") return "R-OBSERVED";
  if (type === "CONCURRENCY_GUARD_TRIGGERED") return "R-COLLAPSED";

  const action = typeof metadata["action"] === "string" ? (metadata["action"] as string) : null;
  if (action != null) {
    if (action.endsWith(".duplicate_request") || action.endsWith(".already_accepted")) {
      return "R-DENIED";
    }
  }

  // No marker = R-ACCEPTED OR genuinely-new operation; cannot distinguish from this row alone.
  // Returning R-AMBIGUOUS keeps ambiguity visible per W2-PR19A rule #4.
  return "R-AMBIGUOUS";
}
