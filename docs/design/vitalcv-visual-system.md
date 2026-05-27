# VitalCV Visual System — North Star

This is the **packaged visual-director output** for VitalCV. It is intentionally compact: every concrete design token (palette, spacing, motion, typography) is already implemented in `apps/web/design-system/tokens/` and exported via CSS variables. This doc names the principles and points at the implementation.

Companion docs:

- `docs/design/current-ui-inventory.md` — what exists today.
- `docs/design/component-library-spec.md` — per-component specs.
- `docs/design/screen-composition-spec.md` — route-level composition.
- `docs/design/state-model-as-design.md` — the truth-state vocabulary.
- `docs/design/ui-implementation-roadmap.md` — order of operations.

## North Star

VitalCV is **a register, not a dashboard**. Every visible surface should read like a public record that any reviewer can audit, not like a SaaS product nagging the user. The visual language is *honest, restrained, document-like*.

Five non-negotiables, in priority order:

1. **Operator-honest copy.** No bare "Verified", no "complete credentialing", no "guaranteed verification", no "HIPAA compliant" / "SOC2 certified" / "NCQA certified". The banned-strings contract in `CLAUDE.md` is enforced by the test suite. (See `state-model-as-design.md` for the canonical vocabulary.)
2. **System state ≠ findings about the clinician.** "Temporarily unavailable" is a system condition, not a negative signal about the person. The visual system marks the system separately and quietly.
3. **Trust-tier and decision artefacts get their own components.** `TrustTierBadge` (T1–T4), `ExclusionBadge` (OIG outcomes), `DecisionBadge` (review outcomes) own their axes. The new `TruthStateChip` owns *only* the system-state axis.
4. **Restrained motion.** All transitions use `var(--vt-motion-fast)` + `var(--vt-ease-standard)`. No celebratory animations on credential state — credentialing is serious; the visual language matches.
5. **Receipt-document layout, not marketing chrome.** `/status`, `/trust/attribution`, `/passport` should read like an audit record. Marketing chrome stays on `/`, `/for/*` persona pages, and `/pricing`.

## Palette

Token source: `apps/web/design-system/tokens/colors.ts`. Themes: `apps/web/design-system/themes/{light,dark,graphite,midnight}.ts`. Production default: **light** with `graphite` ink for operator surfaces.

| Token | Used for |
|---|---|
| `--vt-surface-base` / `--vt-surface-subtle` / `--vt-surface-raised` | page background tiers |
| `--vt-text-primary` / `--vt-text-secondary` / `--vt-text-tertiary` | text contrast tiers |
| `--vt-border` / `--vt-border-subtle` | dividers, chip outlines |
| `--vt-accent` | the *one* attention color; use sparingly (primary CTAs only) |
| `--vt-severity-medium` | restrained amber for `access-required` |
| `--vt-severity-critical` | reserved for actually critical findings (rare) |
| `--vt-status-resolved` | reserved for already-resolved / no-longer-active states |

**Forbidden gradients, glow effects, "crypto" / "AI" / "neon" visuals.** The product is healthcare credentialing — it should look like a register, not a dashboard from a 2017 ICO.

## Typography

Token source: `apps/web/design-system/tokens/typography.ts`. Layout-level fonts wired in `apps/web/app/layout.tsx` (PR-F #214):

- `--font-geist` / `--font-geist-mono` (primary)
- `--font-body` / `--font-sans` / `--font-heading` / `--font-mono` (semantic CSS variables)

Hierarchy: 1 hero scale, 1 heading scale, 1 body scale, 1 caption scale, 1 mono scale. **No more than 5 type sizes per surface.** Caption is reserved for chips, legends, timestamps, audit metadata — not for marketing copy.

## Spacing

Token source: `apps/web/design-system/tokens/spacing.ts`. CSS variables `--vt-space-{4,8,12,16,24,32,48,64}` plus `--vt-radius-pill`. Surfaces use generous vertical rhythm (24–48px between row blocks); chips use 4-8-12 internally.

**Whitespace is a feature, not a bug.** Receipt-document surfaces should feel uncrowded.

## Motion

Token source: `apps/web/design-system/tokens/motion.ts`. Two durations: `--vt-motion-fast` (chip/badge state changes) and `--vt-motion-standard` (panel/modal). Ease: `--vt-ease-standard` (everything that isn't an emergency).

No bounce, no spring, no cascade. No "loading" shimmer on terminal degraded states.

## Surfaces (high level)

| Surface | Treatment |
|---|---|
| Homepage `/` | One primary action (NPI lookup) + four role doors + proof strip + trust footer. Marketing chrome OK; no banned phrases. |
| Passport `/passport`, `/passport/[id]` | Receipt-document layout. 5-row truth legend at top. Per-source rows: name / state chip / reason / timestamp / next action. Institution review boundary surfaced separately. |
| Trust `/trust`, `/trust/doctrine`, `/trust/attribution`, `/trust/schema`, `/trust/graph` | Document register style. `attribution` is a per-field receipt. |
| Status `/status` | Connector Matrix: connector / state chip / last-checked / access requirement / interpretation. Public-facing. |
| Auth `/sign-in`, `/sign-up` | Calm disclosure card. One primary action. No marketing noise. |
| Persona landing `/for/cvo`, `/for/payer`, `/for/staffing-exchange` | Persona-routed but still no banned phrases. CTAs route to `/contact?persona=…`. |
| Internal (employer review, issuer review, intelligence-ops) | More density allowed but still document-register, not dashboard chrome. |

## Anti-patterns to delete or migrate

- Multiple competing `Badge` primitives in active use (`design-system/components/Badge.tsx` and `components/ui/badge.tsx`). New work imports from `design-system/components/` exclusively.
- `apps/web/app/_archive/**` — dead routes that still carry banned phrases ("instant credentialing", bare "Verified"). Delete in a sweep wave.
- Hand-rolled `<span>Unavailable</span>` rows in Passport / Trust / Source Coverage panels. Replace with `TruthStateChip state="temporarily-unavailable"`.
- Skeleton-style loaders left visible during *terminal* degraded states (the system has classified the read as "unavailable" — stop pretending it's loading).

## Where the contract is enforced

- CLAUDE.md "Banned strings" — the authoritative list.
- `apps/web/__tests__/truth-state-chip.test.tsx` — automated check for every chip label/meaning.
- Per-surface Wave H/I/J/K tests will extend the check to the rendered route HTML.

## Out of scope for this doc

- Component-by-component API details — see `component-library-spec.md`.
- Per-route screen composition — see `screen-composition-spec.md`.
- State treatment per visual — see `state-model-as-design.md`.
- Sequence of integration waves — see `ui-implementation-roadmap.md`.
