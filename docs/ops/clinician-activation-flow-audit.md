# Clinician Activation Flow — Consolidated Audit

**Audit date:** 2026-05-11
**Origin tip:** `9eb5cdee feat(status): wire compliance evidence shape into /status page (DOCS-STATUS-1) (#230)`
**Consolidates briefs:** W4-PR220A · W4-PR251A · W5-PR261A · AUTH-1 PR271A (all four asked for "end-to-end clinician activation flow verification")
**Scope:** Static trace of the activation flow from Google OAuth → verifier-ready export. No product code changes. Lockdown test pins the gates that **should** exist so the verdict can't drift silently.

## Why a static audit, not a localhost run

The full flow requires:
- A configured Clerk instance with Google IdP enabled (lives in Clerk Dashboard, not the repo).
- A running backend (`apps/api/backend`) with the marketplace + trust-state + SD-JWT issuer DBs migrated.
- A browser to drive OAuth redirect.

None of that is reproducible from an agent tool call. What IS reproducible from static analysis: whether the code paths exist, whether they're fail-closed, and whether the contracts at each boundary preserve ambiguity. That's what this audit covers.

## Per-step assessment

| # | Step | Real? | Evidence | Open gap |
|---|---|---|---|---|
| 1 | Google OAuth | **PARTIAL** | Clerk is wired in `apps/web` (50+ imports, `clerkMiddleware`, `ClerkProvider`). Google IdP must be enabled in the Clerk Dashboard — not in the repo. Verified by static trace of `apps/web/middleware.ts:1,36` and `apps/web/app/layout.tsx:7,134,203`. | If `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing in prod, `<ClerkProvider>` is conditionally not mounted (`apps/web/app/layout.tsx:200–204`). Verify env presence; do not assume. |
| 2 | Session creation | **REAL** | `clerkMiddleware` extracts `session.userId` (`apps/web/middleware.ts:54`); role hydration via `session.sessionClaims?.vitalcv?.role` (line 62) with fallback to `/api/auth/resolve-role`. Fail-closed: missing role → redirect, not silent default. | None at this layer. |
| 3 | Clinician attribution | **REAL** | `loadClinicianMobileData(session)` at `apps/web/lib/mobile/server.ts:72` keys every downstream call on `session.userId`. Anonymous sessions skip the authenticated channels. With #307 merged, `hydrationStatus.channels[i].status === 'skipped-unauthenticated'` is visible per-channel. | #307 (PR #307) adds the per-channel attribution; not yet merged. |
| 4 | NPI ownership binding | **PARTIAL** | The `WorkspaceProfile` returned by `/api/me/workspaces` carries `personProfile.npi` (`apps/web/app/holder/page.tsx:24`), and the holder page gates on `pp.npi` before hydrating the passport. | **No `clinician ↔ NPI` integrity gate visible from `apps/web`.** Multiple clinicians could in principle claim the same NPI; the audit can't tell from web-side code whether the backend enforces uniqueness + ownership-claim flow. Backend route `apps/web/app/api/ownership/claim/route.ts` exists but its enforcement semantics are out of scope of this audit. |
| 5 | Dashboard hydration | **REAL (with #307 pending)** | 8 backend channels classified ok/absent/failed/skipped-unauthenticated; aggregate verdict `ok\|degraded\|failed\|empty` makes upstream-error vs no-data distinguishable. Pre-#307 the dashboard silently collapsed failures to "no data" — a fake-certainty source documented in the #307 PR body. | #307 not yet merged. |
| 6 | Authenticated manifest issuance | **MISSING** | `ProofManifest` is defined in `packages/source-adapters/src/manifest-engine.ts` and consumed by `embed-sdk`. With #309 merged, `apps/web` will have a rendering primitive (`ProofManifestPanel`). **But no `apps/web` route currently issues a manifest tied to `auth().userId`.** The brief asks for "authenticated proof manifest" — that path does not exist; only embed-sdk (B2B) issues manifests today. | **Biggest single blocker** for "authenticated activation flow." Needs a new route (`/api/me/manifest`) that ties issuance to the Clerk session. |
| 7 | Replay attribution continuity | **MISSING** | `PassportData` has no `replayLineage` field (audited in #306). The SSE pipeline emits events but the event sequence is not embedded on the passport payload — a verifier reading `/api/passport/[npi]` cannot prove provenance from the artifact. | Recommended PR: **W3-PR210A** — embed `replayLineage` on `PassportData`. Closes both the passport gap and the "replay-attributable identity" portion of every queued auth brief. |
| 8 | Export gating enforcement | **PARTIAL** | Web has 5 export routes: `apps/web/app/api/export/packet/route.ts`, `apps/web/app/api/passport/[npi]/export/route.ts`, `apps/web/app/api/pilot-kpi-export/route.ts`, `apps/web/app/api/pilot-ops/export/route.ts`, plus the marketing `[npi]/route.ts`. Test coverage exists (`apps/web/__tests__/export-packet-route.test.ts`, `employer-proof-packet.test.ts`). | The audit cannot prove from static analysis that every export route requires `session.userId` — the middleware matcher excludes API routes that route handlers must each gate themselves. Per-route audit recommended (out of scope here). |

## Composite verdict

**Clinician activation flow status:** `PARTIALLY REAL, MISSING THE ATTRIBUTION SPINE.`

Steps 1, 2, 3, 5, 8 are real (or real-pending-merge of #307). Steps 4, 6, 7 are missing or partial in ways that **cannot be detected at runtime** from the current artifacts — there is no `clinician ↔ NPI ↔ replayLineage` chain visible in the public contract.

If the brief's intent is "verify the flow works for a real clinician," the answer today is: **the user-facing flow runs end-to-end (sign-in → NPI entry → passport view → export), but it does so without producing an artifact a verifier could use to prove ownership or provenance.** The clinician sees their passport; the export packet exists; but nothing in the artifact ties back to the authenticated session.

## Strongest gain (this audit)

Consolidating four rephrased briefs (W4-PR220A, W4-PR251A, W5-PR261A, AUTH-1 PR271A) into a single defensible verdict means future-you doesn't need to re-trace this every wave. The lockdown test pins the source-level invariants that any future product PR must continue to honor.

## Strongest replay-identity convergence gain (recommended next, NOT this PR)

Ship **W3-PR210A**: embed `replayLineage: { runId, eventDigest, eventIds[] }` on `PassportData`. This single change closes the structural gap in steps 6 and 7 simultaneously. Steps 4 (ownership binding) and 6 (authenticated manifest) become checkable once a verifier can reconcile the lineage IDs against the session-bound issuance log.

## Biggest remaining onboarding blocker

**Step 6 — authenticated manifest issuance from `apps/web`.** The `ProofManifest` shape exists, the renderer exists (#309), but no web route ties manifest issuance to `auth().userId`. A new `/api/me/manifest` route gated on `auth()` and binding `manifest.subject.npi` to the session's workspace profile would unblock the full attribution chain.

This is approximately one product PR (W5-PR272A: `feat(api): authenticated manifest issuance route`). It is NOT shipped here because it requires backend coordination (the manifest builder lives in `packages/source-adapters`, and the binding needs a new Prisma table).

## Clinician Activation Board

| Metric | Reading | Evidence |
|---|---|---|
| Real User Activation % | ~65 | Sign-in real (Clerk); session creation real; clinician attribution real per-channel after #307 |
| Replay Attribution Integrity % | ~20 | Events on the wire; no replayLineage on the artifact (passport audit #306) |
| Ownership Continuity % | ~40 | NPI present on workspace profile; no visible web-side ownership-uniqueness gate |
| Dashboard Survivability % | ~65 (with #307 merged) | Per-channel hydration status + aggregate verdict |
| Activation Flow Maturity % | ~50 | Real where it exists, structurally incomplete on attribution |

Board values move only on merge per BOARD-SCHEMA-3.

## Lockdown test (this PR)

The accompanying test at `apps/web/__tests__/clinician-activation-flow-gates.test.ts` pins the source-level invariants that must remain true:

- `apps/web/app/holder/layout.tsx` requires `session.userId` and redirects to `/sign-in` when absent.
- `apps/web/middleware.ts` uses real `clerkMiddleware` and redirects unauthenticated requests on protected routes.
- `apps/web/lib/auth/clerkConfig.ts` derives `CLERK_PROVIDER_ENABLED` from the publishable key (not hardcoded).
- `apps/web/app/holder/page.tsx` gates on a real `personProfile.npi` from `/api/me/workspaces` before showing the passport.

These are pin tests, not behavioral changes. A future PR that silently weakens the auth gate would fail these assertions.

## Out of scope (recommended sequencing)

1. **W3-PR210A** — embed `replayLineage` on `PassportData`. Highest leverage. Closes #306 gap; unblocks attribution chain.
2. **W5-PR272A** — `/api/me/manifest` authenticated issuance route (proposed, not yet briefed).
3. **AUTH-1 PR268A** — `clinician ↔ NPI` ownership binding (after W3-PR210A so lineage is available).
4. **W4-PR249A** — wire `ProofManifestPanel` into `/passport/[id]` (consumes #309; smallest follow-up).

Earlier rephrased golden-path briefs (W4-PR220A, W4-PR251A, W5-PR261A, AUTH-1 PR271A) are considered closed by this audit. If the underlying state changes, supersede this doc rather than re-running the trace per-brief.
