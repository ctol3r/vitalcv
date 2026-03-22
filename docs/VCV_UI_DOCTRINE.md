# VCV_UI_DOCTRINE.md
# VitalCV UI Doctrine

> Binding constraint. Do not ship surfaces that violate these rules without explicit approval.

---

## 1. Surface Classification

Every route belongs to exactly one surface type. Mixing surface behaviors (e.g. putting ops chrome on a public page) is a violation.

| Surface | Routes | Shell | Tone |
|---|---|---|---|
| **Public** | `/`, `/explore`, `/get-ready`, `/developers`, `/search`, `/ask`, `/documents`, `/investors`, `/partners`, `/verify/*`, `/p/*`, `/clip/*`, `/demo/*`, `/sign-in`, `/sign-up`, `/apply/*` | `RootChrome` public mode (Navbar + Footer) | Dark navy, trust-native, clinician-first |
| **Clinician** | `/holder/*`, `/passport/*`, `/onboarding/*` | `HolderLayout` (auth-gated, mobile nav) | Ops dark, credential-centric |
| **Verifier / Employer** | `/verifier/*`, `/employers/*`, `/issuer/*`, `/workspace/*` | Verifier shell (TBD, currently bare) | Ops dark, verification-centric |
| **Ops / Intelligence** | `/(intelligence)/*`, `/calibration`, `/mission-ops`, `/system-health` | `AppShell` (3-panel, no public chrome) | Ops dark, data-dense |
| **Internal** | `/internal/*`, `/analytics`, `/billing`, `/status` | Minimal/bare | White or ops |

---

## 2. Route Classification Rules

### Public Surface — what qualifies
A route is public if a clinician can meaningfully visit it *before* signing in. This includes:
- Marketing/information pages
- `/explore` (unauthenticated browse of opportunities)
- `/get-ready` (credential readiness onboarding)
- Trust verification pages (`/verify/:npi`, `/p/:npi`)
- Sign-in / sign-up flows

### Ops Surface — what qualifies
A route requires authentication AND is primarily for internal operators, investigators, or internal tooling. Key indicator: uses 3-panel `AppShell` or the intelligence data stack.

**`/mission-ops` is OPS, not public** — remove from `PUBLIC_SURFACE_PATHS`.
**`/intelligence`, `/graph`, `/findings`, `/storylines`, `/calibration`, `/system-health` are OPS** — never expose in public Navbar.

---

## 3. Navbar Rules (ANTIGRAVITY)

The public `Navbar` is the first thing a clinician or employer sees. It must:
- Show only public-facing destinations
- Never link directly to ops tools
- Have a clear primary CTA for unauthenticated users (`Get Started` / `Sign In`)
- Have a `My Workspace` entry for authenticated users

**Forbidden in public Navbar:**
- `/intelligence` (ops internal)
- `/graph` (ops internal)
- `/calibration` (ops internal)
- `/mission-ops` (ops internal)
- Any link that requires auth to be useful

**Approved public nav items (current):**
```
Home · Explore · Documents · Developers
```
*Note: "Intelligence" was erroneously added to the public nav and must be removed.*

---

## 4. Token Rules

### Colors
- Never use raw `oklch(...)` or `#hex` values in component/page JSX for background or text colors
- Use semantic CSS tokens: `bg-ops-gradient`, `bg-vt-surface-ops-base`, `text-vt-neutral-200`, etc.
- Exception: motion/animation keyframe values in CSS files may use raw oklch

**Common violations to eliminate:**
- `bg-[#080e1a]` → `bg-vt-surface-ops-base` (for ops/intelligence loading screens)
- `bg-zinc-950` → `bg-vt-surface-ops-base`
- `bg-slate-950` → `bg-vt-surface-ops-base`
- `text-[oklch(0.22_0.01_60)]` → `text-vt-surface-ops-base` or use a named token

### Typography
- Use semantic type utilities: `.heading-xl`, `.body-lg`, `.label`, `.tag`
- Do not override font-family inline unless setting monospace for code

---

## 5. Shell Rules

### Loading States
- All ops/intelligence routes must use the shared `OpsLoadingScreen` component
- Never copy-paste `bg-[#080e1a]` + spinner inline in `loading.tsx`
- Public loading states use `bg-background` (adapts to theme)

### Layout Boundaries
- Pages under `/(intelligence)/` must NOT import `Navbar` or `Footer`
- Pages on public routes must NOT import `AppShell` (3-panel ops)
- The two AppShell types (`shell/AppShell.tsx` = ops 3-panel, `ui/app-shell.tsx` = portal) serve different purposes — do not conflate

---

## 6. Owned Primitives (source of truth)

These are the canonical components. Do not create new equivalents.

| Primitive | Canonical File | Notes |
|---|---|---|
| Button | `components/ui/button.tsx` | CVA + Radix Slot. Use for all standard buttons |
| ButtonPrimary | `components/ui/ButtonPrimary.tsx` | Framer Motion variant, use only for hero CTAs |
| Card | `components/ui/card.tsx` | Standard card. Use for content containers |
| GlassCard | `components/ui/glass-card.tsx` | Glassmorphism card for ops/dark surfaces |
| Skeleton | `components/ui/skeleton.tsx` | Standard skeleton loader |
| Tooltip | `components/ui/lab/Tooltip.tsx` | Premium tooltip with trust/reason content |
| Badge | `components/ui/badge.tsx` | Status badges |
| OpsLoadingScreen | `components/shell/OpsLoadingScreen.tsx` | **New canonical.** Shared ops loading state |

---

## 7. Blueprint Confinement

Blueprint (`@blueprintjs`) currently has **zero imports** in the codebase. 

If Blueprint is ever re-introduced:
- Confine it to dense internal workbench surfaces only (`/(intelligence)/investigations`, `/(intelligence)/graph`)
- Never import Blueprint in public-facing or clinician-facing routes
- Do not use Blueprint layout primitives (Card, Button) where VCV primitives exist

---

## 8. ANTIGRAVITY Alignment

These rules enforce the ANTIGRAVITY motion principle — clinicians flow into value, not into dashboards.

- Clinicians land on `/explore` or `/get-ready`, never `/dashboard`
- The `/dashboard` route is legacy/experimental — do not promote it
- The public Navbar CTA for unauthenticated users must point to `/get-ready` or `/explore`, not `/dashboard`
- Authenticated clinicians are directed to `/holder/home` — their workspace, not a generic dashboard
- The explore surface is public-first by default

---

## 9. What Needs to Happen Next (Backlog)

1. Add a dedicated `VerifierLayout` shell for `/verifier/*` (currently bare)
2. Unify the two Skeleton files (deprecate `ui/lab/Skeleton.tsx`, consolidate to `ui/skeleton.tsx`)
3. Deprecate `dashboard/cv-builder` or move it into `/holder/*`
4. Audit `PUBLIC_SURFACE_PATHS` — remove `/mission-ops`, add any missing clinician-facing prefixes
5. Add `PortalSwitcher` to verifier/employer shell
6. Replace `ButtonPrimary` usage in non-hero contexts with `Button` variant="default"
7. Add surface metadata (RSC metadata per layout) for all non-public routes
