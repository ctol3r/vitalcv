# Authenticated SSE Smoke Runbook — NPPES Truth-State Verification

Operator-safe runbook for verifying PR #423's NPPES truth-state correction is live in production. **No credentials are shared with agents.** All authentication happens in the operator's own browser session or terminal.

## When to run this

After:
- `https://api.vitalcv.com/health` reports a `git_sha` of `9f272c80ce842366a4ee43274b6584668c0a9e0c` or a descendant.
- Operator is signed into VitalCV in their own browser (so the session cookie is local to the operator).

This smoke is the last gate that moves NPPES truth-state from "deployed" to "validated live" on the completion board.

## Preconditions checklist

- [ ] `curl -fsS https://api.vitalcv.com/health` returns `"status":"ok"` AND `"git_sha":"9f272c80c…"` (or a descendant of that commit on `main`).
- [ ] Operator signs in to VitalCV in their own browser. **Do not** create a new account for this smoke; reuse an existing internal/staff/test account.
- [ ] Operator does **not** paste session cookies, JWTs, or `x-clerk-user-id` headers into chat, code, or any agent context.
- [ ] No `.env` or secret file is touched.

If any precondition fails, stop and re-check `/health` first.

## Browser path (preferred — no credential surfacing)

This is the safest path. The operator's browser holds the session cookie; nothing leaves the operator's machine.

1. Open `https://vitalcv-web-production.up.railway.app/passport?npi=1699264564` in the signed-in browser.
2. If the page shows the NPPES Passport surface populated with **VICTORIA ELIZABETH FISCHER, MD** and an "identity confirmed against NPPES" indicator (or equivalent source-confirmed copy), proceed to step 3. If the page shows a no-payload / source-unavailable state, **stop and classify as `PATCH LIVE BUT SOURCE NO-PAYLOAD`** (see Failure classifications below).
3. Open browser DevTools → Network tab → enable "Preserve log".
4. Trigger a fresh ingest (typically a "Refresh" or "Re-check sources" button on the Passport page).
5. In the Network tab, find the `POST /api/ingest/1699264564` request. Note its `runId` from the response JSON.
6. Find the `GET /api/ingest/stream/<runId>` request. Click on it → Response (or EventStream) tab. Watch for `source_complete` events.
7. For each `source_complete` event, record:
   - `sourceId` (e.g. `nppes`, `oig`, `pecos`)
   - `status` (`SUCCESS` / `FAILED`)
   - `resultStatus` (`SUCCESS` / `FAILED`)
   - presence of `displayName`, `identityStatus`, `entityId` (NPPES only)

## Terminal/curl path (only if operator already has a session cookie)

Use this only if the operator has, *on their own machine*, already extracted a session cookie or JWT from their browser. **Never paste cookies into chat or copy them into any agent's working directory.**

```bash
# Operator-only — never run from agent context. Cookie value pulled from operator's browser.
BASE=https://vitalcv-web-production.up.railway.app

# 1. Trigger ingest (auth-gated).
#    Replace $SESSION_COOKIE locally with the operator's actual cookie value.
RUNID=$(
  curl -fsS -X POST -m 20 \
       -H "Cookie: $SESSION_COOKIE" \
       "$BASE/api/ingest/1699264564" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["runId"])'
)

# 2. Stream source_complete events.
curl -sSN -m 30 \
     -H 'Accept: text/event-stream' \
     -H "Cookie: $SESSION_COOKIE" \
     "$BASE/api/ingest/stream/$RUNID" \
  | grep -E '"sourceId"|"status"|"resultStatus"' \
  | head -40
```

When done, **clear the variable** (`unset SESSION_COOKIE`) and clear shell history if the cookie ended up there (`history -c` or remove the matching line in `~/.zsh_history`).

## Expected result

A live PR #423 deployment with intact NPPES payload should produce:

| Source | `status` | `resultStatus` | Other fields |
|---|---|---|---|
| `nppes` | `"SUCCESS"` | `"SUCCESS"` | `displayName` non-empty, `identityStatus` non-empty AND not `"UNKNOWN"`, `entityId` non-empty |
| `oig` | `"FAILED"` (acceptable until OIG live) | matches `status` | n/a |
| `pecos` | `"FAILED"` (acceptable until PECOS live) | matches `status` | n/a |
| `state_board` / `fsmb` / `nursys` | `"FAILED"` (acceptable until live) | matches `status` | n/a |

**Critical truth-state invariants:**

- `status` and `resultStatus` MUST agree for every source. If any source shows `status: "SUCCESS"` AND `resultStatus: "FAILED"` (or vice versa), the extras-spread ordering has regressed. Classify as `TRUTH-STATE CONTRADICTION` and stop.
- NPPES `status: "SUCCESS"` requires the full payload gate (`displayName` + `identityStatus ≠ UNKNOWN` + `entityId`). If `status: "SUCCESS"` is emitted without these, classify as `RUNTIME FAILURE`.
- OIG/PECOS/STATE_BOARD/FSMB/NURSYS must NEVER be promoted to `SUCCESS` by the same path. Per PR #423, only NPPES has the promotion gate.

## Failure classifications

| Class | Symptom | Likely cause | Next step |
|---|---|---|---|
| **AUTH BLOCKED** | `POST /api/ingest/...` returns `403` or `x-cors-blocked`; browser was not signed in or session expired. | Operator session missing. | Operator re-signs in; do NOT bypass auth from agent context. |
| **PATCH LIVE BUT SOURCE NO-PAYLOAD** | API reports modern `git_sha`, but NPPES `source_complete` shows no `displayName` / no `identityStatus` / no `entityId` — i.e. an empty payload. `status` correctly stays `FAILED`. | NPPES source outage, adapter timeout, or auth/rate-limit on the upstream NPPES proxy. NOT a PR #423 regression. | Open the next wave: `docs/ops/nppes-source-health-next-wave.md`. |
| **DEPLOYMENT GAP** | `/health` reports a `git_sha` older than `9f272c80c`. | Railway has not yet picked up the merge, or the deploy is queued. | Wait 10–30 min and poll again. If still stale after 1 hour, operator manually triggers a redeploy in `inspiring-reflection` / `delightful-essence`. |
| **RUNTIME FAILURE** | API responds but emits a malformed `source_complete` payload, missing required fields, or 500-class errors. | Code regression beyond the truth-state slice; or a downstream dependency failure. | Capture the runId, the full `source_complete` event JSON (with PHI redacted), and open a runtime triage wave. |
| **TRUTH-STATE CONTRADICTION** | `status` and `resultStatus` disagree for the same source. | Extras-spread ordering regression — the very class of bug PR #423 fixes. | Roll back PR #423 or land a follow-up fix. This should never happen on `>= 9f272c80c`. |

## Safety constraints (do not violate)

1. **No credential sharing with agents.** Do not paste cookies, JWTs, `x-clerk-user-id`, or any session material into chat, code comments, agent prompts, or `.env` files in the workspace.
2. **No account creation by agents.** Agents must not run signup flows; only an operator's existing account.
3. **No secrets in logs.** When capturing SSE event output for an incident, redact any field that could contain a session identifier, a clinician SSN/DOB, or an internal token. Keep only `sourceId`, `status`, `resultStatus`, `runId`, and the NPPES gate fields (`displayName`, `identityStatus`, `entityId`).
4. **No Railway / DNS / env / secret mutation** as part of this smoke. The smoke is read-only against a live service.
5. **No Prisma migrations** as part of this smoke.

If the smoke surfaces an actionable bug, open a *new* wave with a `fix/` branch — do not patch from inside this runbook.

## Audit trail to keep

For each smoke run, record on the wave ledger:

- Date / time (UTC)
- API `git_sha` from `/health` at run time
- runId issued for the smoke
- Per-source `status` / `resultStatus` summary (no PHI, no cookies)
- Classification (PASS, AUTH BLOCKED, PATCH LIVE BUT SOURCE NO-PAYLOAD, etc.)
- Next action

That's enough to move Product Truth Contract from "merged + deployed" to "validated live" on the completion board, without ever surfacing operator credentials.
