# VitalCV — 30-Day PSV Readiness Pilot
## External Memo · April 2026

---

### The Problem We Solve

When a clinician signs an offer letter, their application typically enters a black box. For 10 to 40 days, it waits — often before anyone checks whether a state license is current, a federal exclusion is present, or a PECOS enrollment is missing. By the time the gap surfaces, the start date has already slipped.

The cost of that delay is not abstract. Every slipped start date represents lost placement revenue, burned coordinator hours, and a candidate who may accept a competing offer.

---

### What VitalCV Does

VitalCV generates a source-backed evidence packet on day zero — the moment an NPI is entered. We pull from publicly available, government-sourced registries to produce a deterministic proof pack that tells your team what is decision-grade, what is partial, and what still needs primary source verification before the file reaches your credentialing committee.

**Sources included in the pilot:**

| Source | What it confirms |
|---|---|
| NPPES (CMS NPI Registry) | NPI identity, specialty taxonomy, enumeration date |
| OIG LEIE | Federal exclusion posture against the latest available source release |
| PECOS | Public Medicare enrollment posture against the latest available public release |
| State licensure lane | One configured state board lane (where a public API or institutional access is available) |

**What we do not do:**

- We do not replace your credentialing committee or CVO.
- We do not replace Primary Source Verification (PSV).
- We do not check NPDB, DEA registration, ABMS board certification, or CAQH.
- We do not claim real-time government portal access. Each check records the source-release date used.
- NPPES confirms NPI identity and public registry fields — it does not validate license status. Licensure is a state-board lane.

---

### The Pilot Structure

**Duration:** 30 days  
**Volume:** 10–30 clinician NPIs  
**Cost:** No charge during the pilot window. Commercial terms are only discussed after the KPI wrap-up call — and only if both sides want to continue.

**Your team does three things:**

1. Provide a roster of 10–30 clinician NPIs (no other PII required).
2. Designate one team member as the primary review operator.
3. Join a 30-minute KPI wrap-up call at day 26–30.

**We do the rest:** ingest, source checks, proof pack assembly, audit event logging, and a Startability report comparing pilot performance to your own baseline — never against a generic industry figure.

---

### What You Get at the End

- **Per-clinician evidence view** showing lane states (Identity / Safety / Authority / Enrollment), freshness notes, and limitation disclosures.
- **Proof Packs** — JSON, ZIP, and PDF artifacts with source-backed evidence, limitation notes, and a deterministic audit hash. An `ARTIFACT_EXPORTED` audit event is written before each packet leaves the platform.
- **KPI Report** — time-to-first-signal, automated lanes hit, proof-pack coverage, and days-at-risk surfaced — all measured against your own baseline.

---

### Who This Is For

VitalCV is the right fit for your organization if:

- You onboard 5 or more clinicians per month and credentialing delays consistently push start dates.
- You have a credentialing coordinator or director who reviews applications before committee.
- You are willing to share 10–30 NPIs and measure against your actual baseline.

This is not the right fit if:

- You need VitalCV to make the final privileging decision.
- You require full legacy HRIS integration before running a pilot.
- You onboard fewer than 2 clinicians per quarter.

---

### Next Step

If the scope above fits your situation, the next step is a 20-minute scoping call to confirm your state-board lane, baseline data availability, and NPI roster size. No IT involvement required to start.

Contact: **Chris Toler** · ct@sourcd.xyz

*VitalCV is HIPAA-aligned. Proof packs use cryptographically signed audit trails. No PHI is stored in the trust container. The trust container is an internal audit record, not a public ledger or a blockchain.*
