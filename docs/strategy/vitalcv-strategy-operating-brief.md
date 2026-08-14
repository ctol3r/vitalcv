---
title: "VitalCV Strategy Operating Brief"
status: "Canonical"
owner: "Chris Toler"
date: "2026-08-04"
amended: "2026-08-14"
source: "VitalCV Category Strategy"
---

# VitalCV Strategy Operating Brief

> **Amendment — 2026-08-14 (founder decision).** VitalCV keeps its broader
> clinician-facing identity as the portable professional identity and employment
> network. For employers, its explicit category is now **the Clinician
> Hire-to-Start Platform**. The initial pilot includes employed physicians and
> advanced practice providers; this supersedes the 2026-08-05 APP-only operating
> hypothesis. The primary buyer is provider recruitment leadership at health
> systems, and the primary outcome is an employer-confirmed actual first day.
> Credentialing, enrollment, privileging, and compliance remain institution- or
> vendor-owned requirements inside the joined case, never VitalCV's authority.

> **Amendment — 2026-08-08 (founder decision, Wave 1078).** The homepage hero is
> now **"Enter your NPI. VitalCV does the rest."**, shipped by UX-V1 (#1190).
> This document previously specified "Your clinician profile. Ready for every
> move." as the hero; that line remains the **clinician promise** but is no
> longer the homepage H1. Only the *Homepage message* section below changed —
> the category, core loop, north-star metric, vocabulary, and business model are
> untouched. Rationale is recorded in that section.

## Category

**Clinicians:** VitalCV is the portable professional identity and employment
network for clinicians.

**Employers:** VitalCV is **the Clinician Hire-to-Start Platform**.

> From opportunity to confirmed first day.

VitalCV connects qualified interest, clinician-controlled application,
employer decisions, remaining requirements, and the confirmed first day. The
ATS remains the recruiting record. Credentialing platforms and institutions
retain credentialing, enrollment, privileging, and compliance authority.

It is not primarily a résumé builder, credentialing service, document wallet,
job board, applicant tracking system, CVO, or privileging authority.

## Core loop

> NPI → useful profile preview → claim profile → set preferences → see relevant role → apply with an exact packet → employer reviews → accepts as a head start → remaining requirements → start-ready → employer confirms actual first day → profile reuse

## Clinician problem

> I need a better job. I do not want to fill all this out again.

## Clinician promise

> **Your clinician profile. Ready for every move.**

Supporting promise:

> **Build once. Move forward without starting over.**

These are the **promise** — what the product is for, and the language to use when
explaining VitalCV in a sentence. They are not required to be the homepage H1.

## Homepage message

### Hero

*Amended 2026-08-08. Live since UX-V1 (#1190).*

# Enter your NPI. VitalCV does the rest.

We find what we can, show you exactly what remains, and handle the administrative work that can safely be handled.

**Start with your NPI**

Free for clinicians · Your NPI is a public identifier — entering it starts nothing you don't approve

**Why this hero and not the promise line.** The promise names the *asset* (a
reusable profile); this hero names the *wedge* (the one action a cold clinician
can take in five seconds with nothing to hand). A hero has to earn the first
interaction, and the asset only becomes legible after the NPI resolves — which
is the product's first proof of work and the moment the homepage is built
around. The promise then does its job everywhere the reader already has context:
the profile surfaces, jobs, apply, employer pages, and every explanation of what
VitalCV is.

**This is a hero decision, not a category change.** The reusable profile is still
the product and the north-star metric is unchanged. If the hero stops converting,
the promise line is the first alternative to test — it is not retired.

### Four steps

1. **Start with what is already known**  
   VitalCV fills in professional information available from public sources. The clinician reviews it and adds what is missing.

2. **Find work that fits**  
   Match on specialty, location, schedule, preferences, and career goals.

3. **Apply with your profile**  
   Preview exactly what the employer receives and apply without rebuilding professional history.

4. **Keep it for your next move**  
   Update once and reuse the profile throughout the clinician’s career.

## What customers should remember

- VitalCV
- Your VitalCV profile
- VitalCV Jobs
- Apply with VitalCV

## Keep from the current product

- NPI-first entry
- Free clinician profile
- No account needed before preview
- Clinician-controlled sharing
- Transparent sources and freshness
- Reusable career record
- Real job matching
- Employer acceptance and reuse

## Remove from the main story

- Blockchain language
- Wallet/passport/dossier proliferation
- Technical trust vocabulary in the hero
- Packets and receipts before the user needs them
- Cinematic storytelling before utility
- Generic completion percentages
- Abstract phrases requiring interpretation
- Separate brands for internal mechanisms

## Product design rule

The homepage needs one memorable moment:

> The clinician enters an NPI and immediately sees a useful professional profile.

After that, prioritize speed, clarity, utility, and confidence.

## Initial beachhead

**Founder decision, 2026-08-14:**

**Employed physicians and advanced practice providers hired by health systems.**

The pilot permits both populations while constraining each design partner to no
more than two service lines. The buyer is provider recruitment leadership,
with credentialing, medical staff services, HR, and onboarding as required
workflow participants.

## Business model

- Clinicians remain free
- Free pilot under a signed scope
- After the pilot, an annual employer platform fee
- After the pilot, an idempotent fee per employer-confirmed start
- No start-triggered billing without active signed commercial entitlement,
  duplicate-start protection, dispute handling, and cancellation terms

One unique authorized `StartAttestation` may create at most one billable event.
First-billable may be recorded when an employer supplies it, but it is not the
universal outcome event.

## Moat

1. Clinician identity graph
2. Consent graph
3. Employer acceptance graph
4. Outcome graph
5. Integration graph

The deepest differentiator is **acceptance intelligence**: what employers accept, for which roles, under which conditions.

## 90-day mandate

### Days 1–15
- Install this contract in strategy, copy tests, lifecycle definitions, and a
  production-grounded current-state audit.

### Days 16–45
- Converge employer decisions, head-start acceptance, requirements, start-ready,
  and actual-start attestation onto one packet-bound transaction path.

### Days 46–65
- Add a vendor-neutral integration contract and the authorized joined
  hire-to-start read model before choosing a vendor-specific adapter.

### Days 66–90
- Recruit 5–10 design partners; launch with the first 2–3 that have signed scope
  and can provide real employed-physician or APP cases.
- Measure confirmed starts and both elapsed-time clocks without publishing speed
  or savings claims before 12 complete, valid spans exist.

## Decision filter

A product, design, marketing, or engineering decision should move forward only when it strengthens at least one of these:

- Faster time to a useful clinician profile
- Better role relevance
- Less repeated data entry
- More transparent clinician-controlled sharing
- Greater employer acceptance
- More successful clinician starts
- More profile reuse

If it does not, it is probably infrastructure, distraction, or premature scope.
