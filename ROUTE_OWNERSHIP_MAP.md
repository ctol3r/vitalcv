# Route Ownership Map — Next App Boundaries

**Generated**: 2026-05-13
**Question**: which Next app (`apps/web` vs `apps/marketing`) owns each verifier-continuity route?
**Companion doc**: [`APEX_DEPLOYMENT_FORENSICS.md`](./APEX_DEPLOYMENT_FORENSICS.md) — proves apex (`vitalcv.com`) deploys `apps/web`

---

## TL;DR

| Route | Owner | Reaches apex? | Status on `origin/main` |
|---|---|---|---|
| `/.well-known/jwks.json` | `apps/web` | ✅ when #349 merges | absent (lives at `/api/.well-known/jwks.json` only) |
| `/.well-known/did.json` | `apps/web` | ✅ when #349 merges | absent |
| `/.well-known/openid-credential-issuer` | `apps/web` | ✅ when #349 merges | absent |
| `/.well-known/openid-configuration` | `apps/web` | ✅ when #355 merges | absent |
| `/.well-known/trust-register` | `apps/web` | ✅ when #349 merges | absent |
| `/trust` | `apps/web` | ✅ when #355 merges | absent |
| `/verify` | `apps/web` | ✅ when #345 merges | absent on apex; **the same path exists in `apps/marketing/app/verify/[shareId]` but that route lives on a different Vercel project, different domain** |
| `/passport` | `apps/web` | ✅ already on apex | present (degraded — see §6) |
| `/api/receipt/[npi]` | `apps/web` | ✅ when #349 merges | absent |
| `/api/receipt/by-lineage/[lineageKey]` | `apps/web` | ✅ when #355 merges | absent |
| `/api/health` | `apps/web` | ✅ already on apex | present (response shape proves apex = web) |

**Every single institutional verifier route lives in `apps/web`. None live in `apps/marketing`. The institutional convergence work targets exactly the runtime that apex deploys.**

---

## §1 — Apps under inspection

The repo defines two Next applications (per `package.json` `workspaces: ["apps/*", ...]`):

| App | Package name | Has `next.config.mjs`? | Has `app/` dir? |
|---|---|---|---|
| `apps/web` | `@vitalcv/web` | ✅ | ✅ |
| `apps/marketing` | `@vitalcv/marketing` | ✅ | ✅ |

The other workspace entries under `apps/*` (`admin-api`, `api`, `authz`, `docs`, `issuer-api`, `lib`, `mobile`, `router`, `sample-api`, `status-api`, `verifier-api`) are NOT Next apps — they are Express services, mobile (Expo), shared libraries, or empty scaffolds. None deploys to apex via Vercel.

**Only `apps/web` and `apps/marketing` could possibly serve apex.** Per the apex-forensics doc, apex is `apps/web`.

---

## §2 — Per-route ownership (verified by filesystem)

For each route the brief enumerated, both apps were checked:

```
Route                                         apps/web    apps/marketing
─────────────────────────────────────────────────────────────────────────
/verify                                       HAS         HAS (different concept — see §3)
/trust                                        HAS         —
/passport                                     HAS         —
/.well-known/jwks.json                        HAS         —
/.well-known/did.json                         HAS         —
/.well-known/openid-credential-issuer         HAS         —
/.well-known/openid-configuration             HAS         —
/.well-known/trust-register                   HAS         —
/api/receipt (any sub-path)                   HAS         —
```

**Eight of nine routes are exclusive to `apps/web`.** Only `/verify` exists in both, but the two implementations are unrelated (see §3).

---

## §3 — `/verify` collision analysis

Both apps have a top-level `/verify` route, but they own DIFFERENT things:

### `apps/web/app/verify/page.tsx` — institutional trust inspection (Wave 9 #345)

Single file, 14,308 bytes. Server component that:
- Takes `?npi=<10-digit>` query param
- Fetches the passport from the backend via `BACKEND_URL/api/passport/npi/<npi>`
- Renders the full institutional reading order using Lane B primitives (TrustHeader, ReplayLineage, IssuerAttribution, DegradedStateBanner, TierBadge, CheckedAtStamp, RunIdentity)
- Designed for hospital verifier / NCQA auditor / Joint Commission reviewer / verifier engineer to inspect a clinician's trust posture

### `apps/marketing/app/verify/[shareId]/page.tsx` — marketing share-link viewer

Different file path (`/verify/[shareId]` vs `/verify`). Server component that:

```ts
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { logEvent } from "../../../lib/events";

interface Props {
  params: Promise<{ shareId: string }>;
  searchParams: Promise<{ organizationId?: string | string[] }>;
}
```

This is a share-link consumption surface — a clinician shares a `shareId`, the marketing site renders a sanitized public view. Same word "/verify" in the URL, completely different domain of concern.

### How the apps don't collide

Because each app is on its **own Vercel project** at its **own domain**, the two `/verify` routes never see each other:

- `https://vitalcv.com/verify` → resolves through `apps/web` (apex)
- `https://<marketing-domain>/verify/<shareId>` → resolves through `apps/marketing` (separate domain)

No path conflict at deployment time. The institutional verifier inspection page in #345 has no overlap with the marketing share-link viewer.

---

## §4 — `apps/web` exclusive routes (per §2)

Every institutional verifier surface in the merge queue is **uniquely owned by `apps/web`**. The marketing app does not have any:

- `/.well-known/*` discovery surfaces (only `apps/web` has `app/.well-known/`)
- `/trust` overview page
- `/passport`, `/passport/[id]` (clinician readiness)
- `/api/receipt/*` (receipt endpoints)
- `/api/health` runtime probe
- `/api/passport/*` proxies to backend
- `/holder/*`, `/verifier/*`, `/issuer/*` role-gated app stacks

This means: there is no way the institutional verifier work could be "accidentally deployed" to the marketing site. Every PR in the merge queue (#338–#357) modifies `apps/web` or files outside both Next apps (backend, packages, docs, scripts). **The institutional convergence work targets exactly the runtime that apex deploys.**

---

## §5 — `apps/marketing` exclusive routes

For completeness, the marketing app owns:

```
/                      ← marketing homepage
/clinician             ← marketing clinician landing
/contact               ← contact form
/demo, /demo/dashboard, /demo/verify, /demo/wizard ← demo flows
/how-it-works          ← marketing
/internal, /internal/metrics ← internal dashboards
/progress, /security   ← marketing pages
/verifier              ← marketing verifier landing
/verify/[shareId]      ← share-link viewer (see §3)
/api/{artifact,contact,demo,internal,npi,pilot,share} ← marketing's own API
```

These routes are **invisible to apex**. They live on the marketing Vercel project's domain only. No institutional verifier surface is among them.

---

## §6 — Apex `/passport` current state (degraded, but reachable)

The user's earlier external probe of `https://vitalcv.com/passport?npi=1346053246` showed all four source lanes returning Unavailable / Unknown. **That route is owned by `apps/web` and IS on `origin/main`** — it's reachable on apex today.

The failure mode is NOT route-ownership; it's two cascading issues:

1. **Production Railway DB has no seed for that demo NPI.** The seed was inserted into local `vitalcv_dev` only (per `prisma/seed-demo-clinician-macie.ts` from the canonical-runtime convergence work earlier this session). Production never received this seed.
2. **Apex Clerk env is misconfigured** (per `APEX_DEPLOYMENT_FORENSICS.md` §5). `/api/health` reports `clerk.enabled: false, mode: "none"`. The `/passport` page itself is public (matches `isPublicRoute()`), so it renders — but any internal API calls that try authenticated-only paths to the backend would fail.

Both are operator-side. No PR ownership change required.

---

## §7 — Verified by live probe

The apex-forensics doc captured the definitive probe:

```bash
$ curl -s https://vitalcv.com/api/health
{
  "status": "ok",
  "service": "web",      ← apps/web returns this; apps/marketing has no /api/health
  "timestamp": "2026-05-13T03:17:45.771Z",
  "config": { "apiBase": false, "clerk": { "enabled": false, "mode": "none" }, "sentry": false }
}
```

`service: "web"` is hardcoded in `apps/web/app/api/health/route.ts`. The marketing app has no `/api/health` handler. **Apex deploys `apps/web`. Confirmed.**

---

## §8 — What this means for the merge queue

Every one of the 20 in-flight session PRs that adds a route adds it to `apps/web`:

| PR | New routes in `apps/web` |
|---|---|
| #345 | `/verify` |
| #347 | `/api/track/apply` |
| #349 | `/.well-known/jwks.json`, `/.well-known/did.json`, `/.well-known/openid-credential-issuer`, `/.well-known/trust-register`, `/api/receipt/[npi]` |
| #355 | `/.well-known/openid-configuration`, `/trust`, `/api/receipt/by-lineage/[lineageKey]` |

**Zero new routes in `apps/marketing`. The institutional convergence work targets `apps/web` exclusively.**

When Vercel auto-deploys `origin/main` after the merge train, the new routes land on apex automatically. No project-rebinding, no domain reconfiguration, no migration is required — the routes are in the SAME app that already serves apex.

---

## §9 — Summary table

| Question from brief | Answer |
|---|---|
| Which app owns `/.well-known/jwks.json`? | **`apps/web`** (`apps/web/app/.well-known/jwks.json/route.ts` after #349) |
| Which app owns `/.well-known/did.json`? | **`apps/web`** (`apps/web/app/.well-known/did.json/route.ts` after #349) |
| Which app owns `/trust`? | **`apps/web`** (`apps/web/app/trust/page.tsx` after #355) |
| Which app owns `/verify`? | **`apps/web`** for the institutional inspector (`apps/web/app/verify/page.tsx` after #345); `apps/marketing` owns `/verify/[shareId]` (share-link viewer) on a separate domain |
| Which app owns `/api/receipt/[lineageKey]`? | **`apps/web`** (mounted at `apps/web/app/api/receipt/by-lineage/[lineageKey]/route.ts` after #355; brief's bracket-only path was renamed for Next-slug-collision reasons) |
| Which app owns `/passport`? | **`apps/web`** (already on `origin/main` — `apps/web/app/passport/page.tsx` + `apps/web/app/passport/[id]/PassportEntityClient.tsx`) |
| Which app does Vercel currently deploy to apex? | **`apps/web`** — verified by `/api/health` returning `service: "web"` |

**Every named route belongs to `apps/web`. Apex deploys `apps/web`. The institutional convergence work merges into the runtime that already owns apex.**

---

**Maintainer**: this document captures route ownership at audit time
(2026-05-13). If a future PR moves a route between apps (highly
unusual), regenerate this map and update the merge readiness audit
accordingly.
