# Start Agent A2.3 — deadlines with provenance

Fourth code sub-wave of A2, implementing §8 of
[the A2 spec](./start-agent-a2-spec.md). Gated on the expiration-scanner
remediation, which landed first (PR #1168).

## The sentence this sub-wave exists to keep apart

> "Your license expires in 12 days."
> "Our preferred freshness window closes in 12 days."

Completely different statements, and only one of them is about the
clinician's license. Everything here is structure that keeps them from
collapsing into each other.

## Provenance is mandatory

| Class | Meaning | Stateable as fact |
| --- | --- | --- |
| `source_set` | the authority published it | ✅ |
| `employer_set` | the employer set it | ✅ |
| `vitalcv_policy` | our freshness preference | only as *ours* |
| `estimated` | a projection | only with the qualifier inside the value |

`describeDeadline` is the single sanctioned rendering. The
`vitalcv_policy` branch attributes twice — once by naming us, once by
explicitly disclaiming that it is the authority's date — because that is the
sentence most likely to be misread.

## What A2.3 can honestly classify, and what it cannot

`vitalcv_policy` deadlines are derivable today and unambiguous: a lane's
`freshnessWindowDays` is our preference by definition.

`source_set` deadlines are modelled and honoured, but **the current reader
path cannot produce one**, and A2.3 does not pretend otherwise. The canonical
coverage layer builds `expiresAt` as *either* a source-published value *or*
`observedAt + freshnessWindowHours`
(`buildCanonicalSourceCoverageFreshness`), and the two are indistinguishable
in the output. Reading it as `source_set` would relabel our own policy as the
authority's fact — precisely the failure this sub-wave exists to prevent.

So a source-set expiry enters only through
`SourceObservationState.sourceExpiresAt`, which a reader may set **only** from
a channel that preserves provenance. Nothing infers it. Bench fixtures
populate it today; the licensure observation path (`LicensureObservation.expiresAt`,
genuinely source-provided) populates it when it goes live.

*That conflation is a new finding and belongs on the defect list — it is the
same failure class as the scanner, one layer up.*

Employer-set comes only from `VcvOrganizationContext.dueAt`, the one
employer deadline actually written anywhere. `ActivationRequirement.dueAt` is
declared, read, and ordered by but never populated (spec §16, defect 3), so
nothing derives a deadline from it.

## A deadline is not a blocker

It changes the **urgency** of an existing one. The blocker set is provably
identical with and without a deadline attached — there is a test that asserts
exactly that. This keeps the model free of a generic "deadline" bucket, which
would be the same mistake as a generic `incomplete` flag.

## Urgency ranks within a tier, never across

`URGENCY_RANK` is an intra-tier tiebreak. A deadline makes a piece of work
more pressing; it does not change who owns it or what kind of work it is,
which is what the six tiers encode. Promoting urgent-but-optional enrichment
above work that blocks a start would be exactly the wrong answer, and there
is a test pinning that a same-day source expiry still loses to a tier-1
employer blocker.

When a lane carries both a source-set end date and our own window at the
same urgency, the **source** one wins — it is the one actually about the
credential, and it is the sentence worth saying.

## The phrasing guard is structural

A new forbidden-claim rule: expiry language ("your license expires", "expires
on", "has expired") is permitted **only** when a `source_set` or
`employer_set` deadline exists in the consumed context. With a policy window
alone, the same sentence is a violation. The policy phrasing itself always
passes.

## Bench

15 new unit tests plus a temporal scenario. One result worth reading: a
source deadline crossing the notice offset produces **no plan delta**,
because only urgency moved and A2.2's projection deliberately does not carry
urgency. Wiring it in would make every day's drift toward a deadline register
as a change — the fingerprint trap in a new costume.

Graph boundaries 80–82.
