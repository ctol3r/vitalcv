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

*Last updated: 2026-03-15 | Wave M: Market Intelligence Assimilation*
