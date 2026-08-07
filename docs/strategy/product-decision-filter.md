# Product decision filter

From [`vitalcv-strategy-operating-brief.md`](./vitalcv-strategy-operating-brief.md).
Applies to product, design, marketing, and engineering proposals alike.

## The test

A proposal moves forward only when it **materially** strengthens at least one of:

- [ ] Faster time to a useful clinician profile
- [ ] Better role relevance
- [ ] Less repeated data entry
- [ ] More transparent clinician-controlled sharing
- [ ] Greater employer acceptance
- [ ] More successful clinician starts
- [ ] More profile reuse

"Materially" is doing work in that sentence. Almost anything can be argued to
touch one of these faintly. If the strengthening cannot be stated in a sentence
that names a user and a changed outcome, it is not material.

## If it passes none

Classify it honestly as one of:

| Class | Meaning |
| --- | --- |
| **Infrastructure** | Necessary to make the above possible. Legitimate work. |
| **Maintenance** | Keeps what exists working. Legitimate work. |
| **Compliance** | Required by law, contract, or platform. Legitimate work. |
| **Premature scope** | Would matter later, does not matter now. |
| **Distraction** | Does not matter. |

The first three are real work and often must be done first. The classification
is not a verdict on whether to build it.

**Infrastructure may still be necessary, but it must not be marketed as the
product.** This is the failure mode the category strategy diagnoses: the
vocabulary of the machinery — wallet, passport, packet, dossier, receipt,
recognition, snapshot, holder, PSV, trust tier — reached the customer-facing
surface and competed with the one thing a clinician was supposed to remember.

## Worked examples

| Proposal | Verdict |
| --- | --- |
| Resolve an NPI to a useful preview in under two seconds | Passes — faster time to a useful profile |
| Show why a role may fit, from public signals | Passes — better role relevance |
| Carry the homepage NPI into signed-in onboarding | Passes — less repeated data entry |
| Let a clinician see exactly what an employer receives | Passes — transparent clinician-controlled sharing |
| Learn which evidence an employer accepts for a role | Passes — greater employer acceptance |
| Add a new top-level product brand for an internal mechanism | Fails — distraction; see the brand architecture |
| Rename backend classes to match marketing vocabulary | Fails — maintenance at best; the strategy explicitly does not ask for it |
| A new cinematic homepage concept | Fails — the visual system launched; this is premature scope |

## Where this bites hardest

The filter is easiest to apply to new features and hardest to apply to
**vocabulary**. A new noun feels free. It is not: every customer-facing concept
added is one more thing a clinician must hold in their head before they
understand what VitalCV does. Treat a new customer-facing term as a product
decision and run it through this filter.
