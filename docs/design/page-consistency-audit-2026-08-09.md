# VitalCV page consistency audit — 2026-08-09

Read-only audit of **every page route** on `vitalcv.com`, measured against
`VITALCV_EXPERIENCE_CONSTITUTION.md` (EC-n, R2 numbering). The UI PR freeze
(EC-0) is in effect; the audit changed no code, and the one fix carried
alongside it (F9) is a route gate, not visual work.

**Truth source:** production `https://www.vitalcv.com` at commit `e93809aa`,
which `/api/version` confirms is identical to `origin/main` — so every finding
below is actionable against mainline, not a deploy-lag artifact.

**Companion to** `current-ui-inventory.md` (2026-08-08, commit `77d4630`, 47
surfaces). 67 commits landed between the two. This audit widens coverage from 47
to the full route universe and adds cross-page dimensions the inventory did not
measure (heading structure, panel radius census, register/ground, per-route
chrome resolution, metadata collisions, redirect hygiene).

**Evidence + reproduction:** `design-lab/page-consistency-2026-08-09/`
(`probe.mjs` → `probe-main.json`; `audit-capture.mjs` → `audit-full.json`;
`analyze.mjs`; `chrome-expect.mjs`). Capture at 1440×900 and 390×844.

---

## Scope — what "all pages" resolved to

| Class | Count | Notes |
|---|---|---|
| Page routes on `origin/main` (excl. `_archive`) | **135** | 97 further routes sit under `app/_archive/` and are not served |
| Reachable, HTTP 200 | 53 | |
| — of which client-redirect to another surface | 4 | `/onboarding/{fetching,identity,readiness}` → `/onboarding`; `/auth/resolving` → `/sign-in` |
| **Distinct public surfaces audited** | **49** | full DOM audit, both viewports |
| Auth-gated (307 → `/sign-in`) | 56 | **not visually audited** — see Gap below |
| 404 — deliberately gated | 19 | `/design/*` (layout gate, `isDesignPreviewAllowed`), `/dev/*` (per-page `notFound()`), `/matcha/{hospitals,investors,recruiters}` (`MATCHA_BUYER_PAGES` flag, default false) |
| 404 — dynamic, probed with a nonexistent id | 7 | route exists; no such record. Not drift |

The 19 gated 404s are **correct behaviour, not rot** — each carries an explicit,
documented gate. They are excluded from findings.

---

## What is genuinely consistent (protect this)

1. **The eyebrow holds.** `header.vcv-eb`, **64px, `position: sticky`, on 45/45
   registered surfaces** — one continuous instrument, one height, no exceptions.
   This satisfies EC-10's structural form and matches the EC-20 verdict
   reference (64px desktop) exactly. This is the strongest alignment in the
   product.
2. **One body typeface.** Geist Sans on 53/53 surfaces.
3. **One ground.** `rgb(240,238,233)` (`#F0EEE9`) on 53/53 — zero register
   splits, zero stray dark surfaces.
4. **One shared footer.** 8-link footer on 42 surfaces; `/` composes its own by
   documented design.
5. **Panel geometry is mostly on-spec.** 381 of 474 measured panels render
   radius 0–3px (EC-20 locked).
6. **No horizontal scroll at 390px on any of the 49 surfaces** (EC-6).
7. **The global `*` transition rule is gone.** The 2026-08-08 inventory measured
   `.28s` on every page; it is now `0s` on all 53. Fixed since.
8. **Navigation is honest.** All 19 hrefs in `navDestinations.ts` resolve 200,
   and the single anchor target (`#how-it-works`) exists on `/`.
9. **EC-3 hard truth bans are clean.** No "HIPAA compliant", "SOC2 certified",
   "instant credentialing", "guaranteed verification", "risk transferred", or
   bare `Verified` as a status anywhere on the 49 surfaces. The truth contract
   is holding — with the one exception at F3.

---

## Findings

Ranked. **Class A** clauses and **locked EC-20 rows** are rejection law (EC-21);
Class C items are design-review findings requiring named rationale.

### F1 · Display typography is split ~50/50 against a locked EC-20 row — *rejection law*

The h1 typeface differs page to page:

| Face | Distinct pages | Examples |
|---|---|---|
| **Fraunces** | 22 | `/employers`, `/trust`, `/status`, `/pilot`, `/verify`, `/pricing`, `/privacy`, `/terms`, `/onboarding`, `/explore`, `/for/*`, `/directory/[npi]` |
| **Geist Sans** | 21 | `/`, `/demo`, `/docs`, `/sign-in`, `/sign-up`, `/evidence-network`, `/review`, `/packet/[entityId]`, `/search/[entityId]` |
| **Geist Mono** | 4 | `/status/technical`, `/trust/attribution`, `/trust/doctrine`, `/dev/graph/[entityId]` |
| none (no h1) | 2 | see F4 |

EC-20 locks display and body to **Geist**, with **Geist Mono** for machine facts.
**Fraunces appears nowhere in the locked table.** It is era-5's choice, and
`current-ui-inventory.md` §1 already recorded that "what remains open is the
*faces* decision" — the verdict has since closed it. Roughly half the product
renders a display face the locked row excludes.

Compounding it, **10 distinct h1 sizes** ship: 14, 16, 24, 30, 33.6, 34, 36, 40,
48, 68px. EC-20 locks hero h1 at **44–52px desktop**. Only `/` (48px) sits in
band; six surfaces render 68px and the largest cluster (12 pages) renders 24px.

This is the single largest visual inconsistency in the product.

### F2 · The EC-9 vocabulary ban is broadly unenforced — *Class A invariant*

**38 phrase×page hits across 20 surfaces**, in customer-facing copy:

| Banned noun | Pages | Sample |
|---|---|---|
| `packet` | 15 | `/employers`, `/concierge`, `/demo`, `/explore`, `/onboarding`, `/pricing` |
| `lane` | 8 | `/status` — "NPPES Identity · **Lane** wired and returning data" |
| `provenance` | 4 | `/clinician/profile`, `/for/payer`, `/for/staffing-exchange` |
| `artifact` | 3 | `/pilot` — "a sha256 **artifact** hash" |
| `evidence network` | 2 | `/demo`, `/evidence-network` |
| `recognition` | 2 | `/evidence-network`, `/professional-growth/[entityId]` |
| `passport` | 2 | `/pricing` — "clinician **passport** readiness path"; `/packet/[entityId]` |
| `holder` | 1 | `/evidence-network` — "entered by **holder**" |
| `dossier` | 1 | `/for/staffing-exchange` — "See a clinician **dossier** in 10 minutes" |

**Root cause, and why this is not a discipline problem:** EC-9 assigns the
machine-checkable subset to `scripts/copy-rules.json` under UX-16.
**That file does not exist on `origin/main`.** There is no gate, so the ban has
only ever been advisory. Every other objective EC-23 contract that *does* have a
gate (design-lint, route guards, public-surface registry) is holding.

### F3 · `NPDB` renders customer-facing on `/evidence-network` — *Class A, EC-3*

The page renders:

> UNAVAILABLE · **NPDB** — no payload · *The source did not return…*

EC-3 bans `NPDB` as a customer-facing noun outright, and the surrounding phrasing
implies a read was attempted against a source VitalCV is not integrated with.
This exact item was flagged in `current-ui-inventory.md` (2026-08-08) and is
still live 67 commits later.

### F4 · Two public pages ship with no `<h1>` — *Class A, EC-5*

`/investigate/[npi]` and `/review/[entityId]` render **zero `<h1>`** in both the
server HTML and the hydrated DOM. `/investigate/[npi]` is registered in
`PREFIX_MATCHERS` specifically as "the public diligence surface the survivability
registry declares public" — an indexable public record page with no document
heading.

### F5 · Three surfaces ship two `<h1>`s — *Class A, EC-5*

`/sign-in`, `/sign-up`, and `/auth/resolving` (which redirects into `/sign-in`)
each render a page h1 plus the Clerk card's own h1:

- `/sign-in` — "Welcome back to VitalCV" + "Sign in to VitalCV"
- `/sign-up` — "Create account" + "Create your account"

Two competing document headings, and the pair reads as near-duplicate copy.

### F6 · Pills remain the de-facto state system — *locked EC-20 row*

**186 pill-shaped state markers across 20 surfaces.** EC-20 locks
"**pills retired**; near-sharp 0–3px on panels and instruments."

| Surface | Pills |
|---|---|
| `/clinician/profile` | 38 |
| `/search/[entityId]` | 19 |
| `/career-intelligence/[entityId]` | 18 |
| `/trust` | 13 |
| `/career-map/[entityId]` | 12 |

Alongside them, **93 panels render radius > 3px** — 38 at 24px, 18 at 4px, 12 at
10px, 8 each at 6px and 16px, 6 at 12px, plus 20/28/14px singletons.

### F7 · Shadowed panels on 11 surfaces — *locked EC-20 row*

EC-20 locks card grammar to "solid hairline-ruled panels, radius 0–3px,
**no shadows**". `/packet/[entityId]` and `/pilot` carry 10 shadowed panels each;
9 further surfaces carry 1–2.

### F8 · Metadata defects on five public surfaces

- **Brand doubled.** `/for/cvo`, `/for/payer`, `/for/staffing-exchange` render
  `"For CVOs — VitalCV — VitalCV"`. `lib/personas/landingContent.ts` lines 59,
  116, 173 bake `— VitalCV` into `title`, and the root template
  (`app/layout.tsx:87`, `'%s — VitalCV'`) appends it again.
- **Generic fallback title + description.** `/auth/error` and `/verify` define no
  `metadata` block at all, so both inherit the root marketing title
  *"VitalCV — Your career evidence, ready before your next job."* `/verify` is a
  real public entry point, not an interstitial.

### F9 · `/dev/graph/[entityId]` is live in production, ungated

The page's own header says *"Developer-only inspector … **Not a production
surface**"*. It is `noindex`, but it serves **HTTP 200** to anonymous visitors.
Every sibling `/dev/*` route carries an explicit `notFound()` gate, and
`/design/*` is covered by a layout gate added precisely so "a ninth reference is
gated the moment it exists". This route is the gap in that pattern.

**Scope check, so this is not overstated:** its backing APIs
(`/api/graph/:npi`, `/api/graph/:npi/trust`) return public NPPES-derived registry
data with `decisionGrade: false` — the same class already published deliberately
at `/directory/[npi]`. This is a **gating-consistency gap, not a data leak.**

### F10 · `/ops/*` auth redirects are hand-rolled three different ways

| Route | Redirect | Return destination |
|---|---|---|
| `/ops` | `/sign-in?redirect_url=/ops` | preserved, unencoded |
| `/ops/engine` | `/sign-in?redirect_url=/ops/engine` | preserved, unencoded |
| `/ops/survivability` | `/sign-in` | **lost** |

The other ~53 gated routes go through `middleware.ts`, which uses
`searchParams.set('redirect_url', pathname)` and percent-encodes correctly. A
signed-out visitor to `/ops/survivability` signs in and does not arrive where
they were going.

### F11 · 716 sub-44px touch targets on mobile — *Class A, EC-5*

Across the 49 surfaces at 390×844. EC-5 sets a 44px minimum. Worst offenders:
`/trust/technical` 30, `/career-map/[entityId]` 25, `/ecosystem/[entityId]` 21,
`/status/technical` 21, `/activity/[entityId]` 20, `/career-intelligence` 20,
`/search/[entityId]` 20, `/sign-up` 20. Comparable to the 2026-08-08 measurement
(221 across 16 mobile captures) — the rate has not improved.

### F12 · Two design-system islands coexist on most pages

`.vcv-*` (Creative Direction, era 5) on **45** surfaces; `.mz-*` (Calm Wave
paper+ink, era 4) on **18** — and the two overlap on 16. Heaviest `.mz`
concentrations: `/directory/[npi]` 130 nodes, `/pilot` 71, `/employers` 40,
`/explore` 29, `/matcha/experience` 18, `/for/*` 17 each. `matcha` classes still
render on `/matcha/experience`, where the codename is also customer-facing copy.

### F13 · The sitemap covers 21 of 49 reachable surfaces

Absent but marketing-shaped in character: `/verify/guide`, `/trust/doctrine`,
`/trust/technical`, `/status/technical`, `/concierge`, `/demo`, `/review`,
`/review/request`, `/matcha/experience`. `/concierge` was added to the public
surface registry in the 2026-08-07 headerless sweep as "a sellable offer page
nothing linked to" — it is still linked from nothing and still unlisted.

### F14 · Four public surfaces fire 401s on anonymous load

| Surface | Failing request |
|---|---|
| `/onboarding` (+ its 3 redirect children) | `/api/me/workspaces` → 401 |
| `/auth/error` | `/api/pilot-ops/events` → 401 |
| `/review/request` | `/api/pilot-ops/events` → 401 |
| `/auth/resolving` | `/api/auth/resolve-role` → 401 |

Console errors on public surfaces for every signed-out visitor. Behaviour is
correct (the routes are gated); the client calls them unconditionally.

### F15 · Two required gates verify less than their names claim

Found while checking whether CI would have caught F4 and F5. It would not have —
and the reason generalizes past this audit.

**`axe WCAG 2.2 AA`** runs `__tests__/a11y/hero-routes.test.tsx`, which scans
**hand-authored HTML fixtures** for five routes — `/`, `/pilot`,
`/clinician/profile`, `/passport/[id]`, `/employer/dashboard`. It never renders
a real page. Two public pages shipped with **zero `<h1>`** and three with
**two**, and this gate was green throughout. A fixture cannot regress, so the
gate measures the fixture author's intent, not the product.

**`Web E2E (real auth)`** is conditioned on `E2E_CLERK_PUBLISHABLE_KEY` /
`E2E_CLERK_SECRET_KEY` and **skips silently** when they are unset — emitting
`::notice::…real-auth e2e skipped` and reporting **pass**. On this PR it
"passed" in 15 seconds, which is the skip path. It is a required context on
`main`, so it contributes a green tick while asserting nothing.

Both are the same failure shape, and it is the one the merge gate already warns
about: *green CI is not evidence the code works.* Here it is worse than
uninformative, because the green sits on a **required** context and reads as
coverage. Two concrete follow-ups: point the a11y gate at rendered output
(server HTML at minimum), and make the real-auth job **fail** rather than pass
when its secrets are absent — a skipped gate should never be green.

---

## Register / ground — a note, not a finding

All 53 surfaces render the era-5 paper ground `#F0EEE9`. This is **not** a
violation: EC-20 makes dark-first warm-graphite (`#141517`) a *permitted public
register, not a mandate* (amendment 5), and the **light register's exact values
are still `PENDING UX-02`**. The product is internally consistent and has simply
not yet implemented the locked palette. Recording it so the uniformity is not
mistaken for compliance later — or for drift.

---

## Gap — 56 auth-gated routes were not visually audited

`/holder/*` (24), `/employer/*` (10), `/issuer/*` (9), `/admin/*` (3), `/ops/*`
(3), plus 7 others. Auth gating itself is consistent (all 307 → `/sign-in`,
53 of 56 with an encoded `redirect_url` — see F10).

The 2026-08-08 run reached 12 clinician surfaces using a **production
synthetic-clinician session that created and deleted a real user and org in the
production database**. I did not repeat that: it is a write to production and
needs explicit authorization. The employer tree has never been audited and
remains the recorded gap from `current-ui-inventory.md` (§Scope, UX-12).

Source-side, these surfaces run **three further navigation systems** beyond the
eyebrow — `HolderWorkspaceFrame`, `GardenShell`, and `WorkspaceNav` — plus
`AppShell`/`Sidebar`/`TopNav` for ops and a second `ui/app-shell.tsx`. Whether
they cohere can only be settled by capture.

---

## Suggested sequencing

Nothing here should ship as a standalone visual PR while EC-0's freeze holds.
Mapping to the overhaul program:

| Finding | Route |
|---|---|
| F3, F4, F5, F11 | **Freeze-exempt now** — F3 is a truth correction; F4/F5/F11 are accessibility regressions. Each still design-review gated |
| F8, F9, F10, F14 | **Freeze-exempt now** — not visual work at all (metadata, route gating, redirect hygiene, client-fetch guards) |
| F2 | **UX-16** — land `scripts/copy-rules.json`, then sweep. The gate should precede the sweep, or it recurs |
| F1, F6, F7, F12 | **UX-02 / UX-03** — these are the locked-row conformance sweep; they need the token/component convergence, not per-page patches |
| F13 | Product decision on which orphan surfaces survive (backlog P4) |
| **F15** | **Gate integrity — not design work at all.** Point the a11y gate at rendered output; make the real-auth job fail rather than pass when its secrets are absent |

**One structural recommendation.** F2 recurred verbatim from the 2026-08-08
inventory, and F3 recurred item-for-item, because neither has a gate. Every
finding class in this audit that *is* gated (design-lint ratchets, public-surface
registry liveness, route guards) either held or improved over the same 67
commits. The EC-23 objective list is the right list; the gap is that only part of
it is wired.

---

## Disposition — what is closed, and by whom

**PR #1239 (`161a5622`, merged 2026-08-09) closed most of the freeze-exempt set
independently**, and in three places went further than this audit did:

- **F3** — found **three** NPDB sites where this audit found one. The extra two
  matter more than the one recorded above: `TrustTierBadge` listed NPDB among
  the authorities a fact is "confirmed against" (a confirmed mark on a
  non-integrated source, which EC-3 forbids in the same sentence), and
  `/design/freshness` carried an "NPDB continuous query" meter.
- **The gate, not just the copy.** `check-public-claims` banned the phrase
  `NPDB cleared`, not the bare noun — which is exactly why both live violations
  passed CI. #1239 extended it to the noun and fixed a second gap it exposed:
  the comment-skipper knew `//` and `/* */` but not `{/* */}`, so explaining why
  a banned phrase was removed re-tripped the gate on the explanation.
- **F14** — removed the anonymous `pilot-ops` request from `/auth/error`, which
  this audit only recorded.

Closed by #1239: **F3, F4, F5, F8, F10, F14**. Recorded here as findings; the
remediation is theirs, and `docs/design/audit-remediation-2026-08-09.md` is its
account. Where the two converged independently on the same fix — `titleAs="h1"`
on `TrustStateCard`, a metadata-only `/verify/layout.tsx`, one shared sign-in
redirect helper — that is agreement, not duplication, and #1239's landed first.

### Still open after #1239

| Finding | State |
|---|---|
| **F9** `/dev/graph/[entityId]` ungated | **fixed here.** Untouched by #1239 and still serving 200 on production at the time of writing — the only `/dev` route with no refusal path |
| **F15** gates that verify nothing | **recorded here, not fixed.** Both gates unchanged on `main`: the a11y gate still scans fixtures, the real-auth gate still skips silently |
| **F1** display face split ~50/50 | open — locked-row conformance, UX-02/UX-03 |
| **F6** pills · **F7** shadows · **F12** era islands | open — same route |
| **F2** remainder (36 phrase×page hits) | open — wants `scripts/copy-rules.json` (UX-16) first |
| **F11** 716 sub-44px targets · **F13** sitemap coverage | open — sweep / product decision |

### What this branch carries

1. **The audit itself** — this document and `design-lab/page-consistency-2026-08-09/`
   (135-route probe, 49-surface two-viewport capture, the harness that produced
   both). Neither is on `main`; F1, F6, F7, F11, F12, F13 exist nowhere else.
2. **F9's gate**, plus a directory sweep (`dev-route-gating.test.ts`) asserting
   every `/dev` page has a refusal path. Written as an outcome, not a mechanism:
   these routes gate three legitimate ways, and pinning one spelling would fail
   honest siblings.
3. **Behavioural cover for two of #1239's fixes.** #1239 verified with live
   anonymous checks, which is real evidence but leaves nothing behind:
   `ops-signin-redirect.test.ts` drives each `/ops` page with a signed-out
   session and asserts the target it hands back, and `review-unavailable.spec.ts`
   now asserts the page owns exactly one `heading level=1` in a browser. #1239
   touched no e2e spec.

**Verification.** F9's gate proven by injection — removing the refusal path
turns that route's case red, and the first attempt at this proof was discarded
because the edit silently failed to apply and "passing" meant nothing. The e2e
assertion was run against a production server locally (2 passed); against a dev
server the whole spec times out in `page.goto` on `networkidle`, and the
pre-existing case fails identically, so it must be run production-mode — which
is what CI does.

---

## Audit trail

- **2026-08-09** — this audit. 135 routes probed; 49 distinct surfaces captured
  at 1440×900 + 390×844; 14 consistency dimensions (F15 added afterwards while
  checking whether CI would have caught F4/F5). Production `e93809aa`, which was
  `origin/main` HEAD at capture time. Auth-gated tree not captured — no
  production writes were performed. Findings recorded before any code changed.
  PR #1239 then closed F3/F4/F5/F8/F10/F14 independently; this branch was
  reduced to what that left open rather than merged as a conflicting duplicate.
- **2026-08-08** — `current-ui-inventory.md`, 47 surfaces, commit `77d4630`.
