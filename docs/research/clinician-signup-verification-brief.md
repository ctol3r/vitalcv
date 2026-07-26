# Clinician Self-Serve Signup & Verification — Competitive Research Brief

> Purpose: Give Claude Code an implementation-ready reference for building a VitalCV
> clinician signup/verification gate modeled on the two flows the founder captured —
> **ChatGPT for Clinicians** (OpenAI) and **OpenEvidence** — adapted to VitalCV doctrine
> (NPI-first, source-backed, checked/gated/pending honesty, audit-first).
> Researched 2026-07-04. Verification-vendor names are **not** publicly confirmed; treat as `unknown`.

---

## 0. Why this matters for VitalCV

Both products gate their entire product behind a **fast, self-serve "verified clinician" signup keyed on NPI**. That gate is the front door that produces their user base (OpenEvidence: ~757k verified clinicians, ~15M consultations/month).

VitalCV already owns the harder half of this pipeline — `POST /api/ingest/npi/:npi → NPPES → OIG/LEIE → trustState → readinessEngine → passport`. What we are copying is the **thin, self-serve onboarding UX** that turns "enter your NPI" into "you're in, and here's your wallet."

**The differentiation to preserve:** their signup outputs a *boolean* ("you are a clinician, here's the app"). VitalCV's signup should output *source-backed career evidence* (a readiness snapshot + wallet). Same front door, strictly more valuable artifact behind it.

---

## 1. ChatGPT for Clinicians (OpenAI) — launched 22 Apr 2026

**Eligibility**
- US-licensed **physicians (MD/DO), nurse practitioners, physician assistants, pharmacists**.
- US-only at launch; more countries "over time."

**Requirements to sign up**
- A ChatGPT account.
- A valid **NPI**.
- A license that can be verified through a **third-party verification provider** (vendor not publicly named).

**Flow (self-serve, minutes)**
1. Go to `chatgpt.com/plans/clinicians`.
2. Sign in with existing ChatGPT account, or create one.
3. Complete **clinician verification via a third-party provider using your NPI**.
4. **Attest** you are a licensed clinician + agree to the services agreement.
5. "Get started with ChatGPT" → provisions a **ChatGPT for Clinicians workspace**.

**Trust / compliance posture**
- Free for verified US clinicians (individual tier).
- HIPAA support, BAA, no-training-on-data, audit logs, RBAC, SAML/SCIM live at the **enterprise "ChatGPT for Healthcare"** tier — the individual free tier is the top of that funnel.
- CME credit offered on eligible clinical questions.

**Strategic read:** consumer → **free individual clinician (this gate)** → enterprise hospital contract. The free clinician signup exists to build familiarity and seed enterprise sales.

---

## 2. OpenEvidence

**Eligibility**
- Verified US HCPs: **MD, DO, NP, PA, pharmacist, dentist, RN with an NPI**; **medical students** via proof of student status.

**Flow (self-serve, seconds)**
1. Go to `openevidence.com` → **Sign Up**.
2. **Select profession** (e.g., RN).
3. **Enter NPI** — with an inline "look yours up at npiregistry.cms.hhs.gov" helper.
4. System **verifies the NPI against the national NPI registry (NPPES)**.
5. **Attest** professional credentials.
6. On success → immediate access.

**Fallback / corroboration**
- **Hospital / institutional email confirmation** is used as an alternate or corroborating verification path alongside NPI.

**Trust / compliance posture**
- Free, **ad-funded** (pharma pays for loading-screen placement; very high CPMs).
- **SOC 2 Type II**, HIPAA-compliant, **embedded in Epic** (Mount Sinai, Sutter).
- NPI users identified as HIPAA-covered providers can earn **AMA PRA Category 1 CME**.

---

## 3. The common pattern (extract this and build it)

Both flows reduce to the same 6 primitives:

1. **Low-friction account creation** (OAuth / existing account / email).
2. **Profession selection** (drives which license class + downstream rules apply).
3. **NPI as the identity key** — single field, with an NPPES-lookup helper link.
4. **Automated check against the public NPPES registry** (name/taxonomy/type match).
5. **Attestation + services agreement** click-through (covers everything not source-verified).
6. **Instant grant on success**, with a **fallback lane** (institutional email; third-party license/ID verification) for edge cases.

Access is gated on "verified clinician" status; **monetization happens downstream** (ads, or enterprise funnel), never at the signup gate.

### The gap both leave open (VitalCV's opening)
An NPI is a **public identifier** — anyone can type another clinician's NPI. NPPES match alone proves "this NPI is real," not "**you** are that person." Competitors patch this with attestation + a third-party license/ID vendor (ChatGPT) or institutional-email possession (OpenEvidence). For VitalCV this is not a footnote — **binding NPI → person is the trust anchor of the wallet (NPI→DID)**, so the possession/knowledge factor must be a first-class design decision, not an afterthought.

---

## 4. Mapping to VitalCV (implementation-ready)

### Reuse (already built)
- `POST /api/ingest/npi/:npi` → `sourceVerifier (NPPES)` → `oigLeieChecker` → `trustStateEngine` → `readinessEngine` → `passportService.buildPassport`.
- `packages/trust-state/sourceCoverage.ts` states: `checked | stale | pending | gated | unavailable | accessRequired | reviewRequired | notDecisionGrade | previewOnly`.
- Wave 180 `PersonProfile` (dual-entity identity) as the account record the wallet hangs off.

### Proposed signup gate (maps 1:1 to the common pattern)
1. **Account** — Clerk (already the auth layer). OAuth or email.
2. **Profession selector** — MD/DO, NP, PA, PharmD, RN, dentist, **student (no-NPI path)**. Drives license-class rules and which source lanes are relevant.
3. **NPI entry** — single field + inline NPPES-lookup helper link (copy the OpenEvidence UX detail; it measurably lowers drop-off).
4. **NPPES resolution** — call existing ingest pipeline; present the resolved **name + taxonomy + NPI type** back to the user to **confirm "this is me"** (Type 1 individual expected).
5. **Identity-binding factor** (the gap above) — minimum: **institutional/work email OTP** as a possession signal → recorded as a **corroboration input to the Trust Gradient**. Upgrade path: third-party ID/license verification vendor, surfaced as a `gated`/`accessRequired` source until an agreement exists. Do **not** mark the clinician "source-checked on license" unless the `STATE_BOARD` lane is actually configured for their state.
6. **OIG/LEIE** — run the exclusion check (already always-on); `CLEAR` required to issue a clean readiness snapshot.
7. **Attestation + services agreement** — click-through covering every claim not yet source-backed. **Write an `AuditEvent` before returning success** (audit-first rule).
8. **Grant + artifact** — provision the **Career Wallet** and render the **readiness snapshot / passport**, not a boolean. This is where VitalCV beats the boolean gate.

### Student / no-NPI path
Mirror OpenEvidence's student lane: proof-of-student-status instead of NPI → wallet created in **`previewOnly` / `pending`** state, upgraded to source-checked when an NPI is later issued.

### Copy discipline (per CLAUDE.md banned strings)
- Never the bare word **"Verified"** as a status label; use **"source-checked," "NPPES-confirmed," "attested,"** and the explicit coverage state.
- "Credential **readiness** packet," not "credentialing complete."
- Attestation ≠ verification — label attested fields as **attested**, keep them visually distinct from `checked` source data.

---

## 5. Concrete build tasks (hand to Claude Code / Codex)

1. **`/onboarding` verified-clinician gate** — profession selector → NPI field (+ NPPES helper) → confirm-identity step → attestation + services agreement → wallet provision. Reuse the ingest pipeline; add the confirm-identity screen.
2. **Identity-binding factor** — institutional-email OTP service feeding the Trust Gradient as a corroboration signal; stub a third-party ID/license verification adapter behind a feature flag as a `gated` source.
3. **Attestation + AuditEvent** — services-agreement click-through that writes an `AuditEvent` row before 2xx; store attested claims as `attested`, never promoted to `checked`.
4. **Coverage-honest result screen** — readiness snapshot showing NPPES `checked`, OIG/LEIE `checked`, license `gated`/`accessRequired` (per state lane), attestations flagged. This *is* the differentiator vs. the competitor boolean.
5. **Student / no-NPI lane** — `previewOnly` wallet with an NPI-upgrade path.

---

## 6. Sources
- ChatGPT for Clinicians — OpenAI Help Center: https://help.openai.com/en/articles/20001202-chatgpt-for-clinicians
- ChatGPT for Clinicians plan page: https://chatgpt.com/plans/clinicians/
- Making ChatGPT better for clinicians — OpenAI: https://openai.com/index/making-chatgpt-better-for-clinicians/
- OpenAI launches ChatGPT for Clinicians — Fierce Healthcare: https://www.fiercehealthcare.com/ai-and-machine-learning/openai-launches-chatgpt-clinicians-free-ai-tool-physicians-nps-and
- OpenEvidence for Nurses (signup/NPI walkthrough) — FindSkill: https://findskill.ai/blog/openevidence-for-nurses/
- OpenEvidence outside the US (verification detail) — iatroX: https://www.iatrox.com/blog/openevidence-outside-us-access-verification-uk-alternatives
- ChatGPT for Clinicians vs OpenEvidence (2026 comparison) — iatroX: https://www.iatrox.com/blog/chatgpt-for-clinicians-vs-openevidence-2026
- OpenEvidence — About: https://www.openevidence.com/about

### Founder-captured primary sources (in Dropbox)
- `ChatGPT for Healthcare _ OpenAI Help Center 2026-04-23 06-38-57.pdf` (enterprise tier; links to the Clinicians signup article)
- `How can I get a Business Associate Agreement (BAA) with OpenAI for the API Services_ ... 2026-04-23 06-40-39.pdf`
- `OpenEvidence 2026-05-16 20-47-22.pdf` (credentialing-bottlenecks Q&A)
- `Business Associate Agreement _ OpenEvidence 2026-05-16 19-22-37.pdf` (OpenEvidence Network BAA, HIPAA)
