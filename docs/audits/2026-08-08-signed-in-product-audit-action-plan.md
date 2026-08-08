# Signed-in product audit and Claude Code action plan

**Date:** 2026-08-08
**Audited production:** `https://vitalcv.com` on Railway, commit `873542cbe40d0408263e0035fb31cc362cd498b0` (`873542c`, `main`)
**Scope:** public acquisition, authenticated clinician workspace, clinician profile, roles, applications, Recognition, Career Garden, and employer entry.
**Boundary:** This is a planning and audit document. It does not authorize weakening consent, packet immutability, source attribution, authorization, or audit behavior.

## Executive verdict

The public homepage has recovered its vertical composition and is materially closer to the intended clinician-first story. The most serious experience problem is now inside the signed-in product: the same clinician is offered several competing mental models—**Workspace, home, profile, Wallet, readiness, Garden, MATCHA, Recognition, share/prove, updates, and a five-step loop**—before a first useful action is complete.

This is not a visual-polish problem. It is an information-architecture and truth-boundary problem. The first execution sequence must simplify the clinician journey around one observable next action, remove production fixture/future-state leakage, and lock shared chrome before any large visual-system investment.

## Audit method and evidence boundary

This audit used the founder's existing authenticated clinician session and read-only production navigation. It did not submit forms, upload evidence, change any account data, or inspect browser credentials/storage. Findings are deliberately anonymous; no personal profile values are reproduced here.

### Confirmed live observations

| Surface | What was observed | Impact |
| --- | --- | --- |
| `/` | The public page is vertically composed. Header shows VitalCV, a quiet middle item, Sign in, one NPI CTA, and menu. The NPI action remains present. | The unwanted horizontal homepage is **not** current production behavior. Preserve this as a regression baseline. |
| `/holder/home` | The single screen presents a profile summary, readiness, Recognition, roles, profile completion, a next action, current role, MATCHA activity, a career graph, loop navigation, more readiness, blockers, proof metrics, applications, role cards, and an actions list. | The home has no dominant job-to-be-done. It reads as stacked dashboards rather than “what VitalCV did and what you should do next.” |
| `/holder/readiness` | An unlinked clinician sees a very sparse page: navigation, loop, “Add your NPI,” and a connect CTA. | The promised readiness explanation disappears precisely when the user needs it most; the home and the route tell different stories. |
| `/holder/opportunities` | A real role card, duplicate “continue application” treatment, refresh, and a broad support fallback are visible. | Role fit, what VitalCV has, what remains, and supported application are not primary on the first view. |
| `/holder/applications` | The empty state is concise and useful, but the global Updates count remains visible. | The count is visually stronger than the empty state and risks looking like user-facing work without explaining its meaning. |
| `/holder/recognition` | The page gives a truthful employer-decision boundary and NPI prerequisite. It repeats the global loop and contains much more explanatory copy than actionable state. | Strong truth language, but it should be a subordinate lifecycle state rather than one of many first-level destinations for a new clinician. |
| `/holder/garden` | Notes are private by default, but cards show “Sample — its wave is next” alongside account state. Garden, seeds/roots/branches/blooms/harvests, Cursor, and research vocabulary coexist. | Explicit labels prevent a false claim, but shipping examples/future states in the primary authenticated experience makes the product feel unfinished and splits focus from activation. |
| `/holder/matcha` | The route reports a high “tuned/learned” percentage and renders career preferences while the workspace cannot load a linked clinician record; blank numeric preferences render as literal zeroes. | MATCHA must distinguish self-reported preference completeness from evidence/readiness, scope data to the authenticated account, and render missing values as unknown—not zero. |
| `/holder` | The Wallet route honestly reports that no linked clinician record could be loaded. | This is the correct failure posture, but it contradicts richer upstream home/MATCHA state; resolve the shared-state contract rather than styling around the inconsistency. |
| `/clinician/profile` | The profile is a long 36-field form. It correctly distinguishes user-entered, inferred, and unknown information; it reports workspace lookup failure honestly. | The provenance policy is good. The experience is still a form-first editor with little task sequencing or progressive disclosure. |
| `/employers` | Employer marketing has credible boundaries: organization identity is not authority; a packet is consented; employer review remains decisive. | Strongest complete narrative outside the clinician home. It is still long and information-dense for an acquisition entry point. |

### Confirmed repository observations

| Evidence | Finding | Required response |
| --- | --- | --- |
| `apps/web/app/holder/layout.tsx`, `components/mobile/ClinicianHomeSurface.tsx`, `components/clinician/MobileBottomNav.tsx` | The authenticated shell is a “mobile” dashboard rendered at all breakpoints; its desktop home stacks many card systems. It uses high-radius cards, gradients, shadows, and pill-like status elements that conflict with the supplied Experience Overhaul program. | Establish one clinician shell and one navigation model in UX-03/UX-08. Do not reskin each card independently. |
| `apps/web/app/holder/readiness/ReadinessSurface.tsx` | The source contains a `buildDemoSnapshot()` fallback with a fabricated clinician identity and a comment that says it is for when no API is wired. | Treat this as P0 truth debt. Delete/contain it before redesign. Production must render live, unavailable, or empty state—never a demo identity. |
| `apps/web/components/holder/HolderSubNav.tsx` | A second legacy holder navigation exists in source with different labels from the current workspace navigation. | Inventory imports and retire/converge it; do not create a third navigation family. |
| Active route inventory | `apps/web/app` still exposes a broad mixture of current product, old holder/passport concepts, public marketing, developer, operational, issuer, review, and archived routes. | Produce route ownership/disposition before changing IA. Public navigation must not surface inactive/experimental/archived product paths. |
| `ClinicianMobileProvider.tsx` | The home uses cached dashboard and resume state. | Preserve only account-scoped, non-sensitive recovery behavior; test logout/account-switch/cache invalidation during the shell consolidation. |

### Not established by this audit

- Employer-only application review was not exercised because this session has a clinician persona.
- An actual NPI resolution, submission, sharing, packet read, or employer decision was not executed; those operations would change state and need a controlled test account.
- Desktop/mobile visual regression, reduced-motion composition, and keyboard paths were not fully run in production. They are mandatory gates below, not claimed as completed.

## Product decisions this plan makes explicit

1. **One clinician home:** `/holder/home` answers only: what changed, what VitalCV handled, what needs the clinician, and the single next action. Profile editing is never the home’s primary purpose.
2. **One navigation system:** clinician primary navigation is **Home, Profile, Roles, Updates**; Wallet/readiness, Recognition, sharing, MATCHA, and Workbench are contextual destinations, not simultaneous global peers. Final labels require the UX-01 verdict, but route ownership does not.
3. **One truthful activation sequence:** NPI → what was found → what remains → verify/approve → next action. No generic percentage, sample identity, or optimism before real state exists.
4. **One private thinking domain:** current Career Garden is the technical kernel. Customer language may become VitalCV Workbench only after the privacy, promotion, revision, and link contract is validated.
5. **One visual grammar:** enforce the existing “Profile in Motion” and hard-eyebrow contracts before scene production. No repeated cinema, graph wallpaper, stock clinicians, or autonomous success animation.

## Priority order and dependency map

```text
P0 truth containment + route census
  -> UX-00/UX-01 decision record
    -> UX-02 tokens + UX-03 eyebrow/shell
      -> UX-05 activation and UX-08 clinician home
        -> UX-09 jobs + UX-10 apply
          -> WB-01/WB-02 private Workbench contract
            -> visual scenes and secondary product polish
```

Do **not** start a Journey Film, Connections Map, broad card reskin, or visual Workbench shell until P0 and the shared-chrome gate are complete.

## Claude Code execution waves

Each wave is a separate branch/PR. Claude Code must read the cited source plan and current implementation before editing, preserve the existing auth/audit/provenance contracts, and stop at the stated gate.

### A0 — Production-truth containment and route disposition (P0)

**Goal:** remove any path by which production could render fabricated clinician/readiness content; establish one authoritative route map.

**Work**

1. Trace `ReadinessSurface` from `apps/web/app/holder/readiness/page.tsx`. Replace `buildDemoSnapshot()` and all demo limitations on product routes with one of: authenticated live data, honest unavailable state, honest empty/unlinked state, or a dev/test-only fixture under an explicit test boundary.
2. Add tests proving no production route serializes the demo name, NPI, or fabricated source result.
3. Inventory every non-`_archive` route under `apps/web/app`; classify it `public-current`, `authenticated-clinician`, `authenticated-employer`, `internal/guarded`, `developer`, `legacy-compatibility`, or `remove/redirect`. Record owner, canonical replacement, and test coverage in `docs/architecture/route-disposition.md`.
4. Identify every current navigation component and its imports: `RootChrome`, public Navbar, workspace switcher, mobile bottom nav, `HolderSubNav`, Garden navigation, profile header. Mark exactly one future owner for public and clinician chrome.
5. Verify production remains `873542c` or record the newer `/api/version` SHA in the PR evidence; never infer production from local main.

**Acceptance gate**

- No production demo identity, demo NPI, “sample” domain state, or fake source success in current clinician routes.
- Route disposition contains no active link into `_archive`.
- Unlinked NPI flow has an intentional screenshot and accessible DOM state.
- Targeted unit tests, `pnpm` type/lint checks, and a production browser check pass.

### A1 — Experience Constitution and UX-01 founder verdict (P0 prerequisite)

**Goal:** convert the supplied design briefs into one citable design authority before new UI is built.

**Work**

1. Execute UX-00 and UX-01 from `VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` only. Do not change product behavior.
2. Adopt the hard eyebrow rules: full-width, one continuous horizontal instrument, 56–72px height, stable geometry, one primary instrument maximum, no floating SaaS container/pills/ordinary hamburger sheet.
3. Reconcile the document’s “no film/scene model” legacy kill-list language with the later approved Profile in Motion plan: a route-specific, original, accessible scene is allowed **only after** the constitution and visual scene contract distinguish it from generic decorative animation.
4. Write the founder decision record for palette/type/grid/eyebrow/motion/illustration. Link it from every design PR.

**Acceptance gate**

- `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` has no TBD brand decisions.
- `design-lab/homepage-reset/DECISION.md` records the selected direction or named hybrid.
- No visible product reskin is merged in this wave.

### A2 — Shared foundation and clinician chrome (UX-02 + UX-03)

**Goal:** make shared navigation and system states singular, accessible, and impossible to regress casually.

**Work**

1. Implement one token layer and StateChip contract. Preserve source, observation time, freshness/limitation semantics; do not flatten all states into “verified.”
2. Converge public and clinician chrome on their declared owners. For the clinician shell, replace duplicate global links and the duplicate five-step loop with one stable desktop + mobile recomposition.
3. On clinician desktop, avoid using the mobile bottom navigation as the primary wide-screen IA. On mobile, retain ≥44px targets and use deliberate compact labels.
4. Place Recognition, readiness, sharing, and MATCHA contextually: each appears when it advances the current task, not as a global top-level obligation.
5. Add design lint, banned-copy checks, active-route-link validation, visual snapshots for desktop/mobile/reduced-motion, and a test that fails if the homepage imports or renders the retired horizontal film.

**Exact initial targets**

- `apps/web/components/layout/RootChrome.tsx`
- `apps/web/components/layout/Navbar.tsx`
- `apps/web/app/holder/layout.tsx`
- `apps/web/components/clinician/MobileBottomNav.tsx`
- `apps/web/components/holder/HolderSubNav.tsx`
- the current workspace navigation owner discovered in A0

**Acceptance gate**

- One clinician nav model at each breakpoint; no duplicate “Wallet/Readiness/Recognition/Share” top-level race.
- Keyboard skip link, focus order, Escape/menu, 320/390/768/1440 views, and reduced motion pass.
- Header is one horizontal eyebrow everywhere; no unapproved header variant can be introduced without a constitution citation.

### A3 — NPI activation and clinician home (UX-05, UX-06, UX-07, UX-08)

**Goal:** make the first authenticated minute feel like VitalCV did work, then give the clinician one clear next step.

**Work**

1. Rebuild `/holder/home` around this strict hierarchy: status since last visit → one next action → VitalCV work ledger → approvals/external blockers → relevant role/application. Everything else moves behind contextual links.
2. Replace the current large widget stack, duplicate role treatments, full profile percentage, generic score-led language, and illustrative career graph from the default home. Keep any graph secondary, data-backed, and labelled as projection/illustration where appropriate.
3. Make the unlinked NPI/readiness path explain what will happen, what is public, what was not found, and why identity verification remains—without synthetic progress or a generic form cliff.
4. Treat agent activity as a ledger of real events: did it / prepared it / needs approval / needs you / employer decides / changed / blocked / finished. Every state has glyph, word, consequence, and time when available.
5. Reconcile home, Wallet, and MATCHA with the same authenticated profile-state contract. MATCHA may present self-reported preferences, but must label their origin, render missing inputs as “not yet shared,” and never phrase preference completeness as source-backed readiness.
6. Keep local recovery/resume only when it is scoped to the signed-in identity and never contradicts fresh server state.

**Exact initial targets**

- `apps/web/components/mobile/ClinicianHomeSurface.tsx`
- `apps/web/components/mobile/ClinicianPanels.tsx`
- `apps/web/components/mobile/ClinicianStatusBanner.tsx`
- `apps/web/components/mobile/ClinicianMobileProvider.tsx`
- `apps/web/app/holder/readiness/ReadinessSurface.tsx`
- NPI/onboarding resolution surfaces discovered in A0

**Acceptance gate**

- A cold clinician can answer “what did VitalCV do, what is my next action, and what must wait for someone else?” from the first screenful.
- No dashboard metric or readiness number is shown unless calculated from returned evidence and explained in context.
- Empty, unavailable, blocked, source-error, and partial-source states receive the same design care as success.
- Controlled browser tests cover no NPI, partial data, failed source, completed onboarding, and return visit.

### A4 — Roles and Apply with VitalCV (UX-09 + UX-10)

**Goal:** turn role discovery and application into one transparent decision path.

**Work**

1. On `/holder/opportunities`, make each card answer: employer, role, location, schedule/compensation when available, why it may fit, what the employer requires, what VitalCV already has, what remains, and whether Apply with VitalCV is supported.
2. Remove duplicated continue/application controls and collapse role detail into one primary next action.
3. Build the application preview from the same selected-field object used by sealing. It must say exactly what the employer will receive; omitted fields and recipient/purpose remain visible.
4. Do not animate a send, recognition, or employer acceptance before the authoritative endpoint succeeds. Preserve immutable ApplicationPacket, consent receipt, idempotency, and submitted-versus-current distinction.

**Acceptance gate**

- A clinician can compare two roles from cards without a magic score.
- Previewed disclosure equals persisted packet input in an integration test.
- Keyboard, screen-reader, reduced-motion, withdraw/reapply, and tamper/authorization regression tests pass.

### A5 — Profile layers and Workbench foundation (profile simplification + WB-01/WB-02)

**Goal:** retain the excellent provenance distinctions while making the profile usable and creating one safe private thinking foundation.

**Work**

1. Re-sequence `/clinician/profile` by jobs: identity, professional record, credentials, work history, research/links. Use progressive disclosure and save/review states; do not silently turn user-entered data into source-backed evidence.
2. The profile layer must clearly separate source-backed, self-attested/user-entered, inferred, unknown, stale, access-required, and contradicted where supported.
3. Execute WB-01 repository baseline, then WB-02 revisions/typed links/authorization. Reuse Career Garden storage, identity resolution, audit-before-success rule, and explicit promotion mechanism. Do not build a second note store or employer-visible notes.
4. Remove production “Sample — its wave is next” material from the main Garden path. Render honest empty/unavailable states until shipped state exists.
5. Only after WB-02: prototype the Workbench shell; no graph-first experience.

**Acceptance gate**

- User A cannot enumerate/read/link/backlink/graph-traverse User B’s notes; an employer tenant cannot reach clinician-private notes.
- Promotion is explicit, reviewable, self-attested, and never changes matching/ranking/eligibility or source status.
- Profile source state is not color-only and every editable field has a truthful persistence/failure state.

### A6 — Employer acquisition and product surface (UX-11 to UX-13)

**Goal:** retain the present employer truthfulness but make acquisition and future review workflow clearer and lighter.

**Work**

1. Tighten `/employers` into outcome → truthful artifact → employer-decision boundary → access CTA. Keep its existing organization-identity-is-not-authority language.
2. Build employer product IA around **Roles · Candidates · Starts** only after the canonical decision service and organization governance are confirmed.
3. Keep the exact-packet decision boundary: employer sees only clinician-selected packet evidence; employer decisions remain auditable and do not expose Workbench/private notes.
4. Simplify Trust to a plain-language first layer with registry/receipts/freshness beneath progressive disclosure.

**Acceptance gate**

- No claim that a packet equals credentialing, privileging, hiring, or automatic start.
- Employer role/membership/organization authorization is server-enforced and negative tests remain green.
- Marketing, Trust, and Status use actual source availability/age/limitations, not static green checks.

### A7 — Visual system integration (VIS-01 through VIS-12, only after A1–A6 gates)

**Goal:** make VitalCV unmistakable without adding visual theater or false product claims.

**Work**

1. Use the approved `VisualScene` contract: `scene`, `mode`, `state`, `priority`, poster, transcript/text equivalent, reduced-motion behavior, error fallback, and asset provenance/size metadata.
2. Start with a storyboard and static profile-object primitives. The Journey Film is beside—not instead of—the real NPI action and plays once with Replay.
3. Authenticated surfaces use semantic DOM and actual returned state. Films may use fictional/abstract content only on public explanatory surfaces and must be visibly illustrative.
4. Map one intentional visual role to each important route; motion does not block controls, hide evidence, or imply a completed action.

**Acceptance gate**

- Poster, mobile crop, static/data-saving/reduced-motion composition, text equivalent, no CLS, and asset budgets pass in CI.
- No scene shows fake sources, clinician data, matches, submissions, or employer decisions as live state.
- Founder walkthrough covers public, clinician, Workbench, employer, Trust, status, empty/error, mobile, and reduced-motion states.

## Required test and release matrix

| Area | Minimum proof |
| --- | --- |
| Truth/fixtures | Source test plus production route test that no demo identity, source success, metric, or sample state leaks into live account pages. |
| Navigation | Active-route link checker; no active link to `_archive`; desktop/mobile keyboard tab-order tests. |
| Visual regression | Public homepage, clinician home, readiness-empty, readiness-partial, role list/detail, apply preview, profile, Garden-empty, employer landing, Trust/Status at 390/768/1440 plus reduced motion. |
| Accessibility | Skip links, headings, contrast, labels, focus restoration, Escape/Back behavior, 44px mobile targets; semantic alternative for any map or motion. |
| Privacy/authorization | Cross-clinician, cross-organization, revoked membership, caller-supplied role/ID spoofing, private-note isolation, packet hash/version tests. |
| Release | `git diff --check`; type/lint/affected tests; build; browser evidence; Railway `/api/version` SHA and cache-header check after deploy. |

## Claude Code operating protocol

```text
Before every wave:
1. Read this action plan, the cited authority brief, AGENTS.md, and the current source.
2. Record baseline branch, SHA, production /api/version SHA, dirty-state ownership, and exact route/component scope.
3. Make only the wave’s scoped change. Do not begin the next wave early.
4. Preserve server-side authorization, audit-before-success, source attribution, consent, and immutable packet behavior.
5. Run the wave’s targeted tests, then relevant type/lint/build and browser checks.
6. Report files changed, tests/results, screenshots, migration status, current production status, known risks, and the next gate.
```

## First Claude Code prompt

```text
Read in full:
- docs/audits/2026-08-08-signed-in-product-audit-action-plan.md
- VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md
- VITALCV_CLAUDE_CODE_ACTION_PLAN_VISUAL_WORKBENCH_2026-08-08.md
- VITALCV_WORKBENCH_SPATIAL_KNOWLEDGE_PROGRAM_2026-08-08.md
- VITALCV_LIVING_PROFILE_VISUAL_SYSTEM_2026-08-08.md
- AGENTS.md

Execute A0 only: Production-truth containment and route disposition.
Start from the current production SHA, not a stale branch. Inspect
apps/web/app/holder/readiness/ReadinessSurface.tsx and every current route/nav
owner. Remove or hard-contain demo readiness data so an authenticated production
route can never show a fabricated clinician/source success. Create
docs/architecture/route-disposition.md with ownership and canonical disposition
for every active route. Do not redesign UI, rename routes, change auth/audit/
packet behavior, or begin UX-00. Add targeted tests proving production routes
do not render the demo identity. Return the exact changed files, test commands
and results, screenshots for the unlinked state, discrepancies, risks, and the
A1/A2 scope proposal.
```

## Final founder gates

1. Approve UX-01’s visual direction and the clinician primary navigation labels before A2 merges.
2. Review a real-but-controlled NPI activation journey before A3 ships.
3. Approve the disclosure preview against a real immutable packet before A4 ships.
4. Approve the note retention/patient-information posture before Workbench revisions/links leave internal use.
5. Approve the Journey Film storyboard before any 3D production or homepage replacement.
