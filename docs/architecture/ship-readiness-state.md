# Ship Readiness State

**Phase 8 deliverable.** The six required answers, sourced from
`product-completion-audit.md` (Phase 1) and the prior 14 audit
documents on PR #358.

## §1 — Classifications

### Shippable today (real+working, foundation-honest, or properly gated)

- `/` (homepage)
- `/pricing`, `/docs`, `/status`, `/legal`, `/terms`, `/privacy`
- `/onboarding` + the four sub-step shells
- `/p/[npi]` (public clinician profile)
- `/review/[entityId]` (public review packet)
- `/api/health`
- `/api/passport/npi/[npi]` and `/api/passport/entity/[id]`
- `/api/ingest/stream/[runId]` (SSE)
- `/api/receipts/verify` (signature oracle)
- `/api/.well-known/jwks.json` (legacy path; serves correct content, wrong media-type)
- The four PR-α/β/γ replay endpoints + 2 NPI-keyed discovery + 2 lineage-keyed proxies — when migration applies

### Degraded but acceptable (ships with honest caveat)

- `/passport`, `/passport/[id]` — degrades to "Unavailable" lanes when probe runner unscheduled. Renderable, but premium feel is currently undercut by the band reading UNKNOWN. Operator-side fix.
- `/employer/dashboard`, `/employer/worklist`, `/employer/review/[applicationId]`, `/employer/decision/[applicationId]` — exist, work for the path-coherence, but workflow completeness unverified in this audit.
- `/api/ingest/[npi]` — HTTP-200-with-fallback masquerade is a known defect. Acceptable for ship if (a) client gets the fix to branch on `fallback:true`, or (b) the fallback path is removed and real errors propagate.

### Hidden intentionally (route exists or planned but not surfaced in public nav)

- All `/admin/*`, `/internal/*` — already gated via Clerk + role allowlist.
- `/issuer/*` family — `recordedBy: 'demo'` literal; demo-grade renders. Should not appear in public nav; accessible via invite/internal link only.
- `/pilot`, `/roi`, `/calibration`, `/analytics-foundation` — internal-ish surfaces; suppress from public nav.
- The Apex `/.well-known/*` canonical verifier paths — DO NOT advertise until #349/#355 land + apex env is configured.

### Broken / blocking (must be hidden or fixed before ship)

1. `/verifier` and `/verifier/*` — directory exists, empty. Any inbound link 404s.
2. `/verify` — does not exist on main; on unmerged #345.
3. `/trust`, `/trust/doctrine` — do not exist; on unmerged #355.
4. `/compliance` — archived; live link is broken.
5. `/sign-up` vs `/signup` — two paths; pick one.
6. Authenticated surfaces (`/holder/*`, `/verifier/*`, `/issuer/*` direct nav, `/internal/*`) all redirect to a sign-in flow that has no functional Clerk backing — apex env gap.

## §2 — Required final answers

### 1. What can ship TODAY?

A coherent **public clinician readiness preview** product:

- Marketing surfaces (`/`, `/pricing`, `/docs`, `/status`, `/legal`) — all foundation-honest copy already.
- Clinician onboarding flow (`/onboarding`) — no auth required, foundation-honest.
- Passport flow (`/passport?npi=...` → `/passport/[id]`) — renders progressively via SSE; degrades to "Unavailable" lanes until probe runner scheduled.
- Public clinician profile (`/p/[npi]`).
- Public review packet (`/review/[entityId]`).
- Replay reader API (`/api/replay/...`, `/api/lineage/...`, `/api/receipt/by-lineage/...`) — institutional partners can discover continuity once data flows in.

### 2. What must be hidden before shipping?

- Every navigation link to `/verifier`, `/verifier/*`, `/verify`, `/trust`, `/trust/*`, `/compliance`.
- Direct links to demo-grade `/issuer/*` flows in public nav (keep accessible by direct URL for invited reviewers).
- Any copy that names `/.well-known/jwks.json` (canonical, absent) as the discovery surface — until #349 lands, only `/api/.well-known/jwks.json` works.
- Either `/sign-up` or `/signup` — pick one and 301-redirect the other.

### 3. What still breaks trust?

- The `LaneHealthMount` band shows "Unavailable" on every passport view today (probe runner unscheduled). For a verifier-readability product, this is the most visible defect — operator-side fix.
- Apex `clerk.enabled: false` → any "Sign in" CTA dead-ends in a redirect loop.
- `/api/ingest/[npi]` masking failures as HTTP 200 with `fallback:true` → the client throws cryptically instead of showing a clean degraded state. Visible to users hitting the homepage NPI submit.
- Mismatch between in-stream `SourceRow` "Unavailable" (transient SSE state) and `LaneHealthMount` "Unavailable" (band state) — same word, two different causes, user confusion.
- The legacy JWKS path emits `application/json` not `application/jwk-set+json` — silent for casual users, real defect for RFC-strict verifier clients.

### 4. What surfaces are operationally believable?

- `/onboarding` — clearest case; pure render, foundation-honest copy, no infrastructure dependency.
- `/status` — foundation-honest copy. Source-health band is empty (probe runner gap) but the page itself doesn't overclaim.
- `/docs`, `/pricing` — foundation-honest copy.
- Homepage `/` — NPI submit handoff works.
- Replay reader endpoints (when migration applied) — JSON contracts are stable and externally navigable per `live-replay-discoverability-audit.md`.
- `/api/health` — emits the actual config posture.

### 5. What is the actual MVP?

**"Clinician readiness preview, source-honest."**

- A clinician (or their employer) types an NPI on the homepage.
- The system fetches public data (NPPES + OIG + PECOS), renders progressive lane statuses, and stops there.
- No claim of completed credentialing, no claim of compliance certification, no implied risk transfer.
- Receipts are emitted in a verifiable JSON form (legacy `/api/receipts/verify`); institutional clients can hit the replay readers post-#361-migration-applied.
- All "advanced" surfaces (canonical verifier discovery, Lane B trust primitives, /trust overview page) are hidden from public nav.

That is the truthful product today. It is shippable behind one
operator pass (env + cron + seed = ~50 min) plus 6 small
hide-or-fix PRs (broken-link cascade).

### 6. What should NOT be built yet?

Per your direction "NO NEW SYSTEMS UNLESS REQUIRED FOR SHIP":

- **DO NOT build** new replay architecture beyond α/β/γ that already shipped.
- **DO NOT build** continuity reconciler endpoint yet.
- **DO NOT build** UI primitives for trust pages on a branch that depends on #355.
- **DO NOT build** receipt-issuance-by-jti persistence yet.
- **DO NOT** generate further convergence/synthesis/doctrine docs (this Phase 8 doc + the Phase 1 audit are the closing of that thread).
- **DO NOT** wire the replay writer into additional ingest sites beyond `ingestOrchestrator` yet — wait until the existing wiring proves stable in production.
- **DO NOT** open new feature waves until the broken-link cascade (item §1 "Broken/blocking" above) is closed.

The shortest path from "audit complete" to "shipped" is:
**operator pass → 6 small hide-or-fix PRs → merge train (#345/#349/#355 if those become priorities) → ship.**

No architecture between here and there.

## §3 — Recommended next 6 PRs (in priority order)

1. **Hide-or-fix `/verifier` empty dir.** Either populate with a placeholder "Coming soon" page or remove all inbound nav links. 1 file change in nav component.
2. **Hide-or-restore `/compliance`.** Either copy the archived page back or remove all marketing-copy links. Touch: marketing copy + footer nav.
3. **Resolve `/sign-up` vs `/signup` duplication.** Pick one; add a redirect from the other. 1-line in `next.config.mjs` redirects array.
4. **Fix `/api/ingest/[npi]` client branch.** `apps/web/lib/api.ts` `startPublicIngest` must check `fallback:true` before parsing as a normal response. Small PR.
5. **Suppress `/issuer/*` from public navigation** (kept accessible by direct URL). Touch: marketing nav components.
6. **Audit-link sweep**: grep marketing copy for any reference to `/verify`, `/trust`, `/.well-known/jwks.json` (canonical), `/compliance` and either update to current paths or remove. Touch: `apps/web/components/` + landing copy.

That is the entire engineering backlog to clear the broken-link
cascade. Estimated effort: **half a day total**, no migrations,
no schema changes, no new endpoints.

## §4 — Headline verdict

**VitalCV is shippable as a clinician readiness preview product
behind one operator configuration pass and one half-day engineering
broken-link sweep.** The institutional verifier story is the
adjacent product surface that will become live when #345/#349/#355
merge + apex env is configured — but it does NOT block shipping
the core clinician/employer readiness loop today.
