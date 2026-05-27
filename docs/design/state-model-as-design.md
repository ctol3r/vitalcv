# State Model as Design

The truth-state vocabulary is the single most important design decision in the visual system. It is the operator-honest answer to "what is the system reporting about this fact right now" — without ever claiming a credentialing decision and without ever shaming the clinician for a system condition.

The full enumerated vocabulary lives in code (`apps/web/design-system/components/TruthStateChip.tsx`) and visually documented in `apps/web/design-system/docs/truth-state-chip.md`. This doc records the **design rationale** behind each state and visual choice.

## The 8 states, by axis

| State | What the system observed | Who needs to act | Visual variant |
|---|---|---|---|
| `source-backed` | A primary source returned a usable payload. | nobody (informational) | neutral |
| `snapshot-only` | We hold a point-in-time read; current state may differ. | reviewer (consider freshness) | neutral |
| `institution-review-required` | Reviewer-ready head start prepared; institution decides. | institution reviewer | outline |
| `access-required` | Authorization needed before this lane can be read. | caller (sign-in / org context) | warning |
| `auth-required` | Operator sign-in unlocks the live read. | caller (sign-in) | outline |
| `temporarily-unavailable` | Source did not return a payload on this attempt. | nobody (system condition) | muted |
| `connector-not-live` | This connector is intentionally not running. | nobody (build-time policy) | outline |
| `demo-only` | Synthetic data for demonstration. | viewer (don't trust as real) | outline |

## Design rationale per state

### `source-backed` — neutral, never celebratory

The visual treatment is restrained on purpose. Source-backed is *not* a credentialing decision. A clinician's name being source-backed against NPPES doesn't tell you whether they're licensed, sanctioned, or employable — it tells you the federal registry returned a record. The chip cannot legally or ethically suggest "Verified".

We deliberately picked the **neutral** variant over a celebratory green to prevent UI sugar from drifting into truth-claim sugar. If a viewer wants to celebrate, they can. The chip won't.

### `temporarily-unavailable` — muted, system condition

When the upstream NPPES API times out or returns 5xx, the system has *no information about the clinician*. The chip must visually distinguish "we couldn't reach the source" from "we found something bad about the clinician".

The **muted** variant is lower-contrast on purpose: it reads as "the system is in a transient state", not as an alarm. The accompanying copy ("System condition, not a finding about the clinician") is part of the contract.

### `connector-not-live` — outline, restrained

OIG/LEIE / CMS PECOS / state board adapters are not connected to live upstream services in the current build. The chip says so honestly. Critically, it does NOT mean "the clinician is excluded" or "the clinician is not enrolled". A viewer who hovers gets explicit copy: "Connector not live. Do not interpret as an exclusion clearance."

The **outline** variant matches the design intent: this isn't a finding, it's a build-time policy.

### `access-required` — warning, the only chip that can raise pulse

Access-required is the *only* state in the vocabulary that uses the warning variant (restrained amber). The reason: this is the only state where the caller needs to act. Every other state is informational about system condition.

We avoided full critical-red because access-required isn't a security incident; it's a "you need to sign in / add org context" prompt. Restrained amber + a lock icon conveys "an action is needed" without sounding an alarm.

### `auth-required` — outline, sign-in only

Distinct from `access-required` because:

- `auth-required`: the caller is unauthenticated entirely (e.g., `POST /api/ingest/...` returned 403 + `x-cors-blocked:1` on the unauthenticated public page).
- `access-required`: the caller is authenticated but lacks org context / specific authorization.

Both prompt sign-in; only the latter is "warning" because it represents a *workflow* gap (someone is signed in but needs more permission). Auth-required is the cold-start gate and stays calm outline.

### `institution-review-required` — outline action, the next-step chip

The institution-review chip surfaces the boundary: "This view is a reviewer-ready head start, not a final credentialing decision." It is the next-step chip that explicitly disclaims the system. Outline variant + an inbox icon (the next move is human).

### `snapshot-only` — neutral, modifier of source-backed

Snapshot-only is what `source-backed` reads when the read is older than a configurable freshness budget. Same variant as source-backed (it's still source-backed data), but the chip label switches and the row picks up a timestamp. Wave H's source-row layout shows the timestamp next to the chip; the row, not the chip, is the place to surface relative time.

### `demo-only` — outline, visually distinct

Demo-only is for surfaces where synthetic data is shown intentionally (issuer review demo, employer review demo, design-surface foundations with `recordedBy: 'demo'`). The outline variant is the same as connector-not-live, but the label and accompanying copy make the demo-ness explicit.

## State transitions (where the design lives)

The chip is a *snapshot*; transitions live in the surrounding row. When NPPES flips from `temporarily-unavailable` to `source-backed` on the next ingest attempt, the chip silently swaps; no animation, no celebration, no "→". This is intentional: state transitions in credentialing should not feel like a slot machine.

The Passport surface (Wave H) reflects state transitions by re-rendering the source row. The chip's visual transition (via `var(--vt-motion-fast)`) is the only motion; row layout doesn't shift.

## What this vocabulary does NOT cover

- **Adverse findings about the clinician** — handled by `ExclusionBadge` (OIG outcome), `SanctionRiskBadge` (sanction risk tier). `TruthStateChip` reports system state, not findings.
- **Trust tier of the source** — handled by `TrustTierBadge` (T1–T4). Pair on the row.
- **Replay integrity** — handled by `ReplayIntegrityBadge`. Different axis (cryptographic integrity vs system state).
- **Decision outcomes** — handled by `DecisionBadge`.

The orthogonality is the point. A single Passport source row can legitimately show all of: `TrustTierBadge` (T1), `TruthStateChip` (source-backed), `FreshnessIndicator` (3h ago). Each chip is a one-axis claim.

## How the contract is enforced

- Type system pins the 8 states (`TruthStateKind` union). Adding a 9th requires updating the test enumeration.
- Variant assignment is fixed per state in `TRUTH_STATE_META`. A caller cannot pass `variant="warning"` to `source-backed` and call it verified.
- Test suite regex-checks every label and meaning against the banned-strings list before any commit can land.
- Per-route Wave H/I/J/K tests will assert the chip is used (not bare `<span>`) by scanning rendered HTML.

## Out of scope for this doc

- Per-component API — `component-library-spec.md`.
- Per-route composition — `screen-composition-spec.md`.
- North star — `vitalcv-visual-system.md`.
- Roadmap — `ui-implementation-roadmap.md`.
