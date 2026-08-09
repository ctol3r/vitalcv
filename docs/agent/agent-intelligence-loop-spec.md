# VitalCV Agent Intelligence Loop — Wave L design spec

Status: **draft, awaiting founder acceptance.** Docs-only.
Author: Claude Code Terminal, 2026-08-09.
Predecessors: A0 (`ec3d4981c`) → A1 → A2.0–A2.5 (`cf4b42dbc`), all on main and deployed.
Successor this blocks: **A3 (employer Hiring Agent).**

---

## 1. What Wave L is

A0–A2.5 built an agent that decides. Wave L builds the loop that makes those
decisions *observable* and *improvable*.

It is not new agent capability. It adds no permission level, no tool, no
autonomy. Every sub-wave is either a read surface, an honesty correction, or a
return path from production into the benchmark. If Wave L works, the agent does
exactly what it does today — and we can, for the first time, see it and grade
it.

**Wave L must land before A3.** A3 introduces a second agent (employer-side)
with a shared plan surface. Shipping a second agent into a system where the
first one's behaviour is unobservable doubles a blind surface instead of
building on a measured one.

### The single hardest thing about Wave L

Nothing here is technically difficult. The difficulty is that Wave L's whole
purpose is to make it possible to discover that the Start Agent is *bad* — and
the loop is only worth building if we are willing to act on that finding. A
measurement layer that exists to confirm a prior is worse than no measurement
layer, because it launders the prior as evidence.

Concretely: the acceptance criterion for L2 (§7) is that harvested production
scenarios are allowed to *fail* the current policy. A harvest pipeline tuned
until everything passes has measured nothing.

---

## 2. Three verified findings that motivate this wave

All three verified against `origin/main` at `7c6044463` on 2026-08-09.

### Finding 1 — the telemetry is write-only

Six Prisma models exist: `AgentRun`, `AgentRunAction`, `AgentEvent`,
`AgentConsentEvent`, `AgentSubjectSchedule`, `AgentPlanDelta`.

Every non-test reference to any of them, across `apps/` and `packages/`, is a
**writer**: `app/api/agent/start-plan/route.ts`, `lib/agent/schedule/tick.ts`,
`lib/agent/execution/execute-action.ts`, `lib/agent/delta/delta-store.ts`,
`lib/agent/telemetry/agent-run-store.ts`.

`AgentConsentEvent`, `AgentSubjectSchedule`, and `AgentPlanDelta` have **no
non-test consumer at all**. There is no admin surface, no API, no aggregation,
no export, no replay. The decision ledger is unreadable by any means short of
opening psql against production.

`AgentPlanDelta`'s own schema comment says rows are "recorded for the learning
loop." The learning loop does not exist yet. This wave is that comment's
implementation.

### Finding 2 — the hourly tick is green and idle

`.github/workflows/agent-tick.yml` has fired hourly since A2.1. The last five
scheduled runs succeeded in 6–8 seconds each.

Six seconds is the cost of a tick that claims **zero subjects**.
`agent_subject_schedules` was 0 rows at the last direct production read
(2026-08-08), enrollment is a deliberate human action per A2 §15 Q7, and nobody
has taken it.

So the workflow reports success on a no-op, indefinitely, and the success is
indistinguishable from success on real work. This is
`green_ci_is_not_evidence_of_function` pointed at our own agent. The tick
returns `NextResponse.json({ source, ...result })` — whatever `runAgentTick`
returns — and the workflow asserts only `HTTP 200`.

### Finding 3 — the loop is open at both ends

The learning architecture is genuinely good and genuinely unfinished:

- `runStartBench(scenario, policy)` takes the policy as an argument
  specifically so v1 and v2 replay side by side. **No production run has ever
  been replayed.** The bench is 25 hand-authored scenarios and can be no
  smarter than its author.
- `AgentEvent.relatedKind` / `relatedRef` reserve exactly the forward
  references needed to join a plan to a hiring outcome
  (`application | interview | offer | accepted_offer | start`). **Nothing
  writes them.** No plan has ever been scored against whether it worked.
- `agent_human_override` is in the event vocabulary. **Nothing records what
  the human did instead.** The single highest-signal datum in the system is
  discarded at the moment it is generated.

This is the same defect class as A2 §16 finding 3 (`dueAt` declared, read,
ordered by, never written) and it deserves the same name: a field that is
reserved but unwritten reads as capability and is absence.

---

## 3. Doctrine

Three rules, in the style of A2's D1–D3.

**L1 — an unobserved agent is an unshipped agent.**
Capability that cannot be inspected cannot be trusted, tuned, or defended to a
buyer. A sub-wave that adds behaviour without adding its observation is
incomplete, not fast.

**L2 — idleness must be loud.**
Any scheduled agent path that does no work must say so in its own response
body, and its surface must render *idle* rather than *healthy*. Success and
vacancy are different states and must never share a colour. Green is a claim
about work performed, not about a request completing.

**L3 — the benchmark grows from reality or it decays.**
A fixed hand-authored suite measures the author's imagination on the day they
wrote it. START-Bench must accumulate adjudicated production-derived scenarios,
and a policy may only be promoted by beating its frozen predecessor on the
accumulated suite — including the scenarios harvested since that predecessor
shipped.

---

## 4. What Wave L must not become

- **Not a metrics dashboard.** Counts of runs are nearly worthless. The wave
  is about *decision quality* — override rate, refusal rate, outcome join —
  not throughput.
- **Not a reason to enroll a wider cohort.** L0 makes the cohort visible; it
  does not widen it. Row existence remains the allowlist (A2 §15 Q7). No
  predicate.
- **Not an LLM in the truth path.** Harvest may use a model to *propose*
  candidate scenarios and *draft* expectations. A scenario enters START-Bench
  only by human adjudication. The model never sets the expected answer.
- **Not a new visual era.** L0 is an internal ADMIN surface and inherits the
  existing `/admin/platform` treatment verbatim. See §11.
- **Not a widening of what the agent may claim.** L5 (§9) *publishes
  refusals*; it does not soften them.

---

## 5. L0 — Agent Ops (the read surface)

The first sub-wave, and the only one with UI.

### What it must show

Four questions, in this order. Anything that does not answer one of them is out
of scope for L0.

**1. Is anything happening?**
Runs in the last 24h / 7d, split by `trigger` (`interactive` | `scheduled` |
`event`) and `mode` (`live` | `shadow`). Enrolled subjects: total, enabled,
next due. **If zero subjects are enrolled, the surface says so as its
headline** — not as an empty table. An idle loop must be legible as idle at a
glance (L2).

**2. What did it decide?**
Ranked actions by `actionType`, `owner`, `permission`, `rankTier`. Plans
generated vs. actions presented. Blockers by frequency. This is the first time
anyone will be able to see what the agent actually recommends at population
level.

**3. Did humans agree?**
The core panel. From `AgentEvent`:
`agent_action_accepted` / `agent_action_dismissed` / `agent_human_override`
as rates per `actionType`. **Override rate is the headline quality metric** and
should be rendered as such.

**4. What did it refuse, and why?**
`agent_action_blocked` plus truth-boundary refusals, grouped by reason. A rising
refusal rate is a *source* problem or a *policy* problem, and distinguishing
them is the point. This panel is also the raw material for L5.

Plus one secondary panel: `AgentPlanDelta` by `kind` and `material`. The A2.1
tick exists to learn the real delta rate; that number has never been read.

### What it must not show

- No PHI, no clinician names, no NPIs in aggregate views. `subjectRef` is a
  Clerk user id and is itself an identifier — it appears only in single-subject
  drill-down, never in a list view.
- No mutation. Detect-only, matching `/admin/platform`'s stated contract. No
  enroll button in L0 — enrollment stays a deliberate act outside the dashboard
  until we have watched the loop for a week.

### Shape

Follows `/admin/platform` exactly: server-rendered initial report from a pure
builder in `lib/agent/ops/`, ADMIN-gated via Clerk `sessionClaims.vitalcv.role`,
a client component that refreshes, and a sibling `GET /api/admin/agent-ops`
returning the same report for any external monitor.

The builder is a **pure read** — no writes, no side effects — for the same
reason `receiptCandidate.ts` and `policyReview.ts` are pure transforms: an
observability layer that mutates is a second, unaudited writer.

---

## 6. L1 — idle honesty

Small, and it closes Finding 2.

- `runAgentTick` already returns a result; the tick route must surface
  `claimed`, `skipped`, and `enrolledSubjects` explicitly in the response body.
- `agent-tick.yml` must assert on the *body*, not only the status code. A tick
  that claims zero subjects when zero are enrolled emits a
  `::notice::` and is honest. A tick that claims zero subjects when subjects
  *are* enrolled and due is a **failure** and must exit non-zero — that is the
  real regression this guard exists to catch, and today it is invisible.
- The workflow name should stop saying "(shadow)" the moment shadow mode ends,
  because a name is a claim.

**Flagged for decision, not fixed here:** the tick is `if: github.ref ==
'refs/heads/main'` and `dryRun=false`, pointed at production, gated on
`PROBE_URL` + `CRON_SECRET`. If either secret is unset the step exits 0 with a
notice. So a *deleted secret* is also a permanently green no-op. L1 should make
that state loud too.

---

## 7. L2 — harvest (production → benchmark)

The return path. This is the sub-wave that makes the agent get better.

### Pipeline

```
AgentRun (prod)
  → context fixture   (deterministic extract; PHI-stripped; subjectRef dropped)
  → candidate scenario (proposed expectations; model-drafted, unmerged)
  → human adjudication (a person sets the expected answer)
  → START-Bench       (versioned; bench version bumps)
```

### Rules

- **Selection is biased toward disagreement.** Harvest prioritises runs
  carrying `agent_human_override`, `agent_action_dismissed`, or a blocked
  action. A run everyone agreed with teaches almost nothing; the bench already
  covers the happy path 25 times.
- **The fixture is the context, never the plan.** Harvesting the plan too would
  encode the current policy's answer as the expected answer — the loop would
  learn to reproduce itself. Only `StartAgentContext` is captured; the expected
  outcome is authored by a human against that context.
- **Anonymisation is structural, not best-effort.** `subjectRef` and `npi` are
  dropped at extract time, not redacted downstream. A fixture that can be
  re-identified is a data export, and A2's cohort discipline would have been
  pointless.
- **Harvested scenarios may fail.** See §1. A harvest run that reports 100%
  pass on its first batch should be treated as a bug in the harvester until
  proven otherwise.
- **Holdouts stay holdouts.** sb16/sb20/sb24/sb25 are never regenerated, and
  harvested scenarios are added to the training portion with a fixed fraction
  reserved as new holdouts.

### Promotion gate

`start-policy-v3` may only be promoted if it beats v2 on the **accumulated**
bench, holdouts included, with no regression on any previously passing
scenario. `start-bench-policy-replay.test.ts` is already the shape of this gate;
L2 extends its corpus rather than its mechanism.

---

## 8. L3 — outcome join, and L4 — counterfactual capture

### L3: write `relatedKind` / `relatedRef`

The fields exist. The writers do not. The join points already exist in the app:
`POST /api/opportunities/[id]/apply`, `/api/applications/[appId]/workflow`,
`/api/employer/decisions`, `/api/hiring/accept`, `/api/hiring/start`.

Each should emit an `AgentEvent` carrying `relatedKind` and the downstream
identifier when the acting subject has an agent plan in flight. That single
change makes it possible, for the first time, to ask: *did the plan the agent
ranked first actually shorten time-to-qualified-start?*

That question is the north-star metric. It is currently unanswerable, and the
schema was designed in A0 to answer it.

**Honest constraint:** this only works for subjects who have agent runs, and
today that is nobody. L3 is worth building *before* enrollment so the join
exists from the first real subject rather than being back-filled — but it
produces no data until the cohort exists. Sequencing in §10 reflects that.

### L4: capture what the human did instead

When `agent_human_override` fires, record the override *target*: which action
the human took, or that they took none. Store it in the existing `metadata`
Json — no migration needed.

An override with no recorded alternative says "the agent was wrong." An
override with one says "the agent was wrong, and here is right." Only the
second is a training signal, and it costs one field.

---

## 9. L5 — the refusal ledger

The one sub-wave that is customer-facing, and the one with the most strategic
upside. Specified here; **recommend building it after L0–L2 have run for two
weeks**, so it is populated by real refusals rather than launched empty.

### The argument

The Start Agent re-audits its own output and throws (`truth-boundary.ts`,
`forbidden-claims.ts`, `auditTruthBoundaries`). No competitor's agent has a
hard truth boundary, so no competitor can produce an auditable record of what
their system *declined* to assert.

In credentialing the liability sits in the unverified thing, not the verified
thing. A signed, timestamped artifact of the form *"we could not confirm X from
source Y at time T, and here is why"* is a document a hospital's counsel can
file. It is also, structurally, the thing we already generate and throw away.

This inverts our largest constraint. Our source coverage is thin (§ competitive
assessment, separate doc) — and thin coverage that is *precisely and
verifiably declared* is a stronger artifact than broad coverage that is
silently interpolated.

### Rules

- The ledger reports refusals. It never reports what *would* have been found.
- "Not found" is a finding, not missing evidence
  (`not_found_is_a_finding_not_missing_evidence`); the ledger must distinguish
  *queried and absent* from *never queried*.
- Every entry carries source, method, timestamp, and methodology version.
- No entry may imply that a refusal is temporary unless a cadence exists that
  would change it — the `enable_background_refresh` narrowing in A2.5 is the
  precedent.

---

## 10. Sequencing

| Sub-wave | Scope | Depends on | Produces data? |
|---|---|---|---|
| **L0** | Agent Ops read surface | — | reads existing |
| **L1** | Idle honesty (tick body + workflow assert) | — | no |
| **L2** | Harvest pipeline → START-Bench | L0 | yes, from prod runs |
| **L3** | Outcome join (`relatedRef` writers) | — | only after enrollment |
| **L4** | Counterfactual capture on override | L0 | yes |
| **L5** | Refusal ledger | L0, L2 | customer-facing |

L0 and L1 are independent and small; they should ship together or back to back.
**Neither produces value until the cohort is non-empty**, which is the real
gate on this entire wave and is founder work, not engineering work — exactly as
L1 access diligence is for licensure.

---

## 11. Boundary notes

**UI freeze.** A UI PR freeze is in effect until UX-03 ships. L0 is an
internal, ADMIN-gated operations surface, not customer-facing experience work,
and it is founder-authorised (requested 2026-08-09). It inherits
`/admin/platform`'s existing `.mz mz-paper mz-persona-admin` treatment verbatim
and introduces no new visual language. Recorded here so the exemption is
explicit rather than assumed.

**Truth contract.** Wave L adds no copy that makes a verification claim. L5 is
the only customer-facing surface and it exclusively reports *absence of*
claims. Banned strings apply unchanged.

**Cohort.** Unchanged from A2 §15 Q7. Row existence is the allowlist. L0
displays the cohort; it does not manage it.

---

## 12. Open questions for the founder

1. **Enrollment.** Wave L measures a loop that currently runs on zero subjects.
   Who are the first N `subjectRef`s, and when? Everything below L0/L1 is
   inert until this is answered. *(Recommendation: internal accounts only,
   this week, so L0 ships against real rows.)*
2. **Does L5 ship publicly, or to pilot employers first?** The refusal ledger
   is our most differentiated artifact and also the most explicit statement of
   our coverage limits. *(Recommendation: pilot employers first — it reads as
   rigour to a buyer in conversation and as a gap to a stranger on the
   homepage.)*
3. **Is a model permitted in the harvest proposal step (L2)?** It never sets
   the expected answer, but it does shape which scenarios a human sees, which
   is its own bias. *(Recommendation: yes, with the selection criteria
   deterministic and the model limited to drafting prose.)*
4. **L3 before or after A3?** The employer Hiring Agent will want the same
   outcome join. Building it once, in L3, is cheaper than twice.
   *(Recommendation: L3 before A3.)*

Related: [[start-agent-a2-spec]], [[start_agent_a2_5]],
[[green_ci_is_not_evidence_of_function]], [[projection_vs_measurement_rule]],
[[not_found_is_a_finding_not_missing_evidence]].
