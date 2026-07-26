# VitalCV DESIGN_SYSTEM.md — Canonical · Wave 1505 (DG-18.1)

> **The single source of truth.** Supersedes `wave1500/DESIGN_SYSTEM.md` and all scattered doctrine. Token files: `01-primitives.css` → `02-semantic.css` → `03-themes.css`, imported in that order. Components consume **semantic (`--vt-*`) tokens only** — raw scales and raw hex are lint-illegal outside the token files (LINT-01).
>
> Self-sufficiency test: a new designer should produce an on-system page from this document alone. If they can't, this document is the bug.

---

## 1. Palette

Paper + ink editorial. **Light only on public routes** — dark (`[data-theme="ops"]`) is operator-surfaces-only.

| Token | Value | Role | Rule |
|---|---|---|---|
| `--vt-surface-page` | `#f4f2ec` | Page paper | Every public page. `<meta theme-color>` = paper. |
| `--vt-surface-card` | `#ffffff` | Raised card | Rule borders, never shadows (one hover-lift exception). |
| `--vt-surface-sunken` | `#efede7` | Sunken wells | Skeletons, code chips, input wells. |
| `--vt-text` | `#141414` | Ink | Body, primary buttons, strong rules, focus. The workhorse. |
| `--vt-text-secondary` | `#474540` | Support copy | 4.5:1 on paper. The darkest "gray" allowed for prose. |
| `--vt-text-muted` | `#6b6860` | Captions | ≥12px only. Never body text. |
| `--vt-text-faint` | `#96938a` | Eyebrows/metadata | Mono ≥10px only. Never sentences. |
| `--vt-rule` / `-soft` / `-strong` | `#dddbd3` / `#eceae4` / `#141414` | Hairlines | Paper separates with rules, not shadows. |
| `--vt-brand` | `#2c3e2d` (matcha 800) | THE accent | Recognition moments, brand chips, primary-button hover. Never body text, never large fills outside Recognition. |
| `--vt-accent-editorial` | `#4f46e5` (indigo) | Editorial accent | Italic Fraunces display phrases ONLY, ≤1 per section headline. Nowhere else. |

**Accent decision rationale (recorded):** one brand accent, and it's matcha — a warm institutional green that can whisper. Trust Blue and teal were killed in wave 1500: two accents made every state hue read as "brand," and blue specifically collided with the `previewOnly` state family. Indigo survives only as a typographic voice (italic display phrases), never as a UI color — that's why it has no `-bg`/`-rule` variants and never appears on interactive elements. If a surface needs "more color," the answer is a truth-state chip with a reason to exist, not a second accent.

## 2. Truth states — 9 coverage states + 2 review states

One semantic set (`--vt-state-{name}` / `-bg` / `-rule`). **Glyph + label always paired** — grayscale legible by construction. Dashed border = degraded/preview semantics, everywhere, never reduced opacity.

| State | Text hex | Glyph | Border | Meaning |
|---|---|---|---|---|
| checked | `#1c5c38` | solid check | solid | Source-backed, within freshness threshold |
| stale | `#7d5a1e` | clock | solid | Past freshness threshold; refresh available |
| pending | `#3f3d38` | dashed circle | **dashed** | Check in flight |
| gated | `#7d5a1e` | lock | solid | Source requires enrollment/agreement |
| unavailable | `#3f3d38` | slash | solid | Source down or out of scope |
| accessRequired | `#7d5a1e` | key | solid | Holder must grant access |
| reviewRequired | `#7d5a1e` | eye | solid, white bg | Human review before decision-grade |
| notDecisionGrade | `#3f3d38` | asterisk | solid, white bg | Informational only |
| previewOnly | `#1a3e6b` | ghost outline | **dashed** | Anonymous preview plane |
| p0 (review) | `#7a1414` | triangle-bang | solid | Blocks readiness until resolved |
| contradicted (review) | `#5b2a86` | diverging arrows | solid | Sources disagree; both values shown |

## 3. Proof tiers T1–T4

Filled-fraction square glyphs (¼, ½, ¾, full) — legible in grayscale. T1 self-attested · T2 source-backed · T3 reviewed · T4 signed institutional artifact. Tier states *provenance strength*; state chips state *current coverage*. Never substitute one for the other.

## 4. Type ramp

Three faces, loaded via `next/font`, self-hosted. Anything else is lint-illegal (LINT-09).

| Role | Face | Spec |
|---|---|---|
| Display h1–h3 | **Fraunces** | weight ~560, optical sizing on, `-0.015em`, `text-wrap: balance` |
| Italic accent | Fraunces italic 480 | + indigo; ≤1 phrase per section headline |
| Body | **Geist** | 14/1.6; support copy `--vt-text-secondary`; `text-wrap: pretty` on ledes |
| Eyebrow | **Geist Mono** | 10px caps, `+0.2em`, `--vt-text-faint` |
| Data | Geist Mono | NPI digits, RUN_ID, hashes, timestamps; `tabular-nums` (`.vt-num`) on ALL metrics |

Scale: `10 / 11 / 12.5 / 14 / 16 / 19 / 24 / 32 / 44 / 60 / clamp(38–68)`. Body text never below 12.5px; muted captions never below 12px… and never *as* body text.

## 5. Spacing, radius, elevation, focus

- **Space:** 4px base — `4 8 12 16 20 24 32 40 48 64 96 128`. Siblings space with flex/grid `gap`, not margins.
- **Radius:** 2/4/6px public (near-sharp). `--radius-ops: 12px` is ops-only (LINT-06).
- **Elevation:** none. Paper separates with rules. The ONE shadow is `--vt-lift` on hover (≤2px translate). Focus ring is a shadow token, not an outline: `0 0 0 2px paper, 0 0 0 4px ink` — uniform on every interactive element, both themes.
- **Container:** `--container-max: 1200px`; prose `--prose-max: 68ch`; legal body 65ch.

## 6. Z-index scale (promoted wave 1505)

`--vt-z-base 0 · raised 10 · nav 40 · banner 45 · widget 50 · overlay 60 · skip 100`. Literal z-index values are lint-illegal (LINT-05). A new stop requires a CHANGES.md entry.

## 7. Motion doctrine

- One curve: `cubic-bezier(0.2, 0.8, 0.2, 1)` (`--ease-house`). Durations 160/320/420ms.
- Single-shot entrances (`.vt-enter`: opacity + 10px rise). No scroll-triggered re-animation.
- Hover lift ≤2px. No global `*` transitions.
- **No infinite loops on public surfaces.** Exceptions, exactly two: skeleton shimmer, /status live pulse.
- All keyframes live in `motion.css` (LINT-03). Everything animated sits inside `@media (prefers-reduced-motion: no-preference)`; the reduced fallback is static except opacity fades.

## 8. Component index

All primitives live in `w15-primitives.jsx` (repo: `components/`). Local variants must be documented in that wave's CHANGES.md or promoted.

| Component | Contract | Usage rule |
|---|---|---|
| `StateChip` | state, size sm/md, tooltip = source + freshness + definition | The atomic unit. Never restyled locally; never glyph-only. |
| `TrustGlyph` | 11 states + T1–T4, currentColor, stroke 1.5 | The ONLY state iconography. Lucide via `<Icon>` for non-state UI only. |
| `ProofTierBadge` | T1–T4 + tooltip definition | Sits beside, never instead of, a StateChip. |
| `SourceRow` / `EvidenceRow` | label / mono source / chip / freshness / action (+ tier) | Groups render as description lists; blockers sort first. |
| `ReadinessRing` | `role="meter"` + aria values; band by threshold ≥80/≥50 | Band always ALSO written as text. Sweeps once. |
| `FreshnessStamp` | relative + ISO on hover; stale coloring | Every displayed fact carries one. |
| `HonestyLabel` | dotted-circle + mono line, designed | Mandatory on every illustrative number. Never fine print. |
| `HonestyPanel` | ok/watch pair at equal weight | "What you get" never renders without "what stays outside." |
| Buttons | primary ink-fill (matcha-900 hover) / secondary outline / quiet underline / destructive p0-outline | ≥44px targets at coarse pointers. Destructive = revocation only. |
| `PaperCard` | rule border, radius-2, optional lift | No stacked shadows, no nested cards >2 deep. |
| `NpiInput` / `NpiField` | 10-digit, mono cells, live count via `aria-live` | "Public identifier — not PHI" microcopy stays. |
| `RecognitionRow` | mono timestamp · employer · stamp Nº | THE reserved matcha moment. One entrance, then archival. |
| `EmptyState` (1505) | glyph frame + Fraunces line + why + ONE action | Solid rule frame — dashed is degraded's. |
| `OfflineBanner` (1505) | sticky under nav, dashed rules, `role="status"` | Never a toast; never auto-dismiss. |
| `SkeletonStack` (1505) | sunken bars + shimmer | Mirrors real layout; never invents rows. |
| `FeedbackWidget` (1505) | right-edge tab at 50vh, `--vt-z-widget` | Geometrically cannot overlap CTAs; Esc closes, focus returns. |
| Form kit (1502) | Field/TextInput/TextArea/ErrorSummary/SuccessCard | Errors: mono + glyph + `role="alert"`; success is designed, with receipt. |

## 9. Do / Don't gallery (the honesty doctrine, visually)

Rendered pairs live on `/dev/design`; the rules:

1. **DON'T** put a checkmark on a gated source. **DO** show the lock + "Gated" + the authorize action. *(A gated source with a checkmark is the system's cardinal sin — LINT-07.)*
2. **DON'T** hide an unavailable source. **DO** show slash + "Unavailable" at full opacity, dashed only if degraded.
3. **DON'T** fade degraded content to 40% opacity. **DO** use the dashed `--vt-degraded-border` + explicit state.
4. **DON'T** show a bare number for an illustrative price/metric. **DO** attach `HonestyLabel` within sight of the number.
5. **DON'T** use matcha for buttons at rest, links, or charts. **DO** reserve solid matcha for Recognition moments.
6. **DON'T** set indigo on chips, buttons, links, or body copy. **DO** use it only as the italic display phrase.
7. **DON'T** announce readiness by ring color alone. **DO** write the band ("Head-start band") next to the ring.
8. **DON'T** write "Verified ✓" on anything VitalCV didn't verify. **DO** write the state's real name ("Source-backed", "Self-attested").
9. **DON'T** style errors as toasts that vanish. **DO** use the error summary + field errors that persist until fixed.
10. **DON'T** claim success in an error state ("Almost there!"). **DO** state failure plainly: "Nothing was recorded as successful."
11. **DON'T** pad empty states with sample rows or "popular" content. **DO** say why it's empty and give ONE next action.
12. **DON'T** use dark surfaces, gradients, glass, or glow on public routes. **DO** keep dark for `[data-theme="ops"]`.

## 10. Voice

Calm, declarative, first-person plural sparingly. State facts with lineage ("read 2h ago via NPPES"), never enthusiasm ("verified instantly!"). Prohibited vocabulary (LINT-08): "cheapest", ROI guarantees, "as seen in", invented counts, "100% secure", "blockchain-verified". Errors never apologize twice and never say "oops". The boundary line appears on every funnel footer: *a head start for employer review — not a final credentialing decision.*

## 11. Accessibility contracts

- Focus ring: uniform `--vt-focus-ring`, every interactive element. Skip link on every shell, lands on `#main`.
- State never by color alone: glyph + label pairing enforced at the component level.
- `ReadinessRing` = `role="meter"`; source groups = description lists; constellation graphs get a text alternative + `aria-hidden` visuals; form errors announce via `role="alert"`; NPI/code digit counts announce via `aria-live="polite"`.
- Tap targets ≥44px at coarse pointers. No horizontal scroll from 360px up. Reduced motion: static except opacity fades.
- Findings-and-fixes log: wave1505 `#/audit`.

## 12. System pages (wave 1505)

- **Auth:** Clerk themed via appearance API (`lib/clerkAppearance.ts`) — mapping in wave1505 `#/auth`. Zero default purple; grep gate on `#6c47ff` family.
- **404:** paper, wordmark, mono path echo, "This page isn't part of the record.", one CTA home.
- **Error:** fail-closed — "Nothing was recorded as successful." + retry + logged reference.
- **Offline:** sticky dashed banner at `--vt-z-banner`; freshness stamps keep telling the truth.
- **Empty states:** gallery + rules in §9.11.
- **Legal:** one prose template (65ch, sticky TOC ≥1024px, mono stamps), four documents.
- **Pricing:** doctrine in §10 + LINT-08 pricing clause.

## 13. Governance

- `/dev/design` (wave1505 `#/dev/design`) is the living arbiter — if a surface disagrees with it, the surface is wrong.
- Visual regression: `REGRESSION_MATRIX.md` — 10 routes × 3 viewports, masked dynamics, reduced-motion captures.
- Lint: `DESIGN_LINT.md` — 10 rules, CI-blocking.
- Change control: any new token, variant, or keyframe requires a CHANGES.md entry in its wave and a promotion decision here. Baseline screenshot updates must link the CHANGES entry.

*Doctrine v1.0 · wave 1505 · A partial proof stays partial.*
