# Start Agent A2.2 — `PlanDelta`, persistence, temporal bench

Third code sub-wave of A2, implementing §7 and §13 of
[the A2 spec](./start-agent-a2-spec.md). Still shadow: the tick now knows
*what changed* and tells nobody.

## The finding this sub-wave is built around

`contextFingerprint` and `planId` cannot be used for change detection. Both
hash the whole context including `collectedAt`, so both change on every run
even when nothing meaningful moved. Verified empirically before any of this
was written, and now pinned by a test that will fail if it ever stops being
true.

Anything built on "did the fingerprint change?" reports a change every tick,
would wake the clinician every tick, and is wrong every tick.

So a plan gets a second, narrower fingerprint over its **decision-relevant
projection**: blocker ids and types, action ids with status and
executability, the top-ranked action, and lane statuses. Never timestamps,
never evidence `observedAt`, never the context fingerprint.

### The one deliberate exception

The projection also carries each lane's `observedAt`, because detecting *"we
re-read the source and nothing had changed"* inherently requires knowing the
reading is new. That field is **excluded from `decisionFingerprint`** — it
classifies a non-material delta, it does not decide whether anything
happened. The bench asserts the equivalence directly: no decision deltas iff
the fingerprint is unchanged.

## Delta kinds and materiality

| Kind | Material |
| --- | --- |
| `blocker_opened` / `blocker_cleared` | yes |
| `action_became_executable` / `action_became_blocked` | yes |
| `top_action_changed` | only if the new top differs in type or owner |
| `external_state_changed` | employer `→ reviewed` yes; `→ opened` no |
| `observation_refreshed_no_change` | **no** |

Two judgements worth stating:

**Re-ranking is not news.** Telling someone "your next step changed" when it
is the same kind of step owned by the same party is how you teach them to
ignore you. A top-action change is material only when type or owner moved.

**Opening is not reviewing.** The `shared → opened` transition is recorded so
the funnel can see it and is deliberately not material — nothing the
clinician can act on has changed. Reaching `reviewed` is.

`observation_refreshed_no_change` exists as its own non-material kind because
it is the most common thing that will ever happen here. Recording is
unconditional; materiality is what a future notification layer filters on.

## Comparability is a refusal, not a result

Two plans may be diffed only when their actor could see the same things.
Diffing a reduced plan against a full one reports the gap between two
viewpoints as though it were a change in the world, so it is refused.

Likewise **"no prior run" is a refusal, never "no changes detected"** — the
same trap the licensure doctrine names, where a tick that checked nothing and
a tick that found nothing look identical unless the model distinguishes them.
Runs written before A2.2 carry no projection and are skipped rather than read
as an empty one.

## Relationship to the watchtower

Unchanged from the spec, and worth repeating because it is the thing most
likely to get rebuilt by accident: `watchtowerEngine` and `drift-engine`
answer *what changed in the world*; `PlanDelta` answers *what changed about
what this clinician should do*. A fact delta is a trigger for a run; a plan
delta is what a run produces. A2 consumes the first and emits the second, and
does not re-derive fact changes from raw source reads.

## Persistence

`agent_plan_deltas` rows, plus three columns on `AgentRun`:
`decision_projection`, `decision_fingerprint`, and `delta_from_run_id`.

**`deltaFromRunId` lands here with its writer.** It was deliberately left out
of A2.1 — a nullable column nothing writes is exactly the defect this program
flagged in `ActivationRequirement.dueAt` (spec §16, defect 3).

Lifecycle reuses the existing `AgentEvent` vocabulary: a material change
records `agent_plan_superseded`, rather than growing a parallel event system.

## Temporal bench

A new bench shape — scenario **pairs** with hand-labeled expectations. Ten
scenarios covering the clock-only case (the important one), refresh-no-change,
stale→current, went-stale, employer opened vs reviewed, reduced-vs-full
suppression, a source down across consecutive ticks, the repeated-failure
pause, and byte-identical idempotence.

It runs against **both** policy versions: the diff is a property of the plan
shape, not of a policy, and if v1 and v2 ever disagree here that is a
regression worth failing on.

Four of the spec's fourteen listed scenarios are **not** here, because their
subject matter does not exist yet: deadline-window entry and the
VitalCV-policy-freshness phrasing need A2.3's provenance-typed deadlines, and
standing/point consent expiry needs A2.5's consent kinds. They land with the
features they describe.

Graph boundaries 77–79.
