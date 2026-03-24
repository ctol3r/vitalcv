# VitalCV Demo Script — 2026-03-24

## The Wedge (60-second version)

VitalCV is the verified clinician identity graph. It starts with an NPI and produces a
portable, audit-ready trust packet that an employer can accept as a head start — instead
of rebuilding from scratch.

---

## Live Demo Flow (3-4 minutes)

### Step 1 — Enter an NPI (15s)
Go to https://vitalcv.com
Enter NPI: `1003000126` (Sarah Chen MD — pre-seeded demo, READY)

Shows in the hero:
- NPPES identity resolves in ~10s
- OIG/LEIE exclusion check runs
- PECOS enrollment check runs
- Readiness state computed: READY / PARTIAL / BLOCKED

**What to say**: "This is the entire trust stack for a clinician — 3 federal sources, live. No
uploads, no forms, no committee. NPI is the identity anchor."

---

### Step 2 — Open the Passport (30s)
After ingestion completes → click "View Passport" or navigate to `/passport/[entityId]`

Show the clinician:
- Identity section: name, NPI, specialty
- Readiness items: ✓ verified / ✕ missing
- **Trust Posture card**: score + band (L0–L3) + dimension breakdown + gaps
- Details accordion: Identity / Authority / Training / Safety / Eligibility

**What to say**: "This is the clinician's portable trust record. Trust posture is computed from
verified primary sources — not an AI score. L3 = Verified, L2 = Credentialed, L1 = Partial.
Every dimension is explainable, every source is named."

Demo NPI 2 (PARTIAL): `1942788324` — Marcus Williams DO, PECOS gap
Demo NPI 3 (BLOCKED): `1841498016` — Priya Nair MD, OIG exclusion pending

---

### Step 3 — Share with employer (20s)
Click "Share with employer" in Passport

Generates a shareable packet → `/interview?entityId=...`

**What to say**: "The clinician owns this profile. They share a packet link — the employer
doesn't need to request documents. The packet inherits everything from the passport."

---

### Step 4 — Employer review (30s)
Navigate to `/review/[entityId]`

Show:
- Trust Posture card (compact) — employer sees the same posture the clinician sees
- Readiness status: READY / PARTIAL / BLOCKED
- Verified vs. contextual distinction
- Accept as head start / Request refresh / Route to review

**What to say**: "The employer reviews the trust record, not a document pile. Trust posture
tells them what's verified, what's missing, and what action to take. Accept as head start —
that means: use this as your starting point, don't rebuild from scratch."

---

### Step 5 — Global Map (optional, 30s)
Navigate to `/intelligence?view=map`

Show:
- Shortage choropleth (HRSA HPSA)
- Institution markers (readiness breakdown)
- Toggle layers

**What to say**: "Workforce context — shortage areas, institutional coverage, trust posture
by geography. This is enrichment — it informs, it doesn't gate readiness."

---

## What's Live Today

| Feature | Status |
|---|---|
| NPI → NPPES live lookup | ✅ Live |
| OIG LEIE sanctions check | ✅ Live |
| PECOS enrollment check | ✅ Live |
| Trust posture (L0–L3) | ✅ Live (surfaced in Passport + Review) |
| Portable packet / share | ✅ Live |
| Employer trust review | ✅ Live |
| MS16 PECOS 4-way status | ✅ Live |
| Document intelligence (OCR) | ✅ Live |
| Global Intelligence Map | ✅ Live |
| Nursys licensure check | ⚙️ Requires institutional access |
| FSMB board status | ⚙️ Requires institutional access |
| OFAC SDN check | ⚙️ Pipeline wiring pending (~1 sprint) |

## What to Avoid Saying

- ❌ "AI-powered credentialing" — it's primary-source verification, not AI
- ❌ "Fully automated credentialing" — trust posture informs, employers decide
- ❌ "Board certification verified" — ABMS not yet integrated
- ❌ "DEA verified" — DEA not yet integrated
- ❌ "Privileges approved" — VitalCV does not issue privileges
- ❌ "NCQA certified" — designed for NCQA alignment, not yet accredited

## What to Emphasize

- ✅ Verified from federal primary sources (NPPES, OIG, PECOS)
- ✅ Portable — clinician shares once, employers receive the same verified record
- ✅ Explainable — every dimension is named, every source is cited
- ✅ Head start — not a replacement for credentialing committee, but a verified foundation
- ✅ Trust posture — quantified, versioned, auditable
