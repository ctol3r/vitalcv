# Pause Root Cause Report

**B18-TRUTH-02 deliverable.** Diagnostic guide for resolving the
HTTP 402 "This deployment is temporarily paused" response from
`vitalcv.com`. Operator-runnable; does not itself probe Vercel.

## §1 — What HTTP 402 from Vercel means

Vercel emits HTTP 402 "Payment Required" / "Temporarily paused" in
exactly these cases:

| Cause | Triggered by | Recovery |
|---|---|---|
| Spending limit hit | Plan's spending cap reached | Raise cap, upgrade plan, or wait for next billing cycle reset |
| Payment failure | Card declined, expired, or removed | Update payment method; Vercel auto-resumes after successful charge |
| Manual project pause | An admin set Settings → General → "Pause project" | Toggle off in the same setting |
| Manual deployment pause | An admin clicked "Pause" on a specific deployment | Resume from Deployments tab menu |
| Account suspension | Anti-abuse / TOS / compliance hold | Vercel-support-required |
| Team transfer in progress | Project is mid-migration between teams | Wait for transfer completion or roll back |

Generic application errors (500/502/503) do NOT use 402. So the 402
specifically isolates the cause to one of the six rows above.

## §2 — Operator diagnostic sequence

Run in order; stop at the first match.

### Probe A — Billing surface check

Vercel dashboard → the canonical project (per `production-restore-sequence.md` §1) → Settings → Billing.

| What to look for | If found, cause is |
|---|---|
| Red "Spending limit reached" banner | Spending limit |
| "Payment method declined" notice | Payment failure |
| Plan badge says "Pause" | Plan-level pause |
| "Project is currently paused" notice | Manual pause |
| No banners but deployment-tab shows "Paused" badges | Deployment-level pause |

### Probe B — Audit log (if available on plan)

Settings → Audit Log → filter to last 24 hours. Look for entries
containing:

- `project.paused`
- `deployment.paused`
- `billing.limit.reached`
- `payment.failed`
- `account.suspended`

The most recent such entry names the cause and the actor (system or
admin).

### Probe C — Recent deployments

Deployments tab → most recent. The deployment card displays its
state explicitly. Possible states:

| State | Meaning |
|---|---|
| Ready | Healthy; 402 would not come from this deployment. If apex returns 402 anyway, the apex is attached to a DIFFERENT (paused) project. |
| Paused | This deployment is the 402 source |
| Error | Build failed; 402 not from this. Usually 500 instead. |
| Queued | Build pending; previous deployment serves traffic. |

If state is Ready and apex still 402s: domain attachment issue —
apex is bound to a stale paused project. See
`domain-topology-audit.md` for the resolution.

### Probe D — Team / account level

Profile / Team menu → Account Settings → Billing. The team-level
billing state can pause all projects regardless of per-project
state.

## §3 — Five most likely root causes (ranked by frequency)

Based on Vercel's documented 402 conditions, ordered by typical
frequency in our context:

1. **Spending limit hit on Hobby/Pro plan** (most common after a traffic spike or accidental loop)
2. **Manual pause** (admin paused the project to control spend or stop deploys)
3. **Payment failure** (card expired, especially on auto-renewing plans)
4. **Team transfer mid-flight** (project migrating between teams)
5. **Account suspension** (rare; almost always communicated by email first)

## §4 — Required answers to diagnose

| Question | Source of answer |
|---|---|
| Canonical Vercel project name? | Operator (Vercel dashboard) — DO NOT presume from prior docs |
| Is the project itself paused? | Settings → General |
| Is a recent deployment paused? | Deployments tab |
| Has the spending limit been hit? | Settings → Billing |
| Is the payment method valid? | Settings → Billing → Payment Method |
| Is the team / account suspended? | Account-level banner on login |

Each row maps to one of the six causes in §1. Answering all six
makes the cause deterministic.

## §5 — Resolution path per cause

### Spending limit
Settings → Billing → Spending Limits → raise the limit OR upgrade plan. The pause clears on save; an existing deployment will serve traffic immediately.

### Manual project pause
Settings → General → toggle "Pause project" OFF. Deployments resume.

### Manual deployment pause
Deployments tab → the paused deployment → three-dot menu → "Resume". Or trigger a new deployment which will supersede the paused one.

### Payment failure
Settings → Billing → Payment Method → update card. Vercel charges immediately; on success, pause auto-resumes.

### Team transfer
Wait for the transfer to complete (Vercel shows a banner with progress). If stuck for >24 hours, contact Vercel support.

### Account suspension
Contact Vercel support with the team / account slug. Provide context: which project, when traffic started failing, any unusual activity.

## §6 — What to do AFTER resolving the pause

Per `production-restore-sequence.md` §4–§7:

1. Verify apex returns 200 (not 402).
2. Verify the runtime is `apps/web` (`service: "web"` from `/api/health`).
3. Verify env vars are set on Production scope.
4. Run the full signing-identity convergence probe.
5. Smoke-test ingest + replay readers.

## §7 — Single deterministic answer

```
GIVEN: vitalcv.com returns HTTP 402

THEN: production is paused at one of:
  1. Spending limit
  2. Manual project pause
  3. Manual deployment pause
  4. Payment failure
  5. Team transfer
  6. Account suspension

OPERATOR ACTION: check Vercel dashboard for the canonical project
  (per production-restore-sequence.md §1) and walk Probes A–D in §2
  of THIS document. The first probe to show a banner / state / log
  entry names the cause.

ESCALATION CONDITION: if no probe surfaces a cause AND apex still
  402s after a forced new deploy → contact Vercel support.
```

## §8 — What this report does NOT do

- Does NOT identify the canonical Vercel project (that's `production-restore-sequence.md` §1).
- Does NOT modify Vercel settings (operator-only).
- Does NOT replace the operator's authentication into Vercel.
- Does NOT presume `vcv-web` or any specific project name is canonical.

The repo is healthy. The pause is platform-side and operator-
resolvable through dashboard or CLI action. No code change can clear
a 402.
