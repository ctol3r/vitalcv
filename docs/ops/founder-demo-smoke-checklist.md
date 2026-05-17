# Founder demo smoke checklist

A 15-step pre-flight to run **after** the lead-capture, banned-strings,
and audit-event-visibility PRs land on `main`. Each step is a
verifiable check; the checklist intentionally avoids any production
mutation. Pair it with `scripts/smoke-founder-demo.sh` for the
fast-machine checks.

The checklist is for the founder running a live demo from their
laptop — it does **not** validate apex / Vercel state. The Vercel /
DNS / apex deployment is a separate concern (see the operator
runbook).

## Pre-flight assumptions

- The repo is on `origin/main` HEAD with the three feature PRs merged
  (lead-capture, banned-strings gate, audit-event-visibility).
- `pnpm install --frozen-lockfile` has completed without errors.
- `pnpm turbo build --filter='@vitalcv/trust-state' --filter='@vitalcv/shared'`
  has been run at least once (workspace dep prebuild).

## 1. Start local app on port 3030

```bash
pnpm --filter @vitalcv/web dev -- --port 3030
```

✅ Pass when: server logs `Ready in <Xs>` and `http://localhost:3030`
is reachable.

## 2. Open `/launch`

Visit `http://localhost:3030/launch`.

✅ Pass when: page renders the primary message
("Reusable, source-backed clinician readiness…") without auth, and
the lead-capture block is visible.

## 3. Confirm `/launch` renders without backend dependency

Stop the backend (if running). Reload `http://localhost:3030/launch`.

✅ Pass when: the page still renders. No 5xx errors. The ROI
calculator + research signals still display. The lead-capture form
still posts (it has no backend dependency — it persists locally via
JSONL).

## 4. Open `/demo`

Visit `http://localhost:3030/demo`.

✅ Pass when: index page lists all three sub-flows
(`/demo/clinician`, `/demo/employer`, `/demo/issuer`) and clicking
each navigates without auth.

## 5. Open `/demo/employer`

Visit `http://localhost:3030/demo/employer`.

✅ Pass when: three demo employer applications render, the ROI
calculator is interactive, and the Equity / Retention block shows
research signals labelled as research signals (not as VitalCV
outcomes).

## 6. Submit lead-capture form with a test email

In the lead-capture form on `/launch` or `/demo/employer`:

- Email: `founder-smoke+test@example.com`
- Intent: `pilot`

Submit.

✅ Pass when: the success state renders ("Received. We've received
your request and will follow up with the next useful step.
Reference: `<uuid>`") and no banner / promise of a response window
appears.

## 7. Confirm `/api/leads` writes JSONL

```bash
# Default path:
tail -n 1 ~/.vitalcv-logs/leads.jsonl

# Or, if LEAD_LOG_PATH is set:
tail -n 1 "$LEAD_LOG_PATH"
```

✅ Pass when: the last JSONL row matches the submission (email,
intent, source, hashed IP, sampleNpis array if applicable). The raw
caller IP must **not** appear in the row.

## 8. Confirm Slack optional failure does not break lead persistence

```bash
# Set an obviously-bad Slack webhook so the delivery fails.
SLACK_LEAD_CAPTURE_WEBHOOK_URL=https://hooks.slack.com/services/INVALID \
  pnpm --filter @vitalcv/web dev -- --port 3030
```

Submit a lead again. Inspect the API response.

✅ Pass when: response is `200 { ok: true, slackDelivered: false,
slackReason: 'http_error' | 'fetch_failed' }` AND the JSONL row was
still appended (lead is persisted even when Slack fails).

## 9. Confirm no banned-string gate failures in public demo routes

```bash
bash scripts/check-banned-strings.sh apps/web/app/launch \
                                     apps/web/app/demo \
                                     apps/web/components/lead-capture
```

✅ Pass when: the scanner exits `0` and reports `CLEAN`.

If the gate fails on a route the founder is about to show, **stop
the demo prep** and fix the copy first. See
`docs/ops/banned-strings-gate.md` for the rewrite patterns.

## 10. Walk the employer review accept flow

Visit `/review/<entity-id>` (via the demo seed) or
`/demo/employer/<id>`. Trigger the **Accept** action.

✅ Pass when: the action transitions to the success state without
500s.

## 11. Confirm `auditEventId` appears after accept

After the accept call completes, look for the audit-entry line:

```
Audit entry: <uuid> · <ISO-8601 timestamp>
```

✅ Pass when: the line is present, the UUID is monospace, and the
timestamp is recent. The line must appear **only** after the accept
succeeds — never before, never as persistent dashboard chrome.

## 12. Confirm no route claims a final credentialing decision

Walk `/launch`, `/demo`, `/demo/employer`, `/review`, `/passport`.
Visually scan for any text that implies credentialing is "complete",
"verified" (bare), "guaranteed", or "automatic".

✅ Pass when: none of these phrases appear. Status labels use
compound forms (`Source-verified`, `Source-backed`) and the
audit-entry line carries no compliance overclaim.

The banned-strings gate covers this mechanically, but the founder
should still scan once before the demo — copy in `<span>{variable}</span>`
shapes is not caught by the regex gate.

## 13. Confirm local tunnel script opens `/launch`

If `scripts/public-demo.sh` is present (lands with PR #366 / #367 /
#368), run:

```bash
scripts/public-demo.sh
```

✅ Pass when: the script prints a tunnel URL (cloudflared or
localhost.run) that resolves to `http://localhost:3030/launch`.

If the tunnel script is **absent** (the PRs haven't merged yet),
this step is **SKIP** — the smoke check still passes.

## 14. Confirm the founder can explain — in this order

The founder narrative for a 3-minute pitch:

1. **Pain** — credentialing takes 103 days (CBP benchmark); each
   day of delay costs the hospital $2,700–$5,400 per role.
2. **Source-backed readiness preview** — VitalCV runs a probe set
   against NPPES / OIG-LEIE / PECOS / the state board and surfaces
   what's checked, stale, gated, or unavailable. It is not final
   credentialing.
3. **Employer review head start** — given the readiness preview,
   an employer can record an acceptance and a start date. The
   recognition → acceptance → start ladder writes an AuditEvent
   row before any 2xx response.
4. **Lead capture** — `/launch` and `/demo/employer` collect
   email + intent into a JSONL row. Optional Slack delivery if
   `SLACK_LEAD_CAPTURE_WEBHOOK_URL` is set.
5. **Audit entry proof** — after acceptance, the UI surfaces the
   `auditEventId` + `auditRecordedAt` so the buyer can see the
   non-repudiation receipt their action created.

✅ Pass when: the founder can recite each beat without notes in
under 30 seconds.

## 15. Record known limitations — in this order

The founder must lead with these, not bury them:

- **Not final credentialing.** Acceptance is a *head start*, not a
  credentialing decision. Real credentialing remains the customer's
  responsibility.
- **Gated sources are access-required.** Any lane in
  `accessRequired` / `gated` is not decision-grade; the source-
  health panel surfaces the next operator step.
- **ROI is an illustrative benchmark.** The $2,700–$5,400/day figure
  is an OpenEvidence market benchmark, not a guaranteed VitalCV
  outcome.
- **Vercel / apex status is separate from the founder tunnel.** A
  failing apex / Vercel preview does not invalidate the local demo;
  treat the tunnel URL as the source of truth for the live walk.

✅ Pass when: each limitation is on the founder's lips before the
buyer raises it.

## Smoke script

`scripts/smoke-founder-demo.sh` automates the fast-machine portion of
this checklist:

- Verifies the required files exist (script, JSONL handler, banned-
  strings gate, audit-event UI line).
- Optionally curls `http://localhost:3030/launch` and
  `http://localhost:3030/demo` if the local server is running.
- Runs the banned-strings scanner against the public demo route
  scope.
- Prints a `PASS/FAIL/SKIP` summary table.

The script is non-mutating — it never writes to production, never
runs migrations, and never calls Slack. See its header comment for
exact behavior.
