# VitalCV Source Coverage Matrix

**MISSION:** Provide a strict ground-truth mapping of data sources, locking in source honesty and preventing marketing drift.

**Last updated:** 2026-03-30 (Wave 5)
**Source of truth:** `apps/api/backend/src/services/identity/sourceCatalog.ts`

## Core Constraints

- **Trust First, Matching Second, Intelligence Third.**
- **No rebrand work.**
- **No platform sprawl.**
- Sources defined in `sourceCatalog.ts` but not yet ingesting data are NOT live — regardless of catalog presence.

## Status Definitions

| Status | Meaning | May influence readiness? | May render as decision-grade? |
| --- | --- | --- | --- |
| **LIVE** | Actively fetched and parsed in real-time or via bulk file. Code path exists, env flag enabled, data flows. | Yes | Yes (if `decisionGrade: true` in catalog) |
| **PENDING** | Code path exists but data may be stale (e.g. quarterly refresh). Honest delay, not a bug. | Yes (with caveat) | Conditionally — must show staleness |
| **ACCESS_REQUIRED** | Institutional subscription, per-state agreement, or contracted access needed. VitalCV cannot query as a platform. | No | No |
| **NOT_INTEGRATED** | No code path, no data flow. May be defined in catalog as a future phase but produces zero signal today. | No | No |
| **STUB** | Simulated or mocked data. Never allowed in production. | No | No |

---

## Source Coverage Matrix

### 1. NPI Registry (NPPES / CMS)

| Field | Value |
| --- | --- |
| **Status** | **LIVE** |
| **Catalog key** | `NPPES_API` |
| **Evidence tier** | GOLD |
| **Integration type** | API (real-time) |
| **What it checks** | Clinician identity: name, NPI, taxonomy code, practice address, enumeration date |
| **Decision-grade** | Yes — part of launch spine |
| **Env flag** | Always on (no flag required) |
| **Allowed public language** | "Identity verified via NPPES"; "Live NPI verification" |
| **Cannot claim** | "Full identity verification" (NPPES confirms NPI registration, not identity proofing) |

### 2. State Medical Boards

| Field | Value |
| --- | --- |
| **Status** | **ACCESS_REQUIRED** (per-state agreements not in place for pilot) |
| **Catalog key** | `STATE_BOARD` |
| **Evidence tier** | GOLD |
| **Integration type** | SEARCH (per-state adapter) |
| **What it checks** | Active/inactive license status, license number, expiration, disciplinary actions |
| **Decision-grade** | Yes when enabled — part of launch spine |
| **Env flag** | `STATE_BOARD_ENABLED` (default false) |
| **Allowed public language** | "State license metadata tracking"; "Active license found ([state])" when adapter is enabled for that state |
| **Cannot claim** | "All 50 states verified"; "Board-certified" (board cert is ABMS, not state board); "License verified" when flag is off |

### 3. OIG/LEIE Exclusions (HHS Office of Inspector General)

| Field | Value |
| --- | --- |
| **Status** | **LIVE** |
| **Catalog key** | `OIG_LEIE` |
| **Evidence tier** | GOLD |
| **Integration type** | BULK_FILE (monthly CSV, cached) |
| **What it checks** | Federal healthcare program exclusion status (fraud, abuse, patient harm convictions) |
| **Decision-grade** | Yes — part of launch spine |
| **Env flag** | `OIG_LEIE_ENABLED` (default true) |
| **Allowed public language** | "Checked against OIG LEIE exclusion list"; "Automated OIG exclusion checks" |
| **Cannot claim** | "NPDB check cleared" (NPDB is a separate system); "Full sanctions screening" (OIG/LEIE is one of several exclusion lists); "SAM.gov cleared" (SAM is separate) |

### 4. NPDB (National Practitioner Data Bank)

| Field | Value |
| --- | --- |
| **Status** | **NOT_INTEGRATED** |
| **Catalog key** | Not defined in `sourceCatalog.ts` |
| **Evidence tier** | N/A |
| **What it checks** | Malpractice payments, adverse licensure/clinical-privilege actions, healthcare fraud convictions |
| **Decision-grade** | No |
| **Env flag** | None |
| **Allowed public language** | "NPDB reports require institutional subscription — not available in VitalCV today" |
| **Cannot claim** | "NPDB checked"; "NPDB cleared"; "Malpractice history verified"; any implication that NPDB data is part of the readiness score |

### 5. DEA (Drug Enforcement Administration)

| Field | Value |
| --- | --- |
| **Status** | **NOT_INTEGRATED** |
| **Catalog key** | Not defined in `sourceCatalog.ts` |
| **Evidence tier** | N/A |
| **What it checks** | DEA registration for controlled substance prescribing authority |
| **Decision-grade** | No |
| **Env flag** | None |
| **Allowed public language** | "DEA registration verification is not available in VitalCV today" |
| **Cannot claim** | "DEA verified"; "DEA registration confirmed"; "Prescribing authority checked" |

### 6. ABMS Board Certification (American Board of Medical Specialties)

| Field | Value |
| --- | --- |
| **Status** | **NOT_INTEGRATED** |
| **Catalog key** | Not defined in `sourceCatalog.ts` |
| **Evidence tier** | N/A |
| **What it checks** | Board certification status, specialty, certification dates, MOC participation |
| **Decision-grade** | No |
| **Env flag** | None |
| **Allowed public language** | "Board certification verification is not available in VitalCV today" |
| **Cannot claim** | "Board certified verified"; "ABMS checked"; "Specialty confirmed via primary source" |

### 7. CAQH ProView

| Field | Value |
| --- | --- |
| **Status** | **NOT_INTEGRATED** |
| **Catalog key** | Not defined in `sourceCatalog.ts` |
| **Evidence tier** | N/A |
| **What it checks** | Provider-attested credentialing data (education, training, work history, malpractice, references) |
| **Decision-grade** | No |
| **Env flag** | None |
| **Allowed public language** | "CAQH ProView integration is not available in VitalCV today" |
| **Cannot claim** | "CAQH data verified"; "Credentialing profile complete"; "Primary-source verified" for any CAQH-sourced field (CAQH is provider-attested, not primary-source) |

### 8. Medicare/Medicaid Enrollment (CMS PECOS)

| Field | Value |
| --- | --- |
| **Status** | **LIVE** (quarterly refresh — data may be up to 90 days stale) |
| **Catalog key** | `PECOS_PUBLIC` |
| **Evidence tier** | GOLD |
| **Integration type** | API |
| **What it checks** | Medicare provider enrollment status, enrollment type, specialty |
| **Decision-grade** | Yes — part of launch spine |
| **Env flag** | `PECOS_ENABLED` (default true) |
| **Enrollment statuses** | `ENROLLED`, `NOT_FOUND`, `UNKNOWN`, `UNCHECKED` |
| **Allowed public language** | "PECOS enrollment status checked"; "Medicare enrollment verification (quarterly cadence)" |
| **Cannot claim** | "Real-time Medicare enrollment"; "Medicaid enrollment verified" (PECOS is Medicare, not Medicaid); "Enrollment guaranteed current" (quarterly refresh means up to 90-day lag) |

---

## Additional Live Sources (Enrichment, Not Decision-Grade)

These sources are implemented and flowing data but are enrichment-only — they do not influence readiness scoring or blocking decisions.

| Source | Catalog Key | Status | What It Provides | Decision-Grade |
| --- | --- | --- | --- | --- |
| CMS Open Payments | `OPEN_PAYMENTS` | LIVE | Industry payment disclosures | No |
| CMS Doctors & Clinicians | `DOCTORS_CLINICIANS` | LIVE | Provider specialty and practice info | No |
| OpenAlex | `OPENALEX` | LIVE | Scholarly publications and authorship | No |
| ClinicalTrials.gov | `CLINICAL_TRIALS` | LIVE | Clinical trial participation | No |
| PubMed | `PUBMED` | LIVE | Biomedical literature references | No |

## Gated Sources (Code Exists, Access Not Yet Active)

| Source | Catalog Key | Status | Env Flag | Gate |
| --- | --- | --- | --- | --- |
| Nursys (State board network) | `NURSYS` | ACCESS_REQUIRED | `REAL_NURSYS_ENABLED` | Institutional E-Notify subscription |
| FSMB (Federation of State Medical Boards) | `FSMB` | ACCESS_REQUIRED | `FSMB_ENABLED` | Institutional agreement + connector |
| SAM.gov (Federal exclusions) | `SAM_GOV` | LIVE in catalog, pipeline wire-up pending | `SAM_GOV_ENABLED` | Rendering complete; pipeline not wired for pilot |

---

## Source Coverage Rules

1. **A source is LIVE only if**: code path exists AND env flag is enabled AND data is flowing in production.
2. **A source is decision-grade only if**: `decisionGrade: true` in sourceCatalog AND env flag is true AND claim confidence is not `UNCERTAIN`.
3. **Never render a gated/pending/access-required source as VERIFIED, CLEAR, or ENROLLED.**
4. **Never render a NOT_INTEGRATED source in any UI that implies it was checked.**
5. **Quarterly sources (PECOS) must show last-checked timestamp** — never imply real-time freshness.
6. **Silent source failures must surface as errors, not as clean/verified states.** A source that fails to respond is `UNAVAILABLE`, not `CLEAR`.
