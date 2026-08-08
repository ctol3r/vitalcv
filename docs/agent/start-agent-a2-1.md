# Start Agent A2.1 — run model, tick, claiming (shadow)

Second code sub-wave of A2, implementing §6 and the fan-out controls in §12
of [the A2 spec](./start-agent-a2-spec.md).

**The agent now runs when nobody asked. It executes nothing.**

## Shadow is a property of the code, not a flag

There is no execution path in A2.1. The tick assembles context, plans, and
records — the executor is simply not wired into it. `mode: 'shadow'` is
stamped on every run row so a later analysis can never mistake an observation
run for one that was permitted to act, but the safety does not depend on that
field being right. A2.5 is still the first sub-wave where anything runs
unattended.

## Claiming

```
POST /api/internal/agent/tick?source=cron&limit=25&dryRun=false
```

One tick claims a bounded batch of due subjects, runs each, and returns
operator-safe counts.

**Claiming is a write.** A subject is claimed by moving `nextDueAt` *forward*
in a compare-and-set — `updateMany` filtered on the row still being due,
claimed iff exactly one row changed. Same discipline as
`revocationOutboxWorker`'s PENDING→PROCESSING claim, and the reason a retried
or concurrent tick finds nothing rather than running a subject twice.

The due time moves **before** the work starts, deliberately. A tick that
crashes mid-run leaves the subject scheduled for its next interval rather
than immediately re-claimable: a crash loop that re-runs the same subject
forever is worse than a skipped cycle.

Proven against real Postgres: six concurrent ticks claim a subject exactly
once, a second tick in the same window claims nothing, disabled and not-yet-
due subjects are never claimed, and repeated failures back off exponentially
(capped) instead of consuming a slot every cycle.

## Enrollment *is* the cohort allowlist

There is deliberately no predicate anywhere in the scheduling module — no
"everyone with a verified NPI", no percentage. A subject is reachable only
because a row exists for them, which means the cohort cannot silently widen
as data changes. That is the failure cohort gating exists to prevent (§15
Q7). `enabled: false` pauses without forgetting.

## Fan-out controls, all present before the first real tick

| Control | How |
| --- | --- |
| Shadow | no executor wired; `mode` recorded on every run |
| Cohort gating | explicit enrollment; row existence is membership |
| Kill switch | `getPilotSurfaceControl('agent_tick')`, same as the apply flow |
| Bounded batch | hard ceiling of 50, default 25, `limit` clamped not rejected |
| Per-subject isolation | one subject's failure cannot end the tick |
| Dry-run default | `dryRun` defaults to true outside production |

One judgement call worth stating: **an unreadable kill switch is not a kill.**
Treating an ops outage as a stop would make the agent silently inert in
exactly the situation where nobody is watching. The bounded batch and shadow
mode are the safety there; the switch exists to stop the loop deliberately.

## Machine auth

The tick reuses `checkAuth` from the source-health probe rather than copying
it. Machine auth duplicated is machine auth where one copy quietly isn't
timing-safe. Both env secrets unset ⇒ 500, never open.

`.github/workflows/agent-tick.yml` runs hourly from `main` only, with a
`concurrency` group so ticks cannot overlap, and passes `dryRun=false`
explicitly — production is the only place the tick may consume schedule
slots, and it has to say so out loud.

## The scheduler holds no bearer

`buildProductionReaders(subjectRef, { actor: 'system_scheduler' })` passes
`token: null` explicitly rather than letting the helper try
`auth().getToken()`. The scheduler never attaches a bearer, so identity-bound
routes refuse it at the boundary instead of appearing to work. That is the
same truth A2.0 expresses at the registry, restated one layer down.

## Run model

`AgentRun` gains `trigger`, `actor`, `completeness`, and `mode`. All additive
with defaults matching the pre-A2 meaning, so existing rows keep theirs:
everything written before A2.1 was an interactive, clinician-session, full,
live run. `actor` and `completeness` come from the **plan**, not from the
caller — they cannot be overridden at the persistence boundary.

`deltaFromRunId` is in the spec's run model and is **deliberately not added
here.** A nullable column that nothing writes is exactly the defect this
program already flagged in `ActivationRequirement.dueAt` (spec §16, defect 3)
— declared, read, ordered by, never written. It lands in A2.2 with the writer.

## What the gate is

A2.1's gate is a week of shadow ticks with a sane delta rate. That is
operational evidence, not a test run, and it cannot be produced by this PR.
What this PR provides is the machinery to gather it safely.

Graph boundaries 74–76.
