/**
 * @vitalcv/governance-runtime — VitalCV constitutional governance runtime.
 *
 * Single source of truth for trust classes, integrity states, replay states,
 * containment states, override audit primitives, and state-transition graphs.
 *
 * Doctrine bundle:
 *   - docs/ops/TRUST_GUARANTEE_LEXICON.md (forbidden phrases)
 *   - docs/ops/trust-class-taxonomy.md (5 trust classes)
 *   - docs/ops/replay-taxonomy-map.md (5 replay states)
 *   - docs/ops/runtime-integrity-dashboard.md (integrity indicators)
 *   - docs/ops/integrity-containment-dashboard.md (containment indicators)
 *   - docs/ops/constitutional-override-governance.md (override audit)
 *   - docs/ops/integrity-stress-escalation-paths.md (transitions)
 *   - docs/ops/operational-guarantee-matrix.md (per-class strength)
 *
 * Per W2-PR19A non-negotiable rule #2: this registry IS the single
 * source of truth. All dashboards / API responses / CI / Codex audit
 * derive from these primitives. Duplicated literals are a CI-failure
 * (per scripts/governance/check-trust-lexicon.ts).
 *
 * Per W2-PR18A non-negotiable rules: unknown ≠ healthy. All parse* helpers
 * fail closed (return UNKNOWN/AMBIGUOUS/null — never coerce to GREEN).
 */

export * from "./registry.js";
