# Claude Design Handoff Index — claude-design-2026-06-26

**Bundle:** `vitalcv-handoff-6-26-26.zip` (exported from claude.ai/design 2026-06-27), mounted at
`design-handoff/claude-design-2026-06-26/`. **Ingested:** 2026-07-02.
**Per the bundle README:** the primary design is `vitalcv/project/wave1400/index.html`; it and every
file it imports were read in full. This index is the committed ingestion artifact required by
[design-lineage-policy.md](design-lineage-policy.md).

## Totals

- **650 files** (README + 649 under `vitalcv/project/`)
- By type: 283 `.jsx` · 154 `.html` · 120 `.png` · 46 `.js` · 22 `.css` · 13 `.tsx` · 6 `.md` · 2 `.ts`
- ~101 top-level design documents in `vitalcv/project/`, plus 27 subprojects

## Top-level folder map

| Folder | Files | What it is |
| --- | --- | --- |
| `project/` (root files) | ~101 | Named design documents: D44–D57 visual-system lineage, W215–W278 system designs, trust/verifier surfaces, QA protocols |
| `wave1400/` | 11 | **Primary handoff target** — Healthcare Operations Engine (5 surfaces, store, data, primitives, icons) |
| `wave600/`, `wave1000/`–`wave1300/` | 3–15 each | Platform-layer wave designs — wave600 Trust Infrastructure narrative, wave1000 Career Platform, wave1100 Knowledge Graph, wave1200 Reasoning Engine, wave1300 Workforce OS (see Subproject survey) |
| `career/`, `career-os/`, `career-wallet/` | 9/17/10 | Clinician career-surface prototypes |
| `cloud/`, `eco/`, `exchange/`, `platform/`, `solutions/` | 8–14 each | Platform/ecosystem surfaces |
| `opportunity-network/`, `recruiter/`, `org-os/`, `organization-graph/`, `workspace-graph/` | 9–11 each | Employer/org-side prototypes |
| `vitalcv-app/`, `vitalcv-web/`, `experience/`, `screens/` | 3–35 each | App shell / web prototypes |
| `qa-pass/` (41), `screenshots/` (32), `uploads/` (145), `docs/` (3) | — | QA artifacts, captures, uploaded assets — reference material, not designs to implement |

## Primary design entrypoint

`vitalcv/project/wave1400/index.html` — "VitalCV · Healthcare Operations Engine" (dark `#0b0e13`
theme, Geist/Geist Mono, cyan `#34d8e8` accent, React 18 + Babel prototype).

### wave1400 imports (all read in full, in load order)

1. `w14-icons.jsx` — inline Lucide-language icon set (production equivalent: `lucide-react`)
2. `w14-data.jsx` — roles, team, 6 workspace archetypes with stage pipelines/SLAs, blocker taxonomy, 7 queue definitions, event taxonomy (incl. `recognition_updated`)
3. `w14-store.jsx` — append-only operational ledger (frozen events, monotonic `seq`), `Ops.*` actions that mutate + log, heartbeat
4. `w14-primitives.jsx` — Panel/Stat/Pill/Bar/priority scoring (P1–P3), hash router, workspace switcher, top chrome
5. `view-operations.jsx` — D1 `/operations` mission control (KPI strip, readiness bands, risk, mobility, pipeline funnel, compliance ring, staffing gaps, alerts rail, live feed)
6. `view-queues.jsx` — D2 intelligent work queues (impact/priority/recommended-action explainers)
7. `view-command.jsx` — D3 command center (filterable roster table + global record drawer: approve/resolve/escalate/advance/assign, every action writes an event)
8. `view-timeline.jsx` — D4 immutable event timeline (day-grouped chain, type/actor filters, "append-only · frozen on write", throughput spark)
9. `view-executive.jsx` — D5 executive view (five leadership questions answered from the same ledger)
10. `app.jsx` — hash router + chrome + `RecordDrawer` mount

**Production status:** ported to `/operations-engine` as a scoped `.w14` client island
(`apps/web/app/operations-engine/`, `components/ops-engine/**`, registered in
`OPS_SURFACE_PREFIXES`) — see memory `wave1400_ops_engine_port`. **Canonical and implemented.**

## Designs read in full during this ingestion

| File | What it specifies | Production counterpart |
| --- | --- | --- |
| `wave1400/*` (11 files) | Operations Engine, five surfaces | `/operations-engine` (implemented) |
| `Acceptance Proof.html` | **D11 employer accept moment**: tier ladder T1–T4, "Accept & record", the audit ledger-row that locks beneath the card ("no confetti, no green checks — the row is the proof"), inverted `ink-950` monospace register for signed artifacts; spec footer names `ReviewClient.tsx` | `/review/[entityId]` accept flow (`components/review/ReviewClient.tsx`, `EmployerDecisionConsole.tsx`) — implemented in spirit; ledger-row lock-in motion + tier rail not yet in production |
| `Verifier Reading Mode.html` | Public verifier page: verdict bar → provenance strip → issuer continuity → trust-first facts table → replay lineage; "We do not credential" footer doctrine | `/verify/[npi]` (`apps/web/app/verify/[npi]/page.tsx`) — implemented (verdict bar, ProvenanceStrip, IssuerContinuityPanel, ReplayChronologyPanel). The **Employer acceptances** section added by PR #487 is an addition beyond this design (consistent with its section grammar, not specified by it) |
| `Professional Memory System W225.html` | Career Event Architecture, Professional Memory Model, Career Timeline Experience, **Recognition System** (Professional Recognition Event: third-party conferred honors — "esteem conferred, not claimed", never self-asserted), Trust Through Time | `packages/domain-evidence` timeline stack + `/activity/[entityId]` — D1–D3/D5 implemented (Waves 220–228); **D4 PRE (conferred honors) NOT implemented** — the shipped `recognition` evidence class covers the employer Recognition→Acceptance→Start chain, not honors |

### Read in full during the #475–#483 audit (2026-07-02, second pass)

| File | What it specifies | Production counterpart |
| --- | --- | --- |
| `Clinician Start.html` | Clinician entry: "Verify your professional identity. Once. Reusable." — hospital-SSO primary CTA with "Start with my NPI" fallback, under-three-minutes framing, reassurance row (you stay in control / no passwords / no PHI), "why this matters" value card | `/get-ready` (PR #475) implements the NPI arm behind Clerk sign-in; the SSO-first arm is not implemented |
| `NPI Resolution D45.html` | Read-only federal-ledger register of a resolved NPPES record (§1 identity / §2 taxonomy / §3 enumeration + provenance / §4 address, source-truth receipt band; "no field is editable, derived, or interpolated") — the activation *preview* surface | No production register view; `/get-ready` success shows a summary only. The register grammar is available via the D57 `.vs-root` port |
| `Clinician Profile.html` | Read-only profile: identity hero + attest strip (resolved-at-source / subject ownership / replayable-until), licensure/employment/session fact lists, and the explicit "why this is read-only" doctrine — self-owned edits deferred to "Wave 06", never co-mingled with federal facts | `/clinician/profile` (PR #476) — implements the Wave-06 intent: federal identity read-only, self-attested fields editable and labeled |
| `opportunity-network/view-opp-detail.jsx` | D2 opportunity detail + D3 match explainer: "Why this opportunity?" three-column alignment (evidence / trust / timeline), readiness verdict strip, requirement blocks, "What closes the gap" recommendation cards, related roles | `/holder/opportunities/[id]` (PR #477) — same intent via the MATCHA explanation (band + score, fit reasons, blockers); the D3 alignment grid and gap-closer cards are not implemented |
| `docs/design/role-auth-interoperability-ux.md` + `docs/ops/role-auth-ux-implementation-brief.md` | D56 role/auth/interop spec: sign-up role tiles, post-login routing per role, "why sign in" microcopy, Proof Continuity Rail, degraded-state microcopy table, copy-replacement table, per-surface P0–P2 implementation checklist | Not implemented as specced; the routes it names predate the current holder IA. Standing candidate spec for auth surfaces — apply the concepts, not the literal routes |

## Relevant product concepts found (bundle-wide)

Employer acceptance as a signed ledger row (D11) · tier ladder T1–T4 · verifier reading mode
(30-second audit pass) · issuer continuity / DID / status lists · replay lineage + RFC 3161
anchoring · Professional Recognition Event (conferred honors) · career event architecture &
professional memory · trust propagation (W222) · career evidence graph (W220/W221) · career
mobility (W230) · reputation engine (W235) · operations ledger with immutable events (W1400) ·
degraded-state & bounded-confidence semantics · trust language / visual grammar canons ·
pilot intake & operator workspace · readiness report · clinician activation flow · Not-PHI band ·
source health inspection.

## Design → production mapping (top-level documents)

**Canonical + implemented** (design ↔ live route/package):

- `wave1400/*` → `/operations-engine` (Wave 1400 port)
- `Verifier Reading Mode.html` → `/verify/[npi]`
- `Acceptance Proof.html` → `/review/[entityId]` accept flow (partial — see gaps)
- `Career Evidence Foundation W215.html` / `Career Evidence Graph W220.html` / `Evidence Graph
  Projector W221.html` / `Trust Propagation Engine W222.html` / `Professional Memory System
  W225.html` (D1–D3/D5) / `System Canonization W228.html` → `packages/domain-evidence` +
  `/api/evidence|graph|timeline/[entityId]` + `/activity/[entityId]` (Waves 215–228, commit
  `0dad066c0`)
- `Readiness Report.html` → `/holder/readiness` (`ReadinessSurface`)
- `Clinician Profile.html` → `/clinician/profile`
- `Clinician Activation.html` + `Clinician Activation Processing.html` + `Clinician Activation
  Success.html` → `/get-ready` → `/onboarding` activation flow (three states of one canonical flow)
- D44–D56 visual-system lineage (`Why VitalCV D44`, `NPI Resolution D45`, `Trust Directory D46`,
  `Antigravity Verifier D47`, `Timeline Matrix D48`, `Claim Profile D49`, `Source Health Inspector
  D50`, `Not-PHI Band D51`, `Audit Ledger D52`, `Specialty ROI D53`, `Identity Hook D54`,
  `Verifier Sightline D55`, `VitalCV Calm Wave D56 Design Report`, `Wave Stack D44-D55`) →
  D57 visual system port (`.vs-root` namespace, `components/visual/`, PR #431)
- `Source Health Panel.html` → source-health surfaces (`unavailableLane` + panels)
- `Pilot Intake.html` / `Pilot Operator Workspace.html` / `Pilot Deployment Kit.html` → `/pilot`
  + pilot ops surfaces
- wave600/1000–1300 dirs → platform layer stack `/trust-exchange`-era PRs #458–#464 (Trust
  Exchange, Trust Cloud, Career Platform, Knowledge Graph, Reasoning Engine, Configurable
  Platform)

**Superseded** (kept for lineage, do not implement):

- `Clinician Activation v1.html` → superseded by `Clinician Activation.html`
- `Pilot Intake v1.html` → superseded by `Pilot Intake.html`
- `PR-B Crypto Verifier Superseded.html`, `PR-B Crypto Verifier Superseded v2.html` → explicitly
  superseded (HS256 path banned; ES256 stack #203+#204 shipped). `PR-B Crypto Receipt Verifier
  Decision.html` is the canonical decision record.
- `Institutional Trust Surface.html` → superseded by `Final Institutional Trust Surface.html`
- `Why VitalCV D44.html` → superseded by `Why VitalCV.html`

**Duplicates / variants:**

- `Why VitalCV-print.html` (print variant of `Why VitalCV.html`)
- `VitalCV.html` (early one-pager, overlaps `VitalCV Product Design Direction.html`)
- `data-*-v2.jsx` vs `data-*.jsx` pairs in `project/` root (v2 supersedes v1 fixtures)

**Deferred** (designed, intentionally not yet scheduled):

- `Professional Reputation Engine W235.html` (reputation summary exists in `timeline.ts`; full
  engine deferred)
- `Career Mobility Engine W230.html` (mobilityImpact exists per-event; engine surface deferred)
- `Platform Integration W278.html`
- `Founder Demo Hub.html`, `Executive Share.html`
- subprojects `career-os/`, `career-wallet/`, `org-os/`, `organization-graph/`,
  `workspace-graph/`, `exchange/`, `eco/`, `cloud/`, `solutions/` — prototype suites beyond the
  current wedge (entry-file survey below; per-file deep audits still pending). `opportunity-network/`
  left this list 2026-07-02: its D2 detail view is partially implemented by PR #477

**Not yet implemented** (design exists, no production counterpart):

- `Professional Memory System W225.html` **D4 — Professional Recognition Event** (third-party
  conferred honors as first-class evidence; distinct from the employer acceptance chain)
- `Acceptance Proof.html` ledger-row lock-in motion + T1–T4 tier rail on the accept surface
- `Verifier Replay.html` full replay surface as designed (production has ReplayChronologyPanel)
- `Trust State Visual System.html` inverted-register grammar for signed artifacts (partially
  present; not systematized)
- `Onboarding IA Map.html`, `Continuity Navigation System.html` /
  `Institutional Continuity Navigation.html`, `Institutional Calmness System.html`,
  `Human Trust Surface.html`, `Institutional Receipt.html`, `Institutional Replay Ledger.html`

**QA / process documents (reference, not designs):** `VitalCV QA Plan.html`, `VitalCV Railway QA
Protocol.html`, `VitalCV Re-QA Precondition Gate.html`, `VitalCV Live QA Report.html`,
`VitalCV Visual QA.html`, `Wave Operating Stack.html`, `Wave Skill Merge Card.html`,
`Repo State Sync.html`, `Repo State Visibility System.html`, `Product Topology Map.html`,
`Runtime *.html`, `Operational *.html`, `Failure Taxonomy.html`, `Degraded State Semantics.html`,
`Bounded Confidence Semantics.html`, `Receipt Reading Doctrine.html`, `Trust Language System.html`,
`Visual Grammar Canon.html`, `Institutional Trust Canon.html`.

## Subproject survey (entry-file level, 2026-07-02)

Second-pass survey: each subproject's entry file and view inventory were read. This is thinner
than a full read of every file — do not cite a specific screen from these suites as design
authority without opening it.

| Subproject | Entry / wave | Concept · persona | Production status |
| --- | --- | --- | --- |
| `experience/` | `VitalCV Experience.html` · w400 | Flagship "operating system for healthcare careers" landing · marketing | Not implemented; the live homepage (`HomePageClient.tsx`) is not derived from it |
| `solutions/` | `VitalCV Solutions Platform.html` · w700 | Role-based solutions hub (clinicians / recruiters / health systems / staffing / med schools) · marketing | Not implemented |
| `exchange/` | `Trust Exchange.html` · w800 | Trust network with issuer + verifier portals · org/ops | Platform layer shipped (PR #458); the portals are not implemented |
| `cloud/` | `VitalCV Trust Cloud.html` · w900 | Trust Cloud: ecosystem directory, trust fabric, marketplace, platform status · org/ops + marketing | Platform layer shipped (PR #459); subpages not implemented |
| `eco/` | `VitalCV Ecosystem.html` · w300 | Career ecosystem: career OS home, career map, activity, network · clinician | Corresponds to the live workspace career cluster (`/activity`, `/career-map`, `/network`); per-view parity unaudited |
| `career/` | `Career Intelligence.html` · w320 | Insights / actions / goals / notifications engine · clinician | Corresponds to `/career-intelligence`; per-view parity unaudited |
| `career-os/` | `index.html` · w245 | Career OS: standing, memory, mobility, reputation · clinician | Not implemented; overlaps `/holder` hub concepts |
| `career-wallet/` | `Career Wallet.html` | Wallet: home / evidence / timeline / trust / share · clinician | Concept overlaps the live `/holder` wallet; the prototype is not its source |
| `opportunity-network/` | `Opportunity Network.html` | Opportunity home / detail / recommend / growth · clinician | D2 detail partially implemented (PR #477); home / recommend / growth deferred |
| `recruiter/` | `Recruiter OS.html` · w320-era | Discovery / readiness / review / search / workspace · recruiter | Not implemented |
| `org-os/` | `Organization OS.html` | Org dashboard, provider directory, hiring, workforce, analytics · employer | Not implemented |
| `organization-graph/` | `Organization Graph.html` | Organization ↔ professional relationship graph · org analyst | Not implemented |
| `workspace-graph/` | `Workspace Graph.html` | Person ↔ workspace ↔ organization ↔ opportunity graph · shared | Not implemented |
| `platform/` | `VitalCV Platform.html` | Developer portal: keys, webhooks, embeds, status · developer | Not implemented |
| `wave600/` | `VitalCV - Trust Infrastructure.html` | Category narrative: career graph + five product tiers · marketing | Narrative source for the platform-layer stack; no single route |
| `wave1000/`–`wave1300/` | `index.html` each | Career Platform / Knowledge Graph / Reasoning Engine / Workforce OS · platform | Platform layers shipped (PRs #460–#463); prototype views not ported 1:1 |
| `vitalcv-web/` | Next.js drop-in (README + `app/(trust)/*`) | Five trust surfaces as real TSX: passport, verify, replay, receipt, trust register | Production built its own equivalents — treat as reference, do not copy in |
| `vitalcv-app/` | static HTML + `qa-shots/` | Public-surface mockups (landing, sign-in/up, status, passport, trust, attribution) | QA reference |
| `uploads/vitalcv-handoff (1)/` | nested prior bundle (~140 files) | The previous handoff iteration, hash-suffixed files | Supersession record — never implement from it |
| `docs/` (in-bundle) | `zenlike-ui-doctrine.md` + D56 role-auth pair | UI doctrine + role/auth/interop spec | Doctrine reference; the D56 pair was read in full (see #480/#481 audit) |

## Audit depth (honesty note)

Read in full this ingestion: the bundle README, `wave1400/index.html` + all 10 imports, and 4
recognition-adjacent designs (`Acceptance Proof`, `Verifier Reading Mode`, `Professional Memory
System W225` in structure + D4 in full, `Career Evidence Graph W220` headings). Second pass
(2026-07-02, the #475–#483 audit): `Clinician Start.html`, `NPI Resolution D45.html`,
`Clinician Profile.html`, `opportunity-network/view-opp-detail.jsx`, and the in-bundle D56 pair
(`docs/design/role-auth-interoperability-ux.md`, `docs/ops/role-auth-ux-implementation-brief.md`)
read in full; every subproject surveyed at entry-file level (table above). Everything else is
inventoried by name and mapped from known production state; per-file deep audits of the remaining
root documents and subproject internals are follow-up work. Do not cite a file from the
unaudited set as design authority without reading it first.

## Golden-path PRs #475–#483 — design audit result (2026-07-02)

None of the nine PRs cited a handoff file: all merged 2026-07-02 02:04–02:49 UTC, before the
lineage policy landed on main (#489, 04:58 UTC). That is honest history, not a violation — the
policy applies to PRs opened after it. Post-ingestion findings, per PR:

- **#475 (`/get-ready` NPI binding):** the bundle designs this entry. `Clinician Start.html` is
  the entry surface (SSO-first CTA + "Start with my NPI" fallback, reassurance row); the
  `Clinician Activation*.html` trio (inventoried, not re-read this pass) is the flow;
  `NPI Resolution D45.html` is the read-only register of the resolved record. Production
  implements the NPI arm behind Clerk sign-in. Intentional deviation, sound: no hospital-SSO arm
  exists in production auth, so binding happens post-sign-in. Gap worth scheduling: D45's
  resolved-record register — the production success state is a summary, while the design's
  "no field is editable, derived, or interpolated" register is stronger.
- **#476 (`/clinician/profile` live profile):** `Clinician Profile.html` applies and was read in
  full. The design is explicitly read-only and defers self-owned edits to "Wave 06" with the rule
  that they are never co-mingled with federal facts. #476 implements that intent without having
  seen it: federal identity stays NPPES-sourced and read-only; edits are limited to self-attested
  fields, each labeled. Deviations to note in any follow-up: production separates by provenance
  labeling on one surface rather than the design's strict facts-only register, and the attest
  strip (resolved-at-source / subject ownership / replayable-until) is not implemented.
- **#477 (`/holder/opportunities/[id]` role detail):** `opportunity-network/view-opp-detail.jsx`
  (D2/D3) applies and was read in full. Production covers the same explainer intent through the
  MATCHA explanation (band + score, fit reasons, blockers with actions) and reuses the tested
  ApplyModal. Not implemented from the design: the three-column evidence/trust/timeline alignment
  grid, readiness ring, "What closes the gap" recommendation cards, related-roles strip.
  Reclassified: `opportunity-network/` D2 is now partially implemented (was wholesale "deferred").
- **#478 (demo 404-gating):** no handoff file applies — truth hardening that narrows what can
  render. The demo pages' design lineage (`Clinician Activation Processing.html`) is unchanged.
- **#479 (`/holder/timeline` wiring):** no handoff file designs the holder→timeline edge; the
  destination `/activity/[entityId]` is already governed by `Professional Memory System W225.html`
  D3. Any future holder-facing timeline UI should read W225 first.
- **#480 (`/holder/settings`):** no handoff file designs a settings surface. Closest material —
  read in full this pass — is the in-bundle D56 pair
  (`docs/design/role-auth-interoperability-ux.md`, `docs/ops/role-auth-ux-implementation-brief.md`):
  sign-up role tiles, post-login routing, "why sign in" microcopy, degraded-state copy. None of it
  specifies account / identity-binding / sharing settings, so #480 stands on its own.
- **#481 (retry banner + contextual not-found):** no direct design file. The degraded-state
  grammar it follows (system-state framing, never findings about the clinician; a retry
  affordance) is consistent with the D56 role-auth §4 microcopy table — the canonical reference
  for future degraded-copy alignment. Do not port that table verbatim without a truth-contract
  pass.
- **#482 (route-contract test), #483 (completion-map doc):** tooling/docs; no handoff file
  applies.

## Recognition Elevation PRs #484–#488 — design audit result

None of the five PRs was built from a handoff file (built before the bundle was available; each PR
body carries the required no-handoff line). Post-ingestion findings:

- **#484 (backend NPI read), #485 (home card), #486 (detail surface):** no handoff file specifies a
  clinician-side recognition record surface — no conflict, no source. Closest grammar:
  `Trust State Visual System.html` (signed-artifact register) for future alignment of acceptance
  entries.
- **#487 (share + verifier panel):** `/verify/[npi]`'s existing structure follows
  `Verifier Reading Mode.html`; the added acceptance section is consistent with its section grammar
  but is not in the design. `Acceptance Proof.html` governs the employer-side accept moment (not
  this PR's scope).
- **#488 (timeline merge, unmerged):** feeds real acceptance data into the system designed by
  `Career Evidence Graph W220.html` / `Professional Memory System W225.html` (D1–D3) — the
  projection stack those designs specify. The W225 D4 PRE (conferred honors) remains a separate,
  unimplemented concept and is NOT what #488 materializes.

Follow-up alignment candidates (each would cite its file): accept-moment ledger-row + tier rail
(`Acceptance Proof.html`) on `/review/[entityId]`; signed-artifact register for acceptance entries
on `/holder/recognition` and `/verify/[npi]` (`Trust State Visual System.html`); PRE as a future
evidence class (`Professional Memory System W225.html` D4); resolved-NPPES-record register on the
`/get-ready` success path (`NPI Resolution D45.html`); D3 match-alignment grid + gap-closer cards
on `/holder/opportunities/[id]` (`opportunity-network/view-opp-detail.jsx`); degraded-copy and
auth-surface alignment from the D56 pair (`docs/design/role-auth-interoperability-ux.md`).
