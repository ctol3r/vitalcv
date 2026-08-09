# VitalCV authed-tree navigation audit — 2026-08-09

Closes the gap recorded at the foot of `page-consistency-audit-2026-08-09.md`:

> **Gap — 56 auth-gated routes were not visually audited.** … Source-side, these
> surfaces run three further navigation systems beyond the eyebrow … Whether
> they cohere can only be settled by capture.

That audit covered the 49 reachable public surfaces and found the eyebrow,
ground and footer strongly consistent. This one covers what it could not reach:
the signed-in product. **Source-of-truth: `origin/main` @ `7c6044463`.**

Method is static rather than visual — chrome resolution is decided in source by
a registry predicate, so it can be evaluated exactly without a session, and
without the production database write the previous run declined to repeat. What
a capture would add (spacing, type, colour on authed surfaces) is still
outstanding and named in Gaps below.

---

## Headline

**39 of 135 page routes render no shared chrome, no `<nav>` landmark, and — on
30 of them — not one in-app link.** A person who lands there can leave only by
browser-back or by typing a URL.

This includes **the entire employer console (10 routes)**, **the entire issuer
tree (9)**, **all admin surfaces (3)**, and `/ops` + `/ops/survivability`.

It is not 39 page-level oversights. It is one missing branch in one function.

---

## Root cause

`components/layout/publicSurfaceRoutes.ts` is the single chrome decision, and it
answered exactly two questions:

| Predicate | Consumers | Routes |
|---|---|---|
| `isPublicSurfacePath` | `Eyebrow`, `Navbar`, `Footer` — each returns `null` when false | 56 |
| `isOpsSurfacePath` | `RootChrome` → ops `AppShell` | 11 |

Everything else fell through both and got the bare `RootChrome` wrapper: a skip
link, a `<div id="main-content">`, and the page. `Eyebrow` and `Footer` **are**
mounted on those routes — they simply render nothing, which is why a source grep
for the components suggests coverage that does not exist. The predicate, not the
mount, is the fact.

The signed-in product was never a class. It fell into the space between two.

---

## Findings

### N1 · 39 routes with no chrome and no way out — *headline*

Measured by evaluating the registry predicates against every non-archived page
route, then scanning each orphaned page's import graph (depth 3) for a `<nav>`
or `<header>` landmark and any in-app `href`.

| Tree | Routes | With `<nav>` | With ≥1 in-app link |
|---|---|---|---|
| `/issuer/*` | 9 | **0** | **0** |
| `/employer/*` (console) | 10 | **0** | 4 (one link each) |
| `/admin/*` | 3 | **0** | **0** |
| `/ops`, `/ops/survivability` | 2 | **0** | 1 |
| `/clinician/profile` | 1 | **0** | **0** |
| `/passport`, `/passport/[id]`, `/receipt/[receiptId]`, `/snapshot/[id]` | 4 | **0** | **0** |
| `/onboarding/{fetching,identity,readiness}` | 3 | **0** | **0** |
| other (`/signup`, `/auth/*`, `/apply/[requestUri]`, `/dev/*`, `/status/technical`) | 7 | 1 | 6 |

The issuer tree is the sharpest case: nine surfaces carrying the PSV review
workflow — the sequence that produces a `PSVReceiptCandidate` — and between them
zero navigation of any kind.

Some of the tail is legitimate: `/status/technical` is a documented bucket-E
decision, `/auth/*` are interstitials, `/apply/[requestUri]` is an OAuth consent
screen that *should* have no exits. Those are now recorded as named exemptions
rather than left indistinguishable from the accidents.

### N2 · The product had no breadcrumbs at all

`components/ui/Breadcrumb.tsx` exists and is competent. Its only importer is
`components/ui/VerifierBreadcrumb.tsx`, whose only importers are under
`app/_archive/`. **Both were dead code on mainline** — zero rendered breadcrumbs
anywhere in the product.

This matters most exactly where it was missing. Eleven product routes are
dynamic (`[applicationId]`, `[requestId]`, `[receiptId]`), and on those a
pathname split cannot produce a usable trail: it yields the literal
`[applicationId]`, and it cannot know that `/employer/decision/:id` belongs
under the review queue rather than under a `decision` folder that serves no
page.

### N3 · Four navigation systems, no shared contract

| System | Where | Form |
|---|---|---|
| `Eyebrow` | 56 public routes | 64px sticky instrument bar |
| `HolderDesktopNav` + `MobileBottomNav` | `/holder/*` (24) | app bar + bottom tab bar |
| `GardenShell` | `/holder/garden/*` (6) | nested workspace shell |
| `WorkspaceNav` | entity surfaces | pill row (EC-20 retires pills) |
| ops `AppShell`/`Sidebar`/`TopNav` | 11 ops routes | sidebar console |

Five, counting the second `components/ui/app-shell.tsx`. None of them covers
employer, issuer, or admin.

### N4 · Account settings exists for one user group of four

| Group | Settings surface | State |
|---|---|---|
| Clinician | `/holder/settings` | Real. Clerk account, identity binding, sharing. Honest — its own header comment records that it exposes only wired controls, no decorative toggles |
| Employer | `/employer/profile` | Organization profile; no account/security surface |
| Issuer | — | none |
| Admin | — | none |

`/holder/settings` is the model the others lack, not a problem itself.

### N5 · Auth gating is consistent; only the redirect return is not

All 56 gated routes 307 to `/sign-in`. 53 preserve an encoded `redirect_url` via
middleware. The three hand-rolled `/ops/*` redirects remain the exception
(finding F10 of the companion audit) — `/ops/survivability` still discards the
return destination. Unchanged by this wave: it is auth behaviour, not
presentation.

### N6 · `/dev/graph/[entityId]` still has no gate — *confirms F9 independently*

Every `/dev/*` sibling carries a `notFound()`; four are env-flag gated
(`career-garden`, `compete-film`, `page-stack`, `story-rail`) and two 404 only
when their payload is absent (`matcha-deck`, `matcha-workspaces`) — a data gate,
not an environment one. `/dev/graph/[entityId]` carries **none** and serves
anonymous traffic. Reproduced on `7c6044463`, 24 hours after F9 recorded it.
Out of scope here: a route gate is an access change, not a design change.

---

## What shipped against this audit (UX-03)

The design-only boundary holds: navigation presentation and information
hierarchy changed; auth, authorization, data models, and business logic did not.
Membership in the new registry class grants chrome and nothing else — middleware
remains the only gate, and every route in it still 307s to `/sign-in` signed out.

1. **A third chrome class.** `isProductSurfacePath` — the missing branch.
   Mutually exclusive with the public and ops classes by construction.
2. **A route manifest** (`lib/navigation/routeManifest.ts`) naming every product
   surface's label and parent, so the trail is correct by construction on
   dynamic routes instead of guessing from the URL.
3. **`RouteTrail`** — the breadcrumb. Labelled `<nav>`, `<ol>`,
   `aria-current="page"`, `aria-hidden` separators, 44px targets, and a mobile
   collapse to parent + current so a five-deep trail stays one line at 390px.
4. **`ProductChrome`** — a 64px sticky bar at the eyebrow's exact geometry, so
   crossing from a public surface into the product does not move the
   instrument. It deliberately omits the eyebrow's marketing index: a person
   mid-review should not be offered `/pricing`.
5. **Mounted once** in `RootChrome`, not in four subtree layouts, so a new
   console cannot ship chromeless by forgetting a file. `/holder` keeps its own
   frame and takes the trail alone.
6. **A CI gate** (`navigation-contract.test.ts`).

### Why the gate is the important part

The companion audit's closing recommendation was structural:

> F2 recurred verbatim from the 2026-08-08 inventory, and F3 recurred
> item-for-item, because neither has a gate. Every finding class in this audit
> that *is* gated either held or improved over the same 67 commits.

So this wave ships its own. `navigation-contract.test.ts` fails when a route
resolves to two chrome classes, when a route resolves to none without a recorded
exemption, when a product route has no manifest entry, when a parent chain
cycles or dangles, or when a breadcrumb label uses EC-9 banned vocabulary.

Both failure modes were proven by injection, not assumed:

| Injected | Gate response |
|---|---|
| `app/employer/fake-console/page.tsx` (unclassified) | fails — `leaves no route without chrome unless it is exempt on the record` |
| `app/admin/unmapped/page.tsx` (classified, unmapped) | fails — `gives every product-chrome route a manifest entry` |

A first injection attempt appeared to pass; the file had landed outside the app
tree on a drifted shell path. Recording that because "the guard did not fire" and
"the guard was not reached" look identical in a green test run.

---

## Verification performed

- `vitest run` — **3942 passed, 45 skipped, 0 failed** (420 files).
- `pnpm turbo run build --filter @vitalcv/web --force` — compiled, lint and
  typecheck clean (`next.config.mjs` enforces both).
- Registry neighbours re-run explicitly: `public-surface-registry`,
  `eyebrow-chrome`, `header-chrome`, `page-density-system`,
  `holder-route-contract`, `a2-clinician-nav-model` — 337 passed.
- Dev server: `/pricing` renders `vcv-eb` and **no** `vcv-pc`/`vcv-trail` — no
  double bar, no public-surface regression.
- `/employer/dashboard` signed out → `307 → /sign-in?redirect_url=%2Femployer%2Fdashboard`.
  Gating unchanged.
- Components rendered through React at four product pathnames and captured at
  1440px and 390×812 against the shipped stylesheet.

### The golden-namespace trap, recorded

`holder-route-contract.test.ts` treats any quoted bare golden-namespace string —
**including inside a comment** — as minting a dead URL. The first implementation
failed it three ways: a `'/clinician'` entry in the prefix list, a
`startsWith('/clinician')` in a comment, and backticked `` `/clinician` `` /
`` `/activity` `` in explanatory prose. The last one also broke `/activity`,
which had been passing. Fixed by matching the namespace with a regex — the idiom
the registry already documents for `/activity` — and by writing the comments
without quoting any bare namespace.

---

## Gaps — what this audit did not settle

1. **No authed visual capture.** Chrome *resolution* is now proven exactly;
   spacing, type scale, and colour on signed-in surfaces are not. That needs a
   real session (`authed_e2e_local_recipe`: Postgres + backend + Clerk dev keys)
   or the production synthetic-clinician path, which writes to the production
   database and needs explicit authorization.
2. **The four nav systems are not yet one.** N3 is unresolved: this wave gave
   the orphans chrome and gave everything a trail; it did not converge
   `HolderDesktopNav`, `GardenShell`, `WorkspaceNav` and the ops shell. That is
   UX-03's remaining half and needs the UX-02 token convergence first.
3. **N4 (settings for employer/issuer/admin) is a product dependency**, not a
   design one — it needs account and org-governance decisions. Recorded, not
   solved. Consistent with the A6 finding that the employer IA rebuild is
   blocked on org-governance authz.
4. **N6 and F10 left open** deliberately — both are access/redirect behaviour,
   outside the design-only boundary.
5. **Page-level simplification not attempted.** The request that prompted this
   audit asked for every page to be simple and easy. Navigation was the blocking
   layer and is now addressed; per-surface information hierarchy is UX-04→13 and
   is gated on the UX-01 palette verdict. Nothing here presumes that verdict.

---

## Audit trail

- **2026-08-09 (this)** — authed tree. 135 routes classified by registry
  predicate; 39 orphans confirmed by landmark + link scan. `origin/main`
  `7c6044463`. No production reads or writes.
- **2026-08-09** — `page-consistency-audit-2026-08-09.md`, 49 public surfaces,
  production `e93809aa`.
- **2026-08-08** — `current-ui-inventory.md`, 47 surfaces, commit `77d4630`.
