# Signed-In Clinician — Golden Path QA Report

**Wave:** EPIC WAVE 2A (Signed-In Clinician QA Pass)
**Author:** Fable 5 (Principal Engineer + Product QA Lead)
**Date:** 2026-07-02
**Environment probed:** production — `https://vitalcv.com` (web) + `https://api.vitalcv.com` (backend)
**Code baseline:** `origin/main` @ `43304d495` (clean worktree)

---

## TL;DR — one P0 blocks the entire wave

**No signed-in clinician can reach any `/holder/*` route in production right now.** Authentication itself succeeds, but immediately afterward the middleware cannot resolve the user's role and redirects every authenticated clinician to `/auth/error` — a dead-end "Sign-in issue" page. This is not a redirect-guess: it was confirmed end-to-end with a real, active Clerk session against live production.

Because the gate fails **after** sign-in and **before** any `/holder` page renders, all 11 required-path surfaces (Home, Readiness, Blocker Detail, Opportunities, Apply, Applications, Timeline, Settings, Recognition, plus Profile) are **inaccessible** — regardless of how well each is built. The route code and internal link graph are actually healthy (route-contract test 13/13 green; all required-path page files present), so once the gate is fixed the surfaces underneath are expected to light up.

**Wave 2B's highest-value action is unambiguous: fix the signed-in auth/role-resolution chain.** Everything else is blocked behind it. This report gives Wave 2B the exact failure chain, three concrete fix options, and a manual QA checklist so the fix can be verified without guessing.

---

## 1. Can signed-in verification be automated?

**Partially — and that limitation is exactly how the P0 was found.**

| Approach | Result |
|---|---|
| `claude-in-chrome` / headless browser against `clerk.vitalcv.com` | **Blocked.** Clerk's Cloudflare bot-management 503s automated browsers (documented in memory `clerk_cdn_bot_management`). Not usable for a live signed-in click-through. |
| **Clerk Backend API + FAPI session mint (used here)** | **Works for the gate, not the UI.** I provisioned a synthetic `CLINICIAN` user via the Clerk Backend API, minted a real sign-in ticket, redeemed it through the production Frontend API (`clerk.vitalcv.com`) to obtain a genuine active session + `__session` JWT, and drove authenticated HTTP requests at production. This is enough to test the **middleware/auth gate** precisely, but not to render and click React surfaces. |
| Native API session token | **Disabled** on this Clerk instance (`native_api_disabled`) — the standard headless shortcut is off. |

**Conclusion:** A full automated signed-in *UI* walkthrough is **not** possible from this environment (Clerk bot-blocking). But automated **auth-gate** verification via the Clerk Backend/FAPI path **is** possible and is how the P0 below was proven. Post-fix UI verification will require a manual pass by Chris (checklist in §5) or an allowlisted/real browser profile.

---

## 2. Root cause of the P0 (the auth/role-resolution chain)

The signed-in gate lives in `apps/web/middleware.ts`. For any `/holder/*` request it runs this sequence:

1. **Authenticated?** — yes for a real session. ✅
2. **Read role from JWT** — `session.sessionClaims?.vitalcv?.role` (`middleware.ts:62-63`). **The production session token carries no `vitalcv` claim at all**, so this is always `undefined`. ❌
3. **Fallback** — call `/api/auth/resolve-role`, which proxies backend `GET /api/me/role` (`middleware.ts:66-80`, `app/api/auth/resolve-role/route.ts`).
4. Backend `/api/me/role` is registered (`app.ts:3589`) **after** the global tenant-context guard `app.use(requireTenantContextOrReadAccess)` (`app.ts:3477`), and is **not** in the guard's skip-list (`middleware/tenantGuard.ts:46-116`). The resolve-role proxy forwards only `x-clerk-user-id` — no org id in JWT, query, or `x-org-id` header (`middleware/organizationContext.ts:70-80`) — so the guard returns **`401 organization_context_required`**.
5. resolve-role sees the non-OK backend response and returns **`502 Failed to resolve role`**.
6. Middleware’s circuit-breaker fires: `userRole` stays undefined → **redirect to `/auth/error`** (`middleware.ts:83-86`).

**Live production evidence (real active session):**
```
GET https://vitalcv.com/holder            (active session)  → 307  /auth/error
GET https://vitalcv.com/api/auth/resolve-role (x-clerk-user-id) → 502 {"error":"Failed to resolve role"}
GET https://api.vitalcv.com/api/me/role   (x-clerk-user-id)   → 401 {"error":"organization_context_required"}
```

### Why this hits *real* users, not just the synthetic test user
- The production Clerk instance has **no session-token customization emitting `vitalcv.role`** (a synthetic user with `public_metadata.vitalcv.role = CLINICIAN` still minted a token with **no** `vitalcv` claim).
- The real account **`ct@sourcd.xyz` has `public_metadata: null`** — so even if a customization existed, its claim would be null.
- Therefore **every** signed-in user falls through to the broken fallback. The fast path is dead for everyone.

### Second-order trap (important for the fix)
Fixing **only** the tenant guard is **insufficient and would make it worse**. On a *successful* fallback, the middleware does not render the page — it redirects to `ROLE_LANDING` "to force JWT refresh" (`middleware.ts:89-92`). But the refreshed JWT still won't contain `vitalcv.role` (no session-token customization), so the next request repeats the fallback → **infinite redirect loop** (`ERR_TOO_MANY_REDIRECTS`). The real fix must make the role claim actually land in the session token (or make the middleware pass through on the resolve turn). See §4.

---

## 3. Route-by-route QA table

**Legend — Verification method:**
`PROD-AUTH` = live probe with a real active Clerk session · `PROD-ANON` = live unauthenticated probe · `CODE` = source read of `origin/main` · `TEST` = route-contract/unit test.

**Legend — Observed reality:** every protected row shares the same observed production behavior (redirect to `/auth/error`), because the gate fails before the page renders. The "built as" column records what the *code* would serve once the gate is fixed (CODE-derived, **not** yet observed live).

| # | Route | Expected | Observed in prod | Built as (code) | Severity | Owner | Recommended fix | Verified by |
|---|---|---|---|---|---|---|---|---|
| — | **AUTH GATE** (all `/holder/*`) | Authed clinician reaches Holder Home | **307 → `/auth/error` dead-end** for every authed clinician | n/a | **P0 / Tier 0** | Backend + Web platform | Fix role-resolution chain (§4) | PROD-AUTH |
| 1 | `/holder` (Home) | Wallet/passport home for signed-in NPI | Unreachable (gate) | REAL — `/api/me/workspaces` → NPI → WalletPassport, CredentialWallet, TrustStatePanel, RecognitionCard; honest no-NPI/loading/error states | P0 via gate | Web | Unblock gate; then live-verify | PROD-AUTH + CODE |
| 2 | `/holder/home` | Mobile-style dashboard (readiness, blockers, apps, opps) | Unreachable (gate) | REAL — data via `loadClinicianMobileData` in layout; `ClinicianHomeSurface` | P0 via gate | Web | Unblock gate | CODE + TEST (`holder-home-page.test.tsx`) |
| 3 | `/holder/readiness` | Source-backed readiness snapshot | Unreachable (gate) | REAL — client fetch `/api/passport/:npi`; explicit "no demo data" honest empty/error; NPI-change identity guard | P0 via gate | Web | Unblock gate | CODE + TEST (`holder-readiness-page.test.tsx`) |
| 4 | `/holder/blockers/[blockerId]` | Blocker detail | Unreachable (gate) | REAL — reads shared mobile context; `notFound()` on unknown id | P0 via gate | Web | Unblock gate | CODE + TEST |
| 5 | `/holder/opportunities` | Matched opportunity list | Unreachable (gate) | REAL — `/api/matcha/opportunities/:npi` via provider | P0 via gate | Web | Unblock gate | CODE |
| 6 | `/holder/opportunities/[id]` | Opportunity detail + apply entry | Unreachable (gate) | HYBRID — live feed first, `/api/opportunities/:id` fallback; honest "not in matched feed" when fallback | P0 via gate | Web | Unblock gate; live-verify fallback path | CODE |
| 7 | `/holder/opportunities?apply=[id]` (Apply) | Apply modal → creates application | Unreachable (gate) | REAL — `ApplyModal` opened via query param, redirects to `/holder/applications/:id` on success | P0 via gate | Web | Unblock gate; live-verify submit | CODE |
| 8 | `/holder/applications` | Applications list | Unreachable (gate) | REAL — `/api/clinician/applications` via provider | P0 via gate | Web | Unblock gate | CODE |
| 9 | `/holder/applications/[id]` | Application detail | Unreachable (gate) | REAL — provider context; `notFound()` on unknown id | P0 via gate | Web | Unblock gate | CODE + TEST |
| 10 | `/holder/timeline` | Career timeline | Unreachable (gate) | REAL shim — resolves NPI server-side, **redirects to `/activity/:npi`**; honest error page. Verify `/activity/:npi` renders post-gate | P0 via gate; **needs product confirm** that `/activity/[npi]` is the intended timeline home | Web | Unblock gate; confirm `/activity/:npi` is the canonical surface | CODE |
| 11 | `/holder/settings` | Account + identity binding + share | Unreachable (gate) | REAL — Clerk `UserButton`/`SignOutButton`; real workspace `PersonProfile`; "no decorative toggles" honesty rule; profile link → `/clinician/profile` | P0 via gate | Web | Unblock gate | CODE |
| 12 | `/holder/recognition` | Employer-acceptance recognition | Unreachable (gate) | REAL — `RecognitionSurface`, source-backed acceptances | P0 via gate | Web | Unblock gate | CODE |
| 13 | `/clinician/profile` (the Profile surface) | Editable clinician profile w/ provenance | **200 shell** (client-auth), but data calls hit the same broken `/api/me/workspaces`/role chain → lands in `signed_out`/`load_error` phase | REAL — client fetch `/api/me/workspaces` + `/api/passport/:npi`; provenance legend; self-attested never shown as verified | **P1** (not middleware-gated; degrades to honest error) | Web | Unblock gate; then live-verify data render. **Product decision:** should Profile live under `/holder/*` for consistency? | CODE + PROD-ANON |
| 14 | `/apply/[bundleId]` (public share target) | Public apply bundle view | 200 (public) | REAL — `/api/apply/bundle/:id`; honest expired(410)/not-found(404)/error states | OK (public path) | Web | None; live-verify a real bundle post-gate | CODE + PROD-ANON |
| 15 | `/get-ready` | NPI entry / onboarding wedge | 200 (public) | REAL NPI lookup flow | OK | Web | None | PROD-ANON |
| 16 | `/passport` | Public NPI → live readiness stream | 200 (public) | REAL — SSE progressive hydration | OK | Web | None | PROD-ANON |
| 17 | `/sign-in` | Clerk sign-in | 200 | Clerk component; honors `redirect_url` | OK | Web | None | PROD-ANON |
| — | `/holder/blockers` (list) | — | 404 (no list route) | **Missing by design** — blockers list is rendered inside `/holder/home`; only `[blockerId]` detail exists | Low / **product decision** | Web | Decide if a standalone blockers list/deep-link is needed | CODE |

### Cross-cutting classifications
- **Broken / inaccessible:** rows 1–12 (all `/holder/*`) — via the single P0 gate.
- **Missing state:** #13 Profile degrades to `signed_out`/`load_error` because its data calls depend on the same session→workspace resolution; honest, but empty for a real signed-in user.
- **Needs product decision:** #10 (`/activity/:npi` as canonical timeline), #13 (Profile lives under `/clinician/*` not `/holder/*`), blockers-list absence.
- **Duplicate risk (minor, not blocking):** `/holder` vs `/holder/home` are two clinician landing surfaces with overlapping intent (passport-home vs mobile-dashboard). Not a defect; worth a product call on which is canonical. `/clinician/*` (profile, onboarding, graph) is supplemental to `/holder/*`, not a true duplicate.
- **Fake/demo:** none found in the signed-in path. Empty/error states are honest across the board; the only hardcoded NPIs (`1234567890`, `1700000000`) are in tests/demo fixtures, not production surfaces.

---

## 4. Recommended fix for Wave 2B (do NOT ship blind — verify)

The role must actually reach the session so the middleware fast path (`middleware.ts:62`) works. Options, best first:

**Option A (recommended) — make the session token carry the role.**
1. Add Clerk **session-token customization** so `vitalcv.role` is emitted from `public_metadata` (Clerk Dashboard → Sessions → *Customize session token* → `{ "vitalcv": "{{user.public_metadata.vitalcv}}" }`). Requires Chris's Clerk dashboard access.
2. Ensure role resolution **writes `public_metadata.vitalcv.role`** back to the Clerk user (webhook or `/api/me/role` side-effect via `clerkClient.users.updateUserMetadata`). Backfill existing users — including `ct@sourcd.xyz`, currently `public_metadata: null`.
3. Add `/api/me/role` to the tenant-guard skip-list (`tenantGuard.ts` `shouldSkipTenantContext`) so the first-time bootstrap call (which legitimately has no org yet) can succeed.
- Result: fast path populates on next sign-in; fallback becomes rare and non-looping.

**Option B (fastest unblock, still needs the loop fix) —**
1. Add `/api/me/role` to the tenant-guard skip-list (it resolves a user by Clerk id and genuinely needs no org — same rationale as `/api/identity`, `/api/ingest` already in the list).
2. **Fix the redirect loop:** change `middleware.ts:89-92` to **pass through** (`NextResponse.next()`) on a successful resolve turn instead of redirecting to `ROLE_LANDING`, OR set a short-lived role cookie the middleware reads, so it doesn't depend on a JWT refresh that never carries the claim.
- Without step 2, Option B converts `/auth/error` into `ERR_TOO_MANY_REDIRECTS`.

**Option C (defense in depth) —** make `/api/auth/resolve-role` forward org context (e.g., derive/create the user's org and pass `x-org-id`) so the backend guard is satisfied. Weaker than A; leaves the fast path dead.

**Tiering:** the fix touches multi-tenant isolation (tenant guard) and auth — treat as **Tier 2** (Codex verify before merge), not a drive-by Tier 0. That is why this QA wave documents rather than ships it: the one-line skip-list change alone is a trap (loop), and the correct fix needs Clerk dashboard config + a metadata backfill + the verify gate.

---

## 5. Manual QA checklist for Chris (post-fix, real browser)

Automated UI verification is blocked by Clerk bot-management, so this must be a human pass in a signed-in browser once Wave 2B lands the fix. Walk the required path and check each item:

- [ ] **Sign in** at `/sign-in` → land on `/holder` (NOT `/auth/error`, NOT a redirect loop). *This is the P0 acceptance gate.*
- [ ] **Holder Home** `/holder` — wallet/passport renders for your NPI; no error card; "Upload Credential" scrolls to evidence panel.
- [ ] **Readiness** `/holder/readiness` — real source-backed snapshot loads (not the "Add your NPI" empty state, assuming your NPI is connected).
- [ ] **Blocker Detail** — from Home, open a specific blocker → `/holder/blockers/[id]` renders detail; an unknown id 404s cleanly.
- [ ] **Profile** `/clinician/profile` — loads your workspace profile with provenance badges (not `signed_out`/`load_error`); reachable from Settings.
- [ ] **Opportunity Center** `/holder/opportunities` — matched roles list renders.
- [ ] **Opportunity Detail** `/holder/opportunities/[id]` — opens; "Apply with your VitalCV" opens the apply modal.
- [ ] **Apply Flow** — submit an application → redirects to `/holder/applications/[id]`.
- [ ] **Applications** `/holder/applications` — your application appears in the list.
- [ ] **Application Detail** `/holder/applications/[id]` — renders; unknown id 404s.
- [ ] **Timeline** `/holder/timeline` — redirects to `/activity/[your-npi]` and that page renders a real timeline (confirm this is the intended surface).
- [ ] **Settings** `/holder/settings` — Clerk account controls work; identity binding shows your real NPI; sign-out works.
- [ ] **Recognition / Share** `/holder/recognition` — employer acceptances render; share panel points to `/verify/[npi]`; open that verifier surface anonymously to confirm the public view.
- [ ] Note any surface that loads but shows empty/demo/confusing content, so Wave 2B can prioritize the highest-value data-wiring gap.

---

## 6. Appendix — how the P0 was reproduced (Clerk Backend/FAPI)

1. Created a synthetic `CLINICIAN` user via Clerk Backend API (`public_metadata.vitalcv.role = CLINICIAN`).
2. Minted a **sign-in token**, redeemed it through the production Frontend API (`clerk.vitalcv.com/v1/client/sign_ins`, `strategy=ticket`) with browser-like headers + cookie jar → obtained a real client + session.
3. Session came back `pending` with a `choose-organization` task; created an org and `touch`ed the session → `active`.
4. Minted the session `__session` JWT and drove authenticated requests at `https://vitalcv.com/holder` and the backend. Decoded JWT claims: `[azp, exp, fva, iat, iss, nbf, role, sid, sts, sub, v]` — **no `vitalcv` claim**.
5. Observed the failure chain in §2.

**Test-data cleanup:** the synthetic Clerk user and org created for this probe are deleted at the end of the wave (IDs recorded in the session transcript). No product data was written. `ct@sourcd.xyz` was only *read* (metadata inspection), never modified.

---

## 7. Definition-of-Done check

- ✅ Signed-in surface mapped route-by-route with expected vs observed, severity, owner, fix, and verification method.
- ✅ Automated-access question answered (auth-gate: yes via Clerk API; UI: no, Clerk bot-block) + manual checklist provided.
- ✅ Did not infer from 307s alone — used a real active session, backend probes, route-contract test, and source reads.
- ✅ Highest-value issue for Wave 2B identified unambiguously (the auth/role-resolution P0) with a ready, verifiable fix plan.
- ✅ No product code shipped this wave (the fix is Tier 2 and loop-prone; documented for Wave 2B per the merge rule).
