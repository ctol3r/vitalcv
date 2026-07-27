# Route-guard drift — the gate that compares prose, patterns, and reality

**Established:** 2026-07-26
**Origin:** [#908](https://github.com/ctol3r/vitalcv/pull/908) — `/employer/*` was serving to anonymous visitors.
**Enforced by:** `scripts/check-route-guards.ts` · CI job `check-route-guards` · `pnpm check:routes`
**Baseline:** `scripts/route-guard-baseline.json`

## What went wrong

`apps/web/lib/auth/roles.ts` opens with a doctrine block classifying every
surface. It has said this since the file was written:

```
Verifier — /verifier/*, /employer/*, /issuer/*  → VERIFIER role
           NOTE: /employers (plural) is the PUBLIC acquisition page —
           it is deliberately not in PROTECTED_ROUTES.
```

The `/employer/*` pattern was never added to `PROTECTED_ROUTES`. Meanwhile
`/verifier/*` — an archived tree under `app/_archive/` that 404s — *was*
guarded. So the guard list protected a dead route and left the live employer
workspace open. Confirmed on production before the fix:

```
/employer/dashboard     200      ← plus fabricated KPIs
/employer/worklist      200
/employer/review-queue  200
/employer/candidates    200
/employer/profile       200
```

**A comment asserting a guard is not a guard.** Nothing compared the prose to
the array, and nothing compared either one to the routes actually served.

## What the gate checks

Three things must agree, and the gate checks them in both directions:

1. the routes the app serves — `apps/web/app/**/page.tsx`
2. the guard patterns — `PROTECTED_ROUTES`
3. the public declarations — `PUBLIC_ROUTE_PATTERNS`

| Rule | Meaning | Why it matters |
|---|---|---|
| `ROUTE-01` | A served route protected by nothing and declared public by nothing | The `/employer/*` hole. An undeclared route is one nobody decided about. |
| `ROUTE-02` | A guard pattern matching no served route | An orphaned guard. Harmless alone, but it makes the list *look* complete and hides gaps like `/verifier/*` did. |
| `ROUTE-03` | A `ROLE_LANDING` target that is not a served route | Post-login 404. The guard makes the route 307 while signed out, so signed-out testing looks healthy. |

The script **imports the real arrays** rather than re-parsing them, so it reads
the same source of truth the middleware does and cannot drift from a regex.

### Protection is not only `PROTECTED_ROUTES`

Some pages guard themselves with an inline `auth()` / `currentUser()` call in
the page or an ancestor layout — `/admin/leads`, `/admin/platform` and `/ops`
all do, and all correctly 307. The gate recognises this and counts those routes
separately. A gate that reported them as holes would be noise, and noisy gates
get ignored.

## Modes

Follows `check-design-lint`: `error` must be zero; `ratchet` is a measured
baseline that may shrink but never grow. All three rules are ratchets today —
a gate that is red on arrival teaches everyone to ignore it.

**Baselines are lists, not counts.** A count tells you the gate went red; a
list tells you which route did it, and makes the baseline a reviewable
inventory of known drift where an appearing or disappearing entry is a visible
line in the PR diff.

Paying down debt requires updating the baseline — the gate fails if a baselined
item is gone, so a fix cannot silently un-ratchet and let the same drift return
later.

```bash
pnpm check:routes            # enforce
pnpm check:routes --verbose  # enforce, listing every finding
pnpm check:routes --update   # rewrite baselines (review the diff!)
```

## Baseline at establishment (2026-07-26)

142 served routes · 23 guard patterns · 4 self-guarded.

| Rule | Count |
|---|---:|
| ROUTE-01 unclassified | 76 |
| ROUTE-02 orphaned guards | 19 |
| ROUTE-03 dead role landings | 3 |

### The debt worth paying first

**`ROUTE-03` — three of five roles land on a 404 after sign-in.**

| Role | `ROLE_LANDING` target | Reality |
|---|---|---|
| `ISSUER` | `/issuer` | `app/issuer/` has only `[requestId]` subroutes — no index page |
| `ADMIN` | `/internal/metrics` | `app/internal/` does not exist |
| `AUTHENTICATED` | `/intelligence` | `app/intelligence/` does not exist |

All three return 307 to anonymous visitors because they are in
`PROTECTED_ROUTES`, which is exactly why this went unnoticed: the guard is the
only thing making them look alive. Choosing replacement landings is a product
decision, so the gate records the debt rather than guessing.

`ROUTE-01`'s 76 are mostly public marketing pages that are simply not
*declared* public (`/pricing`, `/privacy`, `/terms`, `/contact`, `/pilot`,
`/solutions`). That is low-risk but it is the same soil `/employer/*` grew in:
when nothing states intent, nobody notices a sensitive route joining the list.
Worth triaging in passes, prioritising `/admin/*`, `/clinician/*`, `/inbox`,
`/autopilot`, and the `[id]`-bearing document routes.

## Known limitation

`check-route-guards` is not yet a **required** status check on `main` — it runs
on every PR but cannot block a merge until someone with repo admin adds it to
the branch protection rule. Until then it is advisory.
