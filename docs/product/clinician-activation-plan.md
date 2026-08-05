# Clinician activation — implementation plan and acceptance criteria

**Date:** 2026-08-05 · **Wave:** 1076 PR B, resumed after Wave 1077 convergence
**Status:** awaiting `FOUNDER CLINICIAN ACTIVATION IMPLEMENTATION REVIEW`

## Why this is the next thing

Production holds 6 opportunities, 6 organizations and **0 verified clinicians**.
That is not weak segment demand — it is the activation bottleneck. The
[decision filter](../strategy/product-decision-filter.md) is unambiguous here:
this is the only work that currently moves *time to a useful profile*, *less
repeated data entry* and *profile reuse* at once.

**Beachhead (founder-selected 2026-08-05):** hospital-based advanced practice
providers. Pilot recruitment language:

> Hospital-based nurse practitioners and physician assistants changing employers
> or taking an additional role.

This is an operating hypothesis to validate. No density or dominance claim.

---

## The activation loop

1. Clinician enters an NPI
2. VitalCV resolves available professional information
3. Clinician **reviews and corrects** it
4. Clinician adds the minimum missing information
5. Clinician **saves a reusable profile**
6. Clinician sees at least one relevant opportunity, or can share/apply
7. VitalCV records activation and reuse-ready state

### Primary activation event

> **A clinician has reviewed a resolved NPI profile, confirmed sharing control,
> and saved a reusable profile.**

Three conditions, all required. Saving without review is data capture; reviewing
without saving is a preview. Neither is activation.

### Tracked separately

`npi_submitted` · `npi_resolved` · `profile_reviewed` · `profile_saved` ·
`first_opportunity_viewed` · `first_application_shared` · `employer_opened_profile` ·
`employer_review_completed` · `clinician_start_date` · `profile_reused`

Ten events, one funnel. `profile_saved` is the activation denominator; everything
after it measures whether activation was worth anything. Payloads carry stage
metadata only — no NPI, name, credential detail or blocker text, enforced by the
existing allowlist guard.

---

## What exists and what does not

| Step | Today | Work |
| --- | --- | --- |
| 1–2 NPI → resolved preview | ✅ Live on `/` | None |
| 3 Review and correct | ❌ | **Build** — the resolved preview is read-only |
| 4 Add missing minimum | ❌ | **Build** |
| 5 Save a reusable profile | ❌ | **Build** — no persistence from the homepage |
| 6 See an opportunity / apply | 🟡 Public-safe feed live; Apply gated | **Unblock** — see the ownership question below |
| 7 Record activation | 🟡 Events defined, no sink confirmed | **Wire** |

---

## The ownership question, stated precisely

PR #1075 made a self-asserted claim non-authoritative — correctly. The result is
that Apply is gated behind a verification path **that does not exist**, so the
gate is closed for everyone.

The founder decision is explicit: *"Do not make 'verified clinician' depend on
inaccessible or institution-gated sources unless the product labels that state
precisely."*

That rules out making state-board licensure the critical path — it is
`access-gated`, the one lane VitalCV cannot read live. So activation must
distinguish two different things that have been conflated:

| State | Means | Unlocks |
| --- | --- | --- |
| **Profile saved** | The clinician reviewed public-source information and saved it | Their own profile, preferences, opportunity feed, and applying with *self-attested* information clearly labelled as such |
| **Ownership verified** | Someone accepted proof the NPI is theirs | Private credential holdings and source-backed sharing |

The first is achievable now and is what "activation" means. The second remains
the administrative path from Wave 1076 §5–6. **A clinician should be able to
complete the activation loop without waiting on a human.**

This is the one design decision in this plan that changes the product's shape,
and it is the one worth arguing about before it is built.

---

## Acceptance criteria

**Loop**
1. A clinician can go from homepage NPI to a saved profile without an
   administrator.
2. Every resolved field shows its source; every clinician-added field is labelled
   self-attested.
3. Corrections persist and survive refresh and a different device.
4. A saved profile yields at least one opportunity, or an honest empty state.
5. `profile_saved` fires once per clinician per profile, only on backend success.

**Boundaries** (unchanged from #1074/#1075)
6. A pending claim still unlocks no private credential holdings.
7. Self-attested information is never presented as source-backed.
8. Anonymous callers still receive only the public-safe projection.
9. A forged identity header still grants nothing.
10. A clinician cannot read or modify another clinician's profile.

**Truth**
11. No completion, clearance or verification claim appears for a saved profile.
12. The employer still decides; nothing implies otherwise.

**Instrumentation**
13. All ten events fire at their real moments; no event fires before its backend
    success.
14. No payload carries an NPI, name, credential detail or blocker text.

---

## Sequence

| PR | Contains |
| --- | --- |
| **B1** | Profile persistence: schema, save/read, review-and-correct UI, self-attested labelling. Acceptance 1–5, 7, 10–12 |
| **B2** | Activation instrumentation: the ten events end to end. Acceptance 13–14 |
| **B3** | Ownership verification: claim status UI, evidence submission, admin review queue, Apply unlock. Acceptance 6, 8, 9 — the Wave 1076 §3–7 scope |

B1 and B2 need no administrator and can ship independently. B3 is the human-review
path and should not block the first activated clinician.

## Production discipline

No production change without an explicit founder instruction for that change,
plus: exact deployed SHA, matching public `/api/version`, passing production
smoke, homepage interaction audit, and a published deployment receipt.
