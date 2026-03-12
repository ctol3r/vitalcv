# FOUNDER_NOTES.md — Christopher Toler's Product Instincts & Strategic Vision
_Last updated: 2026-03-12. Captured from session conversations._

---

## The Founding Insight

> "No one is connecting credentialing to hiring more people. If we want to hire more people
> in a year, we need to have more interviews. To have more interviews you need to push
> clinicians through faster. I call this moneyball recruiting."

**Reconciled into:** NARRATIVE.md (Moneyball section), Homepage (MoneballSection component)

---

## The Job Board Problem (Lived Experience)

> "I spent 5-6 thousand dollars on a single ASCO oncology posting for 90 days. I supported
> 9 medical groups within the Sutter Health system. All groups were multi-specialty as well.
> So 45 plus specialties that needed targeted job boards. There was no cap on my spend for
> job postings. Eventually I smartened up and bought packages of job board tech companies
> that ran these specialty medical association job boards... I eventually set up a way where
> the vendor would scrape our home job board to be automatically aggregated to the
> specialty-specific job board. Now the goal is to be a place where all employers can post
> their jobs for free."

**Reconciled into:** ROADMAP.md (Phase 3 — specialty board aggregation), CONTEXT.md (free job board layer), Homepage Platform Vision section

---

## The Platform Ambition

> "Is it too ambitious to want to integrate with everything? Well, all things medical. Is it
> too ambitious to want VitalCV to be the mecca of credentialing and medical specialties
> and provider types and career paths. I want to extract or scrape everything possible.
> From associations of NPI number; education, profiles, doximity, linkedin, pubmed, etc.
> Licensure, credentials, state and national data."

**My take:** Not too ambitious. It's the only scope that creates an unassailable moat.
The key is sequencing — build clinical identity layer by layer, each adding value immediately.

**Reconciled into:** DATA_SOURCES.md (tier system), ROADMAP.md (Phase 2 — identity depth)

---

## Capacity Metrics Insight

> "For the first time employers can measure capacity of their clinic."

**This is the enterprise wedge.** No health system today has a metric for
"how many physicians can we actually onboard this quarter?"
VitalCV makes this measurable and improvable.

**Reconciled into:** CONTEXT.md (secondary metrics), SYSTEM_MAP.md (Layer 5), ROADMAP.md (Wave 236)

---

## AI + Blockchain Vision

> "Where is AI in all of this? AI and blockchain. How can we be not only the platform
> with the best approach or solve for the problem we are targeting. But how can we do
> something with technology that has never been done before. How do we raise eyebrows
> in the tech community and not just the medical community. How can we be unavoidable
> to medical orgs, medical gov agencies?"

**The novel tech claims (as documented on site):**
1. First unified clinical identity graph (NPI → credentials → publications → career history)
2. Credential-aware job matching (MATCHA) — not keyword matching
3. PSV that never expires — blockchain-anchored, permanent
4. Clinic hiring capacity as a measurable metric

**Reconciled into:** SYSTEM_MAP.md (tech novel claims), Homepage PlatformVisionSection

---

## The Design Philosophy

> "Everything visually aesthetic should be functionally practical."
> "The graph should work like Obsidian or Roam Research."
> "Doctors appreciate simplicity and being practical and being science-minded."
> "They also like to be part of the next best unconventional thing — especially if it's proven to work, easy and reliable."

**Applied:**
- FilterableTrustGraph (Wave 232): Obsidian-style type filters + search
- Design language: deep navy authority, NOT void-black crypto aesthetic
- Copy: human outcomes, not technical jargon ("cryptographically" removed)
- Medical framing: hypothesis → rationale → proof → conclusion

**Reconciled into:** DECISION_RULES.md (Red Light: "graph features visually impressive but operationally empty"), SYSTEM_MAP.md (principle statement)

---

## Mobile App Priority

> "The mobile app is a key piece or crucial for the success of VitalCV.
> It doesn't feel portable without the mobile app."

**The clinician use case:** Pull up your Trust Passport on your phone at a hospital check-in.
The whole premise of "verified once, trusted everywhere" requires portability.

**Status:** PWA exists. Apple/Google Wallet passes exist. Native Expo app is Phase 4 priority.

**Reconciled into:** ROADMAP.md (Phase 4), MEMORY.md

---

## Clinician Awareness Problem

> "Something I haven't said yet is another part of the issue: clinicians rarely know what
> opportunities are available. The job board market is saturated."

**This is the distribution side of the bottleneck.**
Clinicians don't know what's available. Employers can't afford to be visible in all specialties.
VitalCV solves both sides simultaneously: free posting + intelligent matching.

**Reconciled into:** Platform Vision section on homepage, ROADMAP.md (specialty aggregation)

---

## MATCHA Context

> "Now the goal is to be a place where all employers can post their jobs for free.
> So all nurses, doctors, therapists, etc. can post their jobs. Then this is where
> matcha.ai comes in."

MATCHA is the intelligence layer ON TOP of the free job board.
Not a replacement for the board — the thing that makes it smarter than every other board.

**Reconciled into:** ROADMAP.md (Phase 3), SYSTEM_MAP.md (Layer 5)

---

## Operating Directive (Meta)

> "OpenClaw, you must operate as more than a coding agent. You must behave as a
> system-level strategist and ecosystem operator for VitalCV."
> "Your operating goal is to develop and compound VitalCV into a category-defining,
> billion-dollar healthcare trust infrastructure platform and business."

**This is the standing operating mode.** Not wave → code → commit.
Mission → system → leverage → implementation → validation → business value.

**Applied:** Created `.vitalcv/` knowledge layer. Every future loop reads these files first.
