# Start Agent A2.5 — standing consent and the first unattended action

Sixth code sub-wave of A2, implementing §5. Gated on founder acceptance of
the consent-kind semantics, which was given.

**This is the line.** Everything through A2.4 observed. From here the agent
does work when nobody is watching — and the only thing that permits it is a
standing consent the clinician chose and can withdraw.

## Two consent kinds

**Point** (A1's behaviour, still the default): approval for an action to run
*now*, with the clinician present. A proof mints only within **30 minutes**;
after that the grant lapses for execution. This closes a real A1 hole — an
unexecuted grant stayed executable forever.

**Standing**: the separately-worded *"keep doing this for me"*, with a
mandatory expiry capped and defaulted at **90 days**, revocable at any time.
It is the only thing that authorises a background run to act.

**No inactivity lapse.** A clinician who disappears for three months must
come back to *current* evidence, not the stale evidence they left — lapsing
on inactivity would re-create the exact problem the wave exists to solve. The
cost concern that motivates it belongs to cadence and budgets, not to
authorisation.

## Standing consent is non-disclosing, structurally

An **allowlist** (`background_refresh:`), not a denylist, enforced in two
independent places: the authorization path refuses a standing grant for an
ineligible scope, and the ledger refuses to write one. A new scope is
non-standing until someone deliberately adds it — the safe direction for a
list whose failure mode is *the agent shared something in the background*.

There is a test that constructs the mistake a future contributor makes: a
disclosing action marked `consentKind: 'standing'`. It is refused.

> **"VitalCV can keep your evidence current on its own. It will always ask
> before showing it to anyone."**

## Why refresh needs consent at all

`refresh_source_observation` is Level 2, and A2.0's actor gate already lets
the scheduler invoke it. Standing consent adds no permission — it adds
**legibility**. Keeping someone's evidence current unattended should be
something they chose and can see and stop, not something that quietly happens
to them. That is a different argument from a permission argument, and worth
stating plainly because the code alone doesn't say it.

## Lapse is not withdrawal

A lapsed grant stays `granted: true` in the ledger and is marked `lapsed`.
The clinician *did* approve; the approval is merely unusable now. So the plan
derives `renew_background_refresh` — *"Nothing was withdrawn — approvals are
time-limited on purpose"* — rather than asking as though they had never
agreed.

Expiry is a **read-time predicate** evaluated against an injected clock.
Nothing sweeps the ledger to mark grants expired: a background writer racing
the head is exactly the ambiguity the `seq` design exists to prevent.

## Execution

Three conditions, none of them a config default: a **standing** proof minted
by re-reading the ledger *at execution time* (so a revocation or expiry since
the last tick is honoured), not a dry run, and something actually planned. A
point proof is refused however fresh — nobody is there.

Every execution emits `agent_action_accepted` and then exactly one terminal
event, carrying the consent id, so the ledger records *what ran, under whose
approval*.

## Where the ask appears — narrowed twice

The first implementation offered background refresh whenever any lane was
ageing, which flooded plans and broke bench scenarios. Both narrowings are
honesty rather than tidiness:

- only lanes with a **known registry cadence** — offering to keep
  `state_license:VA` current in the background would promise work the
  scheduler can never do, because the registry declares no cadence for it;
- only in a **clinician-session** context — the ask is a question for a
  person, and reduced plans are never shown to anyone.

## The A2.3 guard caught my own copy

The blocker text originally read *"Your approval has expired"*, and the
`expiry_stated_as_fact` guard rejected it — that phrasing is reserved for
source-backed credential dates. Reworded to "lapsed" rather than weakening
the rule: the cost of an occasional reword is far smaller than *"your license
has expired"* attaching to something we invented. Caught by a gate, not by
review.

Graph boundaries 86–88.
