# The accessibility gate was testing fixtures, not the product — 2026-08-09

`axe WCAG 2.2 AA` is one of the 14 **required** status checks on `main`. It ran
`apps/web/__tests__/a11y/hero-routes.test.tsx`, which rendered **five
hand-written HTML fixtures** and ran axe over those.

The file said so plainly in its own comments —

> Route fixtures: representative structural HTML for each hero route.
> These are **NOT** full page renders.

— but it labelled every result with a route (`axe WCAG 2.2 AA: /clinician/profile`),
so the check reported route coverage it never had.

---

## How far the fixtures had drifted

| Fixture | Claim | Reality on 2026-08-09 |
|---|---|---|
| `HomeFixture` | `<h1>` "Credentialing visibility for the people who move healthcare" | That string appears **0 times** on the live homepage |
| `ClinicianProfileFixture` | covers `/clinician/profile` | Auth-gated — no anonymous visitor reaches it |
| `EmployerDashboardFixture` | covers `/employer/dashboard` | Auth-gated |
| `PassportFixture` | covers `/passport/[id]` | Retired surface |

Three of the five "routes" cannot be loaded by the visitor the check implies it
protects, and the homepage one describes a page that no longer exists.

## What it therefore could not catch

The 2026-08-09 page audit measured, on the real product:

- **716 sub-44px touch targets** across 49 surfaces (EC-5 sets a 44px floor)
- **two public pages with no `<h1>` at all** (`/investigate/[npi]`, `/review/[entityId]`)
- **three pages with two `<h1>`s** (`/sign-in`, `/sign-up`, `/auth/resolving`)

Every one is an EC-5 violation. Every one passed this gate, because a fixture
cannot fail for the page.

**This is not a discipline problem.** It is the `green_ci_is_not_evidence`
pattern: the check ran, went green, and measured something that was not the
product.

---

## What replaces it

Two layers, each making a claim it can actually support.

### 1. Routes — `tests/e2e/a11y-public-routes.spec.ts`

axe WCAG 2.2 AA against **20 rendered public routes**, inside the already-required
`Web E2E (Playwright)` job — so it gates immediately, with no branch-protection
change. Plus a direct measurement of the EC-5 44px floor, which axe does not
enforce (WCAG 2.2's own Target Size (Minimum) is 24px at AA; the constitution
sets a higher bar than the standard, so it has to be measured directly).

**Ratcheted.** `a11y-baseline.json` records what each route measures today, per
rule. The assertion is *never worse*: a rule appearing on a clean route fails, a
count going up fails, a count going down passes and should be committed. A gate
that is red on day one teaches everyone to ignore it — the same argument
`check-design-lint.ts` makes for its own baselines. This wave is not the wave
that pays the debt down; it is the wave that stops it growing.

**Proven by injection**, not assumed: tightening `/pricing`'s baseline to zero
fails with `new axe violation type(s) — color-contrast`; restoring it passes.

### 2. Components — `__tests__/a11y/shipped-components.test.tsx`

The required `axe WCAG 2.2 AA` job now runs this instead. It renders **real
exported components** — `RouteTrail`, `ProductChrome`, `TrustStateCard`,
`ProvenanceChipLegend` — through React, not markup written to resemble them. A
component passing in isolation is a true and useful claim; it is simply a
different claim from "the page is accessible", and the two are no longer
conflated. It also asserts each render is non-empty, so a component that renders
nothing cannot make the suite quietly vacuous.

The job **name** is unchanged (`axe WCAG 2.2 AA`) because branch protection
compares required contexts by name — renaming the job would silently drop the
requirement.

---

## What the real gate found on its first run

### A1 · State chips were completely silent to screen readers — *fixed*

`components/vital/StateChip.tsx` rendered:

```jsx
<span title={name} aria-label={name}>       {/* no role */}
  <Icon aria-hidden="true" />
  <span aria-hidden="true">{meta.label}</span>
</span>
```

`aria-label` is **prohibited on a role-less `<span>`** — the element exposes no
role that supports an accessible name, so assistive tech discards it. With the
icon and the visible word both `aria-hidden`, the chip announced **nothing at
all**. State was conveyed to sighted users only.

On `/trust` — the page whose entire job is explaining what each state means —
**seven chips were silent**.

Fixed by adding `role="img"`, which makes the composite glyph+word one labelled
object so the accessible name (state **and** attribution) is announced. Verified:
`aria-prohibited-attr` 7 → **0** on `/trust`.

This is squarely EC-4: *"Every state renders as glyph + word… Remove all color
and the screen stays fully readable and fully honest."* It was readable without
colour and unreadable without sight.

### Baseline as committed

Measured against the **CI configuration** — production build, Clerk cleared,
ephemeral receipt key — not a dev server. Two viewports, ratcheted separately
under `route@viewport` keys so fixing a desktop target cannot mask a mobile
regression:

| Viewport | Routes | Sub-44px targets | axe violation nodes |
|---|---|---|---|
| desktop 1440×900 | 20 | 253 | 25 — all `color-contrast` |
| mobile 390×844 | 20 | 251 | 25 — all `color-contrast` |

**The mobile assumption was wrong, and that is the useful part.** EC-6 and the
original audit both point at 390px as the problem viewport, so this gate was
extended expecting mobile to be markedly worse. It is not — 251 against 253. The
sub-44px debt is **not** a mobile-layout problem; it is the same controls failing
at both widths.

A sample of `/pricing` at 390px shows what they are, and none of them is noise:
the wordmark link (64×18), a primary CTA at 60×36, an icon button at 40×40,
three CTAs at 42px high — *two pixels under the floor* — and nav links at 28×24.
**Zero** were inline links inside prose, which WCAG 2.2's Target Size (Minimum)
would exempt anyway. These are real controls a few pixels short, which makes the
number both credible and cheap to reduce.

`color-contrast` is the known design-system token debt (Wave DS-contrast-1),
recorded in `docs/security/a11y-known-violations.md`. After the StateChip fix,
**no other rule fires on any covered route**.

---

## Honest limits of this gate

1. **Anonymous routes only.** Auth-gated trees 307 to `/sign-in` and would
   measure the sign-in page twenty times over. Covering them needs a session —
   the same open gap recorded in
   `docs/design/authed-navigation-audit-2026-08-09.md`.
2. **20 routes, not 49.** Chosen for CI runtime (~55s serial). The remaining
   public surfaces are unmeasured; adding them is a line in `ROUTES`.
3. ~~One viewport.~~ **Closed** — desktop 1440×900 and mobile 390×844 both run,
   keyed independently. See the measurement above: mobile is not the worse case,
   which is itself the finding.

   One measurement correction landed with it: screen-reader-only controls are
   clipped to ~1px until focused, so the skip link counted as a sub-44px target.
   Left in, **adding a skip link to a page would raise the count and fail this
   ratchet** — an accessibility improvement punished as a regression. Elements
   ≤2px in both dimensions are now excluded, which is what dropped the desktop
   figure from 273 to 253.
4. **Baseline regeneration must run `--workers=1`.** `fullyParallel` runs
   `afterAll` once per worker, and each worker knows only its own routes, so
   parallel writers drop routes they did not measure — observed live, 16 of 20
   survived. A short baseline cannot pass unnoticed (a route with no entry
   fails), but it wastes a cycle.
5. **The baseline is captured against the CI configuration** — production build,
   Clerk cleared — because that is what the gate will run against. A dev-mode
   baseline encodes a different DOM and would either flake or falsely pass; the
   first dev-mode capture measured 287 targets / 25 nodes against the 273 / 21
   the real configuration produces.

   Reproducing that configuration locally needs one non-obvious step: the
   Playwright config injects an ephemeral ES256 `RECEIPT_PRIVATE_KEY_JWK` into
   its web server, precisely so `/trust` and `/status` render their real paths.
   Serving a production build without it returns **500** on both —
   *"receiptIssuer: RECEIPT_PRIVATE_KEY_JWK is required in production"* — which
   looks like a broken page and is actually a missing harness variable.
