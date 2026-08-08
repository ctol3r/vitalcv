# Start Agent A2.0 — the actor model

First code sub-wave of A2, implementing §4 of
[the A2 spec](./start-agent-a2-spec.md). **No scheduler, no tick endpoint, no
background run yet** — those are A2.1. A2.0 builds only the thing that has to
exist before a background run is safe to write.

## The problem it solves

A1's reader wiring mints a Clerk bearer via `session.getToken()`, which has
no headless variant. A scheduled run has no session, so every canonical route
guarded by `requireVerifiedClerkUserId` — the ownership read, the apply-share
— is unreachable from one.

The tempting fix is a service credential that can act as any clinician. That
would be the single most dangerous asset this system holds, and it would get
created as a side effect of wanting a cron job. A2.0 takes the other path:
**the scheduler is simply a weaker actor, and the weakness is structural.**

## What changed

### `actor`, orthogonal to `permission`

```
AgentActor = 'clinician_session' | 'system_scheduler'
```

`permission` answers *what kind of action is this*. `actor` answers *who is
driving*. A registry is bound to one actor at construction and refuses tools
that actor may not invoke **before** considering permission — whether the
runner may use the capability at all is a prior question to what the
capability is allowed to do.

Each tool declares `allowedActors`, so the reason lives next to the
capability rather than in a central list someone forgets:

| Tool | scheduler | why |
| --- | --- | --- |
| `npi_identity_resolution` | ✅ | public registry |
| `source_observation_retrieval` | ✅ | anonymous canonical read |
| `trigger_source_refresh` | ✅ | header-authenticated, not session-bound |
| `consent_state_retrieval` / `action_history_retrieval` | ✅ | our own stores |
| `opportunity_retrieval` | ✅ | anonymous-capable |
| `ownership_state` / `clinician_profile_retrieval` | ❌ | identity-bound route |
| `share_apply_preparation` / `execute_apply_share` | ❌ | disclosure (D1) |

Two rules, both fail-closed. The tool must list the actor — and
`system_scheduler` may **never** execute an `execute_with_consent` tool
whatever it declares. That second rule is doctrine D1 made unrepresentable
rather than documented: a future tool that wrongly lists the scheduler still
cannot send anything. A tool that forgets to declare actors at all falls back
to session-only rather than throwing or defaulting open.

### `unknown` ownership — the distinction the sub-wave rests on

A scheduler cannot read the ownership record. The honest representation is a
new state, not a guess:

- **not `none`** — "we could not look" is not "there is no claim". Deriving
  *"confirm this record is yours"* for someone who verified months ago is a
  false alarm delivered by a robot at 3am.
- **not cleared either** — anything presupposing verified ownership is not
  derived at all. Under `unknown`, share work simply does not appear.

So a reduced plan contains the background work it can justify (refresh a
stale lane) and nothing it cannot.

### `completeness`, first-class

`StartAgentContext` and `StartPlan` both carry `actor` and
`completeness: 'full' | 'reduced'`. Two consequences implemented here:

- the interactive `/api/agent/start-plan` route **refuses to serve a reduced
  plan** — showing a person a thinner picture of their own situation without
  saying so is worse than an error;
- `reduced` means *structurally out of reach for this actor*, not *a read
  failed*. A flaky source leaves the context `full`, because a clinician
  session with a bad read still sees the same kinds of things a plan is built
  from. Conflating the two would make every transient failure look like a
  different class of run.

The third consequence — deltas only between plans of equal completeness —
becomes enforceable in A2.2, where deltas exist. `completeness` is on the
plan now so that rule has something to check.

## The gate

`__tests__/start-agent-actor-model.test.ts` (14 tests) is the sub-wave gate:
the scheduler cannot reach any identity-bound tool, a misdeclared Level-3
tool is still refused, the reduced context reports `unknown` ownership with
actor-specific input gaps, the registry binding beats a claimed actor, an
ordinary read failure stays `full`, and a reduced plan derives neither an
ownership blocker nor share work — while the same NPI under a full context
does derive the share, proving suppression tracks the unknown state rather
than the actor producing thinner plans generally.

START-Bench gains two scenarios (28, 29) covering the same behavior through
the policy. They are not version-gated: v1 and v2 share the derivation, so
both must pass.

## What A2.0 deliberately does not do

No tick endpoint, no scheduling, no claiming, no background run of any kind.
No `PlanDelta`. No consent kinds. Nothing executes unattended — A2.5 remains
the first sub-wave where that is even representable.

Graph boundaries 71–73.
