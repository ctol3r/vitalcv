# VitalCV — Product Positioning & Category Definition
*Internal product law. Not marketing copy. Every product decision should be testable against this document.*

---

## Category Statement

**VitalCV is Provider Identity Graph infrastructure.**

Not a credentialing platform. Not a workflow tool. Not a compliance dashboard.

A **Provider Identity Graph** is the continuously maintained, multi-source, evidence-backed digital representation of who a clinician is — their identity, licensure, sanctions history, enrollment status, certifications, publications, and institutional affiliations — resolved across every authoritative government and institutional source, with claim-level provenance and trust scoring.

VitalCV makes this graph queryable, embeddable, and actionable — for hospitals, health systems, staffing firms, payers, and any system that needs to make trust decisions about providers.

---

## One-Line Positioning

> **VitalCV computes provider trust from the ground up — not workflows, identity graphs.**

---

## Positioning Stack

| Layer | Statement |
|---|---|
| **What we are** | Provider Identity Graph — continuously computed, multi-source, explainable |
| **What we are not** | Credentialing workflow automation |
| **Primary output** | Trust Score (0–100, L0–L3 band) with dimensional breakdown and provenance |
| **Primary moat** | Cross-source divergence detection + claim-level receipts + verification freshness |
| **Primary customer** | Any operator who needs to make trust decisions about providers at scale |
| **Secondary customers** | AMCs and research institutions (academic identity layer) |

---

## Competitive Classification

These are not direct competitors. They are players in adjacent categories.

| Company | What they actually are | Why we're different |
|---|---|---|
| **Verisys** | Compliance data / sanctions monitoring | Single-source lookups. No identity graph, no trust scoring, no divergence detection. |
| **symplr** | Legacy healthcare operations suite | Workflow-first. Credentialing as process management. No computed trust. |
| **Medallion** | AI credentialing workflow automation | Automates the process of collecting and verifying documents. Not the underlying truth layer. |
| **Verifiable** | Autonomous credentialing agent | Credential collection and routing. No trust score, no freshness model, no provenance. |
| **CAQH** | Provider-attested data utility | Providers self-report. Unverified attestation. No cross-source corroboration. |
| **CertifyOS** | Provider data infrastructure | Closer to what we are. Key difference: VitalCV is evidence-backed with claim provenance vs data pipes. |
| **Definitive Healthcare / H1** | Commercial/research intelligence | Market intelligence, not trust infrastructure. Different buyer, different use case. |
| **Doximity** | Clinician-facing identity network | Provider-controlled identity. No authority chain. No sanctions/enrollment integration. |
| **Kyruus** | Provider directory / care access | Consumer-facing directory. Not credentialing, not trust. |

**Non-compete rule:** Do not add features to compete with workflow automation (document collection, form routing, committee management). That is not the category we are building. Make those tools smarter by being their trust layer.

---

## What VitalCV Owns That No Competitor Does Well

1. **Composite Trust Scoring** — 0–100 score across 8 weighted dimensions, versioned, explainable, audit-trailable
2. **Verification Freshness** — Per-claim-class decay model. Know not just that something was verified, but when, and how much that matters now.
3. **Cross-Source Divergence Detection** — Surface contradictions that no single source can reveal. Seven rules. Three severity tiers. Score penalties.
4. **Source Coverage Transparency** — Every provider profile shows which sources were checked, gated, stale, or missing, and the confidence impact of each gap.
5. **Claim-Level Receipts + Provenance** — Every fact traces to: source artifact → timestamp → checksum → parser version → confidence. Not just "verified." Verified by what, when, how.
6. **Academic / Research Identity Integration** — OpenAlex, PubMed, ClinicalTrials, ORCID (reserved). Creates moat for AMCs and research-active organizations who need to verify investigator credentials and publication track records.

---

## Product Surface Implications

### What goes on every clinician profile
- Trust Score (number + band + explanation)
- Freshness status per claim class
- Source coverage (checked / gated / stale)
- Active divergence flags (if any)

### What goes in the API (Trust Intelligence layer)
- `GET /api/trust/score/:npi` — Full Trust Score V1 with dimension breakdown
- `GET /api/trust/freshness/:npi` — Per-claim-class freshness report
- `GET /api/trust/divergence/:npi` — Cross-source conflict detection
- `GET /api/trust/methodology` — Public methodology documentation (transparency)
- `GET /api/identity/:npi/coverage` — Source coverage with confidence impact

### What the graph shows
- Clinician identity graph (knowledge layer + trust layer, blended)
- Divergence conflicts as edge anomalies
- Source nodes connected to claims they contributed
- Trust band visualized on clinician nodes

---

## What We Are Building Toward

The Trust Score is the first primitive. What it enables:
1. **Trust as an API** — Any workflow tool, ATS, or credentialing platform can query VitalCV for a trust score instead of building their own verification logic
2. **Trust as a Badge** — Passport embed, SVG badge, JSON-LD card that travels with the provider
3. **Trust as a Marketplace Signal** — Match opportunities to providers based on trust band + credential readiness, not just specialty + location
4. **Trust as a Moat** — Historical trust records, divergence history, and source coverage breadth compound over time into a dataset no one else has

---

## Internal Product Laws

1. **No fake controls.** Every UI element maps to real data or is explicitly labeled as coming soon.
2. **No unverified claims presented as verified.** Bronze tier data is always marked as Bronze.
3. **Provenance is non-negotiable.** Every claim must trace to a source artifact. No claim without a receipt.
4. **Freshness is a dimension, not a timestamp.** Displaying when something was verified is not enough — display what it means for trust right now.
5. **Divergences are features, not bugs.** When sources disagree, surface that. It is the most valuable signal we have.
6. **Methodology must be transparent.** Publish the scoring weights, band thresholds, and freshness windows. Trust requires explainability.

---

---

## Technical Differentiators vs. Medallion / Symplr / CAQH / Verisys

**We are an evidence-first trust layer, not a workflow automation tool.**

Workflow tools (Medallion, Symplr, CredentialStream) automate the process of collecting documents and routing them through committees. They do not compute trust. They do not detect divergences. They do not track freshness. They are process tools. We are the infrastructure that makes those process tools smarter.

### The 6 Things Nobody Else Has

1. **Composite Trust Score (0–100)**
   Every clinician gets a single number with a dimensional breakdown (identity, licensure, sanctions, enrollment, board cert, education, employment, references). Transparent methodology. Audit-trailable. No competitor computes this.

2. **Verification Freshness Decay Model**
   Every claim class has a decay curve. License status: 7-day window. Identity: 30-day. Sanctions: daily. Board cert: 90-day. PECOS: quarterly. A verification from 6 months ago is not the same as one from today. Our trust score reflects that in real time. Nobody else models this.

3. **Cross-Source Divergence Detection**
   Seven rules that surface contradictions across NPPES, OIG, state boards, PECOS, and other sources. Name mismatches, DOB conflicts, license discrepancies, specialty mismatches. Three severity tiers (HIGH/MEDIUM/LOW) with score penalties. Single-source lookup tools cannot detect these by definition.

4. **Claim-Level Receipts + Provenance**
   Every fact traces to: source artifact → timestamp → checksum → parser version → confidence. Not "we verified it." Verified by what source, when, how, with what parser, at what confidence level. The receipt is the proof.

5. **Source Coverage Transparency**
   Every provider profile shows what's checked, gated, stale, or missing — and the confidence impact of each gap. Sub-50% coverage = L0 Unknown. 90%+ = L3 Practice-Ready. We tell you what we don't know, not just what we do.

6. **Academic / Research Identity Integration**
   OpenAlex, PubMed, ClinicalTrials.gov, ORCID. No credentialing competitor integrates academic identity. AMCs and research institutions are underserved. This is a moat for research-active organizations.

### What This Means in Practice

| Scenario | Workflow Tool | VitalCV |
|---|---|---|
| "Is this clinician safe to hire?" | "Documents collected, committee approved" | "Trust score 83/100, L3, 6/7 sources fresh, no divergences, sanctions clear as of today" |
| "When was their license last checked?" | "Verified 3 months ago" | "License verified 4 days ago, within 7-day freshness window, 92% confidence" |
| "Do their records conflict?" | Not detectable | "MEDIUM divergence: NPPES lists specialty as Internal Medicine, state board lists Hospitalist. Score penalty: -15" |
| "What don't we know?" | Not surfaced | "State board: GATED (no API agreement). Impact: trust score capped at L1" |

---

*Last updated: 2026-04-03 | Pilot Zero Strategy Assimilation*
