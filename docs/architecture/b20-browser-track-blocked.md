# B20 Browser Track — Blocked

**Status**: production runtime still intercepted by Vercel paused state.

Per the B20 operator-recovery wave directive:

> BROWSER TRACK ONLY EXECUTES AFTER:
> HTTP 402 IS CLEARED.
>
> DO NOT FABRICATE RESULTS.
>
> IF STILL PAUSED:
> state explicitly:
> "production runtime still intercepted by Vercel paused state."

## §1 — Explicit statement

**Production runtime still intercepted by Vercel paused state.**

The five Browser-track missions cannot execute from a build session
while apex returns HTTP 402:

- B20-BROWSER-01 (production restore validation)
- B20-BROWSER-02 (signing identity validation)
- B20-BROWSER-03 (activation experience validation)
- B20-BROWSER-04 (operational trust validation)
- B20-BROWSER-05 (final reality verdict)

None of these are fabricated. None of them have results.

## §2 — What unblocks them

Operator-side: clear the HTTP 402 per `pause-root-cause-report.md`
§2 (diagnostic) and `production-restore-sequence.md` §3 (resume
procedure).

Once the pause is cleared and the canonical Vercel project is
operator-confirmed, the Browser track can execute by either:

- An operator running `scripts/verify-production-runtime.sh` (which mechanically performs B20-BROWSER-01 and B20-BROWSER-02 inputs).
- A rendered-UI reviewer running B20-BROWSER-03 / 04 / 05 against the live apex.

## §3 — What the Code track CAN say about expected outcomes

Code-level analysis (already in this PR's docs) lets us predict what
each Browser-track probe SHOULD return once the pause clears:

| Probe | Expected outcome (assuming env vars set per `production-env-requirements.md`) |
|---|---|
| B20-BROWSER-01 apex 200 | `/api/health` returns 200, JSON, `service: "web"` |
| B20-BROWSER-02 JWKS kid | `vcv-es256-1` if env is set; OR 500 (fail-closed) if env missing |
| B20-BROWSER-02 dev-kid check | No surface should emit any kid containing `"dev"` |
| B20-BROWSER-03 activation | Cannot predict; requires rendered-UI judgment |
| B20-BROWSER-04 trust | Cannot predict; requires rendered-UI judgment |
| B20-BROWSER-05 verdict | Best-case after operator action: "operational pilot system." Cannot be confirmed without rendered-UI review. |

Predictions are NOT verifications. They become verifications when an
operator runs the smoke script against the unpause runtime.

## §4 — Recommended operator sequence

1. **Clear the pause** — `pause-root-cause-report.md` §2 probes; resolve the cause.
2. **Configure env vars** — `production-env-requirements.md` §1–§4.
3. **Trigger a new deploy** — `production-restore-sequence.md` §3.
4. **Run the smoke script** — `scripts/verify-production-runtime.sh`. Output is a PASS/FAIL table.
5. **Verify against the docs** — cross-reference the smoke output with `signing-identity-convergence-report.md` §2 (signing surfaces) and `runtime-state-clarity-matrix.md` §2 (state identification).
6. **Browser-track rendered review** — open the live homepage, passport, onboarding, employer surfaces; evaluate against B20-BROWSER-03/04/05 criteria.

Once 1–5 pass, step 6 can produce the final verdict that B20-BROWSER-05 requests.

## §5 — Single-sentence honest answer

**The Browser track is blocked by the upstream operator action of
clearing the HTTP 402 pause. No code change can replace that step.**
