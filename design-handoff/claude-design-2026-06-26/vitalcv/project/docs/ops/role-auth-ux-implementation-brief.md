# Role, Auth & Interoperability — Implementation Brief

**VitalCV · Design Wave D56 · Implementation handoff**
Status: **docs-only handoff**. No code changes in this wave.
Branch target: `docs/ux-role-auth-interoperability-spec`
Source design: [`../design/role-auth-interoperability-ux.md`](../design/role-auth-interoperability-ux.md) · [`../design/zenlike-ui-doctrine.md`](../design/zenlike-ui-doctrine.md)

---

## 0. What this document is

This is the implementation checklist a later code wave will follow. **No implementation in this wave.** No UI changes. No route/component changes. No backend, auth, Clerk, Railway, DNS, env, or secrets touched.

The next wave's PR description should reference this file by path.

---

## 1. Pre-flight (read-only)

Before opening any implementation PR:

- [ ] Re-read [`../design/role-auth-interoperability-ux.md`](../design/role-auth-interoperability-ux.md) end-to-end.
- [ ] Re-read [`../design/zenlike-ui-doctrine.md`](../design/zenlike-ui-doctrine.md) §0–§8.
- [ ] Open `VitalCV Calm Wave D56 Design Report.html` (project root) for visual reference.
- [ ] Confirm PR #419 (Passport honest degraded states) is still live.
- [ ] Confirm PR #420 (truth-state backend patch) status — required to **not** block this wave, but state lanes that depend on it should be tagged accordingly.
- [ ] Confirm the delightful-essence API build gap state — surfaces affected should render under §3 degraded states.

---

## 2. Components & routes to inspect (read-only first)

| Concern | Files / routes |
|---|---|
| App shell + landing | `app.jsx`, `view-home.jsx` |
| Passport | `view-passport.jsx`, `VitalCV Passport Truth-State Spec.html` (D55) |
| Trust / verifier | `view-dossier.jsx`, `wave18-verify.jsx`, `wave23-verify-v2.jsx` |
| Employer | `view-employer.jsx` |
| Activation / sign-up | `view-activation.jsx`, `view-activation-v2.jsx`, `data-activation*.jsx` |
| Tokens | `tokens-v2.css`, `primitives.jsx`, `components-shared.jsx` |
| Demo | `Founder Demo Hub.html`, demo branch of `view-employer.jsx` |
| Onboarding map | `Onboarding IA Map.html` |
| Existing trust language | `Trust Language System.html`, `Bounded Confidence Semantics.html`, `Degraded State Semantics.html` |

No edits in this wave. Just orient.

---

## 3. Implementation checklist (later wave)

### 3.1 Front door (`/`) — P0

- [ ] Collapse the four hero CTAs into one NPI input + `Check clinician readiness`.
- [ ] Add secondaries: `View demo packet` (ghost) and `Inspect trust layer` (muted).
- [ ] Move `Sign in` to nav only.
- [ ] Autofocus the NPI input on load.
- [ ] Bind `/` keyboard shortcut to focus the NPI input from any surface.
- [ ] Mount the Proof Continuity Rail (compact 4-lane mode) below the hero.
- [ ] Add `Why sign in?` microcopy block per [role-auth §1.4](../design/role-auth-interoperability-ux.md#14-why-sign-in-microcopy).
- [ ] Remove any logo wall implying universal acceptance.
- [ ] Remove any unhedged number.
- [ ] Apply copy table from role-auth §8.

### 3.2 Proof Continuity Rail (net-new shared component) — P0

- [ ] Define the seven primary state tokens per [doctrine §6](../design/zenlike-ui-doctrine.md#6-state-token-system).
- [ ] Lane data shape: `source`, `sub-label`, `state`, `checkedAt`, `accessRequirement`, `evidenceType`, `tier`, `receiptAvailable`, `replayAvailable`, `attestationBoundary`, `mode`.
- [ ] Per-lane Inspect drawer with all technical identifiers (`runId`, `lineageKey`, `kid`, etc) hidden behind expansion.
- [ ] Aggregate tray: counts per state token + one primary action.
- [ ] Reusable across `/`, `/passport`, `/demo/*`, `/trust`, employer view, printed packet.
- [ ] Print stylesheet variant for `/passport` and `/demo/employer`.

### 3.3 `/passport?npi=…` — P0

- [ ] Promote the rail above the fold.
- [ ] Replace any `Verified` badge with `SOURCE-BACKED` token + "Institution review required" line.
- [ ] Add lane-level Inspect drawer.
- [ ] One primary CTA below rail: `Save snapshot`.
- [ ] Remove any aggregate "completion %" score.
- [ ] Remove any red used for non-adverse states.
- [ ] Apply all degraded-state microcopy from role-auth §4.

### 3.4 `/sign-in` — P0

- [ ] Page title: `Sign in to continue.`
- [ ] Surface `Why sign in?` microcopy directly under the form.
- [ ] Add secondary link: `Look up a clinician without an account` → `/`.
- [ ] Replace `Authentication failed` with the §4 reassurance copy.
- [ ] **Do not** modify Clerk configuration.

### 3.5 `/sign-up` — P0

- [ ] Insert the three role tiles above the auth form.
- [ ] Selecting a tile rewrites the form's "what happens next" line and pins post-login destination.
- [ ] Quiet fourth link for verifiers → `/trust`.
- [ ] One-line institution-review disclosure.
- [ ] Remove any tier / plan picker.
- [ ] Remove `Get verified instantly` copy.

### 3.6 `/demo`, `/demo/clinician`, `/demo/employer`, `/demo/issuer` — P0

- [ ] Mount `DEMO ONLY` chip in the header strip of every demo route.
- [ ] Tray copy: *"Illustrative market benchmark — not a customer outcome."*
- [ ] Add `Start a pilot` exit affordance.
- [ ] Add `Print packet` affordance.
- [ ] Hedge every ROI number.
- [ ] Remove any live-ticker UI.

### 3.7 `/pilot` — P1

- [ ] Hero: *"Start a pilot with your committee in the loop."*
- [ ] Add short rail preview at top.
- [ ] Add institution-review disclosure line.
- [ ] Remove HIPAA / SOC2 / NCQA badges not currently attested.
- [ ] Remove `approve clinician` language.

### 3.8 `/trust` — P0

- [ ] Lead with the attestation-boundary statement.
- [ ] Render rail in Inspection mode (drawer expanded by default).
- [ ] Add a `Keys` sub-entry for JWKS / DID (per open question 9.6).
- [ ] Add a `How to cite a finding` mini-page.
- [ ] Remove marketing copy and ROI numbers.

### 3.9 `/trust/attribution` — P1

- [ ] Adopt rail token vocabulary on attribution rows.
- [ ] Add per-source `Boundary` callout.
- [ ] Remove any inferred "trust score" not directly evidenced.

### 3.10 `/status` (if present) — P2

- [ ] Anchor every state to a timestamp.
- [ ] Replace `Live` with `Checked <time> ago` unless a real-time event source is wired (open question 9.7).
- [ ] Add a non-technical "Why does this matter?" line.
- [ ] Remove animated heartbeats / pulses untied to real events.

### 3.11 `/contact` — P2

- [ ] Demote to footer.
- [ ] Trim form to three fields.
- [ ] Add routing line to `/pilot` and `/trust`.
- [ ] Remove sales / newsletter framing.

### 3.12 Nav / footer — P1

- [ ] Nav becomes **Passport · Trust · Pilot · Sign in**.
- [ ] Move "Demo" and "Contact" to footer.
- [ ] Logged-in nav swaps `Sign in` for role workspace label.
- [ ] Footer adds explicit non-credentialing disclosure.
- [ ] Remove any badge in nav.

### 3.13 Post-login routing — P1

- [ ] Compute landing from the role tile chosen at sign-up.
- [ ] Clinician → `/passport` (NPI prefilled). Employer → `/demo/employer`. Issuer → `/issuer`. Verifier → `/trust`.

### 3.14 Motion pass — P1

- [ ] Standardize transitions at 320 ms (range 280–420 ms).
- [ ] Easing `cubic-bezier(.2, .7, .2, 1)`.
- [ ] Remove looping pulses on idle surfaces.
- [ ] Remove `Live` indicators not tied to a real event in the last 60 s.

### 3.15 Global copy lint — P0

- [ ] Apply [role-auth §8 copy table](../design/role-auth-interoperability-ux.md#8-copy-replacement-table) verbatim across all surfaces.
- [ ] The strikethrough column must not appear anywhere in shipped product.

---

## 4. Truth-contract constraints (non-negotiable)

These constraints are restated in every doc; if there is a conflict, this list wins.

- **No backend changes** in this wave or its implementation wave's first pass. No Railway, DNS, env vars, secrets, Clerk config, Prisma, API routes, or deploy settings touched.
- **No new product claims.** No HIPAA / SOC2 / NCQA / universal acceptance / real-time monitoring claims unless evidenced and current.
- **No banned phrases ship.** Bare `Verified`, `Get verified`, `Verify instantly`, `Cleared`, `Approve clinician`, `Complete credentialing`, `Instant credentialing`, `Accepted everywhere`, `HIPAA compliant`, `SOC2 certified`, `NCQA certified`, `Wallet ready`, `Blockchain login` — none ship.
- **Backend-independent.** Every UI/copy change must render correctly whether the source returns source-backed, pending, gated, unavailable, or demo data.
- **No merges of implementation in this wave.** This file is docs-only handoff.

---

## 5. Design QA (run before merging the implementation wave)

| Test | Pass criteria |
|---|---|
| Visual snapshot · `/` | Exactly one primary CTA, two secondaries, one nav-level sign-in. NPI input focused on load. |
| Visual snapshot · `/passport` | Rail above the fold. No red on non-adverse lane. Disclosure line visible. |
| Degraded-state QA · `/passport` | Force source 503, lane not connected, access required, snapshot stale, demo mode. Each renders the role-auth §4 token + copy. Never the word "Verified". Never red on non-adverse. |
| Copy lint · global | Grep against role-auth §8 strikethrough column. Any hit fails QA. Audit `/`, `/passport`, `/demo/*`, `/pilot`, `/trust`, `/status`, `/contact`, `/sign-in`, `/sign-up`. |
| Role landing · `/sign-up` | Each tile pins the correct post-login destination. "What happens next" line updates on selection. |
| Motion QA | No looping animation persists past 1 s on idle. All entrance transitions ∈ 280–420 ms. |
| Accessibility · contrast | State tokens meet WCAG AA on `--paper`. Tab order: NPI input → primary CTA → secondaries → nav. |
| Disclosure presence | Every readiness surface carries the institution-review line. Every demo surface carries the illustrative hedge. `/trust` carries the attestation boundary. |

---

## 6. Banned-phrase grep (for docs)

The docs in this wave may list banned phrases inside "avoid" tables — that is expected and acceptable. They must not appear as VitalCV claims anywhere in product or marketing copy.

Run, from repo root:

```sh
git grep -nE "verified|cleared|approved|complete credentialing|instant credentialing|accepted everywhere|HIPAA compliant|SOC2 certified|NCQA certified" -- docs/
```

Each result must be inside an "avoid" / "banned" / "do not ship" / "current / risky" context. Anything else is a violation.

---

## 7. Recommendation for next wave

Proceed to implementation wave on this design alone. Do not wait for backend.

- **Highest leverage atoms** (ship first): copy lint (3.15), Proof Continuity Rail component (3.2), `/` front door (3.1), `/sign-up` role tiles (3.5).
- **Second pass:** `/passport` rail promotion (3.3), `/sign-in` and post-login routing (3.4, 3.13), demo `DEMO ONLY` chips (3.6).
- **Third pass:** `/trust` and `/trust/attribution` (3.8, 3.9), `/pilot` (3.7), nav/footer (3.12), motion pass (3.14).
- **Fourth pass:** `/status` and `/contact` (3.10, 3.11).

Re-QA against §5 after each pass.

---

## 8. Open questions (carry from role-auth §9)

These must be resolved before, or at the start of, the implementation wave. They do not block this docs wave.

1. Is `/issuer` a public route, or private intake until it ships?
2. Demo NPI on `/`: `1699264564` or randomized sample?
3. Rail lane count on smaller surfaces: 6 or 4? (Recommend 6 on `/passport`, 4 on `/`.)
4. Tier (T1–T4) on primary chip or Inspect-only? (Recommend Inspect-only.)
5. Keep nav word `Pilot` or change to `Engage`? (Recommend keep.)
6. JWKS / DID on `/trust` now, or behind a `Keys` sub-route post-PR #420?
7. Is a real-time event source wired? If not, replace `Live` with timestamps.
8. Printable packet this wave or D57? (Recommend print-stylesheet only.)
9. NPI focus shortcut: `/`, `n`, or both? (Recommend `/`.)
10. Tweaks panel on these surfaces? (Recommend internal-only.)

---

## 9. Related

- Design source: [`../design/role-auth-interoperability-ux.md`](../design/role-auth-interoperability-ux.md)
- Doctrine: [`../design/zenlike-ui-doctrine.md`](../design/zenlike-ui-doctrine.md)
- Visual spec: `VitalCV Calm Wave D56 Design Report.html` (project root)
- Truth-state backbone: `VitalCV Passport Truth-State Spec.html` (D55)
