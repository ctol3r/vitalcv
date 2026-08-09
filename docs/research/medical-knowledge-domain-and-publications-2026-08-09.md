# The Medical Knowledge Domain & Publications Integration — Master Research

**Date:** 2026-08-09 · **Status:** Research of record (decision-grade inputs; no code shipped by this doc)
**Mission:** Make VitalCV more knowledgeable about clinicians than Doximity, LinkedIn, NPINO, AAMC, JAMA, and NEJM — via (1) a publications/research-identity integration layer and (2) a preset medical knowledge ontology (specialties, training paths, roles/suffixes, societies, journals, employers, credentialing workflows) — all under the standing cost policy: **no paid data sources** (paid options catalogued and flagged dormant).

**Provenance of this document:** synthesized from seven parallel research passes (publication platforms; specialty taxonomy & training paths; roles/titles/suffixes; societies & journals; credentialing workflows; competitor knowledge depth; repo integration surfaces), each with primary-source URLs retained inline. Prior in-repo research built on (not repeated): the 2026-07-14 institution-datasets pass (CMS Doctors & Clinicians goldmine, NPPES Type-2 employers, ACGME program list caveat) and the shipped curated-institutions dataset (#652/#653).

---

## 0. Executive summary

1. **The publications layer is buildable for $0 in data fees.** The free, redistribution-safe backbone: **ORCID** (OAuth identity spine, CC0 annual data file) + **OpenAlex** (CC0 citation graph — the only one that may legally be cached/mirrored) + **PubMed E-utilities** (medical canon) + **Europe PMC** (best single ORCID→publication-list-with-citations endpoint) + **Crossref** (DOI ground truth, incl. the `authenticated-orcid` publisher-verification flag) + **ClinicalTrials.gov** + **NIH RePORTER** + **Retraction Watch via Crossref** (free since 2023). Google Scholar, ResearchGate, Scopus, Web of Science, Dimensions, and The Lens are link-only or avoid.
2. **Assertion provenance is the category difference.** Neither Doximity nor LinkedIn can say *who asserted a publication and on what basis*. A six-tier provenance ladder (publisher-authenticated → trusted-org → registry-confirmed → wizard-claimed → hand-entered → algorithmic-guess) maps directly onto the existing proof-tier doctrine (§III.3).
3. **The knowledge ontology is enumerable and mostly free.** ABMS (24 boards / 38 primary / 89 subspecialty certificates), AOA (15 boards), ACGME (specialty & block tables — both parse cleanly from official PDFs), NUCC taxonomy (~870 codes, CSV, the NPPES join key), the residency→fellowship path DAG with official training lengths, the suffix/credential vocabulary with per-profession ordering rules, ~600–800 societies in 9 tiers, and a ~30k-journal catalog from NLM's free J_Medline file. **No NUCC↔ABMS crosswalk exists anywhere — hand-curating it is a moat.**
4. **Credentialing-workflow knowledge is the connective tissue.** The element→PSV-source→free/paid table, the renewal-clock lattice, NCQA's transitive-discharge rule (board cert ⇒ education+training), and the honest finding that **publications and society memberships are consumed by zero credentialing workflows** (they are reputation/academic evidence — keep the split explicit).
5. **No incumbent is deep in more than four knowledge domains, and none is deep in verification provenance, live licensure status, or credentialing-workflow awareness** — the three domains that define a Career Evidence Network. Doximity's depth is closed, ad-shaped, and uncorrectable at the source; AAMC's is a vault; journals know works, not people.
6. **The repo is half-ready.** `publicationFoundation.ts`, `VerificationClaimType.'publication_research'`, `EvidenceClass.'publication'`, and ORCID display UI already exist; missing are a publications `LaneType` + source-registry entries, KTG authorship nodes/boundaries, an `AUTHORED` relationship, Prisma persistence, and — a land mine — `curated.ts`/`InstitutionAutocomplete` live on branch `verify/1225`, not the mainline, with **zero mount points**.

---

# PART I — Where a clinician's published work lives, and how VitalCV connects it

## I.1 Platform verdict table

| Platform | Holds | API | Cost/License | Integration verdict |
|---|---|---|---|---|
| **ORCID** | Scholarly identity: works, employment, education, funding, **peer review**, per-item assertion source | Public REST v3.0 (`pub.orcid.org`), OAuth/OIDC; 12 req/s, 100k/day per client; annual public data file **CC0** | FREE | **OAUTH-CONNECT — the anchor** |
| **OpenAlex** | ~250M works, citation graph, author entities w/ h-index, `cited_by_count`, `counts_by_year` | `api.openalex.org` (`/authors/orcid:{id}`); free API key, $1/day free credits (Feb 2026 regime) — cache aggressively; full snapshot free | FREE, **CC0 — legally cacheable/redistributable** | **API-PULL — primary enrichment** |
| **PubMed / NCBI E-utilities** | ~37M biomedical citations, pub types, MeSH, `[auid]` ORCID search | esearch/efetch/esummary; free key = 10 req/s; full baseline bulk-downloadable | FREE (abstracts carry copyright; metadata clean) | **API-PULL — medical canon; PMID = first-class evidence id** |
| **Europe PMC** | Biomedical + preprints, ORCID-linked, `citedByCount` per hit | REST `AUTHORID:"{orcid}"`; ~10 req/s, no key | FREE | **API-PULL — best single ORCID→publications endpoint** |
| **Crossref** | DOI ground truth; authors w/ **`authenticated-orcid: true/false`**; `update-to` retraction pointers | `api.crossref.org/works/{doi}`; polite pool | FREE; metadata = facts, no copyright | **API-PULL — per-work ground truth + provenance flag** |
| **Retraction Watch (via Crossref)** | Retractions/EoC/corrections, human-curated, DOI-keyed | Free CSV + GitLab mirror + REST `update-to` | FREE | **MANDATORY INGEST — nightly sync (§I.4)** |
| **ClinicalTrials.gov v2** | PI/official/responsible-party roles; legal-act registrations | `api/v2/studies`, `AREA[ContactSearch]`; no auth | FREE, public domain | **API-PULL + confirm-to-claim** (name+affiliation match only — no ORCID/NPI in registry) |
| **NIH RePORTER** | NIH grants, PI names + durable `pi_profile_id`, grant→PMID links | POST `/v2/projects/search`; ≤1 req/s | FREE, gov data | **API-PULL + confirm-to-claim; store `pi_profile_id`** |
| **DataCite / Zenodo / Figshare** | Datasets, posters, software; ORCID-linked DOIs | Free REST APIs; DataCite metadata CC0 | FREE | **API-PULL via ORCID record / DataCite query** |
| **medRxiv / bioRxiv** | Clinical preprints + published-version links | Date/DOI-oriented API (no author search) | FREE | Indirect via Europe PMC/OpenAlex; label "preprint, not peer-reviewed" |
| **DOAJ** | OA-journal legitimacy check | v4 API; journal metadata CC BY-SA, article CC0 | FREE | API-PULL as journal-quality lookup |
| **Semantic Scholar** | 214M papers, author h-index | Graph API, free key ~1 req/s; ODC-BY (attribution required) | FREE w/ credit line | API-PULL — corroborating cross-check |
| **WoS ResearcherID / ex-Publons** | Verified peer review, times-cited | Starter free tier: 50/day, **no cited counts** | PAID beyond trivial tier | **Link-only.** Read peer-review evidence through ORCID instead |
| **Scopus Author ID** | Citation profiles | Institutional token required; non-commercial license | PAID/AVOID | Link-only external identifier |
| **Google Scholar** | The profile clinicians look at | **No API exists; ToS forbid automation; scrapers are paid + ToS-hostile** | N/A | **Link-only, labeled self-reported. Never ingest** |
| **ResearchGate / Academia.edu** | Self-uploads, invented metrics | None; extraction ToS-forbidden | N/A | Link-only, low priority |
| **SSRN** | Working papers (health econ/policy) | No public API; DOIs (`10.2139/ssrn.*`) reachable via Crossref | N/A | Link-only |
| **Dimensions / The Lens / Scite** | Linked-graph aggregators / smart citations | Free tiers are non-commercial-only | PAID/AVOID for commercial use | Avoid (Scite: optional free per-DOI badge embed only) |

## I.2 The canonical $0 pipeline: identifier → publication list with citation counts

```
0  Identity anchor  "Connect ORCID" → OAuth (openid) → authenticated iD stored.
                    (No ORCID? → step 2b candidate flow; push creation — it upgrades every assertion.)
1  ORCID record     GET /v3.0/{id}/works|employments|fundings|peer-reviews.
                    Capture per-item source + assertion-origin → provenance class (§I.3).
2a Expand           Europe PMC AUTHORID:"{orcid}" (+citedByCount) · OpenAlex authors/orcid:{id}
                    (h-index, works, cited_by_count — CC0, cache it) · PubMed "[auid]" (pub types, MeSH).
                    Union on DOI/PMID. Keep per-source citation counts side by side — label
                    "Citations (OpenAlex), as of {date}"; NEVER average sources (projection-vs-measurement).
2b No-ORCID path    OpenAlex author search by name + NPI-derived affiliation → candidate clusters →
                    clinician confirms each. Confirmation = self-assertion layered on algorithmic match.
                    NEVER auto-attach (OpenAlex author precision ≈92% — 1 in 12 wrong).
3  Ground truth     Crossref /works/{doi}: publisher metadata, license, authenticated-orcid flag, update-to.
4  Integrity gate   Nightly Retraction Watch DOI join. Retracted work renders with prominent
                    retraction state — never silently dropped. (No competitor does this.)
5  Beyond papers    ClinicalTrials.gov (confirm-to-claim) · NIH RePORTER (confirm-to-claim, pi_profile_id)
                    · DataCite datasets/posters via ORCID.
6  Refresh          Scheduled ORCID re-pull · weekly OpenAlex/Europe PMC deltas · nightly Retraction Watch.
                    All within free rate limits at pilot scale.
```

Engineering constraints: ORCID 100k reads/day/client · OpenAlex $1/day free credits (a per-clinician sync touches the API once, never per page view — the CC0 license makes local caching the design, not an optimization) · RePORTER 1 req/s.

## I.3 The assertion-provenance ladder (the truth-contract mapping)

| Tier | Class | Captured evidence | Asserted by |
|---|---|---|---|
| **P1** | Publisher-authenticated authorship | Crossref `authenticated-orcid: true` for this author AND that ORCID OAuth-connected to this account | Publisher (at submission) + ORCID + account binding |
| **P2** | Trusted-org assertion on ORCID | ORCID work `source` = member org (Crossref auto-update, DataCite, institution), no user assertion-origin | ORCID member organization |
| **P3** | Registry role, user-confirmed | ClinicalTrials.gov official/PI field or RePORTER record, matched then affirmed in-product | Government registry + user confirmation |
| **P4** | Self-asserted via wizard | ORCID work with `assertion-origin` = researcher (Search & Link) — real DOI, user-claimed authorship | User through a member tool |
| **P5** | Self-asserted, manual | Hand-entered (ORCID or VitalCV); DOI resolvable | User only |
| **P6** | Algorithmic attribution | OpenAlex/Semantic Scholar cluster match only | Machine — **candidate state only, never displayed as verified, never auto-promotes** |

Per-evidence-row fields: `{source_system, source_record_id (DOI/PMID/NCT/appl_id), assertion_source, assertion_origin, authenticated_orcid_flag, retrieved_at, retraction_status, citation_count + counting_source + as_of_date, license_of_metadata}`.

Doctrine notes: absence of P1/P2 is **not** evidence against authorship (ORCID trust markers are legitimately absent on Search-&-Link works); an empty Europe PMC result for a connected ORCID is displayable truth ("not-found is a finding"); PubMed `[auid]` undercounts (publisher-deposit dependent) — never present it as "all publications"; copy uses "Publisher-linked via ORCID" / "Self-reported" style labels, never bare "Verified".

## I.4 Non-paper career evidence (free, and stronger than most CVs)

- **Peer review**: ORCID peer-review section entries **can only be written by trusted orgs via member API** — inherently third-party-attested. Read via public API.
- **Grants**: NIH RePORTER — an R01 cannot be self-claimed; organizational assertion.
- **Trials**: FDAAA-mandated registrations; investigator roles are regulatory filings.
- **Guidelines**: PubMed publication-type `Practice Guideline` — it's a publication record.
- **Editorial boards / committee roles**: mastheads + society pages — URL-capture lane, weak; self-attest + evidence.
- **Datasets/posters/software**: DataCite DOIs, ORCID-validated when deposited with linkage.

---

# PART II — The preset medical knowledge domains

## D1. Specialty taxonomy & the training-path DAG

**Counts of record:** ABMS = **24 member boards, 38 specialty certificates, 89 subspecialty areas** (many co-sponsored — model each co-sponsored certificate as ONE node with multiple `issued_by` edges, admin board flagged). AOA/BOS = **15 boards, 24 primary, 48 subspecialty** (page enumeration is canonical; count discrepancy flagged). ACGME = ~28 core specialties + splits (Child Neurology, 3 Preventive-Medicine specialties, 4 Radiology entries) + Transitional Year + institution-based fellowships.

**Source artifacts (all free, all versioned — pin versions):**
- ABMS Guide to Medical Specialties 2026 (PDF, parses cleanly): https://www.abms.org/wp-content/uploads/2025/12/20261212_GuideMedicalSpecialties_WEB_V3.pdf
- **ABMS Requirements for Initial Certification — Subspecialty (2025-06)** — the official subspecialty→prerequisite→training-length table, i.e. the path-graph backbone: https://www.abms.org/wp-content/uploads/2025/06/Requirements-for-Initial-Certification-Subspecialty_V2_20250613.pdf
- ACGME Specialty/Subspecialty Block Diagram Table: https://www.acgme.org/globalassets/pdfs/specialtieslist.pdf
- NUCC taxonomy CSV (~870 codes, 3-level, 2×/yr releases; free but commercial embedding needs their free license form): https://www.nucc.org/index.php/code-sets-mainmenu-41/provider-taxonomy-mainmenu-40
- CMS Medicare↔Taxonomy Crosswalk (CSV **and** JSON API): https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/medicare-provider-and-supplier-taxonomy-crosswalk
- AOA specialties: https://certification.osteopathic.org/specialties-and-subspecialties/

**Structural modeling rules (each is a place incumbents' ontologies break):**
1. Training ≠ certification: ACGME accredits fellowships with **no ABMS certificate** (interventional pulmonology → AABIP; transplant nephrology → none; 6 of 8 ortho fellowships; oculoplastics → ASOPRS…), and ABMS issues certificates with **no dedicated program type** (HPM/Sports/Sleep/Pain fellows train in multi-board-accredited programs, certify through their parent board).
2. The **non-ACGME fellowship universe** is real career evidence: CAST (neurosurgery), Fellowship Council (MIS/HPB), ASTS (transplant), SSO (breast surg-onc), SF Match ophthalmology, UCNS (~9 neurology subspecialties incl. Headache Medicine), ABOM (obesity, cross-specialty), ABLM. Model as `training_only` / `alt_certified_by` edges.
3. Multi-board certificates (Sports, HPM, Pain, Sleep, CCM, Neurocritical, Addiction Med [ABPM, open to ANY diplomate], Clinical Informatics, Med Tox, EMS, HALM, Brain Injury, Hand, Dermatopathology, Urogynecology…) = one certificate node, many issuing-board edges.
4. Combined residencies (Med-Peds 4yr, EM-IM 5, triple board 5, IM-Derm 5, FM-ONMM 4, Anes-EM…) → graduates board-eligible for **both** parents.
5. Post-2020 single accreditation: ACGME is the sole GME accreditor; "Osteopathic Recognition" is a program **attribute**; ONMM is the one ACGME specialty that exists because of the merger; DOs may certify AOA, ABMS, or both.
6. **NUCC↔ABMS crosswalk does not exist as a file anywhere.** NUCC includes non-certificate concepts (Hospitalist `208M00000X`, ONMM, AOA-only areas) and lags new ABMS certs. Hand-curate: each NUCC physician code → {ABMS cert | AOA cert | no-cert practice focus}. **This curation is a moat.**

**The path DAG** (full tables in the taxonomy research pass; summarized): entry residencies with years/entry-type/boards (FM 3, IM 3, Peds 3, EM 3–4, Psych 4, Neuro 4, OB/GYN 4, Anes 4, Derm 1+3, Ophtho 4 integrated, ENT 5, Ortho 5, Uro 5, NSGY 7, GS 5, Vascular 0+5, Thoracic I-6, Plastics 6 integrated, DR 1+4, RadOnc 1+4, Path 4, PM&R 4, MGG special, PrevMed 3, ONMM, A&I as dual-parent fellowship-specialty)… then per-parent fellowship trees with official lengths (IM tree of 21 subs incl. second-order: Interventional Cards ← CV Disease ← IM; Peds tree of 20; Surgery, Anesthesiology, Psych/Neuro, Radiology, OB/GYN, Ortho, ENT, Derm, Path, PM&R, FM trees). New/emerging certs flagged (Adult Cardiac Anes, HALM, Micrographic Derm Surgery, Complex Peds Oto, Complex Family Planning, Peds Hospital Medicine, Neurocritical Care, Urogynecology).

**Free board-cert verification map:** FSMB **DocInfo** (docinfo.org) = free per-physician profile incl. **both ABMS and AOA** certification — best single free corroboration source. Per-board free public lookups verified: ABIM, ABFM (credentialer access), ABS, ABOG, ABD, ABPN, ABP, ABA, ABR, ABEM, ABOS, ABOHNS, ABPath, ABPMR, ABPS, ABNS (+ smaller boards request-based), plus non-ABMS ABPS (abpsus.org) and ABOM. All per-lookup scrapes — same cadence-table treatment as SOURCE_REGISTRY. **Certification Matters is free but patient-use-only by its own terms — hint source, never PSV.** ABMS Solutions products = PAID/AVOID.

## D2. Roles, titles, degrees, and post-nominal suffixes

**Core principle: "Jane Q. Smith, MD, MPH, FACC" is a render, never a stored string.** Structured store → deterministic suffix projection.

- **`credential_def` vocabulary table:** `token` (NOT unique) + `issuer_id` + `kind` (degree | license | state_designation | national_certification | board_certification | fellowship_honor | registry_credential) + `profession_scope[]` + `field` + `rank_within_kind` + `verifiability` (public_registry | roster | on_request | paid_psv | none) + `verify_url` + `status` (active | legacy | retired) + `renamed_to` (RN-BC→MEDSURG-BC, MT→MLS) + `render_template` (ASCP `MLS(ASCP)ᶜᴹ`, ARRT `R.T.(R)(CT)(ARRT)`). **`UNIQUE (token, issuer)` — the collision fix.**
- **Collision registry (seed):** FAAN (Acad. of Nursing vs Acad. of Neurology) · FCCP (CHEST vs Clinical Pharmacy) · FAAO (Optometry vs Osteopathy) · FAPA (Psychiatric vs Psychological) · PA vs PA(ASCP) · CMA (medical assistant vs medication aide) · MAC (NBCC vs NAADAC) · CPS/CCS · NRP (NREMT Paramedic vs a **course** — blocklist) · LSW/LISW/LMSW tiers keyed by (token, **state**) · org acronyms ACR/AANA/ABPS/AOA/BOC/NHA — issuers are entities, never matched by acronym.
- **Per-profession ordering profiles (the LinkedIn-killer):** nursing = ANCC standard (highest degree → licensure → state designations → national certs → honors; rationale = permanence — encode the rationale as the sort key); physicians = doctorate → other degrees → fellowship honorifics, board certs & licenses **never** rendered as suffixes; PT = license first (`PT, DPT, OCS`); ARRT and ASCP have mandated formats. Default = ANCC-style.
- **Closed lists (encode as fixtures, re-check annually):** APRN roles (4: NP/CNS/CRNA/CNM), NP population foci (8), NREMT levels (4), ARRT disciplines (14 marks), NBRC, BPS (14–16), ABPTS (10), ABMS boards (24), ASCP catalog, ABPP (17+2), dental specialties (12, NCRDSCB). **Open lists** (nursing certs ~180+ via ABSNC registry, honorifics in the hundreds, master's degrees, 50-state license-title matrices for SW/counseling/addiction/APRN designators) ship as curated core + **fail-closed queue: no free-texted suffix ever renders** — unknown token → "request a credential" → curator adds def with issuer + verifiability → then it renders.
- **Issuer-identity subtleties that make VitalCV smarter:** FNP-C (AANPCB) vs FNP-BC (ANCC) — same role, different certifier; store the issuer, render what the issuer awarded, never normalize. GME "Fellow" (a position) ≠ fellowship honorific FACC (an honor) — separate entity types. MBBS renders as earned, never silently converted to "MD". X-waivers abolished 2023 — never model as current.
- **Titles are appointments, never suffixes:** faculty ladder (+ clinical/tenure/adjunct track modifiers), GME ladder (PGY-N as integer + program; Chief Resident), practice-model titles (hospitalist, nocturnist, locums), admin roles (CMO, chair, division chief, PD, DIO, PI) — time-bound, org-scoped records.
- **Free verification surfaces for lanes:** NPPES, Nursys, NREMT, ARRT, ASHA, NBCOT, CDR, BACB, ABGC, NCCPA (**real-time public PA-C PSV** — portal.nccpa.net/verifypac), docinfo.org, ACS Find-a-Surgeon, AAN(nursing) fellow directory, state boards. PAID flagged: ABMS Solutions, AMA Masterfile/Profiles, DEA/NTIS file, CAQH.

## D3. Associations, societies, academies

**Universe: ~600–800 organizations, 9 tiers** — T0 national cross-specialty (~10) · T1 CMSS (**57 now, not ~40 — the shipped curated dataset is stale; delta list captured**: AAHPM, AACE, ACMG, ACOEM, AES, AMIA, ASAM, Breast Surgeons, ASE, NASPGHAN, NASS, OMA, PALTmed, SGO, SIR, SSO, SGIM) · T2 non-CMSS specialty/subspecialty (~120–250; cardiology alone: ACC, AHA, HRS, SCAI, HFSA, ASE, ASNC, SCMR, SCCT) · T3 state medical societies (54; MedChi, MSSNY, TMA, CMA, MMS→owns NEJM…; + ~50 osteopathic state) · T4 county (~1,900 — catalog-on-demand, do NOT prepopulate) · T5 international (~20: WMA, ESC, ESMO, Royal Colleges) · T6 nursing/PA/pharmacy/osteopathic (~80; ANA + 50 state + ~30 affiliates, AAPA, APhA/ASHP) · T7 students/residents · T8 honor societies (AΩA, GHHS, Sigma Theta Tau…). Best enumeration source: **AMA Federation Directory** (free): https://federationdirectory.ama-assn.org/. Key on slug, never acronym.

**Membership-tier ladders are the evidence signal** (election is peer-reviewed): ACP Member→FACP→MACP · ACS→FACS · ACC→FACC→MACC · AAN→FAAN · AGA→AGAF · CHEST→FCCP · SCCM→FCCM · AANP→FAANP · full ladder table captured per society.

**Verification landscape — headline: NO aggregator exists, anywhere.** Zero societies expose a verification API. Four lanes (typed per society):
1. `self_attested` — preset-directory selection; never labeled "Verified".
2. `evidence_attached` — dues receipt / card upload / society-domain email loop.
3. `directory_observed` — public-directory listing URL + retrieval date (ACS Find-a-Surgeon, AAD Find-a-Derm, AΩA member search; AOA Find-a-DO gets a *disclaimed* variant — its own terms deny PSV status).
4. `society_confirmed` — future wave: per-society confirmation, or ORCID "Membership and Service" entries written by the society as trusted org (the only open-standard signal; adoption thin today).

## D4. Journals

**The free stack fully replaces paid catalogs:**
1. **NLM J_Medline.txt** — ~30k journals (title, MedAbbr, ISO abbrev, ISSN print+online, NLM ID), updated daily, US-gov data: https://ftp.ncbi.nih.gov/pubmed/J_Medline.txt → canonical journal table + refresh job.
2. **NLM Broad Subject Terms** (~120 MeSH specialty labels per MEDLINE journal): https://journal-reports.nlm.nih.gov/broad-subjects/ → journal→specialty crosswalk (≈1:1 onto the specialty enum; ~120 rows).
3. **OpenAlex sources** (CC0): publisher, OA status, is_in_doaj, works_count, h-index, `2yr_mean_citedness` → join by ISSN.
4. **DOAJ** for OA verification (journal metadata CC BY-SA — attribution/share-alike on that slice); **Crossref** as publisher-of-record tie-breaker.

**Hard licensing flags:** Clarivate **Impact Factor: paid/licensed — never store, display, or approximate; never the phrase "Impact Factor"**. Scimago SJR: free download but **non-commercial-only — likely unusable**. Scopus source list: proprietary — avoid embedding. Honest prestige presentation (truth-contract-clean): "MEDLINE-indexed since …" · "OpenAlex h-index: N" · "2-yr mean citedness: N (OpenAlex, retrieved {date})". No composite prestige score — that would be fabrication.

**Society→journal ownership table (~45 rows, shipped in the societies research pass):** MMS→NEJM/NEJM Group · AMA→JAMA + 11-journal network · ACP→Annals · ACC→JACC family · AHA→Circulation family · ASCO→JCO family · ASH→Blood · AAN→Neurology · ACOG→Green Journal · AUA→J Urol · ACS→JACS · RSNA→Radiology · ATS→Blue Journal · IDSA→CID/JID · AGA→Gastroenterology · ASN→JASN … (rel = owns vs official; JBJS is independent of AAOS; Radiology≠ACR — it's RSNA). Scale-out via Wikidata P123/P127 (CC0) as candidate edges, human-confirmed.

## D5. Schools, programs, employers (building on prior research)

Already established (2026-07-14 pass + #652/#653): **CMS Doctors & Clinicians National Downloadable File** = the goldmine (~2.5M rows; NPI→med school+grad year, NPI→specialty, NPI→group/employer, NPI→hospital CCN — four edge types out of the box; `Med_sch` doubles as a name-normalization enum) · NPPES Type-2 (~1.7–2M orgs, public domain, monthly) · CMS Hospital General Info (~5,400, CCN-keyed) · LCME/AAMC (~157 MD) + AACOM (~46 DO) schools = curate · ACGME ADS ~13k programs (terms-of-use caveat: curation seed, verify redistribution) · NUCC CSV · PECOS reassignment = works-for edges · NBER NPI↔CCN crosswalk. **Standing gap:** no free clinician→residency-ATTENDED dataset exists (ACGME publishes programs, not rosters) — the residency-attended edge is self-attested/CV-parsed by design; the training-cohort graph derives from CMS grad-year + affiliation history + the program registry, with correctable provenance-carrying edges (Doximity's alumni stats are member-profile-derived and, per JGME, uncorrectable at the source — the wedge).

**Repo land mine:** `apps/web/lib/institutions/curated.ts` (211 entries: 88 MD + 23 DO schools, 40 boards, 40 societies, 9 assns, 8 accreditors, 3 honor societies) and `InstitutionAutocomplete.tsx` are committed on branch **`verify/1225`**, NOT the mainline — and the autocomplete has **zero mount points**. Land that branch (or cherry-pick) before extending; the international-schools layer (World Directory of Medical Schools/ECFMG) remains uncurated.

## D6. Credentialing requirements & workflows (the preset workflow knowledge)

**Six workflows encoded:** initial hospital appointment+privileging (45–120+ days; app → PSV → chair → credentials cmte → MEC → governing board → FPPE; temp privileges ≤120 days) · payer enrollment (90–120 days; CAQH-referenced; PECOS ~45–65 days; delegated credentialing = the high-leverage structure) · recredentialing (NCQA 36-mo + 2025's monthly license/exclusion monitoring + 120/90-day PSV windows; TJC 3-yr reappointment **but** HCQIA 2-yr NPDB query — two clocks; CA caps at 2yr) · locums/multi-state · telehealth credentialing-by-proxy (42 CFR 482.22(a)(3)–(4)) · IMLC (44 states + DC + GU; LOQ valid 365 days; $700 + state fees; eligibility computable from profile data) / FCVS ($395) · IMG/ECFMG (diploma PSV'd at the school; 12–24 months; sole J-1 sponsor).

**Element → PSV source → free/paid (the centerpiece — full table in the credentialing research pass):**

| Element | PSV? | Free path | Paid chokepoint |
|---|---|---|---|
| State license | Always | State-board lookups (VitalCV's 70-authority registry IS this layer) | — |
| Discipline history (all-state) | Yes | — | FSMB PDC $9–12 (dormant) |
| DEA | If prescribing | Certificate copy + expiry tracking (weaker) | NTIS file (dormant) |
| Education/training | Highest level | **Transitively discharged by board-cert verification (NCQA hierarchy) — the single biggest shortcut in the PSV graph**; registrar letters free-manual | AMA Profile, ECFMG CVS $70 |
| Board certification | If claimed | Individual boards' free lookups (§D1) + DocInfo corroboration | ABMS aggregation |
| Malpractice history | Yes | **NPDB self-query $3 — the only clinician-owned motion; model as clinician-held evidence, issuer=NPDB** | NPDB org query (access-restricted) |
| Exclusions (OIG/SAM/state) | Monthly | **Fully free** (LEIE CSV, SAM API) — absence-of-finding semantics = "not found as of DATE" | — |
| Work history 5yr | NOT PSV — documented review | Gap rules: ≥6-mo gaps explained, ≥12-mo written — **computable completeness contract** | — |
| Affiliations / insurance / references / health | Letters, COI, attestations — free-manual | — | — |
| Nurse licensure | Yes | Nursys — free, primary-source-equivalent | — |
| **Publications / society memberships** | **Consumed by NO credentialing workflow** (DNV explicitly bars privileges based solely on membership) | Reputation + academic-appointment evidence only — keep visually separate from the credentialing spine | — |

**The knowledge no incumbent models (ownable):** PSV chains as first-class objects · the clock lattice with cascade prediction (expired license silently invalidates DEA → privileges → payer participation) · transitive-discharge rules · gap rules as computable contracts · free-vs-paid source topology · uncollapsed attestation provenance (CAQH collapses self-asserted/attested/PSV'd into one global 120-day clock) · **packet-readiness as a function**: given target workflow (hospital X privileging vs payer Y vs IMLC), compute which evidence exists at sufficient grade+freshness and what's missing.

Pain numbers for positioning (attribute — industry estimates, never state as fact): 90–120-day payer credentialing; >$10k/day revenue lost per delay day (MGMA/Merritt Hawkins lineage); $100–300 + ~20 labor-hours per application; $2.76B/yr directory maintenance (CAQH).

## D7. Competitor knowledge depth — the target to beat

Capability-matrix finding: **no incumbent is deep in more than 4 of 14 knowledge domains; NONE is deep in verification provenance, live licensure status, or credentialing-workflow awareness.** Doximity: deepest (NPI-seeded stub profiles, hand-parsed CVs, Residency Navigator) but closed, >90% pharma-ad revenue, PubMed name-matching with silent errors, and program stats **uncorrectable at the source** (JGME-documented). LinkedIn: everything clinical is free text; CLEAR verification never touches licensure. NPINO: raw NPPES mirror; zero added knowledge; license numbers self-reported, never status-checked. Healthgrades: claims-derived volume percentiles but moderate board-cert accuracy (audited) and no provenance. AAMC: the deepest vault (ERAS, Faculty Roster, GME Track, Convey) — closed, pre-career, not a market threat. NEJM/JAMA: know works, not people; the identity layer is ORCID — join it, don't fight it. ResearchGate: the cautionary tale (scraped shadow profiles + wrong-author auto-attribution = the anti-pattern the receipt-candidate discipline exists to avoid).

**The 10 knowledge assets that beat all of them (each free-source-powered):** ① per-field provenance ledger ② live licensure-status layer (fail-closed) ③ open NUCC↔board↔path crosswalk ④ preset education/grad-year/affiliation from the CMS file ⑤ delta-aware NPPES spine (know *when* facts changed) ⑥ correctable training-cohort graph ⑦ disputable publication authorship (confidence shown, dispute rail) ⑧ living exclusion/sanction state ⑨ CMS Open Payments transparency (journals hold COI privately in Convey; no profile network shows it) ⑩ grants+trials depth on the verified identity spine. The moat is not the data — it's **crosswalk ontology + per-field provenance + dispute rails**.

---

# PART III — How everything connects (repo-mapped architecture)

## III.1 What already exists (verified this session)

- `apps/web/lib/research/publicationFoundation.ts` — `PublicationSourceKind` ('PubMed'|'ORCID'|'Crossref'|'OpenAlex'|'manual_entry'), `PublicationCandidateStatus` ladder, literal `verified: false`, disclaimers already rendered (incl. "Author / NPI / person disambiguation is required before any 'yours' claim").
- `VerificationClaimType` already includes `'publication_research'`; `packages/domain-evidence` `EvidenceClass` already includes `'publication'`, `'research'`, `'training'`, `'recognition'`.
- `apps/web/components/passport/ResearchPublicationsSection.tsx` renders ORCID iD/affiliations and `pub.doi` behind `disclosurePreferences.showOrcid`; `apps/web/app/clinician/graph/page.tsx` already has `publication-claim` + `source-pubmed` nodes with an 'imported from (candidate)' edge — the precedent.
- Provenance vocabulary of record: `ProfileProvenance = 'VERIFIED'|'USER_ENTERED'|'INFERRED'|'UNKNOWN'|'CONFLICT'` (`apps/web/lib/profile/provenance.ts`); backend `VcvVerificationLevel { SELF_REPORTED, SOURCE_MATCHED, SOURCE_VERIFIED, CRYPTOGRAPHICALLY_SIGNED, BIOMETRICALLY_CONFIRMED }`; KTG boundary #9 hierarchy.
- Backend `Institution.rorId @unique` — the natural join key to ORCID/Crossref affiliations. `VcvEducationRecord.recordType` discriminator + `acgmeCode` field — the training-path attach points.

## III.2 The gaps (build list)

1. **SOURCE_REGISTRY** (`packages/source-adapters/src/types.ts`): `LaneType` has no publications value. Add `'publication'` (and later `'membership'`, `'certification'`) + entries: `ORCID` (oauth), `PUBMED`, `EUROPE_PMC`, `OPENALEX`, `CROSSREF`, `RETRACTION_WATCH` (cadence 24h), `CLINICALTRIALS_GOV`, `NIH_REPORTER` — all `decisionGradeEligible: false`, `requiredForDecisionGrade: false` (publications are never decision-grade; they are career evidence, not credentials — §D6).
2. **Prisma** (`apps/api/backend`): no `Publication`/`Membership`/`Specialty`/`CredentialDef` models. Add `VcvCredentialDomain` members (`RESEARCH_PUBLICATION`, `SOCIETY_MEMBERSHIP`) — **CI runs `db push` but prod runs `migrate deploy`: ship the migration file, not just the schema** (known landmine). Add `AUTHORED`, `MEMBER_OF`, `PUBLISHED_IN` to `VcvRelationshipType` (17 today, no authorship verb).
3. **Knowledge Trust Graph** (`docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` — now at **60 numbered boundaries**, not 28; CLAUDE.md is stale): add nodes (Scholarly Identity/ORCID Record, Publication Work, Authorship Claim, Journal, Society, Membership Claim, Specialty Certificate, Certifying Board, Training Program Type, Credential Definition) and append-numbered boundaries (61+), candidates:
   - *Authorship Provenance Boundary* — an authorship claim carries its assertion tier (P1–P6); P6 never auto-promotes.
   - *Citation Metric Attribution Boundary* — counts always carry counting-source + as-of date; sources never merged.
   - *Retraction Display Boundary* — retraction state renders; retracted works are never silently dropped.
   - *Membership Lane Boundary* — membership claims name their lane (self_attested/evidence_attached/directory_observed/society_confirmed).
   - *Reputation/Credential Separation Boundary* — publications and memberships never enter decision-grade or packet-readiness computations.
   - *Suffix Vocabulary Boundary* — no free-texted post-nominal renders; unknown tokens go to the curation queue.
4. **Persistence + UI**: `ClinicianPublicationEntry` gains `doi`, `orcidWorkId`, provenance tier, retraction status; profile autocomplete mount points (medical school / residency / fellowship / affiliations fields) — blocked on landing `verify/1225` and on profile persistence (autocomplete currently fills locally only).
5. **Knowledge fixtures as data**: specialty ontology (D1), credential_def vocabulary + collision registry + ordering profiles (D2), society directory + tiers + verification lanes (D3), journal table + BST crosswalk + society→journal edges (D4), workflow/clock/PSV knowledge tables (D6).

## III.3 Provenance unification

Map the publications ladder onto existing vocabularies rather than minting another enum: P1/P2 → at most `SOURCE_VERIFIED`-class display (never bare "Verified"; copy: "Publisher-linked via ORCID") · P3 → registry-confirmed + user affirmation recorded as layered assertion · P4/P5 → `USER_ENTERED`/`SELF_REPORTED` · P6 → candidate-only, maps to `INFERRED`, excluded from any readiness/packet computation. Note three parallel proofTier vocabularies already exist (issuer-verification literals; `ReadinessSnapshot.proofTier`; `KnowledgeInboxProofTier`) — do not add a fourth; publications reuse the knowledge-inbox ladder (`claim_candidate` → `source_backed`) whose semantics already fit.

---

# PART IV — Execution roadmap (proposed waves)

| Wave | Scope | Effort |
|---|---|---|
| **K0 — Land the base** | Merge/cherry-pick `verify/1225` (curated.ts + autocomplete); mount autocomplete on the 4 profile fields; fix CMSS 40→57 delta | days |
| **K1 — Specialty ontology** | NUCC CSV ingest + ABMS/AOA/ACGME certificate & program-type fixtures from the three pinned PDFs + path-DAG edges + hand-curated NUCC↔cert crosswalk | ~1–2 wks (crosswalk is the long pole) |
| **K2 — Credential vocabulary** | `credential_def` fixtures (closed lists first), collision registry, per-profession ordering profiles, render pipeline, fail-closed suffix queue | ~1 wk core |
| **K3 — Societies + journals** | Tiered society directory (T0–T3, T5–T8; T4 on-demand), verification-lane typing, J_Medline ingest + BST crosswalk + OpenAlex join + society→journal table | ~10–14 days (per societies-pass estimate) |
| **K4 — Publications spine** | ORCID OAuth connect; pull+classify pipeline (§I.2 steps 0–4); provenance ladder; Retraction Watch nightly sync; SOURCE_REGISTRY lane + entries; Prisma models + migration | ~2 wks |
| **K5 — Beyond papers** | Trials + grants confirm-to-claim; DataCite datasets; peer-review via ORCID | ~1 wk |
| **K6 — Workflow knowledge** | Clock lattice, PSV-chain tables, transitive-discharge rules, gap rules, packet-readiness function | ~1–2 wks |
| **K7 — Graph + display** | KTG nodes/boundaries (61+), career-graph node kinds, profile publications section with provenance labels + dispute rail | ~1 wk |

Standing rules carried through every wave: no paid data sources (dormant flags only) · no bare "Verified" · not-found-is-a-finding · citation counts attributed and dated · no Impact Factor/SJR · publications/memberships never in decision-grade computations · fail-closed on ambiguity.

---

## Appendix — licensing/cost flag summary

**FREE + redistribution-safe:** ORCID (CC0 data file), OpenAlex (CC0), Crossref (facts), Retraction Watch (via Crossref), PubMed/Europe PMC metadata, ClinicalTrials.gov, NIH RePORTER, DataCite (CC0), NUCC CSV (free license form for commercial embed), CMS crosswalk + Doctors&Clinicians + NPPES + Hospital Info (public domain), NLM J_Medline + Broad Subject Terms, DOAJ (BY-SA on journal slice), ABMS/ACGME/AOA taxonomy PDFs (facts; parse + curate), AMA Federation Directory (enumeration), free board lookups + DocInfo + Nursys + NCCPA verify.
**FREE but restricted:** Certification Matters (patient-use only — hint, never PSV) · AOA Find-a-DO (self-disclaimed PSV) · ACGME ADS (ToS caveat — seed only) · Semantic Scholar (ODC-BY attribution) · Wikidata (CC0, candidate edges only).
**PAID/AVOID (catalogue dormant):** ABMS Solutions/CertiFACTS · AMA Masterfile/Profiles · FSMB PDC · NPDB org query (but self-query $3 = clinician-owned) · DEA/NTIS · CAQH · ECFMG CVS · Scopus/Elsevier APIs · WoS/Clarivate (incl. JIF) · Scimago SJR (non-commercial clause) · Dimensions · The Lens · Scite · Google Scholar scrapers (ToS-hostile) · AHA survey · FREIDA bulk.
