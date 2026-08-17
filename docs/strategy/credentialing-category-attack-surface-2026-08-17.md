# Credentialing category — attack surface

**Dated 2026-08-17. Rank 5 (supporting evidence).** This document does not
outrank the two canonical strategy documents, and it never outranks the truth
contract at rank 4. See [`README.md`](./README.md) for the precedence order.

**None of the competitor numbers in this document may appear in customer-facing
copy.** They describe competitors' markets and competitors' claims, not VitalCV
claims. Quoting a rival's speed language would import precisely the overclaim
the truth contract exists to prevent.

---

## What this answers

A buyer's evaluation grid for the credentialing-platform category was put to us:
Medallion, symplr, CertifyOS, Verifiable and Assured, compared on five columns —
platform model, NCQA/CVO certification, delegated credentialing, CAQH
integration, and pricing model. The question was how VitalCV becomes better than
Medallion on those axes.

**The answer is that four of the five columns are not winnable and not worth
entering, and the fifth changed ownership eight weeks ago in a way that opens a
position none of the five vendors can take.**

This is consistent with, and extends, the founder ruling of 2026-08-15: attack
the intake seam, do not build the credentialing surfaces.

---

## 1. The fact that changed

**CAQH is no longer a neutral utility.**

| Fact | Detail |
| --- | --- |
| Corporate form | Converted from nonprofit to **for-profit in January 2026** |
| Ownership | **12 shareholder companies affiliated with health plans** — UnitedHealth Group, Centene, Aetna, Elevance, Cigna, Humana, and several Blues plans |
| Governance | Board chaired by a UnitedHealth Group executive; a Centene executive as vice chair |
| Rebrand | **DataSpring, powered by CAQH**, announced 8 June 2026 alongside AHIP 2026 |
| Scale | ~4.8M records sourced directly from clinicians |
| Clinician terms | Portal keeps its name; remains free to clinicians; **120-day re-attestation** unchanged |

The ADA publicly recorded the obvious concern — data access by the payer-owners —
and reported reassurance that services, pricing, and privacy commitments are
unchanged, while committing to hold the company to its free-service agreement.
That is an association monitoring a counterparty it no longer controls.

**The consequence:** ~4.8M clinicians perform unpaid, recurring, deadline-driven
data work into a for-profit company owned by the counterparties who consume that
data. Meanwhile Medallion's August 2025 raise launched three products, one named
**CAQH Management** — sold to organizations, for managing provider profiles.

> **Attribution precision.** The product name and its launch are confirmed from
> Medallion's own release, which gives no functional detail. The reading that it
> manages the clinician's profile on the employer's behalf is an *inference* from
> the product name plus their organization-side buyer. Do not state it as fact.

**Every vendor in the grid integrates _with_ the payer-owned record. None of them
is an alternative _to_ it.** That is the seam.

---

## 2. The grid, column by column

### Platform model

Medallion is integrated — credentialing, licensing, enrollment, monitoring, and
now privileging and an integration engine. We cannot match that breadth and
should not try.

**The exploitable detail is in their own metric.** Their CareBridge case study
times 8 business days from *completed intake* to application submission. Intake
itself sits outside the clock. Every vendor in the grid restarts data collection
from zero for every provider at every organization, and none of them counts that
step.

**Move:** do not become an integrated platform. Become **the input to every
platform** — the step they exclude from their own timer.

### NCQA / CVO certification

All five vendors have it. A column where every competitor scores identically
differentiates nobody; it is an entry ticket, not an advantage.

Cost to match, for the record:

- Verification services operating for **at least six months before applying**
- Verification performed for **at least 50% of contracted practitioners**
- **$1–2M errors and omissions insurance**
- NCQA fees plus customized application and survey fees, quoted per applicant —
  no published flat price
- Certification cycle extended from two years to **three**

**The structural point: NCQA certifies the verifier, not the record.** There is
no certification a subject-held record can earn, and no amount of engineering
produces one. Chasing this column means becoming a different company.

**Move:** make the column not apply. Supply the evidence classes that a CVO is
not required to verify, and the evidence a clinician may lawfully forward.

### Delegated credentialing

A contractual arrangement in which a payer authorizes an organization to
credential on its behalf. Requirements: a documented program reviewed annually, a
credentialing committee **meeting at least monthly** with auditable minutes, and
a **pre-delegation audit of five to thirty provider files**. A failed
pre-delegation audit **resets the timeline by six to twelve months** and damages
the payer relationship.

This is a legal and operations program, not a roadmap item.

**Move:** the clinician-side analogue of delegation is **acceptance** — the
receiving organization asks for less because the record supplied it. Same
economic good, reached without certification. See
`docs/strategy/product-decision-filter.md` for the test any such proposal must
pass.

### CAQH integration

**This is the opening.** See §1. Every vendor is positioned downstream of a
record that is now payer-owned and for-profit. VitalCV's available position is
upstream: the clinician's own copy, retained regardless of employer or payer.

**Binding constraint:** we cannot write to DataSpring. Their Credentialing API is
available to Participating Organizations with an existing application and a
business case. The honest build is clinician-side — produce what the attestation
requires and retain the clinician's own copy — **not** an automated sync we have
no rights to. Never describe a capability we do not hold.

### Pricing model

Every vendor in the grid prices custom, usage-based, or per-provider-per-month.
Third parties report Medallion in the region of **$200–500 per provider per
month** with a five-provider minimum; Medallion does not publish pricing, and
quotes scale with volume, delegation structure, payer complexity, integrations,
and service mix.

This prices credentialing as an organization's recurring operating cost.

**Move:** price the **avoided request**, not the provider-month. See §4.3 for why
this is structurally uncopyable rather than merely different.

---

## 3. The grid, summarized

| Column | Verdict | Move |
| --- | --- | --- |
| Platform model | Cannot match, should not try | Be the input to every platform; own the step excluded from their timer |
| NCQA / CVO certified | Table stakes — differentiates nobody | Certification covers the verifier, not the record; make the column not apply |
| Delegated credentialing | A different company | Pursue acceptance, which is the same economic good without certification |
| CAQH integration | **The opening** | Be upstream of the payer-owned record, not integrated with it |
| Pricing | All priced per provider-month | Price the avoided request |

---

## 4. The three defensible moves

### 4.1 The 120-day attestation is the recurring hook we have never had

Our own analysis established that a reusable clinician profile already exists,
is free, is universal, is two decades old — and became a compliance chore rather
than a career asset. The unanswered half of that finding was that VitalCV had
**no earned reason for a clinician to return**.

The 120-day re-attestation is a recurring, dated, universal, genuinely
disliked obligation. Helping a clinician satisfy it **from their own record,
while keeping their own copy**, is a reason to return that does not depend on
the clinician being in the market for a job — which is the weakness of every
job-seeking-triggered retention model.

The ownership change gives this a story it did not have in 2025.

### 4.2 Their 90-day decay is our freshness doctrine's payoff

NCQA compressed the maximum primary source verification window: **180 → 120 days
for the accreditation track, and 120 → 90 days for the CVO track.**

A CVO's verification is therefore a *perishable asset* — it expires and must be
repurchased. A continuously re-checked, source-attributed record, with the
freshness qualifier carried inside the value rather than asserted beside it, does
not expire; it gets re-read.

This is the one technical axis where existing VitalCV doctrine is strictly
stronger than the incumbents', and it is stronger *because* of the rule change,
not despite it. It cost us nothing and was not designed for this purpose.

### 4.3 The incentive asymmetry is structural

Medallion's revenue is a function of verification volume — per provider, per
month, per customer. **If credentialing became genuinely reusable, their core
line shrinks.**

CredAlliance is that reuse captured before it eats them: a payer-side
clearinghouse that verifies once and syndicates across participating payer
networks, launched with a $43M raise, live with several national payers, citing
~$1.2B in annual duplicative verification cost.

In that architecture, **providers are subjects of verification, not participants
in governance** — the release specifies no clinician consent framework and no
provider-side data-control model.

**They cannot ship the clinician-governed version without cannibalizing the
customers who funded it.** Pricing on requests-avoided is therefore not a pricing
preference; it is a position their P&L forbids them from occupying.

---

## 5. Constraints and never-claims

These bind any use of this document.

**Never claim "first."**

- **Axuall** ships a clinician wallet, holds a patent on digital credential
  verification and management, and distributes through HealthStream. Our distinct
  and checkable claim is narrower: **self-originated** — a clinician obtains a
  VitalCV record without an employer provisioning it. Axuall publishes no
  self-serve clinician signup path and its messaging addresses health systems.
  The FTO constraint on presentation-exchange claims continues to bind.
- **CredAlliance** occupies "verify once, syndicate many" on the payer side.
- **CAQH / DataSpring** occupied the reusable clinician profile two decades ago.

**Capability constraints that have not moved.**

- `packages/licensure` catalogues 70 authorities with **0 live routes**. VitalCV
  cannot read a licence record from any U.S. board by any route.
- `decisionGrade` is the literal `false` across receipt candidates. VitalCV
  produces candidates, not decisions.
- `Apply with VitalCV` inventory is external. The blocker there is go-to-market,
  not engineering.

**Legal boundaries.**

- **NPDB entity queries may not be reused across entities, even with the
  practitioner's written consent.** The self-query is clinician-held and
  forwardable, and is explicitly not a substitute for an entity's own query.
- **FCRA**: no aggregate readiness score, fit score, or hidden candidate ranking
  an employer screens on. This is a legal boundary as well as an honesty one and
  must not be traded for conversion.
- Primary source verification is mandated by the Joint Commission for a bounded
  list — education, training, licensure, registration. It is **not** mandated for
  work history, references, identity continuity, or background checks unless the
  organization's own policy requires it. That unmandated lane is the one that is
  obtainable, genuinely re-created at every job move, and lawful to hold
  clinician-side.

**Copy discipline.** Competitors' speed language is on our banned-strings list.
Never reproduce it. Ours is the source-and-timestamp form: checked against
[source] at [timestamp], with the qualifier inside the value.

---

## 6. The falsification test

**Employer requests avoided** — items an employer did *not* ask for because the
record supplied them.

**If that number is zero across the first ten packets, the thesis is falsified
and more building will not fix it.** Measure it from packet one. This test
outranks every argument in this document.

---

## 7. The other attack surfaces

Nine avenues, ranked by fit to capability VitalCV already has. The test applied
to each is the wedge test — **not** "what makes a clinician build a record?" but
**"what makes one recipient ask for less?"**

| # | Surface | Why it is attackable | Fit today |
| --- | --- | --- | --- |
| A1 | Continuous monitoring became mandatory | Our three live free sources are the ones now named in a monthly mandate | **Highest** |
| A2 | Directory accuracy attestation | Legally forced every 90 days, for every billing clinician | High |
| A3 | The nursing lane | The only licensure lane where source access is already free and solved | High |
| A4 | Locums / travel repetition | Highest re-ask frequency in the market | Medium-high |
| A5 | The 120-day DataSpring attestation | See §4.1 | Medium-high |
| A6 | Identity continuity | Unmandated for PSV, re-done at every organization, unowned | Medium |
| A7 | Enrollment delay economics | Gives us ROI language without claiming the capability | Medium (framing) |
| A8 | The standards seat | CMS has named direct provider attestation as a future source | Low cost, high option value |
| A9 | Auditable screening | Our legal constraint is an asset as AI-hiring law converges | Passive |

### A1 — Credentialing entered the continuous-monitoring era, and it runs on our lanes

**This is the strongest fit between a market shift and capability VitalCV already
has, and it was not designed for it.**

NCQA's July 2025 standards moved credentialing from episodic to continuous.
Ongoing monitoring of each provider is now required **monthly — at least every 30
days**. The named checks include **Medicare and Medicaid exclusion checks,
SAM.gov reviews, OIG queries, and applicable state board sanctions**, with
license expiration tracked monthly and findings escalated to a peer-review body.
Recredentialing remains a fixed 36-month cycle initiated 90–120 days ahead, with
a 30-day decision notification window.

**The mapping is close to exact.** VitalCV's live, decision-relevant, free
sources are identity (NPPES), exclusions (OIG/LEIE), and Medicare enrolment
(PECOS). Those are precisely the lanes the monthly mandate runs on. Everything
VitalCV cannot read — state licensure — is on the *annual and triennial* cadence,
not the monthly one.

**The economics invert here.** Monthly monitoring is a cost that scales linearly
under a per-provider-per-month contract and asymptotically under an always-on
record. The incumbent's pricing model is worst-adapted to the requirement its own
accreditor just imposed.

**Concrete gap this exposes:** `packages/psv/sources/samExclusions.ts` still
calls the SAM.gov **v3** endpoint, retired in September 2024, and
`SAM_GOV_ENABLED` defaults false. SAM.gov is explicitly named in the monthly
mandate. This was previously deprioritized on the reasoning that OIG/LEIE already
covers exclusions; the mandate names them as separate checks. That reasoning
should be revisited on evidence, not reversed on assumption.

### A2 — Directory accuracy is a legally forced, 90-day, universal re-ask

Separate from credentialing, and larger, because it applies to every billing
clinician rather than only those changing jobs.

- **No Surprises Act:** plans must update directory information at least every
  **90 days**, remove unverified providers, and make updates **within 2 business
  days** of receipt. Providers face penalties up to **$10,000 per violation**;
  plans up to **$100 per day per affected individual**.
- **CMS:** 85% accuracy, 30-day updates, annual attestation. From **1 October
  2026** CMS ingests provider data directly from Medicare Advantage plans' public
  directory APIs; for plan year 2027 directory data appears publicly on Medicare
  Plan Finder.
- **REAL Health Providers Act:** further MA directory verification requirements
  from plan year 2028.

**The asymmetry:** the clinician is the only party who reliably knows where they
actually practise, and the law obliges plans to keep asking them. DirectAssure
exists specifically to reduce that repeated outreach. A clinician-side
attestation that many recipients can read sits upstream of all of it.

This is a stronger recurring hook than credentialing itself: it repeats by law,
it repeats often, and it does not require the clinician to be job-seeking.

### A3 — Nursing is the lane where source access is already solved

We have spent the licensure programme fighting for physician board access we have
not obtained: **0 of 70 authorities readable**. Meanwhile:

- **Nursys QuickConfirm and e-Notify are free.** e-Notify pushes status and
  renewal changes rather than requiring polling — which is the correct shape for
  the A1 monthly mandate.
- The **Nurse Licensure Compact reached 41 states as of June 2026** (New Jersey
  and Pennsylvania most recent), covering **over two million nurses**.
- Locums growth is APP-driven, which aligns with an NP/PA beachhead.

The nurse/APRN lane was never blocked on money. It is blocked on institutional
enrolment plus an unresolved SSN/DOB privacy decision. **If we want one genuinely
live licensure route this quarter, it is this one, and the blocker is a founder
decision rather than an engineering problem.**

This is a sequencing attack, not a market attack — and it is the cheapest live
route available to us.

### A4 — Repetition, not duration, is the wedge

Credentialing runs **60–120 days per facility** for a mobile clinician, and it
runs again at the next facility. Agency placement bundles that burden; direct
placement pushes it onto the clinician.

The value of a portable record scales with the **number of moves**, not the
length of any one wait. That makes locums, travel, and multi-state telehealth the
segments where a portable record is worth most per clinician — and the segments
where "employer requests avoided" should first become measurable.

### A6 — Identity continuity is unguarded

The Joint Commission does **not** mandate primary source verification of identity
verification, work history, references, or background checks unless an
organization's own policy requires it. Identity is therefore legal to hold
clinician-side, is re-established at every organization, and is owned by nobody in
the credentialing grid.

The infrastructure is maturing independently: IAL2 is the accepted remote
identity-proofing bar, only eight identity providers held Kantara IAL2 approval
as of mid-2026, and persistent-identity patterns (prove once, re-authenticate
biometrically) are established. CMS accepts IAL2 credentials.

This is the clearest example of the PSV inversion: the unmandated lane is the
unguarded one.

### A7 — Use their number, do not claim their capability

Enrollment delay is where the money actually is: **$1,000–$5,000 per provider per
day**, reported by **69% of health systems, hospitals and provider groups**; a
60–90 day delay compounds to **$30,000–$120,000 per provider**; **one in five
hospitals** report losing over $1M annually to delayed activation.

VitalCV cannot do payer enrollment and must not imply it can. What this number
does is price the seam we *can* attack: days removed from the front of that clock
have a defensible dollar value that we do not have to invent. State it as days
saved against a published industry figure, never as revenue we recovered.

### A8 — The standards seat is cheap and currently open

CMS's National Directory of Healthcare Providers and Services RFI contemplates
future releases drawing on payer directories, state licensing boards, and
**direct provider attestation systems**. Stakeholder comments push CMS toward
API-based, machine-readable attestation over manual portals.

A clinician-side attestation API is a *position* rather than a product. Filing
comments and publishing the schema costs little and buys option value on a
standard being written now. It does not require certification, paid sources, or
employer volume.

### A9 — Our legal constraint is becoming a market asset

AI hiring law is converging on transparent, auditable, human-supervised
decisions. Competitors screening candidates with opaque models accumulate
exposure. The FCRA-derived ban on aggregate readiness scores and hidden ranking
already binds us. **We are not behind on AI screening; we are early on auditable
screening** — and the constraint must not be traded for conversion.

### What we are explicitly not attacking

CVO/PSV parity, payer enrollment execution, privileging, delegated credentialing,
and job-inventory volume. Each requires either certification, paid per-entity
sources, employed human verifiers, or capital we do not have. Building the
surfaces without the capability would be fabrication.

### Ranked recommendation

1. **A1** — align the monitoring story with the 30-day mandate, and fix the
   SAM.gov v3 route on evidence.
2. **A3** — resolve the Nursys enrolment and privacy decision; it is the only
   cheap path to a live licensure route.
3. **A2** — clinician-side attestation, which serves A5 and A8 simultaneously.

A4, A6, A7 and A9 are framing and sequencing rather than new build. **None of
these substitute for §6: if employer requests avoided is zero across the first
ten packets, none of this matters.**

---

## 8. Sources

Retrieved 2026-08-17.

- Medallion — [$43M raise and CredAlliance launch](https://medallion.co/news/medallion-raises-43-million-to-expand-ai-infrastructure-and-launch-credalliance)
- Medallion — [CVO credentialing solution](https://medallion.co/solutions/cvo-credentialing)
- Fierce Healthcare — [AHIP 2026: CAQH rebrands as DataSpring](https://www.fiercehealthcare.com/health-tech/ahip-2026-caqh-rebrands-dataspring-it-charts-course-future)
- American Dental Association — [What to know about the CAQH change to DataSpring](https://adanews.ada.org/ada-news/2026/june/what-to-know-about-caqh-change-to-dataspring-powered-by-caqh/)
- Acuity — [CAQH rebrands as DataSpring: under payer ownership](https://acuity.news/regulation/caqh-rebrands-dataspring-payer-ownership-credentialing-2026/)
- NCQA — [CVO certification FAQs](https://www.ncqa.org/programs/health-plans/credentials-verification-organization-cvo/faqs/)
- Integral Healthcare Solutions — [NCQA CVO certification cost guide](https://www.integralhs.com/credentialing-cvo-cost-guide)
- Assured — [NCQA credentialing standards 2026: what changed](https://www.withassured.com/blog/ncqa-credentialing-standards-updates)
- HIT Consultant — [Preparing for delegated credentialing and NCQA audits](https://hitconsultant.net/2026/03/19/delegated-credentialing-trap-failing-payor-audits-provider-enrollment/)
- Kaizen Automation — [Medallion credentialing reviews and pricing](https://www.kaizenautomation.com/blog/medallion-credentialing-reviews)
- Axuall — [The Clinician Wallet](https://axuall.com/data-network/clinician-wallet/)
- Ideon — [CMS provider directory requirements 2026–2027](https://ideonapi.com/resources/blog/cms-provider-directory-requirements-a-complete-compliance-guide-for-2026-2027/)
- ProviderTrust — [Unpacking the 2025 NCQA credentialing guideline updates](https://www.providertrust.com/blog/unpacking-the-2025-ncqa-credentialing-guideline-updates/)
- Verisys — [NCQA 2025: a guide to new monitoring standards](https://verisys.com/blog/mastering-ncqa-compliance/)
- WCH — [Credentialing enters the continuous monitoring era](https://insights.wchsb.com/2026/01/27/credentialing-enters-the-continuous-monitoring-era/)
- Quest Analytics — [No Surprises Act provider directory FAQ](https://questanalytics.com/provider-data-accuracy-resource-hub/no-surprises-act-faq/)
- Candor Health — [The REAL Health Providers Act and the No Surprises Act](https://candorhealth.com/blog/the-path-to-accountability-in-provider-data-accuracy-breaking-down-the-no-surprises-act-and-the-real-health-providers-act)
- CMS — [RFI on establishing a National Directory of Healthcare Providers and Services](https://www.cms.gov/newsroom/press-releases/cms-asks-public-input-establishing-first-national-directory-health-care-providers-and-services)
- Neolytix — [Credentialing delays, revenue loss and cash-flow risk](https://neolytix.com/articles/credentialing-delays-revenue-loss/)
- Hospitalogy — [The credentialing and enrollment bottleneck](https://hospitalogy.com/articles/2026-05-27/the-credentialing-and-enrollment-bottleneck-nothing-moves-until-the-provider-is-ready/)
- NCSBN / NLC — [Nurse Licensure Compact state list 2026](https://www.nursesend.com/blog/nurse-licensure-compact-states-2026-a-recruiters-guide/)
- Biometric Update — [Healthcare builds new identity infrastructure](https://www.biometricupdate.com/202605/healthcare-builds-new-identity-infrastructure-as-fraud-and-interoperability-pressures-grow)
