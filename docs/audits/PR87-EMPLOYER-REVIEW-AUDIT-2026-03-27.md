# PR #87 Employer Review Audit — 2026-03-27

**Auditor:** Cowork (Claude Opus)
**Scope:** Employer POV walkthrough of `/review/request`, workspace bootstrap, `/review` no-context path, plus live public-shell drift check.
**Commit:** `0c468c1b` — `feat: employer-workspace-bootstrap — setup flow, request-review API, improved panel states`

---

## 1. BLOCKERS (must fix before merge)

### B1. `needs_setup` inline bootstrap never fires for the most common case

**Severity: P0 — breaks the core employer onboarding path**

`RequestReviewPanel.tsx` triggers the inline `EmployerWorkspaceSetup` only when:
```ts
res.status === 404 && data.hint?.includes('VcvEntity')
res.status === 422 && data.hint?.includes('VcvEntity')
```

But the API route (`/api/request-review`) returns **403** with hint `"Create or switch into an employer workspace before requesting a clinician review."` when the user is signed in but has no workspace. That hint does **not** contain "VcvEntity".

The only path that returns a "VcvEntity" hint is line 161 — when the backend `POST /api/organization-context` fails — which is a much rarer case (workspace exists but org entity not registered).

**Result:** A first-time signed-in employer enters NPI → hits 403 → sees a generic red error card (`"Employer workspace required to request a review."`) → **no inline setup offered** → dead end.

**Fix:** Either:
- (a) Change the `needs_setup` trigger to match on `res.status === 403` and/or `data.hint?.includes('workspace')`, or
- (b) Add a `nextStep` field to the API error payload (the contract already defines it in `RequestReviewErrorPayload`) and switch on `data.nextStep === 'create_workspace'` instead of string-matching the hint.

Option (b) is strictly better — the contract types exist (`request-review-contract.ts`) but the API route doesn't emit them. The `resolveEmployerWorkspaceRequestorContext()` function in `employer-workspace.ts` already produces `nextStep` values, but the route handler at `/api/request-review/route.ts` uses the older `resolveEmployerWorkspaceAuthContext()` directly and formats its own error payloads without `code` or `nextStep`.

### B2. API route uses two divergent workspace resolution paths

The `/api/request-review/route.ts` calls `resolveEmployerWorkspaceAuthContext()` directly and then manually duplicates entity-resolution logic (lines 85–109). Meanwhile `resolveEmployerWorkspaceRequestorContext()` in `employer-workspace.ts` already encapsulates the full flow including entity resolution and returns structured `RequestReviewErrorPayload` with `code`/`nextStep`.

The route should use `resolveEmployerWorkspaceRequestorContext()` and forward its structured errors. This would simultaneously fix B1 because the client could switch on `nextStep` instead of hint-sniffing.

---

## 2. EMPLOYER POV ISSUES (non-blocking but visible to pilot users)

### E1. `/review/request` — unauthenticated path shows correct sign-in CTA ✅
Live check confirms: an anonymous visitor sees "Sign in to request a review" with a "Sign in with employer workspace" button. Clean, correct.

### E2. `/review` landing — no-context warning path is honest and functional ✅
Live check confirms: landing shows "Open a shared passport review" with warning tone, explains that review opens from a real share link, and offers "Start with NPI lookup" and "View passport" as escape hatches. "Are you an employer?" CTA links to `/review/request`. All good.

### E3. `/review/[entityId]` — error state is honest ✅
When no passport is found, shows "Employer review unavailable" with the actual backend error message, plus retry and back-to-home buttons. No fake or placeholder data.

### E4. `EmployerWorkspaceSetup` — feels pilot-scoped, not productized
The inline bootstrap collects only an organization name. This is fine for pilot, but:
- No NPI input field — the workspace will be created without an NPI, and the very next retry will fail at `resolveEmployerWorkspaceAuthContext` line 74 (`employerWorkspaceNpi` will be empty) with error "Employer workspace is missing a resolvable organization NPI."
- So even if B1 is fixed, the setup → auto-retry loop will still fail unless `POST /api/employer/setup` also sets the NPI on the workspace profile, or the setup form collects it.

**This is arguably P0 — the setup form creates a workspace that immediately fails the NPI check on retry.**

### E5. Success state — review link generation is clean ✅
Context ID, status, review URL with copy button, open-in-new-tab, audit trail footer. Productized feel.

### E6. Loading states use honest copy ✅
"Creating review context…" / "Resolving NPI and registering context." — no fake progress bars, no synthetic delays.

---

## 3. DEAD / AMBIGUOUS / FAKE STATE CHECK

| Area | Verdict | Notes |
|------|---------|-------|
| `/review` landing | ✅ Honest | Warning tone, real CTAs, no fake data |
| `/review/request` unauthenticated | ✅ Honest | Clean sign-in gate |
| `/review/request` authenticated, no workspace | ❌ Dead end | Generic error, no setup path (B1) |
| `/review/request` authenticated, workspace exists | ✅ Functional | NPI → context → review link |
| `/review/[entityId]` error | ✅ Honest | Real error message from backend |
| `/review/[entityId]` success | ✅ Functional | Real passport data, real decision surface |
| `EmployerWorkspaceSetup` | ⚠️ Incomplete | Creates workspace without NPI → auto-retry fails (E4) |
| `ReviewClient` decision surface | ✅ Honest | Truth-model-driven, real status labels, real proof sections |

---

## 4. PUBLIC SHELL DRIFT CHECK

### Homepage (vitalcv.com)

| Element | Live Copy | Assessment |
|---------|-----------|------------|
| Hero | "NPI first. Honest coverage." | ✅ Aligned with doctrine |
| Subhead | "See your readiness snapshot in about 10 seconds." | ✅ Honest qualifier ("about") |
| Description | "source-backed credentialing snapshot from NPPES, OIG, and available PECOS coverage" | ✅ Accurate to current source coverage |
| Source strip | NPPES=Checked, OIG/LEIE=Checked, CMS PECOS=Pending, CA State Board=Access required | ✅ Matches actual pipeline state |
| Footer disclaimer | "Homepage preview starts with NPPES and OIG. Other lanes stay marked as access required, pending, or preview-only until a connected source actually runs." | ✅ Honest |
| CTA | "Start with NPI lookup", "No signup required to preview" | ✅ Accurate |
| Nav | "For Employers" link present | ✅ Routes to employer path |

**Homepage drift: NONE detected.** Clean.

### Developers page (vitalcv.com/developers)

| Element | Live Copy | Assessment |
|---------|-----------|------------|
| Headline | "Build against the current VitalCV API preview." | ✅ Honest — says "preview" |
| API Host | `delightful-essence-production.up.railway.app` | ⚠️ Exposes raw Railway hostname — not branded. Not a blocker but looks like internal tooling. |
| Mode | "Preview" | ✅ Honest |
| Auth | "API keys" | ✅ Accurate |
| SDK packages | `@vitalcv/verifier-sdk`, Issuer SDK, Wallet SDK | ⚠️ Are these published packages? If not, listing them implies availability that doesn't exist. |
| Trust Threshold/Revocation/Peer stats | Specific numbers (60, 5/30 days, 3 endorsements) | ⚠️ Are these enforced in the current codebase? If spec-only, they read as live behavior. |
| Resource links | `/docs/api`, `/docs/sdk`, `/docs/webhooks` | ⚠️ Do these routes return content? If 404, the links are dead. |

**Developers page drift: LOW-MEDIUM.** The page is honest about being preview, but the SDK package names and governance stats may overstate what's real. Railway hostname is cosmetic but unprofessional for a pilot employer who clicks through.

---

## 5. FOLLOW-UPS (post-merge, non-blocking)

1. **F1.** Refactor `/api/request-review/route.ts` to use `resolveEmployerWorkspaceRequestorContext()` — eliminates duplicated logic and surfaces structured error codes.
2. **F2.** Add org NPI field to `EmployerWorkspaceSetup` form, or have `POST /api/employer/setup` auto-resolve NPI from Clerk org metadata.
3. **F3.** Developers page: replace raw Railway hostname with `api.vitalcv.com` or a branded subdomain.
4. **F4.** Developers page: audit SDK package names and governance stat cards — mark as "planned" if not yet real.
5. **F5.** Developers page: verify `/docs/api`, `/docs/sdk`, `/docs/webhooks` routes return content.
6. **F6.** Add telemetry for the `needs_setup` → setup → retry flow to track pilot employer conversion.
7. **F7.** Consider adding a `EMPLOYER_WORKSPACE_IDENTITY_REQUIRED` inline recovery path (NPI addition) similar to the org-name setup.

---

## 6. MERGE RECOMMENDATION

### **NO-GO as-is.**

**Reason:** The primary value of PR #87 — letting a first-time employer go from zero to a valid review context — is broken. The `needs_setup` inline bootstrap never triggers for the most common path (signed-in, no workspace). A pilot employer will hit a generic error wall.

### Path to GO:

Fix **B1** (hint-matching → nextStep switching) or at minimum widen the 403 case to trigger `needs_setup`. This is an S-sized fix (30 min). If E4 (setup creates workspace without NPI → auto-retry fails) is also fixed, the full zero-to-review path works end-to-end. E4 is M-sized (1–2 hours).

**Minimum merge bar:** B1 fixed. E4 can be a fast follow if `/api/employer/setup` is updated to accept and set an NPI.

**Recommended merge bar:** B1 + E4 fixed. Then the "first employer touches VitalCV" story is actually complete.
