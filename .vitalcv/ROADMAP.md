# ROADMAP.md — VitalCV Strategic Sequence
_Last updated: 2026-03-12. Current wave: 233._

**Sequencing principle:** Each phase must create standalone value AND compound the next phase.

---

## Current State (Wave 233)

✅ Clinical identity via NPI  
✅ PSV pipeline (Nursys, BreEZe, FSMB, NPPES live)  
✅ SD-JWT VC credentials + OID4VCI/VP  
✅ Trust Passport at `/p/:npi`  
✅ Free job board — employers post, clinicians browse  
✅ Apply with VitalCV (Wave 229 — ApplyModal)  
✅ Knowledge graph (filterable — Wave 232)  
✅ MATCHA service (built, not front-and-center)  
✅ Audit ledger, revocation, continuous monitoring  
✅ Homepage: Moneyball thesis + 5 pillars + antigravity design  
🔶 Verifier inbox: seeded data only  
🔶 MATCHA: not connected to live opportunities  
❌ Clinic capacity model  
❌ Mobile app  
❌ PubMed / ABMS / full identity enrichment  
❌ Specialty job board aggregation  

---

## Phase 1 — Close the Loop (NOW, pre-YC)
_Goal: Every core user flow works end-to-end. Demo is airtight._

| Wave | What | Why |
|---|---|---|
| **234** | Live verifier inbox — real applications from DB | Closes the marketplace loop completely |
| **235** | MATCHA connected to live opportunities — readiness score on explore page | Shows AI layer is real, not a demo |
| **236** | Capacity score MVP — "You can start X more physicians this month" | First instance of the enterprise metric |

---

## Phase 2 — Identity Depth (Q2 2026)
_Goal: Clinical identity graph becomes genuinely rich and differentiated._

| Wave | What | Why |
|---|---|---|
| **237** | OIG/LEIE integration (public dataset, easy) | PSV completeness, safety signal for employers |
| **238** | NPDB completion — full malpractice check | Employers care most about this |
| **239** | PubMed researcher profile — publications on Trust Passport | Differentiates VitalCV from any other platform |
| **240** | ABMS board certification integration | The credential employers care about most |
| **241** | All 50 state boards via PSV adapter framework | True national coverage |

---

## Phase 3 — Intelligence Layer (Q2–Q3 2026)
_Goal: MATCHA becomes the career engine, not just a matching widget._

| Wave | What | Why |
|---|---|---|
| **242** | MATCHA v2 — credential gap analysis + career path modeling | "You're 6 months from being eligible for these 14 roles" |
| **243** | Specialty job board aggregation — auto-pull from ASCO, ACEP, AMA, etc. | The Sutter model automated |
| **244** | Ask VitalCV — AI career Q&A (enable flag, polish UI) | Natural language over the knowledge base |
| **245** | Employer capacity dashboard — starts-per-quarter, credentialing velocity | Enterprise sales wedge |

---

## Phase 4 — Mobile (Q3 2026)
_Goal: Trust Passport lives on the clinician's phone._

| Wave | What | Why |
|---|---|---|
| **250** | React Native / Expo app scaffold | Foundation |
| **251** | Clinician passport + credential viewer | Core mobile use case |
| **252** | Apply from mobile + push notifications | Marketplace on mobile |
| **253** | NFC / QR credential share | Physical world interaction |
| **254** | Apple / Google Wallet deep integration | Credential at hospital check-in |

---

## Phase 5 — Network & Distribution (Q3–Q4 2026)
_Goal: VitalCV becomes unavoidable to medical organizations._

| Wave | What | Why |
|---|---|---|
| **260** | Doximity partnership integration | 80% of US physicians |
| **261** | Hospital EHR bridge (Epic, Cerner webhook) | Credentialing starts inside the workflow |
| **262** | Government agency integration (CMS, TEFCA) | Regulatory legitimacy |
| **263** | Credentialing body white-label SDK | MSOs and CVOs become distribution |
| **264** | Open API + developer portal launch | Ecosystem moat |

---

## Phase 6 — Category Definition (2027)
_Goal: PSV anchored on blockchain becomes the regulatory standard._

- Blockchain PSV anchor: verifiable once, trusted everywhere, by anyone
- TEFCA QHIN integration: VitalCV as a trust node in the national health information network
- International expansion: Canada, UK, Australia (common-law medical credential frameworks)
- Series A: $8M → sales, compliance, federation network

---

## Decision Rule for Wave Selection

Before choosing the next wave, answer:
1. Does it reduce time-to-start?
2. Does it improve demo quality?
3. Does it close an open loop (broken flow, seeded data, disconnected layer)?
4. Does it compound a future phase?
5. Is there a smaller version that gets 80% of the value in 20% of the time?

If none of the above — it's not the next wave.
