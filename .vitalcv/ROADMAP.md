# ROADMAP.md — VitalCV Strategic Sequence
_Last updated: 2026-03-12 14:50 PDT. Current wave: 238 (in progress)._

**Sequencing principle:** Each phase must create standalone value AND compound the next phase.
**Priority filter:** time-to-start compression > trust-state durability > verifier confidence > buyer proof > aesthetic.

---

## Current State (Wave 238)

✅ Clinical identity via NPI
✅ PSV pipeline (Nursys, BreEZe, FSMB, NPPES live)
✅ SD-JWT VC credentials + OID4VCI/VP
✅ Trust Passport at `/p/:npi`
✅ Free job board — employers post, clinicians browse
✅ Apply with VitalCV (Wave 229 — ApplyModal, real DB)
✅ Knowledge graph (filterable — Wave 232)
✅ MATCHA engine (built, sophisticated scoring — Wave 187)
✅ Audit ledger, revocation, continuous monitoring
✅ Homepage: Moneyball thesis + 5 pillars + antigravity design (Wave 230-233)
✅ Google Sans Flex + antigravity design system (Wave 235-236)
✅ Document Intelligence — drop credential, AI parses it (Wave 237)
✅ Live verifier inbox — real applications from DB (Wave 234)
🔄 Wave 237 hardening — durable storage, audit, tests (in progress)
🔄 Wave 238 — credential onboarding: parse → review → ingest → PSV (in progress)
🔶 MATCHA: not connected to live opportunity DB
❌ Clinic capacity model
❌ Mobile app
❌ PubMed / ABMS / full identity enrichment
❌ Specialty job board aggregation

---

## What Changed Since Last Update

| Wave | Planned | Actual |
|---|---|---|
| 234 | Live verifier inbox | ✅ Done — real applications from DB |
| 235-236 | MATCHA connection | ⏭ Deferred — built antigravity design system instead (YC visual) |
| 237 | OIG/LEIE integration (roadmap) | ⏭ Pivoted — built Document Intelligence (Qomplement-style parser) instead |
| 238 | NPDB completion (roadmap) | ⏭ Pivoted — building credential onboarding flow (parse → ingest → PSV) |

**Why the pivot:** Document Intelligence is higher leverage than individual source integrations because it:
1. Enables ANY credential type to be ingested (not just one source at a time)
2. Creates the upload → verify loop that makes the product feel real
3. Feeds CandidateCredential records into the system, which MATCHA and capacity need
4. Is the user-facing "wow" moment missing from the demo

---

## Phase 1 — Close the Loop (NOW, pre-YC) — REVISED

| Wave | What | Status | Why |
|---|---|---|---|
| **234** | Live verifier inbox | ✅ Done | Marketplace loop closed |
| **237** | Document Intelligence (parse/extract/verify) | ✅ Done | Credential ingestion — the missing input |
| **237h** | Harden: durable storage, audit, file validation | 🔄 Building | Trust-state durability |
| **238** | Credential onboarding: parse → review → ingest → PSV trigger | 🔄 Building | End-to-end credential flow |
| **239** | MATCHA → live opportunities (replace mock data) | ⏳ Next | Intelligence layer activation |
| **240** | Capacity score MVP | ⏳ After 239 | Enterprise wedge (only if real data feeds it) |

**Gate for 239:** MATCHA only goes live when real `Opportunity` + `Application` + `CandidateCredential` records feed it. No mock data in production intelligence.

**Gate for 240:** Capacity score only ships when real application + start data exists. It must compute from actual records, not seed data.

---

## Phase 2 — Identity Depth (Q2 2026) — RE-RANKED by leverage

| Priority | Wave | What | Why |
|---|---|---|---|
| 1 | **241** | OIG/LEIE exclusion check (public dataset) | Safety signal — employers ask for this first |
| 2 | **242** | NPDB malpractice check | Second most-asked employer question |
| 3 | **243** | ABMS board certification API | The credential that matters most |
| 4 | **244** | PubMed publications on Trust Passport | Differentiator for academic clinicians |
| 5 | **245** | All 50 state boards via PSV adapter framework | National coverage claim |

---

## Phase 3 — Intelligence Layer (Q2-Q3 2026)

| Wave | What | Depends On |
|---|---|---|
| **246** | MATCHA v2 — credential gap analysis | Phase 2 sources live |
| **247** | Specialty job board aggregation | Job board data pipeline |
| **248** | Ask VitalCV (enable flag, polish UI) | Knowledge graph populated |
| **249** | Employer capacity dashboard | Application + start data real |

---

## Phase 4 — Mobile (Q3 2026)

| Wave | What |
|---|---|
| **250** | React Native / Expo scaffold |
| **251** | Passport + credential viewer |
| **252** | Apply from mobile + push |
| **253** | NFC / QR credential share |
| **254** | Apple / Google Wallet deep integration |

---

## Phase 5 — Network & Distribution (Q3-Q4 2026)

| Wave | What |
|---|---|
| **260** | Doximity partnership integration |
| **261** | Hospital EHR bridge (Epic, Cerner) |
| **262** | Government agency integration (CMS, TEFCA) |
| **263** | Credentialing body white-label SDK |
| **264** | Open API + developer portal launch |

---

## Decision Rule for Wave Selection

Before choosing the next wave, answer:
1. Does it reduce time-to-start for a real clinician?
2. Does it create durable trust-state records (not just UI)?
3. Does it close an open loop (broken flow, seeded data, disconnected layer)?
4. Is real data feeding the experience? (No mock data in production intelligence.)
5. Does it improve verifier confidence or buyer proof?
6. Is there a smaller version that gets 80% of the value in 20% of the time?

If none of the above — it's not the next wave. Aesthetic work only justified when substance is solid.

---

## Known Weaknesses (updated)

| Weakness | Impact | Status |
|---|---|---|
| ~~Verifier inbox uses seeded data~~ | ~~Breaks marketplace loop~~ | ✅ Fixed (Wave 234) |
| ~~No credential upload flow~~ | ~~System has no inputs~~ | ✅ Fixed (Wave 237) |
| Document store is in-memory | Data lost on restart | 🔄 Fixing (Wave 237h) |
| MATCHA uses mock data | Intelligence layer is fake | ⏳ Wave 239 |
| Clinical identity is NPI-only | Graph is thin | Phase 2 |
| Capacity modeling doesn't exist | Missing enterprise wedge | Wave 240 (gated) |
| Mobile app not built | "Not portable" | Phase 4 |
| Ask VitalCV flag-gated | AI layer invisible | Phase 3 |
