# Start Agent A2.4 — scheduled source refresh with budgets

Fifth code sub-wave of A2, implementing §9 of
[the A2 spec](./start-agent-a2-spec.md).

**It decides what to refresh. It refreshes nothing.** Background Level-2
execution is A2.5, and the staging table's line — *A2.5 is the first sub-wave
where the agent does something unattended* — is the reason A2.4 stops at a
plan. What it produces is the decision plus the budget that decision would
have spent, which is exactly what the *"no budget breach in shadow"* gate
needs before anything fires.

## One cadence table, chosen out loud

Three unreconciled cadence tables exist: `SOURCE_REGISTRY`, the backend
`SOURCE_POLL_CONFIGS` (11 sources, different bands, doesn't import the
registry), and `continuousMonitor`'s env crons. A2 uses **`SOURCE_REGISTRY`**,
because it is the one the canonical adapters declare and the one
decision-grade eligibility is keyed to.

The choice has to be explicit or the agent silently disagrees with the sweeps
and nobody can tell which clock is authoritative. Reconciling the other two
stays out of scope.

**A lane the registry does not know gets no cadence at all.** `state_license:VA`
is skipped with `no_known_cadence` rather than borrowing California's, because
asserting how often an authority we have never asked changes is the same class
of error as inventing an expiry date. Only `state_license:CA` maps, because
`CA_PA_BOARD` is the only state board in the registry.

## Five gates, every skip named

1. **relevance** — is this lane worth reading for this clinician?
2. **cadence** — could the source plausibly have changed?
3. **source health** — is it answering? `UNAVAILABLE`/`RATE_LIMITED` defer;
   `DEGRADED` proceeds, because degraded is not down.
4. **failure pause** — A1's `REPEATED_FAILURE_THRESHOLD`, reused rather than
   a second retry policy.
5. **budget** — is there quota left?

Order matters. **Budget is checked last**, so a lane skipped for a free reason
never consumes quota it did not use — and the budget report reflects work we
actually wanted to do.

Every skip carries a named reason, so an operator looking at a tick that
refreshed nothing can tell *"everything was fresh"* from *"the source is
down"* from *"we ran out of budget"*. A tick that read nothing and a tick
where nothing needed reading must not look identical.

## Budget wraps what exists

`SOURCE_REGISTRY` has **no rate-limit field at all**, so the budget cannot
come from there. Rather than add a fourth limiter this wraps
`ConnectorQuotaManager` — rolling window, `blockedUntil`, near-limit
reporting.

Two decisions worth stating:

**The cap is 20/60s, deliberately below the connector default of 60.**
Background work competes with clinician-initiated reads for the same upstream
quota, and background work should lose that competition.

**The budget is shared across every subject in a tick**, not held per subject.
Sources are shared, so the cap must be too — a per-subject budget lets a batch
of 25 hammer one authority while each subject stays politely under its own
limit.

### A bug worth recording

Distinguishing "our window is spent" from "the source told us to back off"
cannot be done via `retryAfterMs`: `ConnectorQuotaExceededError` populates it
on **both** throw paths. The honest discriminator is `snapshot.rateLimitHits`,
which only `recordRateLimit`/`recordHeaders` increment, and those only fire on
an upstream `Retry-After`. The first implementation got this wrong and a test
caught it.

## Required lanes get first claim

Candidates are ordered so lanes an active role requires come before merely-
aging ones. When budget is scarce, work that blocks a start outranks keeping a
tidy lane tidy.

## Attribution

Spec §9 rule 5 — a scheduled read must be distinguishable from a
clinician-initiated one — is already satisfied by the run model: A2.1 stamps
`trigger: 'scheduled'` and `actor: 'system_scheduler'` on every run row, and
the tick endpoint carries `?source=cron`. When A2.5 executes, the observation
inherits that attribution rather than needing a new mechanism.

Graph boundaries 83–85.
