# Role, Auth & Interoperability UX

**VitalCV · Design Wave D56 · Calm Credentialing Layer**
Status: `PASS TO SPEC` · Scope: design-only · Backend-independent
Companion: [`zenlike-ui-doctrine.md`](./zenlike-ui-doctrine.md) · Handoff: [`../ops/role-auth-ux-implementation-brief.md`](../ops/role-auth-ux-implementation-brief.md)

---

## 0. Truth-contract constraints (read first)

These are non-negotiable. They apply to every surface, every state, every copy string this wave produces.

### Banned in product copy
- Bare `Verified` (any form of `Get verified`, `Become verified`, `Verify instantly`)
- `Cleared` / `Approved` (as adjudication on a clinician)
- `Complete credentialing` / `Instant credentialing`
- `Accepted everywhere`
- `HIPAA compliant` / `SOC2 certified` / `NCQA certified` (unless evidenced and current)
- `Wallet ready` · `Blockchain login`
- `Real-time monitoring` (unless an actual real-time event source is wired)

### Preferred phrasing
- `source-backed readiness`
- `credentialing head start`
- `reviewer-ready packet`
- `source-checked where available`
- `access required where gated`
- `institution review still required`

### What VitalCV claims
- It surfaces source-backed evidence with timestamp, source attribution and tier.
- It packages a reviewer-ready snapshot for the next review.

### What VitalCV does not claim
- It does not credential.
- It does not adjudicate clinicians.
- It does not replace hospital credentialing committees.
- It does not assert universal acceptance.

These constraints are mirrored verbatim in §8 (copy table) below.

---

## 1. Sign-up / login recommended flow

### 1.1 Front-door behavior (`/`)

The unauthenticated user must be able to do real work without an account. Sign-in earns its place by *saving and continuing*, not by gatekeeping.

```
[hero]   "The calm credentialing layer between fragmented systems."
         "Reusable, source-backed clinician readiness."

[input]  Start with an NPI · placeholder: e.g. 1699264564
[primary CTA]   Check clinician readiness                    (verb · action)
[secondary]     View demo packet                             (noun · destination)
[tertiary]      Inspect trust layer                          (noun · destination)

[micro]  "Look up readiness without an account.
          Sign in to save a snapshot you can carry to the next review."
```

The keyboard shortcut `/` focuses the NPI input from anywhere on the page.

### 1.2 Sign-in (`/sign-in`)

- Page title: **Sign in to continue.** (never bare "Sign in")
- Below the form, the *why-sign-in* microcopy block (§1.4).
- Secondary link: **"Look up a clinician without an account"** → `/`.
- Error microcopy: see §4 degraded states.

### 1.3 Sign-up (`/sign-up`) — role tiles

Three tiles, plus a quiet fourth link. Selecting a tile rewrites the form's "what happens next" line and pins the post-login destination.

| Tile | Label | One-line promise | Post-login destination |
|---|---|---|---|
| 1 | **I am a clinician** | "Start with your NPI. See what's source-backed, what's gated, and what still needs institution review. Save a snapshot you can reuse." | `/passport` (NPI prefilled) |
| 2 | **We are an employer** | "Check a clinician's readiness before paperwork starts. View a demo packet first, or run a pilot with your committee in the loop." | `/demo/employer` → `/pilot` |
| 3 | **We are an issuer / source** | "Confirm a record once. Reduce repeat questions. VitalCV does not replace your authority — it carries your confirmation forward." | `/issuer` (open question 11.1) |
| · | *"I'm a verifier or auditor → Inspect the trust layer"* | quiet link, no tile | `/trust` |

Investors / buyers have **no separate path**. They route through the employer demo packet. Discipline: no investor-only surfaces.

### 1.4 "Why sign in?" microcopy

Appears below every sign-in affordance (nav, `/sign-in`, modal):

- Default: *"Look up readiness without an account. Sign in to save a snapshot you can carry to the next review."*
- Employer: *"Sign in to share a clinician packet with your committee."*
- Verifier: *"Sign in to continue review across sessions."*

### 1.5 Post-login landing

| Role | Lands on | Primary card | Secondary card |
|---|---|---|---|
| Clinician | `/passport` | "Continue to Passport" | "See what employers usually ask for" |
| Employer | `/demo/employer` (then `/pilot`) | "Open clinician lookup" | "Start a pilot" |
| Issuer | `/issuer` | "Confirm this record" | "How integration works" |
| Verifier | `/trust` | "Inspect trust layer" | "How to cite a finding" |

Post-login state is computed from the role tile at sign-up, not from a generic dashboard.

---

## 2. Role journeys

Each journey has five beats: **first screen → primary CTA → proof moment → anxiety point → success moment.** The anxiety point is named so the design can protect against it.

### 2.1 Clinician

| Beat | Detail |
|---|---|
| First screen | `/` with NPI input in focus. No account required. |
| Primary CTA | **Check clinician readiness** → `/passport`. |
| Proof moment | Source-backed lanes show source + last-checked timestamp (e.g. "NPPES · checked 4m ago"). |
| Anxiety point | A lane is empty or access-required. Protect with: *"Access required. Your organization may need separate source evidence."* No red. No shame language. |
| Success moment | **Save snapshot** → reading is carried to the next review. Feels like *"this travels with me,"* not *"I just got graded."* |

### 2.2 Employer / healthcare organization

| Beat | Detail |
|---|---|
| First screen | `/demo/employer` with `DEMO ONLY` chip and a pre-loaded sample clinician. |
| Primary CTA | **Check a clinician's readiness.** Secondary: "View demo packet" for sharing with the committee. |
| Proof moment | Known / Gated / Missing / Unavailable lanes — matches how committees already think. |
| Anxiety point | "Will this replace our committee?" Surface disclosure: *"Reviewer-ready head start. Institution review is still required."* |
| Success moment | Start pilot · packet sent. Committee receives a packet that *reduces repeat questions* rather than one that overclaims. |

### 2.3 Issuer / source authority

| Beat | Detail |
|---|---|
| First screen | `/issuer` · one confirmation request. Not a dashboard. |
| Primary CTA | **Confirm this record.** Three lines: who is asking, what they are asking, what changes. |
| Proof moment | "Confirm once, reduce repeat questions." Confirmation is timestamped and attributed back to the issuer. |
| Anxiety point | "Is VitalCV scraping or replacing us?" Persistent boundary line: *"VitalCV does not issue or override your authority. It carries your confirmation forward."* |
| Success moment | "Your confirmation reused N times since" — the issuer sees how many reviews they spared without re-asking. |

### 2.4 Verifier / auditor / technical reviewer

| Beat | Detail |
|---|---|
| First screen | `/trust` · reading mode. Monospace, no marketing copy. |
| Primary CTA | **Inspect trust layer.** Then per-record: `runId`, `lineageKey`, `kid`, attestation boundary. |
| Proof moment | Replay reconstructs a prior reading: same inputs → same outputs. The system tells on itself. |
| Anxiety point | "What does VitalCV claim, and what doesn't it?" Attestation-boundary surface — explicit, page-level. No HIPAA / SOC2 / NCQA claims anywhere. |
| Success moment | A finding is exportable as a citable receipt, not a screenshot. |

### 2.5 Investor / buyer evaluating credibility

| Beat | Detail |
|---|---|
| First screen | `/` — the same one everyone else sees. No investor portal. |
| Primary CTA | **View demo packet** — same path as employers. ROI shown only as illustrative market benchmark. |
| Proof moment | Truth-state register on `/trust`. A product that shows its limits sells more confidence than one that hides them. |
| Anxiety point | "Is this hype or product?" Every surface carries explicit unavailable / gated / pending states. |
| Success moment | "I understood the wedge in 10 seconds" — hero sentence + Proof Continuity Rail tells the whole story without a deck. |

---

## 3. Interoperability UX — the Proof Continuity Rail

A single reusable component appears across `/`, `/passport`, `/demo`, `/trust`, and the employer view. It uses **human labels** at the surface and hides protocol identifiers in an **Inspect** drawer.

### 3.1 Component anatomy

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROOF CONTINUITY RAIL · /passport?npi=…                            │
├──────┬──────┬──────┬──────────────┬──────────────┬──────────────────┤
│ NPPES│OIG·LEIE│PECOS │ STATE BOARD  │ DEA          │ EMPLOYMENT HIST. │
│ [OK] │ [OK]   │[ACCESS REQ] │[TEMP UNAVAILABLE] │ [NOT CONNECTED] │ [NEEDS REVIEW] │
│ 4m   │ 9m     │ org auth    │ source returned   │ not in this    │ source-backed, │
│      │        │ needed      │ 503 at 13:58 UTC  │ build          │ review needed  │
│ Insp.│ Insp.  │ How to req. │ Retry · or wait   │ What to ask for│ See what's     │
│      │        │             │                   │                │ needed         │
├──────┴──────┴──────┴──────────────┴──────────────┴──────────────────┤
│ source-backed 3/6  ·  review 1  ·  access 1  ·  unavail 1  ·  off 1 │
│             [ SAVE SNAPSHOT ]  [ Share packet ]  [ Inspect trust ]  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 User-facing state vocabulary (primary)

| Token | Meaning | Color | Used when |
|---|---|---|---|
| `SOURCE-BACKED` | Primary source returned a record. | ok / green outline | NPPES, OIG, etc returned data this session. |
| `ACCESS REQUIRED` | Needs organization auth or separate evidence. | watch / amber | Gated source. Routes to pilot intake. |
| `NOT CONNECTED` | Lane not wired in this build. | unknown / dashed | Honest about scope, not about the clinician. |
| `TEMPORARILY UNAVAILABLE` | Source up, but didn't answer. | watch / amber | 5xx / timeout. **Not red.** |
| `SNAPSHOT ONLY` | Saved point-in-time, may be stale. | ink dashed | Unauthenticated reading or expired snapshot. |
| `NEEDS INSTITUTION REVIEW` | Evidence captured, decision is theirs. | watch / diamond | Default for any non-issuer lane. |
| `DEMO ONLY` | Illustrative, not customer data. | info / blue | Every `/demo/*` page header. |

### 3.3 Technical vocabulary (behind Inspect only)

Never primary. Appears inside the expanded Inspect drawer or on `/trust`.

- `runId` — which run produced this lane.
- `lineageKey` — the record's identity over time.
- `kid` — key id of the signature.
- `JWKS` — published verifying keys (per open question 11.6).
- `DID` — decentralized identifier where present.
- `receipt` — signed artifact for citation.
- `replay` — same-input → same-output reproduction.
- `attestation boundary` — the literal claim and its limits.

### 3.4 Translation table — lead with human

| Technical | Surface in product as |
|---|---|
| JWKS / DID | "This system can inspect the proof." |
| signed receipt | "This result can be inspected." |
| replay | "This reading can be re-run." |
| lineage | "This record's history is intact." |
| portability | "This packet can travel to the next review." |
| attestation boundary | "This does not replace institution review." |

### 3.5 Where the rail appears

| Surface | Rail mode | Notes |
|---|---|---|
| `/` | Compact, four-lane preview | Wired to demo NPI (per open question 11.2). |
| `/passport` | Full, six-lane, above the fold | Inspect drawer collapsed by default. |
| `/demo/*` | Full six-lane + `DEMO ONLY` chip | Tray copy hedges every illustrative number. |
| `/trust` | Inspection mode | Inspect drawer **expanded** by default. |
| Employer view | Six-lane grouped as Known / Gated / Missing / Unavailable | |
| Shared packet (print) | Printable export of rail + Inspect drawer | Print-stylesheet only this wave. |

---

## 4. Degraded-state microcopy

A source outage is **not** a clinician failure. Every degraded state must reduce anxiety, never raise it.

| State | Surface label | Microcopy | Severity | CTA | Do not imply |
|---|---|---|---|---|---|
| NPPES unavailable | `TEMPORARILY UNAVAILABLE` | "Source temporarily unavailable. Try this NPI again in a moment. Nothing has been marked adverse." | watch | "Retry · or wait" | …that the clinician is excluded. |
| OIG / LEIE not connected | `NOT CONNECTED` | "This lane is not connected in this build." | unknown | "What to ask for" | …that exclusion was found. |
| PECOS not connected | `NOT CONNECTED` | "This lane is not connected in this build." | unknown | "What to ask for" | …that Medicare enrollment is absent. |
| State board access required | `ACCESS REQUIRED` | "Access required. Your organization may need separate source evidence." | watch | "How to request" | …that licensure is invalid. |
| Backend degraded | `TEMPORARILY UNAVAILABLE` | "Some lanes are temporarily unavailable. Nothing has been marked adverse." | watch | "Retry" | …systemic failure of credentialing. |
| User unauthenticated | `SNAPSHOT ONLY` | "Snapshot only. Sign in to save this reading and carry it forward." | info | "Sign in to save snapshot" | …that the data is unverified. |
| No snapshot loaded | empty rail | "Type an NPI to begin. We'll show what's source-backed, what's gated, and what still needs institution review." | info | NPI input | …error or fault. |
| No NPI entered | empty rail | (same as above) | info | NPI input | …error. |
| Invalid NPI | inline | "That doesn't look like a valid 10-digit NPI. Nothing has been marked adverse — try again." | info | NPI input | …adverse signal. |
| Demo data only | `DEMO ONLY` chip | "Illustrative market benchmark — not a customer outcome." | info | "Start a pilot" | …customer outcome. |

**Required principle, repeated literally on the page where appropriate:** *Nothing has been marked adverse.*

---

## 5. CTA hierarchy

### 5.1 Global rule

Every CTA answers the question: **"what do I do next?"**

- **Verbs** are actions. (`Check clinician readiness`)
- **Nouns** are destinations. (`Passport`, `Trust`)
- Never blend. Never use bare `Continue` — always name the destination (`Continue to Passport`).

### 5.2 Per-surface CTA tier

| Surface | Primary (verb) | Secondary (noun · destination) | Tertiary | Nav-level |
|---|---|---|---|---|
| `/` | Check clinician readiness | View demo packet | Inspect trust layer | Sign in |
| `/passport` | Save snapshot | Share packet | Inspect trust layer | — |
| `/demo/employer` | Check a clinician's readiness | View demo packet · Print packet | — | Start a pilot |
| `/pilot` | Start a pilot | — | — | — |
| `/trust` | Inspect trust layer | — | — | — |
| `/sign-in` | Sign in to continue | Look up a clinician without an account | — | — |
| `/sign-up` | Continue as <role> | — | I'm a verifier or auditor → trust | — |

### 5.3 Nav

`Passport · Trust · Pilot · Sign in` — four items, all nouns. "Demo" and "Contact" live in the footer. Logged-in nav swaps "Sign in" for the role workspace label.

---

## 6. Screen-by-screen recommendations

Each row uses Keep / Change / Add / Remove with a P0 / P1 / P2 priority.

### `/` — P0

- **Keep.** Calm aesthetic. Geist + Geist Mono. Footer trust links.
- **Change.** Replace four hero CTAs with one NPI input. Demote "Contact" to footer. Hero h1 to the core product sentence.
- **Add.** Compact Proof Continuity Rail beneath the hero. *Why sign in?* microcopy.
- **Remove.** Logo wall implying universal acceptance. Any unhedged number. The word "Verified."

### `/passport?npi=…` — P0

- **Keep.** D55 truth-state register. PR #419 honest degraded states. Per-lane source attribution and last-checked.
- **Change.** Promote rail above the fold. Replace any "Verified" badge with `SOURCE-BACKED` + "Institution review required" line.
- **Add.** Lane-level Inspect drawer with `runId` / `lineageKey` / receipt / replay. One primary CTA below rail: **Save snapshot**.
- **Remove.** Any red used for "unavailable" or "not connected". Any aggregate "completion %" score. Any "approve" language.

### `/launch` (if present) — P2

- Internal-only. Add `INTERNAL · DEMO` banner. Remove from public nav.

### `/demo`, `/demo/clinician`, `/demo/employer`, `/demo/issuer` — P0

- **Keep.** Role-segmented routes. Sample NPI.
- **Change.** `DEMO ONLY` chip on every demo route. Tray copy: *"Illustrative — not a customer outcome."*
- **Add.** "Start a pilot" exit affordance. "Print packet" affordance.
- **Remove.** Any unhedged ROI number. Any "Verified" word. Any live-ticker UI.

### `/pilot` — P1

- **Keep.** Existing intake fields and operator workspace.
- **Change.** Hero: *"Start a pilot with your committee in the loop."* Replace "deployment" with "engagement."
- **Add.** Short Proof Continuity Rail preview at top. Institution-review disclosure line.
- **Remove.** HIPAA / SOC2 / NCQA badges that aren't currently attested. Any "approve clinician" language.

### `/trust` — P0

- **Keep.** Monospace reading mode. Receipt / replay primitives. Truth-state register link.
- **Change.** Lead with the attestation-boundary statement. Then the rail in Inspect mode.
- **Add.** Single "Keys" entry surfacing JWKS / DID (per 11.6). A "How to cite a finding" mini-page.
- **Remove.** Marketing copy. Hero ROI numbers. Any cryptographic-finality phrasing.

### `/trust/attribution` — P1

- **Keep.** Per-source attribution rows with timestamp and tier (T1–T4).
- **Change.** Adopt the rail token vocabulary so rows agree visually with Passport lanes.
- **Add.** "Boundary" callout per source: what the authority does and does not assert.
- **Remove.** Any inferred "trust score" that is not directly evidenced.

### `/status` (if present) — P2

- **Keep.** Per-source uptime rows when evidence exists.
- **Change.** Anchor every state to a timestamp. Replace "Live" with "Checked &lt;time&gt; ago" if no real-time event source exists (open question 11.7).
- **Add.** "Why does this matter?" line for non-technical visitors: *"When a source is down, your readiness is not adverse — it's pending."*
- **Remove.** Animated heartbeats / pulses untied to real events in the last 60s.

### `/contact` — P2

- **Keep.** Direct contact, plain form.
- **Change.** Make it a footer link, not a primary CTA. Trim form to three fields.
- **Add.** A line directing employers to `/pilot` and verifiers to `/trust` before contacting.
- **Remove.** "Talk to sales" framing. Newsletter sign-up.

### `/sign-in` — P0

- **Keep.** Existing auth provider integration (config out of scope).
- **Change.** Page title to *"Sign in to continue."* Surface *why-sign-in* microcopy directly under the form.
- **Add.** Secondary link "Look up a clinician without an account." Replace `Authentication failed` with the §4 microcopy.
- **Remove.** Wallet / blockchain phrasing.

### `/sign-up` — P0

- **Keep.** Email + SSO via existing provider.
- **Change.** Insert the three role tiles above the form. Selecting one rewrites the form's "what happens next" line and the post-login destination.
- **Add.** Quiet verifier link. One-line disclosure that VitalCV does not replace institution review.
- **Remove.** Tier / plan picker. "Get verified instantly" copy.

### Nav · footer — P1

- **Keep.** Sticky black mono header. Footer trust + attribution links.
- **Change.** Nav: **Passport · Trust · Pilot · Sign in.** Footer adds explicit "VitalCV does not credential — institution review is required" line.
- **Add.** Logged-in nav swaps "Sign in" for role workspace label. Keyboard shortcut hint (`/`) to focus NPI input.
- **Remove.** "Demo" from main nav. "Contact" from main nav. Any badge in nav.

---

## 7. Truth-contract reminders (mirrored from §0)

- A source outage is **not** a clinician failure.
- "Verified" is not in our vocabulary.
- Final credentialing is the committee's decision, not ours.
- Any specific number on a demo surface needs the explicit hedge.
- Real-time language requires an actual real-time event source.

---

## 8. Copy replacement table

| Current / risky | Safer | Reason |
|---|---|---|
| `Get verified` | Check clinician readiness | Avoids "verified" entirely. |
| `Become verified` | See what's source-backed | "Become" implies a status transition we don't grant. |
| `Verify instantly` | Source-backed in seconds where data is available | "Instant" + "verify" implies finality. |
| `Complete credentialing` | Reviewer-ready head start | Final credentialing is the committee's decision. |
| `Clear` / `Approve clinician` | Ready for institution review | We don't adjudicate. |
| `Accepted everywhere` | Carries to your next review | Universal acceptance is not our claim. |
| `Wallet ready` | Snapshot you can carry | Avoids crypto-first connotation. |
| `Blockchain login` | Sign in to save snapshot | Auth mechanism is not the value. |
| `Real-time monitoring` | Checked &lt;time&gt; ago · &lt;source&gt; | Claim only what's evidenced. |
| `HIPAA / SOC2 / NCQA certified` | *omit unless evidenced and current* | Certification needs live attestation. |
| `Authentication failed` | "Sign-in didn't go through. Your snapshot is safe." | Operational tone, reassure nothing was lost. |
| `Incomplete profile` | "Some lanes still need institution review." | Avoids judgmental framing. |
| `Missing data` | "This lane is not connected in this build." | Build state ≠ clinician deficiency. |
| `Source error` | "Source temporarily unavailable. Nothing has been marked adverse." | Operational tone, protect clinician. |
| `Verified by VC 2.0 / SD-JWT / OID4VP` | "This packet can travel to the next review." | Lead with benefit; standards live on `/trust`. |
| `DID-first identity` | "A portable identity you control." | Translate protocol into experience. |
| `Cryptographic finality` | "This reading can be re-run and re-checked." | Replay is reproducibility, not closure. |
| `ROI · 38% faster onboarding` | "Illustrative market benchmark — not a customer outcome." | Demo numbers always hedged. |
| `Start free` | Start with an NPI | Pricing copy signals wrong product. |
| `Continue` (bare) | Continue to Passport · Continue to review | Always name destination. |

---

## 9. Open questions

Only questions that affect a design decision in this wave.

1. Does `/issuer` exist publicly today, or should the issuer tile on `/sign-up` route to a private intake until it ships?
2. Should the rail on `/` be wired to demo NPI `1699264564`, or to a randomized sample to avoid implying a real clinician?
3. Six lanes (as mocked) or four (Known / Gated / Missing / Unavailable) on smaller surfaces? **Recommend six on `/passport`, four on `/` hero.**
4. Surface tier (T1–T4) in the primary lane chip, or only inside Inspect? **Recommend Inspect-only.**
5. Keep nav word `Pilot` (current product equity) or change to `Engage`? **Recommend `Pilot`.**
6. Expose JWKS / DID on `/trust` today, or gate behind a `Keys` sub-route until cryptographic surfaces are stable post-PR #420?
7. Is there a real-time event source in production? If not, "Live" indicators must become timestamps everywhere this wave.
8. Printable packet export this wave, or hold for D57? **Recommend print-stylesheet pass on `/passport` and `/demo/employer` only.**
9. Keyboard shortcut to focus NPI input: `/`, `n`, or both? **Recommend `/`.**
10. Should the Tweaks panel pattern from earlier waves appear on these surfaces? **Recommend internal-only for now.**

---

## 10. Related

- Implementation handoff: [`../ops/role-auth-ux-implementation-brief.md`](../ops/role-auth-ux-implementation-brief.md)
- Doctrine: [`zenlike-ui-doctrine.md`](./zenlike-ui-doctrine.md)
- Source design report: `VitalCV Calm Wave D56 Design Report.html` (project root)
- Truth-state backbone: `VitalCV Passport Truth-State Spec.html` (D55)
