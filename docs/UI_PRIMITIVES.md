# UI_PRIMITIVES.md
# VitalCV UI Primitive Ownership

> Companion to `VCV_UI_DOCTRINE.md`. This document is the authoritative reference
> for which primitives to use, which to avoid, and how surface shells are bounded.
>
> Last updated: Wave 6 patch bundle (Waves 3–6), 2026-03-22

---

## 1. Canonical Primitives (use these)

These are the source of truth. Do not create new equivalents without updating this doc.

| Primitive | File | When to use |
|---|---|---|
| `Button` | `components/ui/button.tsx` | All standard interactive buttons (CVA + Radix Slot) |
| `ButtonPrimary` | `components/ui/ButtonPrimary.tsx` | Hero CTAs only (Framer Motion variant) — not for inline use |
| `MagneticButton` | `components/ui/MagneticButton.tsx` | Antigravity hover-pull effect on marketing CTAs |
| `Card` | `components/ui/card.tsx` | Standard content containers (light surfaces) |
| `GlassCard` | `components/ui/glass-card.tsx` | Glassmorphism containers on ops/dark surfaces |
| `Skeleton` | `components/ui/skeleton.tsx` | Standard loading skeleton |
| `Badge` | `components/ui/badge.tsx` | General status badges (default, secondary, destructive, outline, trust-*, claim-l*) |
| `ClaimBadge` | `components/ui/claim-badge.tsx` | Domain-specific: credential claim level (L0–L3) with label |
| `BadgeStatus` | `components/ui/BadgeStatus.tsx` | Animated claim-level badge with Framer Motion (use in clinician-facing surfaces) |
| `Breadcrumb` | `components/ui/Breadcrumb.tsx` | Standard breadcrumb navigation |
| `VerifierBreadcrumb` | `components/ui/VerifierBreadcrumb.tsx` | Verifier-surface breadcrumb (pre-wires Employer Dashboard root) |
| `OpsLoadingScreen` | `components/shell/OpsLoadingScreen.tsx` | Shared ops loading state — use in all `loading.tsx` under ops routes |
| `Tooltip` | `components/ui/lab/Tooltip.tsx` | Premium tooltip with trust/reason content |

---

## 2. Deprecated / Legacy (do not use)

| File | Status | Replacement |
|---|---|---|
| `components/ui/foundry-primitives.tsx` | **Deleted** (Wave 3, 2026-03-21) | `button.tsx`, `card.tsx`, `badge.tsx`, `glass-card.tsx` |
| `components/ui/lab/Skeleton.tsx` | **Deprecated** — zero imports (Wave 6, 2026-03-22) | `components/ui/skeleton.tsx` |
| `app/dashboard/cv-builder/page.tsx` | **Deprecated route** — do not link (Wave 4) | Migrate to `/holder/*` in a future wave |

---

## 3. Shell Ownership by Surface

Each surface type has exactly one shell. Pages must not import the wrong shell.

| Surface | Routes | Shell | Auth |
|---|---|---|---|
| **Public** | `/`, `/explore`, `/get-ready`, `/p/*`, `/verify/*`, `/sign-in`, `/sign-up`, etc. | `RootChrome` (Navbar + Footer) | None |
| **Clinician** | `/holder/*`, `/passport/*`, `/onboarding/*` | `HolderLayout` | `CLINICIAN` role |
| **Verifier / Employer** | `/verifier/*`, `/employers/*`, `/issuer/*` | `app/verifier/layout.tsx` (`bg-ops-gradient text-white`) | `VERIFIER` role |
| **Ops / Intelligence** | `/(intelligence)/*`, `/calibration`, `/mission-ops`, `/system-health` | `AppShell` (3-panel) or intelligence workspace — pages self-manage. `(intelligence)/layout.tsx` is a passive passthrough. | `ADMIN` or `AUTHENTICATED` |
| **Internal** | `/internal/*`, `/analytics`, `/billing`, `/status` | Minimal/bare — pages self-apply `min-h-screen bg-background` | `ADMIN` role |

### Shell rules
- Pages under `/(intelligence)/` **must not** import `Navbar`, `Footer`, or `HolderLayout`.
- Pages on public routes **must not** import `AppShell` (3-panel ops).
- The verifier layout already provides `bg-ops-gradient text-white min-h-screen` — verifier pages **must not** re-apply background via inline `style=` or `bg-vt-surface-ops-base` on their root `<main>`.
- Internal pages use `bg-background` (not `bg-white`) on their root wrapper.

---

## 4. Token Rules (enforcement)

### Forbidden in page/component JSX
```
bg-white          → bg-card or bg-background
bg-slate-*        → bg-muted or bg-card or bg-background
bg-zinc-*         → bg-muted (for UI) or bg-vt-surface-ops-base (for ops)
text-slate-*      → text-foreground or text-muted-foreground
text-zinc-*       → text-muted-foreground
text-neutral-*    → text-foreground or text-muted-foreground
border-slate-*    → border-border
border-neutral-*  → border-border
bg-[#hex]         → use a semantic token (see vitalTokens.css)
text-[oklch(...)] → use a named token class
style={{ background: '...' }} on page <main> → never; use layout or bg- class
```

### Allowed exceptions
- `bg-white/N` (opacity modifier) in glassmorphism overlays on dark ops surfaces — intentional.
- Raw hex/oklch in CSS `@keyframe` animation values in `.css` files — fine.
- Specific decorative CTA gradients (`bg-[linear-gradient(...)]`) on a single high-emphasis action button — acceptable if isolated and purposeful.

### Semantic token cheat sheet
```
text-foreground         → primary text (near-black light / near-white dark)
text-muted-foreground   → secondary/label/muted text
bg-background           → page background
bg-card                 → card / panel background
bg-muted                → subtle background (inputs, table headers, badges)
border-border           → default border
divide-border           → table/list dividers
text-vt-neutral-*       → fine-grained neutral scale (prefer semantic above when possible)
bg-vt-surface-ops-base  → ops/dark base surface
bg-ops-gradient         → ops surface gradient (layout-level, not page-level)
```

---

## 5. Blueprint Confinement

Blueprint (`@blueprintjs`) currently has **zero imports** in `apps/web`.

If Blueprint is ever re-introduced:
- **Allowed only in:** `/(intelligence)/investigations`, `/(intelligence)/graph` — dense internal workbench surfaces.
- **Never in:** public routes, clinician routes, verifier routes, internal admin pages.
- **Never use:** Blueprint `Card`, `Button`, `Tag` where VCV primitives exist.
- Any Blueprint import outside the allowed zones is a doctrine violation.

---

## 6. Antigravity Constraint on UI Additions

Before adding any new component or surface, ask:

1. **Does this resolve a blocking workflow step?** If not, it likely violates the Antigravity contract.
2. **Does removing this component break any user flow?** If not, the component may be misplaced.
3. **Is this the smallest useful version?** No speculative abstractions.
4. **Does it reuse an existing canonical primitive?** Prefer composition over new files.

See `ANTIGRAVITY.md` for the full contract.

---

## 7. What Is Now Stable (post Wave 3–6)

- ✅ `analytics/page.tsx` and `billing/page.tsx` — full token sweep, semantic tokens throughout
- ✅ All four `internal/*` pages — `bg-background`/`text-foreground`/`text-muted-foreground`/`border-border` throughout
- ✅ `verifier/inbox` — raw hex background removed, inherits from `VerifierLayout`
- ✅ Verifier breadcrumb — `VerifierBreadcrumb` wrapper, 3 pages updated
- ✅ `verifier/inbox` heading — `heading-lg text-white` consistent with all other verifier pages
- ✅ `/billing` — now gated as ADMIN in `PROTECTED_ROUTES` (was open)
- ✅ `/dashboard/*` — gated as CLINICIAN in `PROTECTED_ROUTES`, deprecated comment added
- ✅ `foundry-primitives.tsx` — deleted
- ✅ `lab/Skeleton.tsx` — deprecated (zero imports, doc entry added)
- ✅ Surface classification comment block added to `lib/auth/roles.ts`
- ✅ `(intelligence)/layout.tsx` — confirmed correct as passive passthrough

---

## 8. What Still Needs a Larger Decision

These are known gaps that require either a design decision, a dedicated wave, or product agreement:

| Item | Notes |
|---|---|
| `VerifierLayout` — no sidebar | Doctrine §9 item: add `PortalSwitcher` to verifier shell when employer product is further defined |
| `dashboard/cv-builder` route | Needs migration to `/holder/*` — route exists and is clinician-gated but is a dead-end |
| `ButtonPrimary` in non-hero contexts | Audit needed: replace with `Button variant="default"` where it appears outside hero CTAs |
| `lab/Skeleton.tsx` deletion | Safe to delete once confirmed zero imports in CI; annotated but not yet removed |
| `verifier/inbox` Accept CTA gradient | `bg-[linear-gradient(#10b981,#059669)]` is isolated to one button — can be tokenized if a green-action token is defined |
| ops loading screens | Audit `loading.tsx` files under ops routes to ensure `OpsLoadingScreen` is used consistently |
| Public Navbar "Intelligence" link | Doctrine §3 marks it forbidden — confirm it was removed from the current Navbar |

---

## 9. If Going Further: Linting / Enforcement Ideas

If the team wants to enforce these rules programmatically:

- **ESLint rule**: Forbid `bg-white`, `bg-slate-*`, `text-slate-*` etc. in JSX `className` strings (`eslint-plugin-tailwindcss` custom deny-list).
- **Codemod**: `jscodeshift` transform for the common `slate-` → semantic token replacements.
- **Visual regression**: Chromatic or Percy snapshot on `/analytics`, `/billing`, `/verifier/candidates` to catch shell drift.
- **CI grep**: `grep -r 'style.*background.*#' apps/web/app` as a pre-commit hook to catch raw hex inline styles.
