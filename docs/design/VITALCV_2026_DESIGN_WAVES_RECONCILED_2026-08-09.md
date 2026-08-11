# VitalCV 2026 Design Waves — Reconciled Execution Plan (D′ series)

**Date:** 2026-08-09 · **Status:** Executable — founder rulings 1–3 recorded below
**Supersedes:** the wave numbering (D-00…D-11) of `docs/design/VITALCV_2026_DESIGN_IMPLEMENTATION_WAVES_2026-08-09.md`, which is retained verbatim as the input of record. This document is also the deliverable that brief called `VITALCV_2026_VISUAL_LANGUAGE.md`.
**Governed by:** `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` (canonical; cite clauses), `docs/design/VITALCV_EXPERIENCE_OVERHAUL_PROGRAM_2026-08-08.md` (this program runs inside the Experience Overhaul lineage — the UI-PR-freeze clause is satisfied by membership, with formal disposition recorded at D′-00), `design-lab/homepage-reset/DECISION.md` (UX-01: Direction B, with amendments).

**Inspiration inputs (inspiration, not imitation — no third-party raw token, name, or composition ships):** the Dimension style extraction (dusk-dark restraint, hairline definition, low-weight display type), the Linear reference (operational density, decisive status), the ElevenLabs reference (editorial calm, warm paper contrast, accents reserved for product moments), and Lovable's 2026 trends guide (functional motion, accessibility-first, performance budgets — explicitly *not* trend collecting: no kinetic type, no neo-brutalism, no 3D for its own sake).

---

## 1. The design decision

> **A calm clinical record meets a precise operating instrument.**

VitalCV is not a dark AI workspace, a generic healthcare site, or a white-label credentialing dashboard. Its visual signature is the **portable clinician profile**: a clear record that gathers known facts, exposes what remains, pauses at clinician consent, and carries forward to the next opportunity (EC-27's protagonist object; EC-7's four owners).

Two registers, both already constitutional (EC-20 light/dark doctrine):
- **Public / story register** — warm graphite field, bone-white type, one restrained atmospheric moment at most (pending ruling R-c below).
- **Product / record register** — warm paper surfaces, sharply legible operational panels; dense where proof, source timing, or a decision requires it. Evidence artifacts stay printable/light by default (UX-01 amendment 6).

### What we borrow, and what we refuse

| Reference | Borrow | Do not borrow |
| --- | --- | --- |
| Dimension | Dusk-dark atmosphere discipline, hairline definition instead of shadows, low-weight display type, generous breathing room | Its palette or token names, warm-to-cobalt hero, pill silhouette and frost *as defaults* (each is a D′-00 ruling, off until ruled on), generic AI-workspace composition |
| Linear | Operational density, hairline precision, decisive status information | Acid-lime branding, compact-to-the-point-of-cramped control surfaces, PM visual tropes |
| ElevenLabs | Editorial calm, warm paper contrast, product visuals as the only expressive color, quiet cards | Whisper-thin text where accessibility suffers; its identity or accent sparks |
| Lovable 2026 guidance | Functional motion, organic restraint, accessibility-first, deliberate 3D, mobile performance | Trend collecting: decorative kinetic type, faux personalization, anti-grid for its own sake |

## 2. Founder rulings recorded 2026-08-09

1. **Primary CTA → paper-inverse. ADOPTED.** Primary actions become warm-paper inverse (paper fill, near-black ink). Green (`#4ADE97` → `--vt-evidence`) means source-confirmed / completed work — never a request to act. This amends EC-20's interaction row ("accent-work merge") via EC-22; the dated amendment text ships in the D′-00 packet, and the visible flip lands at D′-04 behind its own founder visual gate. Rationale: on the live `/`, `.ezh-npi-submit`, `.ezh-result-keep`, `.ezh-start-cta`, and the eyebrow CTA share `#4ade97` with ~14 completed/confirmed-state selectors — green currently does two jobs, and the truth grammar loses its meaning.
2. **Pills / frost / indigo atmosphere / radius scale → ruled at D′-00 preview.** Four EC-20 locks are challenged by the 2026-08-09 brief (pills retired · glass none · nothing glows · 0–3px radii). Waves are built **conflict-neutral**: each treatment is exactly one token knob; D′-00 renders fixtures both ways; D′-09 flips values and amends EC-20 per the ruling. Until then every knob holds the current locked value.
3. **Execution start:** this plan document + the D′-00 ruling packet + the D′-01 token bridge. Later waves are dispatched from this document, one prompt each (§6).

## 3. Reconciliation with the repository (what the 2026-08-09 brief did not know)

| Brief assumption | Repository fact (origin/main `7c6044463`) | Consequence |
| --- | --- | --- |
| D-03 must build a `VisualScene` runtime | Shipped (CC-06, PR #1208): `apps/web/components/visual-scene/` — type-level kind contract, poster-first server render, EC-29 budgets + license metadata, all 10 approved scene IDs | **D-03 is dead.** Its remaining tail (real posters, motion sources) is D′-06 |
| D-02 must create shared primitives from scratch | `apps/web/components/vital/` exists: StateChip (source/asOf required at the type level), EvidenceRow, NpiInput, TrustGlyph, ProofContinuityRail, EmptyState, SkeletonStack | D′-02 extends this library; it does not fork a dialect |
| Homepage needs a manifest + gate | `docs/design/homepage-composition-manifest.md` + `apps/web/__tests__/homepage-composition-gate.test.tsx` exist with a same-PR change protocol | D′-04/D′-05 update both in the same PR |
| Jobs surface = `/jobs` | No `/jobs`. Opportunities live at `/holder/opportunities/*` (MATCHA deck) and apply at `/apply/[requestUri]` (founder decision) | D′-07b targets the real routes |
| Workbench visual language can assume a shell is coming | CC-05/07/08/09 + A5 merged; CC-10 (Decision Trail) sits unmerged on `wave/cc-10-decision-trail` | D′-07a starts only after CC-10 disposition |
| Design lint may need creating | `scripts/check-design-lint.ts` is a live required CI context (LINT-01…13, XS-1, CD-3/4, R-rules, ratchet baselines) | New rules extend it; IDs LINT-14+ |
| Fonts and tokens are unsettled | Geist/Geist Mono/Fraunces self-hosted in `apps/web/app/fonts/`; but `globals.css` carries 26 `@import`s and ~900 custom properties with cross-file collisions — UX-02's census (draft PR #1165) is founder-held | D′-01 is a **thin additive bridge** that becomes UX-02's target dialect; UX-02 thereafter only deletes |

**Standing repo facts every wave inherits:** the live `/` is `EasyHome` + `WorkSurface` (server renders the completed story frame; JS replays it; no keyframes; no z-index), `.ezh` island discipline (every color routes through `--ezh-*` on the island root — the bridge reaches the homepage **only** via D′-04's sanctioned alias block), variant rollback via `PUBLIC_HOME_VARIANT`, and the merge gate: all required contexts green **by name on the head SHA**, plus real verification — green CI alone is not evidence (CLAUDE.md).

## 4. Color, type, shape, and motion law (reconciled)

| Role | Law | Authority |
| --- | --- | --- |
| Canvas | Warm graphite public register (`#151412` family as shipped — the constitution's `#141517` reference was warm-shifted at UX-V1 to pass the warm-ink doctrine check; the shipped values are canon) | EC-20 neutral palette · UX-V1 |
| Paper / primary action | Warm paper fill (`#f6f5f1`) with near-black ink (`#151412`); the primary CTA is **not** green | Ruling 1 |
| Evidence / completed | `--vt-evidence` (`#4ade97`) only when a named source actually returned a match or work actually completed | Ruling 1 · EC-3 |
| Pending / needs a person | Amber `#e4b45c` only for the real pending state | EC-20 · shipped `.ezh-hold` |
| Waiting on someone else | Neutral `#8f8c88` / `#6e7073` | EC-20 · shipped `.ezh-wait` |
| Editorial atmosphere | At most ONE quiet indigo moment per viewport, never on a button, text, status, or input — **off** (`--vt-atmos-display: none`) until ruling R-c | Ruling 2 |
| Borders | 1px warm hairlines; elevation by rule and surface contrast, never heavy shadow | EC-20 |
| Type | Geist display/body (never bolder than 600; display weight 500 preferred), Geist Mono for machine facts with `tabular-nums` | EC-20 |
| Shape | Radius knobs `--vt-radius-{control,card,chip}`, values 2–3px until ruling R-d | Ruling 2 |
| Motion | Four bands (80–150 / 150–250 / 250–450 / 450–800ms rare); **no movement means no new state**; single-shot; reduced-motion/data-saver/no-JS get the complete composed experience. The shipped `--duration-*` family does **not** satisfy the 80–150ms control-feedback band — values hold at their current 280ms floor until ruling R-e | EC-29 · EC-20 |

## 5. The D′ wave map

```
(D′-00 ∥ D′-01) → (D′-02 ∥ D′-03 ∥ D′-08) → (D′-04 ∥ D′-06 ∥ D′-07a/b/c) → D′-05 → D′-09
```

Rules for every wave: the DESIGN-ONLY BOUNDARY verbatim at the top of the PR; worktree cut from `origin/main` (the long-lived local checkouts are stale); a **Design Handoff References** section citing EC clauses; no two waves editing the same file concurrently; wave handoff block (§7) in every PR; `pnpm check:design`, targeted vitest, and `pnpm turbo run build --filter @vitalcv/web` before push; merge only on named-context green at the head SHA plus real verification.

| ID | Goal | Founder gate | Parallel with |
| --- | --- | --- | --- |
| **D′-00** Ruling packet | Both-ways fixtures + memo for the five open rulings; CTA amendment text; freeze/UX-03 disposition; #1165 recommendation | **YES** — rulings R-a…R-e | D′-01 |
| **D′-01** Semantic token bridge | One additive file `apps/web/styles/tokens/semantic.css` + LINT-14/15 + token-contract test | No | D′-00 |
| **D′-02** Primitive kit | VitalAction/VitalChip/VitalPanel/VitalField in `components/vital/`, treatment from tokens only, fixtures under both value sheets | Async look | D′-03, D′-08 |
| **D′-03** ProfileObject kit | `components/vital/profile-object/` — ProfileObject, ProfileLayerStack, ContinuityRibbon + poster-grade statics, art neutral on unruled axes | **YES** — EC-25 | D′-02, D′-08 |
| **D′-04** Homepage register | `.ezh` alias block; CTA flip per ruling 1; evidence/action token split; manifest + gate same PR; eyebrow CTA same treatment | **YES** — visual gate | D′-06, D′-07 |
| **D′-05** WorkSurface evolution | ProfileObject becomes the protagonist of the five beats; completed-frame/replay/reduced-motion invariants preserved | **YES** — EC-25 | after D′-04 (shared files) |
| **D′-06** Scene content | Real posters (then motion) for the 10 registered scene IDs, per-scene parallel, EC-28 placement authority | **YES** — EC-28 per scene | D′-04, D′-07 |
| **D′-07a/b/c** Interior sweep | a: clinician home + Workbench material (CC-10 disposition first) · b: MATCHA deck + apply Choice Gate · c: onboarding NPI Reveal | No | each other, D′-04, D′-06, D′-08 |
| **D′-08** Light register | Name `--vt-paper-*`; migrate `mz-*` surfaces (`/employers`, `/trust`, `/status`, PageFrame, ArtifactStage) | No | D′-02, D′-03, D′-07 |
| **D′-09** Ruling flip + lock | Flip knob values per rulings; ruling-specific lint (e.g. evidence-green banned in action selectors); EC-20 amendment | **YES** | post-ruling |

## 6. Task bundles (one prompt per wave — paste into a fresh Claude Code session)

Every prompt implicitly begins with:

```text
DESIGN-ONLY BOUNDARY
This wave may change UI, UX, visual design, interaction design, responsive behavior,
animation, information hierarchy, customer-facing copy, navigation presentation, and
brand expression. It may not change application truth, authentication, authorization,
consent semantics, data models, APIs, readiness calculations, agent policy, source
behavior, employer decisions, business logic, or pricing behavior. If the proposed
experience requires one of those changes, record it as a product dependency and stop.

Read first: CLAUDE.md · docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md ·
docs/design/VITALCV_2026_DESIGN_WAVES_RECONCILED_2026-08-09.md (this plan) ·
the prior wave's handoff. Cut a worktree from origin/main
(git fetch origin main && git worktree add -b <branch> /tmp/vitalcv-<slug> origin/main;
pnpm install; pnpm turbo run build --filter @vitalcv/web).
```

### D′-00 — Ruling packet *(executed in this session)*
```text
Execute D′-00. Build design-lab/2026-register/: a static both-ways fixture board
(no app routes) rendering a representative hero band + NPI CTA, a filter/tag row,
a panel/card stack, a Workbench sidecar mock, and an atmosphere demo under two
value sheets — Sheet L (current EC-20 locks: 2px chips, no frost, no atmosphere,
2–3px radii) and Sheet D (challenged values: pill chips, frosted panel, one indigo
atmospheric wash, 8–10px controls / 20–24px cards). The CTA renders paper-inverse
on BOTH sheets (ruling 1 is settled) with a small before-strip showing the retired
green CTA for context. Add RULING-MEMO.md: one page per ruling R-a (pills on
filters/tags only?) R-b (frost on chrome/Workbench sidecar only?) R-c (one indigo
atmosphere per viewport?) R-d (radius scale) R-e (control-feedback duration —
see §8.8; the band is locked, only the value is open), each citing the EC-20 row
it would amend; plus the drafted EC-22 CTA amendment text, the freeze/UX-03 disposition
recommendation, and the #1165 census recommendation. Capture 1440/390 +
reduced-motion evidence with a capture.mjs in the same directory (pattern:
design-lab/homepage-reset/evidence/capture.mjs). Do not add routes, tokens, or
app code.
```

### D′-01 — Semantic token bridge *(executed in this session)*
```text
Execute D′-01. Create apps/web/styles/tokens/semantic.css — the ONE place the
2026 semantic namespaces are declared: --vt-action-* (paper-inverse per ruling 1),
--vt-evidence (#4ade97), --vt-radius-{control,card,chip} (2–3px until D′-09),
--vt-frost-* (filter: none until ruled), --vt-atmos-* (display: none until ruled),
--vt-scene-* (canvas/panel/paper/glow slots for VisualScene compositions),
--vt-paper-* (light register, values from the shipped .ezh light family),
--vt-space-* (4/8/12/16/24/32/48/64 scale). Values map to the SHIPPED warm
family in styles/easy-home.css (#151412 ground, #f6f5f1 paper, #f2f1ed ink…);
no Dimension/Linear/ElevenLabs raw hex. Add ONE @import to app/globals.css
(the designated terminal state — UX-02 thereafter only deletes imports). Extend
scripts/check-design-lint.ts: add the file to TOKEN_FILES; LINT-14 (error) — the
new namespaces may be declared only in semantic.css, one declaration each;
LINT-15 (ratchet, baseline = measured) — the third-party reference palette
(#0a0a0a #161616 #d4d4d4 #ededed #c2c2c2 #686868 #b2b2b2 #e5e5e5 #6b62f2) may
not appear outside token files. Add apps/web/__tests__/semantic-token-bridge.test.ts:
each namespace declared exactly once repo-wide; conflict knobs hold current-lock
values; --vt-evidence === #4ade97; action-primary is not the evidence green; no
third-party hex in semantic.css. Zero visual change (nothing consumes the tokens
yet). Run pnpm check:design, the new test, targeted suites, and the web build.
```

### D′-02 — Primitive kit
```text
Execute D′-02 after D′-01 merges and the D′-00 freeze disposition is recorded.
In apps/web/components/vital/, add VitalAction (primary reads
--vt-action-primary-*; secondary hairline; quiet text), VitalChip
(radius from --vt-radius-chip), VitalPanel (surface/hairline; backdrop-filter:
var(--vt-frost-filter), none today), VitalField (uses the NpiInput focus
conventions). No literal radius/shadow/backdrop-filter/gradient/hex inside
components/vital/** — treatment comes from semantic.css only; extend
check-design-lint with that rule (error mode) scoped to components/vital.
Keyboard visibility, accessible names, ≥44px targets, nested-interactive
resistance. Add vitest fixtures rendering every primitive under BOTH D′-00 value
sheets with contrast assertions (paper-inverse CTA on graphite AND on paper).
No new routes — fixtures and tests only. StateChip and TrustGlyph remain the
only state representations (EC-4).
```

### D′-03 — ProfileObject kit
```text
Execute D′-03 (parallel with D′-02; different files). Create
apps/web/components/vital/profile-object/: ProfileObject (the EC-27 protagonist —
tall near-sharp record pane with 3–5 visible layers: identity, source-backed,
clinician-provided, permissions, applied-to context), ProfileLayerStack, and
ContinuityRibbon (a short path object connecting two real events; never a
network graph). Layer states use text + glyph + layout, never color alone
(EC-4); StateChip semantics where real state appears. Static/DOM only — no
canvas, no 3D, no keyframes. Art stays NEUTRAL on the four unruled axes
(near-sharp corners, no frost, no atmosphere, no pills) — add a grep check to
the wave PR proving it. Produce poster-grade static renders usable by the
VisualScene manifest (respect EC-29 byte budgets + source/license/origin
metadata). Fixtures at 320/390/1440, high contrast, reduced motion. Founder
gate: EC-25 scene-truth review — no fake clinician, source result, match,
count, or employer outcome anywhere in the kit.
```

### D′-04 — Homepage register application
```text
Execute D′-04 after D′-02 and the D′-00 rulings. Restyle, do not rebuild:
in styles/easy-home.css add ONE sanctioned alias block at the .ezh island root
mapping --ezh-* onto var(--vt-*, <current fallback>) — the island invariant
("every color routes through --ezh-*") is amended, not abandoned; update the
island guard test in the same PR. Split the two jobs of green: completed/
confirmed selectors consume the evidence token; .ezh-npi-submit, .ezh-result-keep,
.ezh-start-cta, and the eyebrow CTA (styles/eyebrow.css --eb-* equivalents)
flip to the paper-inverse action tokens (ruling 1). Focus outlines move off
evidence green to the action family. Render the inert atmosphere slot
(display: var(--vt-atmos-display, none)) behind the WorkSurface only. Preserve
untouched: NPI validation, bootstrap, real-result paths, no-script completed
frame, replay, reduced-motion static, variant registry, tracking, source-
freshness footer. Update docs/design/homepage-composition-manifest.md and
homepage-composition-gate.test.tsx in the same PR. Verify at desktop/390/
reduced-motion with the UX-V1 evidence harness pattern; watch the known traps:
sitemap-freshness date if page.tsx is touched, element-right-edge overflow
assertions, CI=1 for the e2e suspects. Founder visual gate before merge.
```

### D′-05 — WorkSurface Profile in Motion
```text
Execute D′-05 after D′-04 merges (same files). Rebuild the five-beat
WorkSurface composition around the D′-03 ProfileObject: the profile pane is
the protagonist; source objects arrive and settle (VitalCV handles); the
approval tray waits without pulsing (needs your approval); one open slot
points at the human (needs you); the employer desk receives and does NOT
resolve (employer decides — EC-7). Keep: server-rendered completed frame,
single ~10–14s JS-scheduled class timeline over CSS transitions (no
keyframes), replay control, reduced-motion static with beat annotations,
HOME_BEAT_EVENT eyebrow narration. Labels remain honest (illustrative,
fictional; no real NPI, no fabricated counts). Update composition manifest +
gate test same PR. Five-second comprehension test at the founder gate:
"VitalCV gathers known facts, the clinician approves sharing, the employer
reviews."
```

### D′-06 — Scene content (per-scene, parallel)
```text
Execute D′-06 one scene at a time (npi_reveal, profile_layers, choice_gate,
opportunity_field, employer_desk, continuity_ribbon, quiet_source_constellation,
workbench_window, decision_trail — journey_film remains OFF the homepage,
EC-28). For each: replace the placeholder poster in
apps/web/components/visual-scene/ with a real composition derived from the
D′-03 kit; keep kind semantics honest (stateful scenes render only real
returned state); EC-29 budgets and license/origin metadata enforced by the
existing validateManifest gate; art neutral on unruled axes until D′-09.
Placement PRs are separate from asset PRs when they touch owned routes.
Founder gate per scene: EC-25 truth review.
```

### D′-07a/b/c — Interior sweep (three disjoint lanes)
```text
a) After CC-10 disposition: apply the register to ClinicianHomeSurface
(preserve A3's hierarchy: since-last-visit → one next action → work ledger →
waiting → application/role) and the Workbench shell material language
(solid raised panels + hairlines today; frost only if ruling R-b adopts it).
Private state visibly distinct; never mounted on public/employer routes.
b) MATCHA deck + /apply/[requestUri]: Choice Gate consent tray around the
REAL selected-facets flow (ApplyBundleView/ConsentSeal); no send motion
before endpoint success; deck motion stops while the user searches/filters/
types; keyboard + screen-reader complete.
c) /onboarding GetReadySurface: NPI Reveal as DOM state transitions from
actual returned data; unknown/unavailable/access-required/self-attested/
source-confirmed each get distinct text + glyph + layout; errors are as
deliberately designed as success.
```

### D′-08 — Light register formalization
```text
Execute D′-08 (parallel with D′-02/03/07). Fill the EC-20 "light-register
artifact palette" task: name --vt-paper-* values in semantic.css (from the
shipped .ezh light family), then migrate the mz-* surfaces — /employers,
/trust, /status, PageFrame, ArtifactStage — onto them. Editorial proof rows
and thin dividers instead of card grids where content is explanatory. Employer
story ends at employer review (EC-7); every source visual state keeps adjacent
accessible text (source, age, limitation). design-lint baselines may only
shrink for migrated files.
```

### D′-09 — Ruling flip + lock
```text
Execute D′-09 after the D′-00 rulings land. Flip semantic.css knob values per
the rulings; enable the ruling-specific lint variant (paper-inverse adopted →
evidence green forbidden in action-role selectors; pills adopted → radius
literals still banned, token-only); amend EC-20 rows via EC-22 with dated
rationale; re-run the D′-02 both-ways fixtures as single-sheet contract tests.
One PR, small diff, founder gate.
```

## 7. Wave handoff block (required in every PR)

```text
Wave: <ID + name>
Invariant(s) preserved:
Files changed:
Route / component ownership affected:
Schema or API changes: none | exact migration
Tests run and results:
Visual evidence: screenshots / recording paths
Accessibility and performance evidence:
Privacy / provenance review:
Rollback path:
Risks or founder decisions needed:
Next eligible wave:
```

## 8. Standing risks

1. **`.ezh` island isolation** — the bridge reaches `/` only through D′-04's alias block; amend the island invariant and its guard test in the same PR.
2. **Freeze ambiguity** — UX-03 never ran as its own gate; the D′-00 memo extracts explicit disposition before D′-02+ PRs open.
3. **Token dialect fork** — #1165's census mapping must target the D′-01 names; recommendation rides in the D′-00 memo. Never push to the founder-held branch.
4. **Baked-asset churn** — D′-03/D′-06 art stays neutral on unruled axes (grep-enforced) until D′-09.
5. **Stacked-PR squash trap** — merge D′-01 before opening dependents; maximum stack depth 1; rebase children `--onto` after each squash.
6. **CC-10 collision** — `wave/cc-10-decision-trail` shares Workbench files with D′-07a; disposition first.
7. **Stale checkouts** — long-lived local trees are hundreds of commits behind; every wave cuts fresh from `origin/main`.
8. **The shipped duration tokens cannot express the control-feedback band — ruling R-e.** Verified against `origin/main` `0323745d0`, 2026-08-10. EC-29 locks 80–150ms for control feedback; `apps/web/styles/tokens.css` declares its whole `--duration-*` family "locked to 280–420ms", so **no shipped token can express the fastest band**. The tokens named for control feel are the ones that miss it: `--duration-instant`, `--duration-snap`, and `--duration-respond` are all **280ms**.

   **This is not a missing-token gap — it is a declared value overriding an in-band intent.** Every consumer writes the fallback `var(--duration-snap, 80ms)`: `apps/web/styles/utilities.css` (`.instant-transition`, `.control-hover`, `.control-surface`) and `apps/web/components/ui/ActionBar.tsx`. The call sites already ask for 80ms — exactly the band floor. Because `tokens.css` is imported globally (`app/globals.css:21`) and declares `--duration-snap: 280ms` at `:root`, the fallback never fires and every one of those sites resolves to **280ms, 3.5× the authored intent**. Adding a *new* in-band token would therefore fix nothing: the seven live `--duration-snap` references would keep resolving to 280ms unless they are also repointed. The minimal correct change is to the value of the existing control-feel tokens.

   **Blast radius today is one route, and that is the reason to rule now rather than patch now.** Of 13 `var(--duration-*)` references in `apps/web`, 7 sit inside `tokens.css`'s own `--transition-*` presets, which have **zero consumers**. The only live user-facing surface is `/review/[entityId]` (`ReviewPageClient` → `ReviewClient` → `DecisionCard`), where `.instant-transition` and `ActionBar`'s approve/secondary buttons animate at 280ms — the employer's highest-stakes click. `SignalCard` reaches `_archive/wave119` only; `.control-hover` and `--duration-{fast,normal,slow,xslow,stagger,instant,respond}` have no live consumers at all. So this is a **latent doctrine defect, not a live latency problem** — the surfaces that do real motion (`easy-home`, `wave1501-home`, `home.css`) each carry island-local values that land in-band on their own (`--dur-fast: 160ms`, `--film-dur-state: 120ms`). It becomes product-wide the moment **D′-02's primitive kit** starts consuming the global family, which is why it should be ruled inside the D′-00 packet rather than after.

   **Recommended default:** set `--duration-snap` / `--duration-instant` / `--duration-respond` to **120ms** — inside 80–150ms, matching the `--film-dur-state: 120ms` precedent already in the tree, and honouring the call sites' intent without sitting on the band floor. Leave `--duration-{normal,slow,xslow}` untouched (320/380/420ms are legitimately the 250–450ms transformation band) and correct the file's "locked to 280–420ms" header comment, which is the origin of the error. **No EC-22 amendment is required for this:** EC-20's animation row reads `LOCKED CONSTRAINTS · values in UX-02` — the four-band structure is locked, the exact durations are explicitly delegated. An amendment becomes necessary only if a ruling *widens a band* to fit the current tokens, which is not recommended. Do not mint a new `--dur-*` prefix (one system: extend the file that owns the tokens), and do not reach for the `wave1501`/`film` island tokens, which are scoped and superseded.

   Separately confirmed on `origin/main`: `--dur-state`, `--dur-enter`, `--dur-scene`, `--ease-enter`, `--ease-exit` are declared **nowhere** in `apps/web` and have zero references. They came from the superseded `VITALCV_CREATIVE_DIRECTION.md`; agent definitions instructed agents to use them until PR #1302 repointed them. The near-miss `--film-dur-{state,enter,scene}` in `apps/web/styles/home.css` is film-island-scoped and is **not** the replacement.

## 9. Completion definition

The program is complete when a clinician can see — in five seconds, without deciphering a dashboard — that (1) their professional record begins with known public information; (2) unknowns and ownership remain visible; (3) nothing leaves their profile without consent; (4) a role can receive the chosen record without another blank application; and (5) the record remains useful after the immediate application. The interface should feel expensive because it is exact, calm, and humane — not because it is noisy, trendy, or impersonating someone else's brand.

## 10. Continuation block

**CURRENT STATE:** Rulings 1–3 recorded; D′-00 packet and D′-01 bridge executed alongside this plan; D′-02/03/08 are the next eligible waves once the D′-00 freeze disposition is recorded and D′-01 merges.
**NEXT STEPS:** Founder rules R-a…R-e from the D′-00 board (R-e is value-only — see §8.8); then D′-02 ∥ D′-03 ∥ D′-08; then D′-04.
**OPEN QUESTIONS:** the four D′-00 rulings; #1165 merge-lift; CC-10 disposition; who produces master 3D/motion sources after D′-06 posters prove the compositions.
