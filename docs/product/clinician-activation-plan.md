# Clinician activation — implementation plan and acceptance criteria

**Date:** 2026-08-05 · **Wave:** 1076 PR B, resumed after Wave 1077 convergence
**Status:** ✅ **APPROVED 2026-08-05** with one required event-model correction,
applied below. Awaiting `FOUNDER CLINICIAN ACTIVATION B1 REVIEW`.

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

The activation event and its funnel are defined under
[The event model](#the-event-model) below.

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

## Canonical state model

Five states. **Separate and non-interchangeable** — none may be inferred from
another, and none may be collapsed into a single "verified" badge.

### Resolved
VitalCV located and displayed information associated with the submitted NPI.
**This does not prove the current user owns or controls that professional
identity.**

### Profile saved
The clinician has (1) reviewed the resolved profile, (2) corrected or completed
the minimum required information, (3) confirmed what VitalCV may share, and
(4) saved the reusable profile.

Unlocks: their reusable profile · opportunity discovery · clearly-labelled
self-attested sharing · Apply with VitalCV where the employer accepts that
profile state.
**Does not unlock private credential holdings.**

### Ownership verified
A separate identity or administrative process established that the user controls
the clinician identity. May unlock private credential holdings, restricted source
results, higher-trust sharing, and actions that legally or contractually require
identity assurance.

**Ownership verification is not the initial activation event.** A clinician must
reach a useful, retained profile without waiting for an administrator, an
employer, an institution-gated source, or a licensure integration.

### Employer reviewed
An employer opened or reviewed the shared profile. **This does not mean the
clinician was approved, credentialed, privileged or hired.**

### Ready to start
Only when the required downstream employer-controlled conditions are actually
satisfied. **Never inferred** from profile completion, source resolution, or
ownership verification.

---

## The event model

### Primary activation event

`clinician_profile_activated` — emitted **exactly once per activation cycle**,
when all three are true:

- `profile_reviewed = true`
- `sharing_control_confirmed = true`
- `profile_saved = true`

**Raw `profile_saved` is not the activation event and not the denominator.** It
remains a separate funnel event so an ordinary save is distinguishable from a
completed activation — a distinction that disappears if one event does both jobs.

### Canonical funnel

1. `npi_submitted`
2. `npi_resolved`
3. `profile_reviewed`
4. `sharing_control_confirmed`
5. `profile_saved`
6. `clinician_profile_activated`
7. `first_opportunity_viewed`
8. `first_application_shared`
9. `employer_opened_profile`
10. `employer_review_completed`
11. `clinician_start_date`
12. `profile_reused`

### Payload boundary

Approved stage metadata only. **Never**: NPI · clinician name · credential
values · free-text corrections · blocker details · source-returned professional
information. Enforced by the existing allowlist guard, extended to the new events.

---

## Truth classes

Every displayed or shared field keeps its class. At minimum:

| Class | Means | Must never imply |
| --- | --- | --- |
| **Public source** | A public registry returned it | That the user owns this identity |
| **Clinician provided** | The clinician typed or corrected it | That anyone verified it |
| **Ownership verified** | Identity control was established | That any credential was verified |
| **Employer reviewed** | An employer looked | Approval, credentialing, privileging or hiring |

Friendly customer language is fine; the underlying distinctions must remain
**visible and testable**. No single `verified` badge.

---

## Persistence

Activation must survive refresh, browser restart, sign-in completion mid-flow,
and navigate-away-and-return. After a successful activation the clinician must
not repeat NPI resolution or profile review unless source data materially changes
or they explicitly restart.

If the current no-account flow cannot safely persist a profile, introduce the
**smallest** account-claim step — **after** the value preview and **before**
durable save. Account creation does not precede seeing resolved value unless
technically unavoidable.

---

## Sharing

Before the first share or application, show: exactly what will be shared · which
fields came from public sources · which the clinician provided · that the
recipient reviews and decides · that sharing is not credentialing, privileging or
hiring approval.

The clinician **affirms each recipient**. No global consent silently authorizing
future recipients.

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
13. All twelve events fire at their real moments; no event fires before its
    backend success.
14. No payload carries an NPI, name, credential detail or blocker text.

**Founder-required additions (2026-08-05)**
15. A raw save without profile review does **not** emit `clinician_profile_activated`.
16. Review plus save without sharing-control confirmation does **not** activate.
17. Activation emits **once**, when all three conditions become true.
18. Repeated saves do not duplicate the activation event.
19. Public-source and clinician-provided fields remain distinguishable **after** save.
20. Ownership verification is **not** implied by NPI resolution.
21. Ownership verification is **not** required to reach a reusable saved profile.
22. Private credential holdings remain inaccessible before ownership verification.
23. The activated profile survives refresh and return.
24. No activation analytics payload contains NPI, name, credential detail or free text.
25. The first share requires **recipient-specific** clinician affirmation.
26. Employer review does **not** produce a ready-to-start state automatically.

---

## Sequence

| PR | Contains |
| --- | --- |
| **B1 — Review, correct and save** | Editable resolved profile · minimum missing fields · sharing-control confirmation · persistence · `clinician_profile_activated` · state and truth labels |
| **B2 — Opportunity and share** | Relevant opportunity surface · first share/application · recipient-specific affirmation · employer-open event · truthful employer-review state |
| **B3 — Measurement and reuse** | Funnel reporting · activation cohort reporting · profile reuse detection · start-date capture · beachhead pilot dashboard |

**Do not start B2 until B1 can activate a real clinician end to end.**

### Explicitly NOT in B1

A new credentialing workflow · manual administrator review as a prerequisite ·
institution-gated licensure promises · document collection beyond the profile
minimum · wallet or blockchain UI · profile scoring · a universal readiness
score · a new public product noun.

---

## B1 success threshold

Pilot thresholds, **not market claims**:

- 10 real hospital-based APPs enter an NPI
- ≥ 8 resolve successfully
- ≥ 6 activate a reusable profile
- median NPI-to-activation under **10 minutes**
- ≥ 5 return to the saved profile without repeating the process
- **zero** truth-label or consent-boundary failures

The first target is not visual completion.

### B1 stop condition

Deployed to a review environment with a full interaction recording, desktop and
mobile evidence, event receipts, persistence proof, truth-class proof, and one
successful end-to-end test using a **non-sensitive test identity**.

## Production discipline

No production change without an explicit founder instruction for that change,
plus: exact deployed SHA, matching public `/api/version`, passing production
smoke, homepage interaction audit, and a published deployment receipt.
