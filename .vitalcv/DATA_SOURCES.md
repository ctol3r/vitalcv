# DATA_SOURCES.md — VitalCV Data Source Registry
_Last updated: 2026-03-12._

> **Historical planning document — not a production coverage contract.**
>
> This file predates the canonical runtime source catalog and contains stale labels such as “Live Today” for integrations that may be adapter-only, gated, unconfigured, or never successfully run in production. Do not use this document to claim live coverage.
>
> Runtime truth must be derived from `apps/api/backend/src/services/identity/sourceCatalog.ts`, canonical handler registration in `identityIngestionPipeline.ts`, required configuration/credentials, and the latest successful production `SourceRun` inside its freshness window. The build contract for consolidating those states is `docs/product/clinician-enrichment-graph.md`.

**Principle:** Sequence interoperability strategically. Prioritize by trust + leverage + feasibility.

---

## Tier 1 — Live Today

| Source | What It Provides | Integration | Notes |
|---|---|---|---|
| NPPES | NPI, name, specialty, address, taxonomy | HTTP API — live | Foundation of clinical identity |
| Nursys | Nursing license verification | Adapter built | Multi-state nursing |
| BreEZe / DCA | CA medical license | Adapter built | California-specific |
| FSMB | Federation of State Medical Boards data | Adapter built | Cross-state medical |

---

## Tier 2 — Built, Needs Completion

| Source | What It Provides | Status | Next Step |
|---|---|---|---|
| NPDB | National Practitioner Data Bank — malpractice, exclusions | Partial routes | Complete adapter, live query |
| DEA | Drug Enforcement Administration — Schedule II-V registration | Stub in PSV | Complete verification flow |
| OIG/LEIE | Office of Inspector General exclusion list | Stub in PSV | Public dataset, downloadable, easy |
| CMS Provider Enrollment | Medicare/Medicaid participation, PECOS | `pecosEngine.ts` built | Wire to identity profile |

---

## Tier 3 — High Value, Build Next

| Source | What It Provides | Feasibility | Business Leverage |
|---|---|---|---|
| **ABMS** (American Board of Medical Specialties) | Board certification status for 24 specialty boards | API partnership needed | Critical — employers care most about board cert |
| **ABIM** | Internal medicine subspecialty certification | Subset of ABMS | Already referenced in copy |
| **PubMed / NCBI** | Publication record, research activity | Open API — easy | Clinical identity completeness, prestige signal |
| **State medical boards (all 50)** | License status, disciplinary actions | PSV adapter framework ready | Expand Nursys/FSMB coverage to all states |
| **ECFMG** | International medical graduate verification | API partnership | Important for IMG physicians |

---

## Tier 4 — Strategic, Requires Partnership

| Source | What It Provides | Approach | Notes |
|---|---|---|---|
| **Doximity** | Physician network, profile, peer connections, practice history | Partnership API | 80%+ of US physicians are on Doximity. Partner, don't scrape. |
| **LinkedIn** | Career history, education, endorsements | OAuth integration | Self-reported but useful for career graph enrichment |
| **ACGME** | Residency/fellowship training program verification | Structured data | Verify training pedigree |
| **AAMC** | Medical school, USMLE, ERAS application data | Partnership | Education verification |
| **Hospital privilege records** | Active privileges at specific facilities | Direct employer integration | Requires hospital API or attestation |

---

## Tier 5 — Specialty Job Board Network

| Source | What It Provides | Approach | Notes |
|---|---|---|---|
| ASCO job board | Oncology positions | Auto-aggregation (scrape/RSS/API) | Christopher's Sutter model |
| ACEP | Emergency medicine | Same | |
| AMA job board | General/multi-specialty | Same | |
| AANP | Nurse practitioners | Same | |
| AAPA | Physician assistants | Same | |
| CRNA-specific boards | Anesthesiology | Same | |
| Hospital career pages | Direct employer postings | Sitemap/RSS scraper | Long tail volume |

**Strategy:** Build a universal job aggregation layer. Employers post free on VitalCV.
VitalCV syndicates to specialty boards (and can pull from them).
Clinicians get all opportunities in one place, matched to their verified credentials.

---

## Privacy & Legal Guardrails

- **Never scrape protected health information (PHI)**
- NPDB requires institutional credentialing authorization for full records — use summary data in demo
- LinkedIn ToS prohibits bulk scraping — use OAuth + explicit user consent only
- Doximity data requires their partnership agreement
- State board data is generally public but check per-state before automating
- OIG/LEIE is a public government dataset — fully legal to download and index
- PubMed is fully open — no restrictions
- NPPES is a public CMS dataset — fully legal

---

## Source Priority Matrix

| Source | Trust | Legal Safety | Business Leverage | Feasibility | Priority |
|---|---|---|---|---|---|
| NPPES | ★★★★★ | ✅ | ★★★★ | Done | Live |
| OIG/LEIE | ★★★★★ | ✅ | ★★★★ | Easy | Next |
| NPDB | ★★★★★ | ✅ (with auth) | ★★★★★ | Medium | Next |
| DEA | ★★★★★ | ✅ | ★★★★ | Medium | Next |
| ABMS | ★★★★★ | ✅ | ★★★★★ | Partnership | Q2 |
| PubMed | ★★★★ | ✅ | ★★★ | Easy | Q2 |
| All 50 state boards | ★★★★★ | ✅ | ★★★★★ | Medium | Q2 |
| Doximity | ★★★★ | Partnership | ★★★★★ | Partnership | Q3 |
| Hospital privilege | ★★★★★ | Employer consent | ★★★★★ | Employer-led | Q3 |
