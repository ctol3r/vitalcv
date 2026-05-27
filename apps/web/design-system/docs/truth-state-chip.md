# TruthStateChip — usage guide

The canonical chip for "what is the system reporting about this truth claim right now."

## When to reach for it

- A row in the Passport surface that displays per-source state (NPPES, OIG/LEIE, PECOS, state board).
- The Connector Matrix on `/status` (which connectors are live, which are not).
- The per-field register on `/trust/attribution`.
- Any operator-facing surface where you want a one-glance honest summary of what the system observed — without making promises about credentialing decisions.

## When NOT to use it

- For credential-tier indicators (T1–T4): use `TrustTierBadge`.
- For audit replay integrity signals: use `ReplayIntegrityBadge`.
- For OIG exclusion outcomes that need a decision artifact: use `ExclusionBadge`.
- For severity/risk scores: use `SeverityBadge` / `RiskScoreBadge`.

`TruthStateChip` is **system-state** chrome, not a decision artifact.

## The eight states

| State | Visible label | When to use |
|---|---|---|
| `source-backed` | "Source-backed" | A primary source returned a usable payload. The field is backed by that source — never claim it's "verified" in the credentialing sense. |
| `snapshot-only` | "Snapshot only" | The system holds a point-in-time read; current state may have changed since. |
| `temporarily-unavailable` | "Temporarily unavailable" | The source did not return a payload on this attempt. **System condition**, not a finding about the clinician. |
| `connector-not-live` | "Connector not live" | This connector is intentionally not running in the current build. Do **not** interpret as an exclusion clearance. |
| `access-required` | "Access required" | Authorization is needed before this lane can be read. Caller action expected. |
| `auth-required` | "Sign in to view" | Operator sign-in unlocks the live read. Public passport pages remain readable without an account. |
| `institution-review-required` | "Institution review" | This view is a reviewer-ready head start, not a final credentialing decision. |
| `demo-only` | "Demo only" | Synthetic data for demonstration. Not a real source confirmation. |

Every label was reviewed against the banned-strings list in `CLAUDE.md`:

- No bare "Verified".
- No "automatically verified", "guaranteed verification", "instant credentialing", "complete credentialing", "legally accepted", "risk transferred", "HIPAA compliant", "SOC2 certified", "NCQA certified".

The tests in `apps/web/__tests__/truth-state-chip.test.tsx` enforce this — adding a new state or editing an existing label without updating the test will fail CI.

## Visual treatments

The variant is determined by the state, not by the caller, so the same state always reads the same across surfaces:

| State | Variant | Visual intent |
|---|---|---|
| `source-backed` | `neutral` | Factual, restrained. Never alarming, never celebratory. |
| `snapshot-only` | `neutral` | Same as source-backed; the modifier ("snapshot") lives in the label. |
| `temporarily-unavailable` | `muted` | Lower contrast — signals "the system is in a transient condition", not a credential finding. |
| `connector-not-live` | `outline` | Outline gray. Quiet acknowledgement that this lane is intentionally not connected. |
| `institution-review-required` | `outline` | Quiet action outline; the next move is a human review, not a system claim. |
| `access-required` | `warning` | Restrained amber. Caller action expected; the chip is the only chip we let raise pulse. |
| `auth-required` | `outline` | Outline gray — the caller needs to sign in; we don't pretend that's an alarm. |
| `demo-only` | `outline` | Outline gray — visibly different from production states. |

If you ever feel tempted to override `variant`, ask whether the situation is genuinely a different *truth state* (in which case introduce a new state with its own canonical visual) rather than reskinning an existing one.

## Basic usage

```tsx
import { TruthStateChip } from '@/design-system/components';

<TruthStateChip state="source-backed" />
<TruthStateChip state="temporarily-unavailable" />
<TruthStateChip state="connector-not-live" />
```

## With a source label (aria-only)

```tsx
<TruthStateChip state="source-backed" sourceLabel="NPPES" />
```

This renders the same visible chip but the `aria-label` becomes:

```
Truth state: source-backed for NPPES
```

The source label never leaks into the chip's visible body; it's only there for assistive tech and for hover tooltips composed by the consumer.

## With a timestamp

```tsx
<TruthStateChip state="snapshot-only" timestamp="2026-05-27T03:18:00Z" />
```

A hidden `<time>` element is emitted alongside the chip's visible label so screen readers can announce "Truth state: snapshot only, 2026-05-27 03:18 UTC". The visible chip stays terse — surface timestamps in the *row*, not in the chip.

## Compact size

```tsx
<TruthStateChip state="source-backed" size="sm" />
```

Use `size="sm"` inside compact tables or legends where the default `md` chip would crowd. The default size is `md`.

## Custom label override

```tsx
<TruthStateChip state="access-required" label="Sign in required" />
```

If your surface demands a different label *for this one render*, pass `label`. You are responsible for copy review — the test suite cannot catch a banned-string violation passed at runtime.

## Use with the legend

```tsx
import { TruthStateLegend } from '@/design-system/components';

// Default: 5-row Passport legend
<TruthStateLegend />

// Or with optional heading
<TruthStateLegend heading="What these tags mean" />

// Full 8-row legend (use on /status, /trust/attribution)
<TruthStateLegend rows="all" />

// Custom subset, e.g. for an employer review surface
<TruthStateLegend
  rows={[
    { state: 'source-backed' },
    { state: 'institution-review-required', meaning: 'Reviewer-ready head start; institution makes the final call.' },
  ]}
/>
```

The default 5-row Passport legend matches Wave H's specified Passport vocabulary:

1. **known** → `source-backed`
2. **source-backed where available** → `snapshot-only`
3. **unavailable / gated** → `temporarily-unavailable`
4. **awaiting institution review** → `institution-review-required`
5. **next step** → `access-required`

## Migration notes

If you currently render an ad-hoc `<span>Unavailable</span>` on a source row, swap it for `<TruthStateChip state="temporarily-unavailable" />`. If you currently render bare `>Verified<` (banned!), swap it for `<TruthStateChip state="source-backed" />` and update any tooltip / accessibility text to drop the "Verified" word.

`LaneStateBadge` continues to live in the design system for the ops-lane vocabulary (checked / pending / access / blocked / contradicted / unknown / info). The two systems are complementary, not redundant — `TruthStateChip` is *what the public sees*; `LaneStateBadge` is *what ops sees*.

## Where this is enforced

- Component: `apps/web/design-system/components/TruthStateChip.tsx`.
- Legend: `apps/web/design-system/components/TruthStateLegend.tsx`.
- Public re-export: `apps/web/design-system/components/index.ts`.
- Tests: `apps/web/__tests__/truth-state-chip.test.tsx`.
- Banned-string list (mirrored): `CLAUDE.md` "Banned strings" section.
