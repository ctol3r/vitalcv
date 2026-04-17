# PR #84 — Share/Review Flow UX Audit

**Date:** 2026-03-27
**Scope:** Employer share/review experience post-PR #84 merge
**Auditor:** Claude (VitalCV strategic/technical operator)

---

## Executive Summary

The share → review flow is **operationally real and structurally sound**. The employer decision surface (ReviewClient) is the strongest component in the public wedge — spec-exact layout, immutable audit trail with trust snapshots, proper auth gating with graceful preview degradation, and a clear < 10-second decision path. The clinician share surface (PassportShareActions) is functional but thin — clipboard-only, no scoped share tokens, no expiry, no recipient context.

**Verdict: CONDITIONAL GO** — merge is safe for preview/pilot. Seven issues must be tracked for production readiness.

---

## What I Know For Sure

1. `/review/[entityId]` is public, server-renders passport data, fires KPI tracking (fire-and-forget, 2s timeout), and falls back to a clear TrustStateCard error when the backend can't hydrate.
2. ReviewClient renders a spec-exact decision surface: Identity → Safety → Authority → Eligibility → Readiness → Blockers → Proof (collapsible) → Actions.
3. Three employer actions (Accept, Request Refresh, Route to Review) all write to the backend via `POST /api/employer-review/:entityId/:action`, require Clerk auth, and return an `EmployerReviewActionState` with an immutable `DecisionTrustSnapshot`.
4. Auth gating uses a 4-tier degradation: Clerk unavailable → Clerk not loaded → Not signed in → Not employer role. Each state renders a specific `previewOnlyMessage` and disables action buttons.
5. Packet export (JSON download) is auth-gated and works via blob URL + click-through `<a>` element.
6. The `/review` landing page (no entityId) shows a clear "start from NPI lookup" redirect — not a dead end.
7. The `/passport` page's "View as employer" button correctly builds a `/review/:entityId` link from the ingest anchor.
8. PassportShareActions is clipboard-only: copy public link (`/p/:npi`), copy embed SVG code, copy LinkedIn markdown. No scoped share token, no expiry, no recipient binding.
9. Homepage, /developers, /explore, /employers all render current-state copy with appropriate scoping language ("current directory," "launch cohort," "this environment").
10. Middleware correctly classifies `/review/*` as public (no auth required for viewing), while employer *actions* require Clerk auth at the API layer.

---

## What I Do Next

1. Track the 7 issues below in the backlog with P0/P1 labels.
2. Validate the backend endpoints (`/api/employer-review/:entityId/*`) return correct `DecisionTrustSnapshot` hashes in staging.
3. Test the full clinician-to-employer handoff with a real NPI in the preview deployment.
4. Confirm WebAuthn prompt does NOT fire during employer review (it shouldn't — it's only in SelectiveDisclosureModal for holder flows).
5. Verify `/employers` page gracefully handles empty directory (already coded, but needs runtime confirmation).

---

## Does the Share/Review Flow Feel Operationally Real?

**Yes, with caveats.** The employer review surface is production-grade in structure: decision-first layout, trust stack rendering, freshness warnings, blocker callouts, proof accordion, audit trail with snapshot hashes, and proper action state machines. The "Accept as head start (N blockers noted)" pattern is the right model — it doesn't pretend blockers don't exist.

The share side is the weak link. Today, "sharing" means copying a `/p/:npi` URL. There's no scoped share token in the clinician → employer handoff from PassportShareActions. The `/api/apply/share` endpoint exists and creates scoped tokens, but PassportShareActions doesn't use it — it only generates the public profile URL. This means the employer review link is reachable by anyone who knows the entityId, not gated by a share token.

---

## Does Any Auth/Failure State Feel Confusing or Dead?

**Mostly clean, two concerns:**

1. **"Preview only" messaging is clear but not actionable enough.** When an unauthenticated employer views the review page, they see disabled buttons + "Preview only. Sign in with an employer workspace to persist decisions." The "Sign in with employer workspace" link appears, but there's no explanation of what an "employer workspace" is or how to get one. A first-time employer who received a share link would not know what to do.

2. **The `/review` landing (no entityId) is not confusing but is slightly orphaned.** It tells you to "start from NPI lookup" — but an employer wouldn't know an NPI. This page should either not exist or redirect to `/employers` or a "paste your share link" prompt.

---

## Does Production Still Expose Old Public-Story Copy?

**No significant stale copy detected.** The homepage, /developers, /explore, and /employers pages all use current, scoped language. The employers page explicitly says "current directory" and "this environment." The explore page warns about "seeded launch-cohort employers." No lorem ipsum, no old branding, no orphaned "coming soon" placeholders.

---

## Clinician POV Issues

| # | Issue | Severity | Detail |
|---|-------|----------|--------|
| C1 | **Share actions are clipboard-only with no scoped tokens** | P1 | PassportShareActions copies `/p/:npi` URLs. The `/api/apply/share` endpoint exists but isn't wired into the share UI. No expiry, no recipient binding, no revocation from the clinician side of the share card. |
| C2 | **No share confirmation or tracking** | P1 | Clinician copies a link and gets a toast ("Copied link"). No record of who they shared with, when, or whether the employer opened it. The `/api/passport/analytics/:npi/share` endpoint exists but PassportShareActions doesn't call it. |
| C3 | **"View as employer" from /passport is the only handoff path** | P2 | The clinician can preview what an employer would see, but there's no "Share with employer" flow that generates a scoped review link with context (purpose, recipient org, expiry). |
| C4 | **No selective disclosure gate before sharing** | P2 | The BiometricPrompt + SelectiveDisclosureModal components exist but are not wired into the share flow. A clinician shares everything by default. |

---

## Employer POV Issues

| # | Issue | Severity | Detail |
|---|-------|----------|--------|
| E1 | **No employer onboarding or context for first-time reviewers** | P1 | An employer who receives a review link lands on the decision surface with no orientation. The "employer workspace" concept is referenced but never explained. No "What is VitalCV?" or "How to read this review" affordance. |
| E2 | **"Accept as head start" label may confuse employers unfamiliar with credentialing** | P2 | The primary CTA says "Accept as head start" with a blocker count. This is correct for credentialing professionals but opaque for hiring managers or HR generalists. No tooltip or explanation of what "head start" means operationally. |
| E3 | **Download failure is silently swallowed** | P2 | `handleDownloadPacket()` catches all errors with `/* download failure is non-fatal */`. The user sees the button return to idle with no feedback. Should show a toast on failure. |
| E4 | **Persisted action state fetch failure is silent** | P2 | `getPersistedActionState()` catch block sets state to null — the employer sees "idle" even if the backend returned an error. Previous action context is lost. |
| E5 | **No "reject" or "decline" action** | P2 | Three actions exist: accept, refresh, review. An employer who wants to explicitly decline has no path. They can only close the tab. No audit trail for a negative decision. |
| E6 | **Review context card only shows truncated contextId** | P3 | When `contextId` is present, the UI shows `{contextId.slice(0, 8)}…` with no way to expand or copy. Debugging or cross-referencing this ID requires dev tools. |

---

## Top 10 UX Problems (Ranked)

| Rank | ID | Problem | P-Level |
|------|-----|---------|---------|
| 1 | C1 | Share actions are clipboard-only — no scoped tokens, no expiry, no revocation | **P0** |
| 2 | E1 | No employer onboarding or first-visit context on review surface | **P0** |
| 3 | C2 | No share tracking or analytics wired into the share UI | **P1** |
| 4 | C3 | No "Share with employer" flow — only "View as employer" preview | **P1** |
| 5 | E2 | "Accept as head start" label is opaque to non-credentialing users | **P1** |
| 6 | E3 | Packet download failure is silently swallowed — no user feedback | **P1** |
| 7 | E5 | No "decline" action — negative decisions leave no audit trail | **P1** |
| 8 | C4 | No selective disclosure gate before sharing | **P2** |
| 9 | E4 | Persisted action state fetch failure is silent | **P2** |
| 10 | E6 | Truncated contextId with no expand/copy affordance | **P3** |

---

## Specific Flags

### Missing employer context
**Confirmed.** E1 is the biggest employer-side gap. The review surface assumes the viewer understands what VitalCV is, what a trust stack means, and what "Accept as head start" implies. No onboarding card, no help text, no "first time here?" flow.

### Weak action confirmation
**Partially addressed.** The success state shows audit event ID + trust snapshot hash — strong for compliance, but the "Back" button after success returns to the action panel with no persistent visual indicator that an action was already taken. The `persistedActionState` banner exists but is buried in the metadata card, not highlighted.

### WebAuthn confusion
**Not a risk in this flow.** WebAuthn (BiometricPrompt + useBiometricConfirmation) is only wired into SelectiveDisclosureModal for holder credential presentation. It does not appear in the employer review flow. No confusion path exists.

### Stale public copy on homepage/developers/explore
**Clean.** All public surfaces use current, scoped language. No stale "coming soon," no old branding, no orphaned copy.

### Orphan routes
**One orphan identified:** `/review` (no entityId) is a landing page that tells employers to "start from NPI lookup." Employers don't know NPIs. This page should redirect to `/employers` or show a "paste your share link" input. It's not broken — just not useful for the stated audience.

---

## GO / NO-GO

### CONDITIONAL GO

**Safe to merge for preview/pilot deployment.** The review surface is structurally complete, the auth gating degrades gracefully, the audit trail is immutable, and no route is broken or dead. The two P0 items (C1: no scoped share tokens, E1: no employer onboarding) are real gaps but do not block a controlled preview where share links are manually distributed and employers have been briefed.

**Conditions for production GO:**
1. Wire PassportShareActions to `/api/apply/share` to generate scoped, expirable share tokens (C1)
2. Add a first-visit employer context card or modal on `/review/[entityId]` (E1)
3. Track share events via the analytics endpoint (C2)

**Should be addressed before pilot expansion (P1 items):**
4. Add download failure toast (E3)
5. Add "decline" action (E5)
6. Clarify "Accept as head start" for non-credentialing audiences (E2)
7. Build a proper "Share with employer" flow beyond clipboard copy (C3)
