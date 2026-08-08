# VitalCV Start Agent — A2 design spec

**Status: design/spec only. No implementation in this branch.** A2 coding is
gated on acceptance of this spec.

Base: A0 (kernel, PR #1113) and A1 (consented execution, PR #1123 at
`d449ed36a`). Everything below assumes both land unchanged.

---

## 1. What A2 is

A0 and A1 are **request-scoped**. A clinician arrives, a plan is generated
for that moment, and an action runs because they clicked. Close the tab and
the agent ceases to exist.

A2 makes the agent **persistent**: it runs when nobody asked, notices that
something changed, tracks time, and keeps source evidence from going stale
underneath a clinician who has moved on with their life.

The product difference is the difference between

> *"When I log in, VitalCV tells me what to do next."*

and

> *"VitalCV noticed my license observation was about to age out, refreshed it,
> and the only reason I know is that it told me it was done."*

That second sentence is the whole point of the wave. Everything in this spec
exists to make it true without making it a lie.

### The single hardest thing about A2

Every safety property A1 established was enforced *at a moment when a human
was present*. Consent was verified at execution time — and execution time was
"three seconds after they clicked." A background loop breaks that coupling.
The clinician is not there. The session does not exist. The approval may be
weeks old.

So A2 is not "A1 on a timer." It is A1 plus an explicit theory of **what the
agent may do when no one is watching**, and that theory has to be stated
before any of it is built.

---

## 2. Doctrine

Carried forward unchanged from A0/A1:

- The agent consumes truth; it never manufactures it.
- The plan does not authorize anything; the consent ledger does.
- Owners are real: clinician, employer, source, and other institutions own
  their own steps, and VitalCV never does those on their behalf.
- Every refusal is named and honest. A failure is never recorded as a success.
- Governed learning only: observe → diagnose → propose → replay → shadow →
  canary → promote. No self-modification.

A2 adds three:

**D1 — The agent may do work for you in the background. It may not disclose
you in the background.** Refreshing a source, noticing a change, preparing a
request: these are reversible, private, and leave no trace outside VitalCV.
Sharing an evidence packet with an employer is none of those things. The line
is drawn at *disclosure*, not at permission level, because that is the line a
clinician would draw.

**D2 — A background run is a weaker actor than a clinician session, and that
weakness is structural.** Not a convention, not a code review rule: the
scheduler literally cannot reach the tools that require a live clinician
identity (§4).

**D3 — Waking someone up is an action with a cost.** A notification that did
not save the clinician work is a failure of the agent, even if the clinician
opened it. §10 makes this measurable rather than aspirational.

---

## 3. What A2 must not become

Stating this up front because the gravitational pull is strong and every one
of these is a plausible-sounding next step:

- **An engagement product.** The north star is days from accepted offer to
  start. A daily digest that people enjoy reading and that changes nothing is
  a regression. D3 exists to make that measurable.
- **A notification firehose.** Cadence is bounded per clinician, and the
  bound is a product decision, not a config default nobody revisits (§10).
- **An autonomous discloser.** See D1. This is the one that would be
  genuinely hard to walk back — a packet sent to the wrong employer cannot be
  recalled by revoking a consent scope.
- **A second source of truth about time.** Deadlines come from whoever owns
  them. VitalCV's own freshness preferences are labeled as preferences (§8).

---

## 4. Actors: what happens when the session disappears

### The problem, concretely

A1's reader wiring is `buildProductionReaders(userId)`, which calls
`buildIdentityHeaders({ userId })` to produce a Clerk bearer for the backend.
A scheduled run has no session and therefore cannot mint one. Every canonical
route guarded by `requireVerifiedClerkUserId` — the ownership read and the
apply-share — is unreachable from a background run.

There is no service-account, machine-token, or impersonation mechanism in the
codebase that satisfies that guard. Inventing one means creating a credential
that can act as **any clinician**, which is the single most dangerous asset
this system could hold. A2 should not do that as a side effect of wanting a
cron job.

### The design: actor-scoped tool availability

Introduce an orthogonal axis to the existing permission model:

```
AgentActor = 'clinician_session' | 'system_scheduler'
```

`permission` answers *what kind of action is this*. `actor` answers *who is
driving*. The tool registry gates on both. Each tool declares the actors that
may invoke it:

| Tool | clinician_session | system_scheduler | Why |
| --- | --- | --- | --- |
| `npi_identity_resolution` | ✅ | ✅ | public registry, no identity needed |
| `source_observation_retrieval` | ✅ | ✅ | anonymous canonical read |
| `trigger_source_refresh` | ✅ | ✅ | header-authenticated, not session-bound |
| `consent_state_retrieval` | ✅ | ✅ | our own ledger, subject-keyed |
| `action_history_retrieval` | ✅ | ✅ | our own telemetry |
| `ownership_state` | ✅ | ❌ | requires verified clinician identity |
| `clinician_profile_retrieval` | ✅ | ❌ | requires verified clinician identity |
| `execute_apply_share` | ✅ | ❌ | disclosure — D1, and requires verified identity |

A scheduler run that needs an unavailable tool does not fail and does not
guess. It records the gap the way A1 already records input gaps, and the plan
it produces is **explicitly marked as reduced**.

### Reduced context is a first-class state, not a degradation

`StartAgentContext` gains `completeness: 'full' | 'reduced'` plus the actor
that assembled it. A reduced context has real consequences the spec must
honor:

- The scheduler cannot read ownership state. It must therefore **assume the
  most conservative ownership posture** and never derive an ownership-cleared
  action. It may not, for example, decide a share is now unblocked.
- A plan generated from a reduced context is **not shown to the clinician as
  the current plan**. It drives background work and change detection. When
  the clinician next appears, a full plan is generated in-session — and that
  full plan is what they see.
- Deltas computed between a reduced plan and a full plan are suspect by
  construction and must be marked as such, or the agent will "notice" changes
  that are really just the difference between what the two actors can see.
  **Rule: deltas are only computed between two plans of the same
  completeness.** This is subtle and is exactly the kind of thing that
  produces phantom notifications if left implicit.

### Why this is the right call rather than building impersonation

It converts an authorization problem into a capability problem, which is
enforceable in code and testable in the bench. It also means A2 can ship
while the Clerk `off → shadow → enforce` rollout
(`docs/ops/clerk-jwt-verification-rollout.md`) proceeds on its own timeline,
because A2's background half never needed verified identity in the first
place.

If we later decide the scheduler must act with full clinician authority, that
is a **separate, explicitly-designed wave** with its own threat model — not a
flag flip inside A2.

---

## 5. Consent under autonomy

This is the section to argue with.

### The problem

A1 consent is a point in time: the clinician approved *this action* and the
proof was minted seconds later. If a scheduled run picks up a
three-week-old grant and acts on it, the ledger technically still says
`granted` — but the clinician approved a thing in a context, and the context
has moved.

### The design: two consent kinds

`AgentConsentEvent` gains `consentKind: 'point' | 'standing'`.

**Point consent** (A1's behavior, unchanged as the default): approval for an
action to run *now*, with the clinician present. A proof may only be minted
within a short freshness window — proposed **15 minutes** — after which the
grant lapses for execution purposes. The ledger row is not deleted; the head
simply stops satisfying proof minting, and the clinician is asked again. This
closes a hole A1 currently has: an unexecuted grant stays executable forever.

**Standing consent**: an explicit, separately-worded decision — *"keep doing
this for me"* — carrying a mandatory `expiresAt` (proposed maximum **90
days**) and revocable at any time. Only standing consent authorizes a
background run to execute anything at Level 3.

### Which actions may ever hold standing consent

Per D1, standing consent is available **only for non-disclosing actions**. In
A2 that means:

- ✅ `refresh_source_observation` — already Level 2, doesn't strictly need
  consent, but standing consent is what makes proactive refresh *legible* to
  the clinician rather than something that quietly happens.
- ❌ `prepare_share_packet` / `execute_apply_share` — disclosure. Stays point
  consent, clinician present. Forever, unless a future wave makes a
  deliberate, separately-reviewed case.

That yields a clean sentence for the product surface: **"VitalCV can keep
your evidence current on its own. It will always ask before showing it to
anyone."**

### Consequences for the ledger

The `seq`-serialized ledger from the A1 revision already handles the
transitions. Additions:

- `consentKind` and `expiresAt` on the event.
- `verifyAgentConsent` gains the freshness rule: a `point` head older than
  the window does not mint a proof; a `standing` head past `expiresAt` does
  not mint a proof. Expiry is evaluated at proof time against an injected
  clock, so it is testable and cannot drift.
- Expiry is **not** a ledger write. Nothing sweeps the table to mark grants
  expired — a background writer racing the head is exactly the ambiguity the
  `seq` design exists to prevent. Expiry is a read-time predicate.

---

## 6. Runs, triggers, and the scheduler

### Run model

`AgentRun` gains:

- `trigger: 'interactive' | 'scheduled' | 'event'`
- `actor: 'clinician_session' | 'system_scheduler'`
- `completeness: 'full' | 'reduced'`
- `deltaFromRunId` — the prior run this one was diffed against (nullable)

Existing columns (`planId`, `contextFingerprint`, `policyVersion`, blockers,
ranked actions) carry over unchanged. Runs remain append-only.

### Triggers

1. **Time-based.** A due-date per subject, not a global sweep. A subject
   becomes due based on the shortest relevant source cadence and any
   approaching deadline — not "everyone at 6am," which would produce a
   thundering herd against rate-limited public sources.
2. **Deadline-driven.** Wake at defined offsets before a *source-set* or
   *employer-set* deadline (§8).
3. **Event-driven.** An external state change we can observe — most
   importantly employer review transitions. A2 should **poll our own
   database** for these rather than wait for the `OutboxEvent` table to gain
   a drainer; the data is local and polling is honest and simple.

### Scheduling mechanism: reuse the established pattern

The repo already has exactly one working pattern for scheduled production
work: **GitHub Actions cron → `CRON_SECRET` bearer → internal endpoint on the
deployed web app**. `source-health-probe.yml` runs this every 15 minutes
against `/api/internal/source-health/probe?source=cron`, and
`release-verify.yml` every 30.

A2 uses the same shape rather than introducing a worker process or a queue
library:

```
POST /api/internal/agent/tick?source=cron    (Bearer CRON_SECRET)
```

One tick claims a bounded batch of due subjects, runs each, records a run and
its deltas, and returns operator-safe counts. Bounded batch size is what
keeps a tick's blast radius and runtime predictable.

Worth naming: GitHub Actions cron is not a precise scheduler (it can be
delayed under load), and this couples production cadence to a CI product.
That is acceptable for A2 at pilot scale and matches what the platform
already relies on for source-health. If A2 graduates past pilot, a Railway
cron service is the natural migration and the endpoint contract does not
change.

### Idempotence

The A0 deterministic plan id already means an unchanged subject re-plans to
the same content. A tick that runs twice must not double-execute: **claiming
a subject for a tick is a write** (`nextDueAt` moves forward before the work
starts), so a concurrent or retried tick finds nothing to claim. This is the
same serialization discipline as the consent ledger and should reuse it
rather than inventing optimistic locking.

---

## 7. Change detection

### The finding that shapes this section

`contextFingerprint` and `planId` **cannot** be used for change detection.
Both hash the whole context including `collectedAt`, so they change on every
single run even when nothing meaningful moved. Verified empirically against
the bench fixtures: advancing only the clock changes both, while the derived
blockers and ranked actions are byte-identical.

Any A2 implementation that reaches for "did the fingerprint change?" will
report a change every tick, wake the clinician every tick, and be wrong every
tick.

### The design: `PlanDelta` over decision content

Compute the delta between two same-completeness plans over their
*decision-relevant projection only*: blocker ids and types, action ids with
status and executability, the top-ranked action, and lane statuses — never
timestamps, never evidence `observedAt`, never the fingerprint.

Typed change kinds, each carrying an owner and a materiality:

| Kind | Material? | Example |
| --- | --- | --- |
| `blocker_opened` | yes | a lane went stale, a requirement appeared |
| `blocker_cleared` | yes | a refresh landed and the lane is current |
| `action_became_executable` | yes | consent granted, dependency satisfied |
| `action_became_blocked` | yes | a dependency regressed |
| `top_action_changed` | sometimes | only if the new top action has a different owner or type |
| `external_state_changed` | yes | employer opened or reviewed the packet |
| `deadline_entered_window` | yes | a source-set expiry crossed a notice offset |
| `observation_refreshed_no_change` | **no** | the whole point of separating this out |

`observation_refreshed_no_change` existing as an explicit non-material kind is
deliberate: it is the most common thing that will happen, it must be recorded
for the learning loop, and it must never reach the clinician.

### Delta persistence

Deltas are rows, not derived-on-read, because the learning loop needs to ask
"what did we notice, and did anything come of it?" months later. They join
the existing chain by `planId` / `runId` and reuse `AgentEvent` for the
lifecycle rather than growing a parallel event system.

---

## 8. Deadlines

### Provenance is mandatory

A deadline is a claim about the world and gets the same treatment as
evidence. `DeadlineProvenance`:

| Class | Meaning | May be stated as fact? |
| --- | --- | --- |
| `source_set` | the authority says so (license expiration, receipt TTL) | ✅ |
| `employer_set` | the employer says so (`ActivationRequirement.dueAt`) | ✅ |
| `vitalcv_policy` | our own freshness preference | ⚠️ only as *our* preference |
| `estimated` | a projection | ⚠️ only with the qualifier inside the value |

The `vitalcv_policy` distinction is the one that will be violated if it is not
enforced structurally. "Your license expires in 12 days" and "our preferred
freshness window closes in 12 days" are completely different sentences, and
only one of them is about the clinician's license.

### A deadline is not a blocker

Deadlines do not create blockers — they change the **urgency** of existing
ones. This keeps the A0 blocker model intact and avoids a generic
"deadline" bucket, which is the same mistake as a generic `incomplete` flag.
Ranking gains urgency as an input; the six tiers stay as they are.

### Flagged defect: the existing expiration scanner fabricates deadlines

`apps/api/backend/src/services/monitoring/expirationScanner.ts` computes
`estimatedExpiry = (verifiedAt ?? createdAt) + 365 days` for **every**
verification artifact regardless of source, then emits `EXPIRED` /
`CRITICAL` / `WARNING` alerts carrying that invented ISO date and a
`daysRemaining` count. Nothing in that number came from an authority. It is
consumed by `monitoringEngine` and `alertEngine`.

A2 **must not** consume this scanner as a deadline source. Its output is an
`estimated` projection wearing the clothes of a `source_set` fact, and
feeding it into a system that wakes clinicians up would turn a dormant
inaccuracy into an active one.

This is out of A2's scope to fix, but it should be tracked separately — it is
the same failure class as the fabrication cluster the platform has already
had to clean up once. **Recommend a separate remediation ticket before any
A2 deadline work begins**, since A2's deadline model is the natural place
someone would wire it in.

---

## 9. Source refresh scheduling

Rules, in priority order:

1. **Never refresh faster than the source's own cadence.** A source that
   updates monthly, polled hourly, produces load and no information. Cadence
   comes from the canonical `SOURCE_REGISTRY`, not from an agent-side guess.
2. **Refresh only what matters.** Lanes required for a role the clinician is
   actually pursuing, plus lanes already carrying evidence that is aging.
   Not every lane for every clinician.
3. **Global per-source budget.** A ceiling per source per hour across all
   clinicians, enforced centrally, so the fleet cannot collectively hammer a
   public registry. When the budget is exhausted the tick defers rather than
   queues indefinitely.
4. **Backoff and pause.** Reuse A1's repeated-failure pause
   (`REPEATED_FAILURE_THRESHOLD`) rather than adding a second retry policy.
5. **A scheduled refresh must be distinguishable from a clinician-initiated
   one** in the audit trail — the `?source=cron` attribution precedent from
   the source-health probe. Without it, every observation looks
   clinician-driven and the ledger carries no information about why it
   happened.

Interaction with source health: when a lane is `UNAVAILABLE`, scheduled
refresh should defer rather than retry into a wall. The source-health
snapshots already exist and should gate the tick.

---

## 10. Noticing vs. telling

### Scope recommendation: A2 notices; delivery is a separate gate

A2 should **produce and persist material deltas**, and stop there. Delivery
to a human should be its own sub-wave with its own review, for three reasons:

1. Outbound comms is the most irreversible thing in this design. A wrong
   packet share is recallable-ish; a wrong email is not.
2. The existing surface is thin — `INotificationProvider.send(to, subject,
   body)`, Resend-backed via `RESEND_API_KEY`, stub-logging otherwise. There
   is no clinician-level notification preference model, no opt-out, and no
   in-app notification store. All three are prerequisites, and none of them
   is agent work.
3. The provider already carries the right doctrine —
   `isEmailDeliveryConfigured()` exists specifically so callers never claim
   "sent" when the environment can only log. A2 must inherit that honesty:
   the agent may never record `notified` when delivery was a no-op.

### When delivery does land, the rules

- Only material deltas, and only those with an action the clinician can take
  or an external change that affects their start.
- Bounded cadence per clinician, with the bound stated in the product surface
  so it is a promise rather than a setting.
- Never a summary of things that did not change. `observation_refreshed_no_change`
  never reaches a human.
- The success metric is **blocker-resolution time**, not opens (D3).

---

## 11. Application coordination

The smallest useful version: watch the canonical employer review state for
submitted applications and turn transitions into deltas.

- `shared → opened` is a delta but arguably **not** material to notify on:
  opening is not reviewing, and telling a clinician "someone looked at your
  packet" invites exactly the over-reading A1's copy contract works to
  prevent. Recommend recording it, not sending it.
- `opened → reviewed` is material.
- Requirement status transitions on `ActivationRequirement` are material when
  the owner is the clinician (something is now theirs to do).

The honesty gate from `clinicianActivationView` — an empty requirement ledger
is `not_started`, never `requirements_met` — carries over unchanged. A
scheduled run must not read "no blockers found" as readiness, which is a
mistake that gets easier to make when no human is reading the output.

---

## 12. Fan-out safety and rollout

A request-scoped bug affects one clinician who is present to notice. A
scheduled bug affects everyone at once and nobody is watching. Controls, all
of which should exist before the first real tick:

- **Shadow first.** The tick runs, plans, computes deltas, and records
  everything — and takes no action and sends nothing. This is the same
  governed-learning shape already in the doctrine, and it is how we learn the
  real delta rate before it can hurt anyone.
- **Cohort gating.** An explicit subject allowlist, not a percentage.
- **Kill switch.** Reuse `getPilotSurfaceControl` — the precedent already
  gates the apply flow and returns a 503 when tripped.
- **Per-tick caps.** Bounded subjects per tick and bounded actions per
  subject per day.
- **A dry-run mode that is the default** in any non-production environment.

Staging:

| Sub-wave | Content | Gate to proceed |
| --- | --- | --- |
| A2.0 | Actor model, reduced context, actor-scoped tool availability | Bench proves scheduler cannot reach identity-bound tools |
| A2.1 | Run model, tick endpoint, claiming, **shadow only** | A week of shadow ticks with a sane delta rate |
| A2.2 | `PlanDelta` + persistence + temporal bench | Deltas match hand-labeled expectations |
| A2.3 | Deadlines (provenance-typed) | Expiration-scanner remediation landed first |
| A2.4 | Scheduled source refresh with budgets | Source-health gating proven; no budget breach in shadow |
| A2.5 | Standing consent + background Level 2 execution | Consent-kind semantics accepted |
| A2.6 | Notification delivery | Separate review; preferences + opt-out exist |

A2.5 is the first sub-wave where the agent *does* something unattended.
Everything before it is observation.

---

## 13. START-Bench: temporal scenarios

A2 needs a bench shape A0/A1 do not have. Current scenarios evaluate **one
state**. A2's behavior is about **transitions**, so temporal scenarios are
*pairs*: prior context + next context → expected delta set + expected
materiality + expected notification decision + forbidden claims.

Minimum new coverage:

1. Clock advances, nothing else — expect **zero** material deltas. (The
   fingerprint trap from §7. This is the single most important new scenario.)
2. Refresh succeeds, status unchanged — `observation_refreshed_no_change`,
   not material.
3. Refresh succeeds, stale → current — `blocker_cleared`, material.
4. Lane goes stale — `blocker_opened`, material.
5. Employer `opened` → recorded, not notified.
6. Employer `opened → reviewed` — material.
7. Source-set deadline enters notice window — material, urgency changes,
   no new blocker type.
8. VitalCV-policy freshness window closes — material but must be phrased as
   our preference, and a forbidden-claim assertion pins it.
9. Standing consent expires between runs — the action stops being executable.
10. Point consent goes stale between runs — same.
11. Reduced-vs-full plan pair — deltas suppressed, not fabricated.
12. Source unavailable across several ticks — defers, backs off, does not
    accumulate blockers per tick.
13. Repeated failure crosses the threshold — pauses, exactly one delta.
14. Two ticks over identical state — idempotent, no duplicate work.

The bench must run with an **injected clock**, which A0 already supports
(`now` is injected everywhere and no policy code reads a clock). That
decision pays off here.

Policy replay extends unchanged: a v3 policy replays against both the
single-state and temporal suites, and promotion still requires strict
improvement with no regression on the shared set.

---

## 14. What "smarter" means in A2

North star is unchanged: **days from accepted offer to clinician start.**

A2-specific leading indicators, each of which is only measurable *because*
of the delta model:

- **Blocker resolution time** — now directly measurable from
  `blocker_opened` → `blocker_cleared`.
- **Staleness prevented** — refreshes that landed before a freshness window
  closed, versus lanes that went stale.
- **Time-to-notice** — external change occurred → agent noticed. Currently
  unbounded, because the agent only notices when the clinician logs in.
- **Unattended work rate** — work completed with no clinician involvement.
- **Notification precision** — material deltas that led to a resolved
  blocker, over material deltas sent. This is the D3 metric and it must be
  reported alongside any notification volume, or volume will optimize itself.

Explicitly **not** metrics: opens, sessions, daily actives, time in product.

---

## 15. Open questions for founder decision

1. **Standing consent scope.** I recommend non-disclosing actions only (D1).
   Confirm, or name the disclosure case worth arguing about.
2. **Point-consent freshness window.** Proposed 15 minutes. This is a real
   product tradeoff: too short and approvals fail on slow connections; too
   long and a stale click authorizes a later action.
3. **Standing-consent maximum.** Proposed 90 days with mandatory expiry.
4. **Notification delivery in or out of A2.** I recommend out (§10), which
   means A2 ships an agent that notices and records but never contacts
   anyone. That may feel like half the value — the counter-argument is that
   the noticing is the hard part and the sending is the dangerous part.
5. **Expiration-scanner remediation.** A2.3 should not start before it. Do
   you want that as its own ticket now?
6. **Scheduler substrate.** GitHub Actions cron (matches existing practice,
   imprecise) vs Railway cron service (better fit, new infrastructure).
   Recommend Actions for A2 pilot scale.
7. **Cohort.** Which subjects are in the first allowlist?

---

## 16. Explicitly out of scope for A2

- Any chat UI or new public product noun (still).
- Autonomous disclosure of any kind (D1).
- The employer Hiring Agent and the shared Start Plan — that is A3.
- Autonomous policy self-modification. Policy versions still ship through
  replay → shadow → canary → promote with a human at the gate.
- Impersonation or machine credentials that can act as an arbitrary
  clinician (§4).
- Fixing the expiration scanner (flagged, tracked separately).
