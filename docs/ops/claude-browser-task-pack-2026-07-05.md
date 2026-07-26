# Claude Browser Task Pack — 2026-07-05

Prompts for the founder to delegate the **manual-verification queue** to Claude sessions with browser access, instead of doing the clicking himself. Each prompt is self-contained: paste it into a fresh Claude session that has browser tools and let it run. All three are **read-only** — none of them changes settings, env vars, or data.

Origin: god-mode Wave B part 1 (PR #544, shadow RBAC live), Wave 0 (PR #541/#545, NPPES guard live), and the open launch-blockers list (`docs/ops/launch-blockers.md`).

| # | Task | Browser session type | Est. time |
|---|------|----------------------|-----------|
| A | Clerk prod Google-OAuth verification | Any Claude with browser + founder's Clerk login | ~10 min |
| B | Railway shadow-RBAC telemetry review | Any Claude with browser + founder's Railway login | ~10 min |
| C | Signed-in clinician QA pass | **Founder's own Chrome profile** (Claude-in-Chrome) — required, see caveat | ~25 min |

Known gotcha baked into all three: `clerk.vitalcv.com` sits behind Cloudflare bot management and 503s fresh automated browsers. Dashboard domains (`dashboard.clerk.com`, `railway.app`) are separate and normally fine. Prompt C only works from the founder's real, already-signed-in Chrome profile.

---

## Prompt A — Verify Google OAuth on the Clerk production instance

```text
You are verifying production auth configuration for VitalCV (vitalcv.com). READ-ONLY:
do not create, edit, enable, disable, or delete anything in any dashboard. If a
setting looks wrong, report it — do not fix it.

Context: VitalCV uses Clerk (custom domain clerk.vitalcv.com) for sign-in. Launch
blocker "Production auth / Google OAuth verification" needs evidence that Google
OAuth is correctly enabled on the PRODUCTION Clerk instance, not just development.

Steps:
1. Open https://dashboard.clerk.com and use the already-signed-in session. If a
   login or CAPTCHA/Turnstile challenge appears, stop and ask the user to complete
   it — do not attempt to bypass.
2. Select the VitalCV application. Confirm you are viewing the PRODUCTION instance
   (instance switcher usually top-left; production shows the custom domain
   clerk.vitalcv.com). Screenshot the instance selector.
3. Navigate to User & Authentication → Social connections (naming may vary:
   "SSO connections" / "Social providers").
4. For Google: record (a) enabled or disabled, (b) whether it uses Clerk's shared
   dev credentials or custom OAuth client credentials (production must use custom —
   shared credentials are dev-only), (c) the authorized redirect URI shown.
   Screenshot this panel.
5. Also record which other sign-in methods are enabled (email OTP, password, etc.)
   — VitalCV's clinician gate relies on email OTP, so confirm email verification
   is on.
6. Check Domains (or "Domain & URLs") → confirm clerk.vitalcv.com is listed as the
   production frontend API domain and vitalcv.com as the application domain.
   Screenshot.
7. Live smoke (best-effort): open https://vitalcv.com/sign-in in a normal tab.
   Report whether the page renders and whether a "Continue with Google" button is
   present. Do NOT complete a sign-in with any credentials. If the widget fails to
   load or a Cloudflare challenge appears, note it verbatim (known issue: Cloudflare
   bot management on clerk.vitalcv.com blocks automated browsers — a failure HERE
   with a healthy dashboard config is expected and not a config bug).

Report back as a table: item | expected | observed | screenshot ref. End with one
of exactly three verdicts: "OAUTH PRODUCTION-READY", "OAUTH MISCONFIGURED (details)",
or "COULD NOT VERIFY (blocked at step N)". Do not soften a failure into a pass.
```

---

## Prompt B — Read shadow-RBAC telemetry + NPPES boot line on Railway

```text
You are gathering production log evidence for VitalCV on Railway. READ-ONLY: do not
touch Variables, Settings, or trigger deployments/restarts. Evidence only.

Context: On 2026-07-05 (UTC) VitalCV deployed a shadow-mode RBAC gate on employer-
review mutations (PR #544, commit 0a90df985, then 54f73eb5e). In shadow mode nothing
is blocked; the backend logs a would-deny line whenever an unauthorized caller would
have been rejected once enforcement turns on. Before enforcement can be enabled, we
need to know: does legitimate traffic trip the gate?

Steps:
1. Open https://railway.app and use the already-signed-in session. Project:
   "inspiring-reflection". Service: "delightful-essence" (the backend).
2. Open the service's Logs (or latest SUCCESS deployment → View logs). Set the time
   range to "since 2026-07-05 03:00 UTC" or the widest available window that covers it.
3. Search/filter the logs for each of these strings, one at a time, and record the
   count of matching lines and one full sample line for each:
   - employer_rbac_shadow_would_deny   (the headline signal)
   - rbac_unknown_user                 (caller has no User row — most important reason)
   - rbac_wrong_tenant
   - rbac_wrong_role
   - nppes_api_version                 (bonus: Wave 0 boot guard — expect exactly one
                                        per boot saying version 2.1, endpoints[3])
4. For every employer_rbac_shadow_would_deny line found, extract: route, reason,
   userId (do not paste emails or names if present — IDs only).
5. Screenshot the filtered log views.

Report format:
| filter | count | sample (redacted) |
plus a short interpretation using these rules:
- 0 would-deny lines AND real employer actions occurred in the window → enforcement
  flip is safe.
- would-deny lines with reason rbac_unknown_user → the flip would break those
  callers; list their userIds so User rows can be provisioned first.
- No employer actions in the window at all → say "NO TRAFFIC EVIDENCE YET — keep
  shadow running", do not claim safety.
Do not flip VERIFIER_RBAC_ENFORCED or change anything — the flip is a separate
founder-gated step.
```

---

## Prompt C — Signed-in clinician QA pass (founder's Chrome profile only)

```text
You are running a signed-in clinician QA pass on production vitalcv.com using the
user's own already-signed-in Chrome profile (Clerk's Cloudflare bot management
blocks fresh automated browsers — that is why this must run in the real profile).
READ-ONLY intent: browse and record; do not submit forms that create real employer
actions, do not share the passport externally, do not change account settings.
Clicking through navigation, tabs, and preview surfaces is fine.

Context: prior QA baseline is docs/product/signed-in-clinician-qa.md (Wave 2A —
auth was fully broken then; since fixed). This pass checks the current signed-in
clinician golden path after the 2026-07-04/05 merges (Calm Wave surfaces, MATCHA GA,
signup gate PRs 1-3, shadow RBAC — which must be INVISIBLE to clinicians).

Visit each route below in order. For each record: loads OK? console errors?
failed network calls (401/403/500)? any status label that is the bare word
"Verified" (that exact single word as a label — a truth-contract violation; compound
labels like "Source-verified" are fine)? screenshot.

  1. https://vitalcv.com/holder            (home: daily brief, streak, Recognition card)
  2. https://vitalcv.com/holder/readiness  (readiness surface + provenance legend)
  3. https://vitalcv.com/holder/recognition
  4. https://vitalcv.com/holder/passport
  5. https://vitalcv.com/holder/applications
  6. https://vitalcv.com/holder/opportunities
  7. https://vitalcv.com/matcha/experience (public preview of signed-in experience)
  8. https://vitalcv.com/get-ready         (NPI-binding gate — view only, do NOT
                                            re-bind or submit)
  9. https://vitalcv.com/holder/profile
 10. From /holder, follow the primary "next step" CTA once and report where it leads.

Also: open DevTools network tab on /holder and report any request to /api/me/role
and its status code (a 401 there reproduces a known past bug).

Report: a 10-row table (route | loads | console | network | truth-contract | note),
top 3 issues ranked by severity, and an overall verdict: "GOLDEN PATH CLEAN" or
"ISSUES FOUND (n)". Compare against the Wave 2A baseline doc if visible issues
overlap. Do not fix anything; this is evidence for the next build wave.
```

---

## Decision queue (founder-only, not delegable to a browser)

| # | Decision | Evidence in hand | The action once you say GO |
|---|----------|------------------|---------------------------|
| D1 | Apply pending Prisma migrations on prod | Deploys skip migrations by design (`SKIP_STARTUP_MIGRATION=1` in `railway.toml` startCommand). Local `railway run … prisma migrate status` cannot reach the DB (P1001 — `postgres.railway.internal` is private-network-only, verified 2026-07-05) | Founder sets `SKIP_STARTUP_MIGRATION=0` on the backend service for ONE deploy — `server.ts` then runs the migration in the background (its built-in path, logs `migration_async`) — then restores the variable. Terminal Claude watches deploy + health before/after |
| D2 | Flip `VERIFIER_RBAC_ENFORCED=true` on Railway | Wait for Prompt B report showing zero legitimate would-denies over several days of real traffic | You flip the variable in Railway (Tier 3), then terminal Claude ships the default-on + web-flip PR |
| D3 | Start Docker Desktop when convenient | Needed once to run the DB-backed enforced-mode RBAC test locally | Terminal Claude runs the employer-actions jest suite with the flag on |

Rules of the road for all sessions: truth-contract language is non-negotiable (no bare "Verified" label, no certification claims); read-only means read-only; when a bot-challenge appears, hand control back to the founder rather than retrying.
