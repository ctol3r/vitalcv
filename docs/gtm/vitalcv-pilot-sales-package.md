# VitalCV — Pilot Sales Package

One-document consolidation of the sales kit. This is the primary source material for external conversations; it mirrors the individual assets in this folder so nothing contradicts between them.

* Full scope document: [`30-day-psv-readiness-pilot.md`](./30-day-psv-readiness-pilot.md)
* Full outreach copy: [`founder-outreach-pack.md`](./founder-outreach-pack.md)
* Full qualification rubric: [`buyer-qualification-checklist.md`](./buyer-qualification-checklist.md)
* Pipeline tracker template: [`pilot-outreach-tracker.md`](./pilot-outreach-tracker.md)
* External memo for buyers: [`pilot-kit/01-external-pilot-memo.md`](./pilot-kit/01-external-pilot-memo.md)

---

## Positioning

VitalCV is **PSV readiness + audit-ready proof + time-risk visibility**. It is not a CVO replacement, not a credentialing committee substitute, and not a blockchain product. Limitations are explicit in every asset.

| The wedge | The truth |
| :--- | :--- |
| "Day-zero source-backed readiness" | NPPES identity + OIG LEIE federal exclusion posture + PECOS public enrollment posture + one configured state licensure lane |
| "Proof pack with audit event on every export" | Deterministic JSON / ZIP / PDF with a sha256 artifact hash and an `ARTIFACT_EXPORTED` audit row written before bytes leave the platform |
| "Trust container" | Hidden backend record that binds the credential envelope id + artifact hash + issuer metadata; mock/dev today, Dock-compatible scaffold wired for later |
| What we do **not** sell | Real-time OIG / LEIE feeds, license validity from NPPES, production DIDs, NPDB access, DEA, ABMS, CAQH, SAM.gov |

---

## The Pilot Offer (30-Day PSV Readiness Pilot)

* **Duration:** 30 days
* **Volume:** 10–30 clinician NPIs
* **Cost:** Small no-charge structured pilot. No invoice during the window. Commercial terms are only discussed after the KPI wrap-up — and only if both sides want to continue.
* **Timeline:** Kickoff + scope sign-off (Day 0–2) → NPI intake + ingest (Day 2–5) → Review window (Day 5–25) → KPI report + wrap-up call (Day 26–30).

### Sources included
| Source | What it confirms |
| :--- | :--- |
| NPPES | NPI identity and public registry fields (name, specialty taxonomy, enumeration date). **Not** license validity. |
| OIG LEIE | Federal exclusion posture against the latest available source release. **Not** a real-time OIG feed. |
| PECOS public | Medicare FFS public enrollment posture against the latest available public release. **Not** the real-time PECOS portal. |
| State licensure lane | One configured state board lane where institutional access or a public API is available. |

### Out of scope
* Primary Source Verification (PSV) — we surface what still needs it; we do not perform it.
* Credentialing committee / final privileging decision.
* NPDB (self-query evidence expires after 45 days — future lane), DEA, ABMS, CAQH.
* **SAM.gov is not integrated yet; OIG LEIE is included.**
* Real-time Nursys / FSMB access without an explicit institutional agreement.
* Production DID / Verifiable Credential issuance. The trust container runs in mock/dev for this pilot; a Dock-compatible scaffold is wired but not producing production credentials.

---

## Outreach Cheat Sheet (see `founder-outreach-pack.md` for the full copy)

**30-second pitch.** When a clinician start date slips because an application sat for weeks waiting on a manual credential check, you lose revenue, placements, and coordinator hours — usually all three at once. VitalCV assembles a source-backed evidence packet from NPPES identity, OIG LEIE federal exclusions, PECOS public enrollment posture, and a configured state licensure lane, so your team knows on day zero what is decision-grade, what is partial, and what still needs PSV — without replacing your credentialing committee.

**Cold email hook (subject: "Cutting your time-to-clear for clinician onboarding").** 3 medical groups wanted. Small no-charge 30-day pilot. 10–30 NPIs. You get a KPI report measured against your own baseline.

**Top objection handling.**
* *"Replacing our CVO / software?"* → No. We sit at the top of the funnel and hand a source-backed packet on day zero; your existing stack still owns the committee decision.
* *"Replacing our committee?"* → No. We provide a source-backed head start, not a final credentialing decision.
* *"Is this blockchain / crypto?"* → No. The trust container is an internal audit record. We use standard cryptographic signatures for tamper detection, not a public ledger and not a cryptocurrency.

---

## Qualification in one table (see `buyer-qualification-checklist.md`)

| Axis | 5 (green) | 3 (yellow) | 1 (disqualify) |
| :--- | :--- | :--- | :--- |
| **Urgency** | Start dates slipping weekly | Process is slow but they manage | 90-day window, no pressure |
| **Data readiness** | Can provide 30 NPIs tomorrow; knows baseline | Can provide NPIs; no baseline | 4 weeks of legal review just to share public NPIs |
| **Pilot feasibility** | Understands this is a day-zero head start, not a CVO replacement | Wants custom state boards that aren't live yet, but willing to test included lanes | Demands real-time CAQH / NPDB immediately |

Add the three axes. **12–15** → pilot fit. **8–11** → nurture. **< 8** → disqualify.

---

## Pipeline hygiene (see `pilot-outreach-tracker.md`)

One tracker row per account. Columns: account · buyer type · contact · problem hypothesis · intro source · outreach date · response · discovery scheduled · fit score · blockers · next step · owner · last touched · notes. Any row with `last touched` older than 10 days and `next step != closed` gets a nudge or gets closed out.

---

## Rules we hold each asset to

* No guaranteed savings, no instant-hire claims, no fake ROI, no fake customer traction.
* No blockchain-first pitch. The trust container is explained as an audit record; cryptography is an integrity detail, not the product story.
* Limitations are explicit everywhere. Partial evidence stays partial. NPPES is identity, not license. OIG LEIE is federal, not state. PECOS is public, not real-time.
* Every number used externally comes from a real measurement or is labelled as an internal simulation on the `/pilot` page.
