# First Real Clinician Onboarding — Operator Walkthrough

The end-to-end walkthrough for driving the **first** real clinician through
VitalCV. Designed for the operator (you) to execute alongside a credentialing
director who is evaluating the system.

**Pre-flight** (do once before the walkthrough): complete
`docs/pilot/go-live-checklist.md` and verify `aggregate: 'ok'` at
`/api/status/health`. The script `scripts/check-onboarding-readiness.sh`
automates that verification.

## Walkthrough format

Each step has:
- **What you do** — the concrete operator action.
- **What the clinician/director sees** — the expected UX state.
- **Verify** — a concrete command or visual check that proves the step worked.
- **Failure mode** — the most common breakage at this step and how to confirm.

The 10-minute target: a credentialing director reading this doc alongside the
walkthrough understands the system without needing additional explanation.

## Step 0 — Pre-flight readiness

**What you do**: from your terminal, run
```
./scripts/check-onboarding-readiness.sh
```
**Verify**: script exits 0 with `VERDICT: READY`. If not, fix every `✕` and
`●` before proceeding. **Do not start a real onboarding with a degraded
subsystem.**

## Step 1 — Google OAuth sign-in

**What you do**: clinician opens `https://<your-domain>/sign-in` and clicks
**Continue with Google**. They sign in with their actual Google account.

**What the clinician sees**: Google OAuth consent screen → redirect back to
the configured `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` (default `/`).

**Verify**:
- Browser network tab shows a 302 from `https://accounts.google.com/...` to
  the Clerk callback, then to your domain.
- After redirect, `document.cookie` includes `__session` (Clerk's session
  cookie).
- `curl -b "<session-cookie>" https://<domain>/api/me` returns the Clerk user
  shape (or 401 if your cookie is wrong).

**Failure mode**: button is missing → Google IdP not enabled in Clerk
Dashboard (revisit `docs/ops/clerk-google-oauth-runbook.md` step 2).
Redirect URI mismatch → Google Cloud Console authorized redirect URIs
out of sync with Clerk's required callback.

## Step 2 — NPI entry

**What you do**: clinician navigates to `/passport` and enters their 10-digit
NPI in the input.

**What the clinician sees**: input accepts digits only, formats as
`XXX XXX XXXX`. **Submit** button enabled only on 10 digits. On submit,
redirects to `/passport?npi=<NPI>` which starts the SSE ingest stream.

**Verify**:
- Network tab shows `POST /api/ingest/<NPI>` returning a `runId`.
- An `EventSource` opens against `GET /api/ingest/<runId>/stream` (or
  equivalent).
- The SSE stream emits `source_start` then `source_complete` events for
  each source.

**Failure mode**: 400 on POST → NPI not 10 digits (UI should prevent this,
but the API enforces it server-side too). 500 → backend not reachable.
Verify `BACKEND_URL` in env.

## Step 3 — NPPES validation

**What you do**: watch the SSE events as NPPES is queried.

**What the clinician sees**: identity card populates with name, specialty,
state of practice. A `source_complete` event for `nppes` arrives within
~1 second under normal conditions.

**Verify**:
- The SSE event log includes `source_complete` with `sourceId: "nppes"`.
- `GET /api/passport/<NPI>` returns the populated identity block.
- The displayed identity matches what NPPES has — name, taxonomy, address.

**Failure mode**: NPPES timeout → check `IngestEvent` rows in the database
(`SELECT * FROM ingest_events WHERE source_id = 'nppes' ORDER BY created_at
DESC LIMIT 5;`) to see the actual upstream response.

## Step 4 — Clerk identity bind

**What you do**: nothing — this happens automatically once both sign-in and
NPI entry are complete.

**What the clinician sees**: `/holder` (the dashboard) loads with their NPI
visible in the workspace header. No re-entry of identity is required on
return visits.

**Verify**:
- `GET /api/me/workspaces` returns `{ personProfile: { npi: "<NPI>", ... } }`.
- The clerk session and the workspace NPI are linked via the
  `PersonProfile` Prisma model (per `apps/api/backend/prisma/schema.prisma`).

**Failure mode**: NPI absent on the workspace → no binding row exists in
the database. Until AUTH-1 PR268A (clinician↔NPI ownership binding) lands,
this binding is created lazily on first access; if it's missing, the
backend route that creates the row may be misconfigured.

## Step 5 — Credential issuance

**What you do**: walk the clinician through what is and is not source-checked.
Open `/truth-boundary` in a new tab and read the **WHAT VITALCV VERIFIES** vs
**WHAT VITALCV DOES NOT VERIFY** lists out loud.

**What the clinician sees**: explicit list of what's claimed vs not. No
"verified" badge is ever shown for self-attested or gated items.

**Verify**:
- `/truth-boundary` route renders (PR #325).
- The 7-state legend at the bottom is visible.

**Failure mode**: the clinician asks "is my license verified?" — answer
honestly: VitalCV verifies NPI + OIG + PECOS + Clerk session today. State
license verification is per-jurisdiction and varies (see Limitations
section).

## Step 6 — Replay persistence

**What you do**: open the browser console and inspect the response of
`GET /api/passport/<NPI>`.

**What the clinician sees**: the response carries (or will carry, post
W3-PR213A) a `replayLineage` field with `runId`, `eventDigest`, and the
ordered list of events.

**Verify**:
- Until W3-PR213A merges: `replayLineage` is absent. The `ProofManifestPanel`
  (PR #324) renders an ambiguity-visible "Manifest incomplete" message.
- Post W3-PR213A: `replayLineage.eventDigest` is a 64-char hex string. Run
  the verifier reference impl (`verifyReplayLineageDigest` from
  `apps/web/lib/trust/replay-lineage.ts`) and confirm it returns `true`.

**Failure mode**: digest mismatch → tampering OR the backend computed
the digest against a different event sequence than what's embedded.
Investigate the SSE event log; the backend MUST hash exactly the
ordered list it ships in the response.

## Step 7 — Verifier validation

**What you do**: from a separate terminal (simulating a third-party
verifier):
```
curl -X POST https://<your-domain>/api/receipts/verify \
  -H 'Content-Type: application/json' \
  -d '{"token":"<paste a real signed receipt JWT>"}'
```

**What the verifier sees**:
- `200 { verified: true, ... }` for a real signed receipt.
- `422 { verified: false, ... }` for a tampered or expired one.
- `400` for malformed input.

**Verify**:
- A successful round-trip is the end-to-end proof. If you don't have a
  signed receipt yet, this step is blocked until the issuer-side wiring
  lands (proposed CRYPTO-1 PR316A — embed `replayLineage` in the signed
  receipt body issued by `credentialIssuer.ts`).
- The JWKS endpoint at `/.well-known/jwks.json` returns the public key
  the verifier used to validate the signature.

**Failure mode**: 404 → wrong endpoint (the right one is
`/api/receipts/verify`, not `/api/credentials/verify` — common confusion
documented in PR #321 verifier quickstart).

## After the walkthrough

**Strongest onboarding moment**: typically the moment the SSE stream shows
NPPES coming back with the clinician's real name + taxonomy in under a
second. Compliance directors find this visceral — it's not a checkbox, it's
their actual federal record showing up.

**Biggest onboarding confusion**: the difference between "Source-verified"
and "Source-linked" / "Self-attested". Most clinicians initially expect
everything to be verified; the `/truth-boundary` legend exists to make this
explicit before it becomes a relationship problem.

**Biggest verifier hesitation**: lack of `replayLineage` on the artifact
today (pre-W3-PR213A). A verifier asks "how do I know this is real?" and
the answer until that PR lands is "fetch JWKS and check the signature" —
true, but the lineage is what makes the *audit trail* legible.

## First clinician verdict (template)

After the walkthrough, fill in:

```
Date: ____
Clinician name: ____
NPI: ____
Pre-flight verdict (readiness script): READY / NOT READY
Steps completed: 1 / 2 / 3 / 4 / 5 / 6 / 7
Steps blocked: ____
Strongest moment: ____
Biggest confusion: ____
Director verdict: GO / NO-GO for institutional rollout
```

Commit the filled-in verdict to `docs/pilot/verdicts/YYYY-MM-DD-<clinician>.md`
(create the directory if not present). The verdicts are append-only — never
rewrite an older verdict; supersede with a new one and reference.

## Related artifacts

- `docs/pilot/go-live-checklist.md` (PR #327) — pre-flight before first run.
- `docs/ops/clerk-google-oauth-runbook.md` (PR #314) — OAuth setup detail.
- `docs/trust-boundaries.md` (PR #325) — read out loud at Step 5.
- `docs/verifier-quickstart.md` (PR #321) — for the verifier role at Step 7.
- `scripts/check-onboarding-readiness.sh` (this PR) — Step 0 automation.
