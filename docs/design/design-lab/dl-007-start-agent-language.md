# DL-007 — Start Agent activity language

**Status:** exploration. No implementation, no components, no route.
**Why now:** A0 (#1113), A1 (#1123) and A2.1 (#1159) are in flight. The primitives
should exist before the surface is improvised.
**Why doc-only:** the agent's real states are still landing. Designing components
against an unmerged substrate is how prototypes become doctrine by accident.

---

## The question

> How do we make an agent doing a large amount of invisible work feel understandable
> and trustworthy — without turning it into a chat interface?

## The answer this doc argues for

**Do not design a conversation. Design a worklist with provenance.**

A chat window is the wrong primitive here for a specific reason, not an aesthetic one:
chat makes every statement look the same. The Start Agent's statements are **not** the
same — "I read a public registry" and "the hospital has to do this" and "I can send
this if you approve" carry completely different authority, and a chat bubble flattens
all three into one voice. The domain model already refuses that collapse. The interface
must refuse it too.

---

## The primitives are already in the domain model

This is the central finding. `apps/web/lib/agent/types.ts` (A0) defines two enums that
between them generate the charter's requested primitives. **We should not invent a
parallel vocabulary — we should render these.**

```
ACTION_OWNERS       vitalcv | clinician | employer | source | other_institution
PERMISSION_CLASSES  observe | recommend | prepare | execute_with_consent | human_only
                    (execution levels 0–4; A0 executes nothing above 2 = prepare)
```

Every primitive the charter asked for is a cell in `owner × permission`:

| Charter primitive | Domain state | The sentence it earns |
| --- | --- | --- |
| **Agent plan** | the ranked action set | "Here is what remains, in the order that shortens your start." |
| **Agent activity** | `owner: vitalcv` + level ≤ 2, done | "I prepared this. Here is what I used." |
| **Consent queue** | `permission: execute_with_consent` | "I can do this once you approve it." |
| **Human action** | `owner: clinician` or `permission: human_only` | "This one needs you — nobody can do it for you." |
| **Employer-controlled** | `owner: employer` | "The hospital controls this step. I am tracking it." |
| **Source-controlled** | `owner: source` | "The board has not answered. That is their queue, not your fault." |
| **Completed** | terminal state + evidence ref | "Done — and here is the receipt." |
| **Change detected** | new observation vs prior | "Your license record changed. I refreshed what depends on it." |

The charter listed six primitives; the domain model yields **seven**, because it
separates `employer` from `source`. That separation is worth keeping in the UI: "the
hospital is deciding" and "the state board has not replied" feel completely different
to a clinician waiting, and only one of them is anyone's fault.

## Honesty constraint that shapes the whole surface

**A0 executes nothing above Level 2 (`prepare`).** The tool registry refuses higher
levels. A1 adds consented execution; A2.1 runs in shadow only.

So the surface must not imply autonomous action that is not happening. Today the honest
verbs are **observed, explained, ranked, prepared** — not "handled" or "done for you."
The "I already did this" primitive should therefore ship in its *prepare* form first:

> "I drafted this request. It sends when you approve it."

not

> "I sent this."

The interface should be able to grow into execution without rewriting its voice — the
same card, with the approval state moving from `awaiting you` to `sent`.

## What every agent statement must carry

From the Easy Button canon's agentic-UX rule, and directly supportable by the A0 types:

| Element | Source in the model |
| --- | --- |
| what will happen / happened | the action itself |
| why | policy rationale (`policy/derive.ts`, `rank.ts`) |
| what it read | `evidenceRefs` on every state |
| how sure | source status (`current` / `stale` / `pending` / …) |
| who owns it | `ActionOwner` |
| what it needs from you | `PermissionClass` |
| proof it happened | telemetry event / evidence ref |

If a proposed card cannot fill all seven, it is not ready to render.

## Distinctions the interface must never collapse

These are load-bearing in the domain and are exactly what a friendly summary would
destroy. Each is a real state in `types.ts`:

1. **`resolved` ≠ owned.** Resolution is a statement about the public registry record.
   It carries no ownership meaning. The UI must never let "we found you" read as "we
   confirmed it's you."
2. **`pending` ≠ verified.** Claimed is not verified. Ownership `pending` means a claim
   exists, nothing more.
3. **`not_found` is a finding, not missing evidence.** The source was checked and holds
   no record. That is information, and it must not render as an empty slot.
4. **`unsupported` is VitalCV's coverage gap, not the clinician's problem.** It means we
   have no live route to that authority. It should read as our limitation, in our voice.
5. **`invalid` is never evidence of anything.** A source returned something that failed
   validation. It must never be upgraded into a status.
6. **A correction has no winner.** When a clinician disagrees with a public source, both
   sides are preserved with their own provenance. The agent surfaces the conflict; it
   does not resolve it. **The UI must show two values, not one with an asterisk.**
7. **`ready_to_start` only when a canonical service said so.** The union makes the
   collapsed form unrepresentable. No visual summary may imply it.

Design rule following from all seven: **no aggregate.** No single score, no percentage,
no one-line "you're 80% there." Those exist to compress exactly the distinctions above.

## Sketch: the three regions

Not a layout — a hierarchy proposal, to be tested against real A1 data.

```
┌────────────────────────────────────────────────┐
│  ONE next action                               │  the only thing competing for
│  "Add your state license number."              │  attention; owner: clinician
│  why · what it unlocks · ~2 min                │
├────────────────────────────────────────────────┤
│  AWAITING YOUR APPROVAL            (2)         │  execute_with_consent
│  ▸ Request residency confirmation  [Review]    │  each expands to the full
│  ▸ Share profile with Cascade      [Review]    │  seven-element disclosure
├────────────────────────────────────────────────┤
│  MOVING WITHOUT YOU                            │  owner: vitalcv | employer | source
│  ✓ NPPES identity — read today                 │  provenance chip per row
│  ⋯ OIG/LEIE — monthly source, last read 12d    │  cadence stated, never "live"
│  ⏸ State board — access required (our gap)     │  our limitation, our voice
│  ⏸ Cascade Regional — committee review         │  their queue, named
└────────────────────────────────────────────────┘
```

The third region is the one that makes this feel like an agent rather than a form: it is
the visible evidence that work continues while the clinician is not looking. It is also
where the truth vocabulary already lives — the existing `ProofContinuityRail` and
`EvidenceState` (`source_backed` / `checked` / `needs_review` / `access_required` /
`unavailable`) are the right substrate to extend rather than replace.

## Deliberately open

1. **Where does this live?** `/holder` and `/clinician/profile` already both claim to be
   the profile (**DL-008**). The agent surface must not become a third claimant. That IA
   decision should land before this one takes a route.
2. **Does the clinician see the plan, or only the next action?** The canon says one
   obvious next action; the plan is the agent's artifact. Showing the whole ranked list
   may relieve anxiety or may recreate the checklist wall this replaces. Needs a real
   plan from A1 to judge.
3. **Change-detection cadence.** "Your license updated" is powerful and, at the wrong
   frequency, becomes notification spam. Depends on A2.1's tick model.
4. **What does refusal look like?** The agent must be able to say "I can't do that, and
   here is who can." That state has no design yet and is the most trust-defining one.

## Next step

Not implementation. When **A1 (#1123)** merges, build a **read-only render of one real
plan** for a real NPI — no new route, no new components, just proof that the seven
elements can be filled from live data. If any element cannot be filled, that is a finding
about the substrate, and it is far cheaper to learn it in a render than in a wave.
