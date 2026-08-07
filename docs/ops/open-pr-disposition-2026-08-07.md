# Open-PR disposition — 2026-08-07 (backlog burn-down)

Owner: platform ops · Snapshot: 2026-08-07 ~19:52 UTC · **216 open PRs** (vs 876 closed)
Baseline for all merge analysis: `origin/main` @ `f0b3749d3f8` (2026-08-07).

**Analysis only.** Nothing in this document closes or merges anything by itself.
Execution is a separate, deliberate step, exactly as in the predecessor document
[`open-pr-disposition-2026-08-02.md`](open-pr-disposition-2026-08-02.md) — whose
central lesson this report inherits: **that disposition was written, but its
closure step was never executed.** 225 PRs were sentenced to close on 08-02;
194 of them are still open today and still form ~90% of this backlog.

## Method (what "verified" means in this document)

- Every one of the 216 open heads was fetched and merged **locally** against
  `main@f0b3749` with `git merge-tree` — so "conflicts" and "clean" below are
  measured against today's main, not GitHub's cached `mergeable` flag.
- "Green" was verified by enumerating **check-runs on the head SHA** for every
  merge-ready candidate (per the repo doctrine that green is a claim about a
  SHA, not a PR). The GitHub search `status:` qualifier disagrees with
  check-runs on this repo (it reads legacy commit statuses) — it reported
  several fully-green PRs as "pending". Do not triage from search status.
- Staleness = commits on main since the PR's merge base (`behind` below).
- For pre-June PRs, I also measured whether the files each PR **modifies**
  still exist on main. Result: of the 122 non-ancient stale PRs, **52 modify
  nothing at all** (they only add files) and 21 more modify files main has
  since deleted in whole or part. A stale PR that merges "cleanly" mostly
  does so because it would dump new, obsolete files into the tree that
  nothing else touches — clean ≠ relevant.

## The capacity problem, quantified

- ~15–16 check jobs fire per push on a full-stack branch (12 on docs-only
  after path filters). Observed: 16 on #852, 15 on #853/#1076, 14 on #1066,
  12 on #891/#986. This matches the required-context growth (2 → 5 → 7 → 14)
  recorded in CLAUDE.md.
- The backlog's standing cost is **event-multiplied**. Check-run and
  `updated_at` timestamps on the stale PRs I inspected cluster into bulk
  events — 2026-03-22 ~04:20 (all 43 ancient PRs touched at the same second),
  2026-07-26 18:15–18:43 (#439–442, #748, #574 all re-fired), 2026-08-02
  18:39–18:51 (#582, #852, #853 re-fired full suites). Something (bulk
  "update branch" / re-run sweeps) periodically walks stale branches and
  re-fires their gates. 194 stale branches × ~15 jobs ≈ **~2,900 runner jobs
  per sweep**, for PRs that will never merge.
- The backlog also destroyed signal: with 216 open, the ~13 PRs that are
  actually waiting on a human (§4, §5) are invisible.
- The backlog is still growing: during the two hours of this audit, at least
  7 new PRs (#1110–#1116) were opened. They are outside this snapshot.

## Bucket totals

| Bucket | Count | PRs |
|---|---|---|
| (a) Merge-ready | 6 | #852, #853, #891, #986, #1066, #1076 |
| (b) Superseded / stale-clean | 82 | #582 + 81 pre-June PRs whose trees merge clean but whose intent landed in later form (full list in appendix) |
| (c) Rotted | 114 | 43 ancient (#1–#46: main's history was rewritten from under them — no merge base exists; they can never merge, only be re-cut) + 70 pre-June conflicting + #844 (dependabot, conflicting lockfile — close and let dependabot recreate) |
| (d) Deliberately parked | 5 | #506, #748, #1072, #1079, #1081 — each with its named blocker in §4 |
| (e) Genuinely in flight | 9 | #1101, #1103–#1109 (today's cleanup lane) + #574 |

Target end state after execution: **~13–15 open PRs**, all of them either in
flight or parked with a named unblock condition.

---

## §1 — Biggest capacity win first: execute the already-written closure (194 PRs)

The 2026-08-02 disposition (founder-visible, merged to main) sentenced every
pre-2026-06-01 PR to *close as superseded*. The sentence was never carried
out. **This is the single largest CI-capacity action available and it
requires no new judgment — only execution of an existing decision.**

This audit independently re-verified the sentence with merge evidence:

- **43 ancient** (#1, #2, #4–#42, #45, #46 — Dec 2025–Feb 2026): share **no
  merge base** with today's main (history rewritten). Mechanically
  unmergeable forever. #45/#46 are also duplicates of each other (vercel-bot
  RSC CVE drafts; the CVE has long since been cleared by later Next bumps).
- **70 conflicting** (Apr 8 – May 13 cohort): fail `git merge-tree` against
  today's main.
- **81 clean-but-hollow** (mostly May 3–30): merge without textual conflict
  because they are adds-only or near-adds-only trees. The 08-02 spot-checks
  (#345 → shipped canonically, #370 → live as `check-public-claims`) and the
  duplicate clusters below confirm the intent is on main in later form:
  - #163 / #164 / #165 — three drafts of the same knowledge-inbox slice
  - #367 / #368 — same demo-spine, two PRs
  - #245 / #246 — **literally the same branch** (`feat/upload-cv`, identical
    head SHA) opened as two PRs
  - 25 of the stale PRs are stacked on other stale PRs (the `w2-pr17a`
    governance stack, the `web-v2` sandbox stack, the provenance stack) —
    deleting a base branch auto-closes its dependents, so closure order
    doesn't matter.

**Recommended execution** (after founder sign-off on this doc): batch-close
all 194 with a receipt comment pointing here, exactly per the 08-02 appendix
script, and **delete the branches** — a closed PR whose branch survives can
still be resurrected by bulk-update sweeps; a deleted branch cannot fire
anything. This removes ~90% of the gate-firing surface in one action.

## §2 — Quick wins: 6 merge-ready PRs

Green verified per head SHA + clean merge-tree vs `f0b3749`. Greens are 2–12
days old — per the merge gate, re-read check-runs live at merge time and
exercise the change; each merge also permanently retires a branch from the
sweep surface.

| PR | Change | Checks on head SHA | Merge-tree | Note |
|---|---|---|---|---|
| #1076 | postcss 8.5.6 → 8.5.23 (dev) | 15/15 ✓ (Aug 5) | clean | Routine bump, no newer superseding PR open |
| #1066 | actions/cache 4 → 6 | 14/14 ✓ (Aug 3) | clean | CI-only |
| #852 | vite 6.4.1 → 6.4.3 (dev) | 16/16 ✓ (Aug 2) | clean | 08-02 disposition: merge after green — it is green |
| #853 | @opentelemetry/core 2.5.0 → 2.8.0 | 15/15 ✓ (Aug 2) | clean | Same |
| #986 | docs(continuity): Jul 30–31 project memory | 12/12 ✓ (Jul 31) | clean | Docs-only; 08-02: keep — active. Merge or fold into memory docs, don't let it rot |
| #891 | flask 3.0.3 → 3.1.3 (`apps/api/bug-bounty`) | 12/12 ✓ (Jul 26) | clean | ⚠ Isolated Python service, **no JS CI covers it** — per the merge gate, run the service by hand before merging |

## §3 — Close-and-recreate: superseded/rotted singles in the post-June set

| PR | Disposition | Why |
|---|---|---|
| #582 | Close — superseded | expo-notifications 57.x crosses Expo SDK lines; #1031 (merged) took `apps/mobile` to SDK 53 with the SDK-correct `~0.31.5`. 08-02 already ruled this; it's still open. Green checks don't change supersession. |
| #844 | Close + `@dependabot recreate` | marketing Next 15.2.8 → 15.5.21: branch now **conflicts** with main (lockfile) and checks are red. Hand-rebasing a dependabot branch is wasted effort — recreate gets a fresh green branch for free. |
| #574 | Re-run or recreate | actions/github-script 7 → 9: merge-tree **clean** but checks red after the Jul 26 sweep. 08-02: merge after green. Cheapest path: `@dependabot rebase`, then merge under §2 rules. (Counted in bucket (e).) |

## §4 — Deliberately parked: what each is actually blocked on

These are correctly out of the merge path, but three of the five are
accumulating rot while parked. A parked PR should be **draft + `parked`
label + named unblock condition** — not a "DO NOT MERGE" title, which no
automation can read.

| PR | State | Actually blocked on | Rot status | Recommendation |
|---|---|---|---|---|
| #506 | Open (non-draft!), title-guarded "DO NOT MERGE" | (1) `MONITORING_SECRET` set on web + backend, (2) `ENFORCE_ME_ROLE_INTERNAL_AUTH` staged on backend, (3) explicit founder approval of the rollout | 509 commits behind; now **conflicts** with main; checks red | 08-02 already ruled *close — superseded*. Re-affirm: close with a receipt; the 222-line backend-gate diff is cheaper to re-cut from main at arm time than to keep alive for weeks. The underlying need (arming the `/api/me/role` transport gate) **still exists** but lives in the env rollout runbook (`docs/product/me-role-transport-auth.md`), not in this branch. |
| #748 | Open, idle since Jul, batch-rebased Jul 26 | Founder call recorded 08-02: G4 backlinks tree predates ADR 0006's authz/consent gate on the public backlinks endpoint; must not merge as-is | Merge-tree clean (adds-only), checks pending | Underlying need (bidirectional evidence-graph links) plausibly real — decide: re-cut against ADR 0006, or close. Don't leave in limbo a third week. |
| #1072 | Draft | Its own §0: `FOUNDER VISUAL DECISION: GO` + `FOUNDER PRODUCTION PROMOTION: GO` | 30 behind, conflicts | **Likely superseded**: CLAUDE.md (2026-08-05) records that `/` was promoted to the One Real Loop under founder authorization via **#1075** (`7b6bb0aa1`), and the Wave-1072 gate that held this draft is closed. Founder to confirm this draft delivered its payload via #1075 and close it. |
| #1079 | Draft | Explicit: "Not for merge without founder production promotion" (homepage messaging convergence) | 21 behind, conflicts (homepage moved under it, e.g. #1102) | Keep parked, but it must be **rebased before any GO** — a promotion decision made on this stale diff would ship against a homepage that no longer exists. |
| #1081 | Draft, actively updated (new commits 2026-08-07) | Self-declared "do not merge, not for production" + recorded verification gap (no signed-in browser run — sandbox has no Clerk test identity) + production-readiness decision | 19 behind, conflicts; companion fix #1082 already merged | Closest to real of the drafts — arguably bucket (e). Rebase onto main (absorb #1082), close the signed-in verification gap, then promote out of draft. |

## §5 — Genuinely in flight (leave alone)

Today's cleanup lane, all created 2026-08-07, checks running at snapshot
time: **#1101, #1103, #1104, #1105, #1106, #1107, #1108, #1109** (#1109 is a
draft). Two notes for the lane owner:

- **#1104** already conflicts with main — sibling merges (#1099–#1102 era)
  landed under it. Rebase before its checks are trusted.
- **#1103 vs #1108** look like overlapping intent (both carry `?npi=`
  through to `/onboarding`, from marketing-form and passport-stub
  respectively). Worth a 2-minute dedupe check before both merge.

Plus #574 (see §3) and the untriaged newcomers #1110–#1116.

## §6 — The long tail, specifically

Requested call-outs, each with a verdict on whether the underlying need
still exists:

- **#440** docs(ops): Clerk auth gate diagnostics (May 30, batch-rebased
  Jul 26, adds one 50-line doc). The auth gate it diagnoses was **rebuilt**
  by the July auth overhaul (#504 → #507 and successors); main now carries
  its own runbooks (`REBASELINE-2026-07-04.md`,
  `authenticated-sse-smoke-runbook.md`, `HOMEPAGE_RECOVERY_2026-08-02.md`).
  Need: **gone** — the doc describes a topology that no longer exists. Close.
- **#441** docs(ops): trust persistence gaps inventory (May 30). The
  persistence work itself is now the active #1081 wave (durable clinician
  profile, server-authoritative backend). A May-era gap inventory would
  mislead more than inform. Need: **superseded by the work actually
  happening**. Close.
- **#442** docs(gtm): PSV readiness pilot packet outline (May 30). Main's
  pilot pack (`docs/PILOT_*`, `docs/gtm/`) went through multiple later
  generations. Need: **stale**; if GTM still wants an outline, re-cut it
  from the current pack in an afternoon. Close.
- **#439** docs(ops): triage of the PR431 visual-system port (May 30).
  PR431 is long closed and the visual system was replaced by the
  design-reset direction promoted to `/` on Aug 5. Need: **gone**. Close.
- **#1–#46** (Dec 2025–Feb 2026, 43 PRs): the deep tail. No merge base with
  today's main — the repo's early history was rewritten, so these are
  unmergeable *as a matter of git mechanics*, whatever their content. Their
  themes (MATCHA, issuance/verification, trust ledger, lifecycle) all have
  later canonical implementations on main. Need per-PR: **gone in current
  form**; anything still wanted is a re-cut, never a merge. Close all.
- **#506, #748**: see §4 — both parked on decisions, both with the honest
  answer being close-and-recut.

## §7 — Policy: how to stop this backlog re-forming

The 08-02 episode is the diagnosis: **the repo produces dispositions but
not closures.** Recommendations, strongest first:

1. **Execution is part of the disposition.** A disposition doc that reaches
   founder sign-off must have its closure batch run within 48h, and the run
   recorded in `docs/ops/merge-ledger.md`. An unexecuted sentence is how 225
   became 194 still-open five days later.
2. **Stale janitor (auto-close).** Scheduled workflow: no push/comment for
   21 days → `stale` label + warning comment; 14 more days → close with the
   standard re-cut receipt + **branch delete**. Exemption: `parked` label,
   which is only valid with a named unblock condition and a 60-day expiry
   (re-affirm or it closes). This bounds the backlog at ~5 weeks of true
   inactivity, forever.
3. **Cap open PRs via wave discipline (net-zero rule).** Above a threshold
   (suggest 25 open), a wave may not open more PRs than it merges or closes.
   GitHub has no native cap, so enforce with a nightly job that fails/
   notifies when `open_count > 25`, and make the count part of the wave
   ledger. The Aug 7 lane (9 PRs in 15 minutes) is fine *if* it lands; it
   must not be possible on top of 200 corpses.
4. **Kill the bulk re-fire vector.** The Mar 22 / Jul 26 / Aug 2 sweeps
   re-ran full gate suites across stale branches with zero merges to show
   for it. Disable auto-"update branch" on anything labeled `stale`/`parked`,
   and add `concurrency: { group: pr-<number>, cancel-in-progress: true }`
   to the remaining heavyweight workflows so a rebase storm costs one run,
   not N.
5. **Parked means draft + label + condition + small.** Never a title-only
   "DO NOT MERGE" on a non-draft PR (#506 sat mergeable-looking for five
   weeks). And prefer *close-and-recut-at-arm-time* for small parked diffs:
   #506's 222 lines cost less to re-cut than to keep alive.
6. **Let dependabot manage dependabot.** Red/conflicting bumps get
   `@dependabot recreate`, not hand-rebasing; superseded bumps (#582 vs
   #1031) get closed the day the superseding PR merges.

---

## Appendix — full inventory (216 PRs)

Legend — MT: local `git merge-tree` vs `main@f0b3749` (**clean** /
**CONFLICT** / **ANCIENT** = no merge base, history rewritten). Behind:
commits on main since merge base. Bucket: (a) merge-ready · (b) superseded ·
(c) rotted · (d) parked · (e) in flight.

### Post-June (22)

| PR | Created | MT | Behind | Bucket | Title / note |
|---|---|---|---|---|---|
| #506 | 07-03 | CONFLICT | 509 | d | transport-auth gate /api/me/role — parked on env rollout + founder GO; 08-02 ruled close-and-recut |
| #574 | 07-06 | clean | 193 | e | actions/github-script 7→9 — red since Jul 26 sweep; `@dependabot rebase` then merge |
| #582 | 07-06 | clean | 56 | b | expo-notifications bump — superseded by #1031 (SDK 53) |
| #748 | 07-18 | clean | 194 | d | G4 evidence-graph backlinks — founder call vs ADR 0006; recut or close |
| #844 | 07-25 | CONFLICT | 193 | c | marketing next 15.5.21 — close + `@dependabot recreate` |
| #852 | 07-25 | clean | 56 | a | vite 6.4.3 — 16/16 green (Aug 2) |
| #853 | 07-25 | clean | 56 | a | otel core 2.8.0 — 15/15 green (Aug 2) |
| #891 | 07-26 | clean | 191 | a | flask 3.1.3 — 12/12 green; hand-exercise the Python service pre-merge |
| #986 | 07-31 | clean | 117 | a | continuity memory docs — 12/12 green |
| #1066 | 08-03 | clean | 34 | a | actions/cache 4→6 — 14/14 green |
| #1072 | 08-04 | CONFLICT | 30 | d | one-real-loop draft — payload shipped via #1075; founder confirm + close |
| #1076 | 08-05 | clean | 23 | a | postcss 8.5.23 — 15/15 green |
| #1079 | 08-05 | CONFLICT | 21 | d | homepage messaging — parked on founder promotion; rebase before any GO |
| #1081 | 08-05 | CONFLICT | 19 | d | durable clinician profile B1 — active draft; self-declared not-for-production |
| #1101 | 08-07 | clean | 1 | e | remove orphaned passport/sandbox trees |
| #1103 | 08-07 | clean | 0 | e | NPI form → /onboarding; overlap-check vs #1108 |
| #1104 | 08-07 | CONFLICT | 2 | e | retire 21 orphan routes — rebase (siblings landed) |
| #1105 | 08-07 | clean | 1 | e | close /admin/demo-reset finding |
| #1106 | 08-07 | clean | 1 | e | remove demoProfiles.ts |
| #1107 | 08-07 | clean | 2 | e | retire marketing dead code |
| #1108 | 08-07 | clean | 3 | e | carry ?npi= through passport stub |
| #1109 | 08-07 | clean | 1 | e | bucket E decisions (draft) |

### May 30 docs quartet (4) — all bucket (b), batch-rebased Jul 26

| PR | MT | Note |
|---|---|---|
| #439 | clean | PR431 port triage — target PR long closed; need gone |
| #440 | clean | Clerk gate diagnostics — auth gate rebuilt in July; need gone |
| #441 | clean | trust persistence inventory — superseded by the #1081 wave |
| #442 | clean | pilot packet outline — pilot pack regenerated since |

### April–May wave cohort (147) — Tier S of the 08-02 disposition, re-verified

Conflicting → (c); clean → (b). Stacked PRs marked ⧉ (close order irrelevant).

| PR | Created | MT | Bucket | Title (abbrev.) |
|---|---|---|---|---|
| #124 | 04-08 | CONFLICT | c | holder: clinician adoption loop |
| #125 | 04-08 | CONFLICT | c | holder: repo salvage map |
| #126 | 04-08 | CONFLICT | c | holder: repo harvest UX/TTFV |
| #127 | 04-09 | CONFLICT | c | holder: daily-use utility loop |
| #128 | 04-11 | CONFLICT | c | DecisionBlock UI + confidence primitives |
| #129 | 04-11 | CONFLICT | c | ttfv: auto-start ingest stream |
| #131 | 04-11 | CONFLICT | c | hybrid-loader: instant-render identity |
| #132 | 04-13 | CONFLICT | c | Wave 13 employer explainability |
| #133 | 04-13 | CONFLICT | c | wave14 graph substrate |
| #134 | 04-13 | CONFLICT | c | deterministic conflict-resolution engine |
| #153 | 04-19 | CONFLICT | c | pilot intake + operator handoff |
| #156 | 04-19 | clean | b | labs: acceptance-graph |
| #158 | 04-19 | CONFLICT | c | Trust Warranty & Risk Transfer |
| #159 | 04-24 | CONFLICT | c | Wave 246 Apply with VitalCV core loop |
| #160 | 04-24 | CONFLICT | c | smoke-test: WorkspaceMembership fixes |
| #161 | 04-24 | CONFLICT | c | Wave LIVE-100 public shell |
| #163 | 04-25 | CONFLICT | c | AI Knowledge Inbox (dup of #164/#165) |
| #164 | 04-25 | CONFLICT | c | knowledge inbox foundation (dup) |
| #165 | 04-25 | CONFLICT | c | knowledge inbox foundation (dup) |
| #181 | 04-27 | CONFLICT | c | reset completion board |
| #190 | 04-28 | CONFLICT | c | copy: passport wording |
| #206 | 05-03 | CONFLICT | c | security compliance delta |
| #212 | 05-03 | clean | b | map honest path to completion |
| #223 | 05-04 | clean | b | release-checklist + CI gate |
| #224 | 05-04 | clean | b | route map + CI gate |
| #225 | 05-04 | clean | b | banned-strings CI gate (live as check-public-claims) |
| #231 | 05-04 | clean | b | identity vendor foundation |
| #233 | 05-04 | clean | b | Stripe checkout gate |
| #236 | 05-04 | clean | b | PWA shell |
| #237 | 05-04 | clean | b | DB migration baseline |
| #238 | 05-04 | CONFLICT | c | signup domain gate |
| #239 | 05-04 | clean | b | document upload foundation |
| #240 | 05-04 | CONFLICT | c | cross-tenant PSV reuse block |
| #243 | 05-04 | CONFLICT | c | verifier org RBAC |
| #244 | 05-05 | clean | b | hero-route smoke workflow |
| #245 | 05-05 | clean | b | CV upload route (same branch as #246) |
| #246 | 05-05 | clean | b | export bundle route (same branch as #245) |
| #247 | 05-05 | CONFLICT | c | policy decision persistence |
| #248 | 05-05 | CONFLICT | c | verifier-invitation lifecycle |
| #249 | 05-05 | CONFLICT | c | a11y homepage landmark |
| #250 | 05-05 | CONFLICT | c | demo passport seed |
| #251 | 05-05 | CONFLICT | c | DB migrate cutover runbook |
| #266 | 05-07 | clean | b | CRS licensure cap |
| #267 | 05-07 | CONFLICT | c | CRS cap propagation |
| #269 | 05-07 | clean | b | Confidence Doctrine v2 |
| #272 | 05-07 | clean | b | OIG three-way confidence |
| #276 | 05-07 | clean | b | ROI Console v2 |
| #277 | 05-07 | CONFLICT | c | current-state map + PR triage (a previous triage doc, itself now rotted) |
| #278 | 05-07 | CONFLICT | c | restore qualifiers on Verified labels |
| #280 | 05-08 | CONFLICT | c | RBAC foundation primitives |
| #281 ⧉ | 05-08 | CONFLICT | c | RBAC fail-closed enforcement |
| #282 | 05-09 | CONFLICT | c | constitutional governance (base of the w2 stack) |
| #283 | 05-09 | clean | b | workflow composer + replay-safe requests |
| #284 | 05-09 | clean | b | credential artifact lifecycle |
| #285 | 05-10 | CONFLICT | c | human-ai-integrity |
| #286 | 05-10 | CONFLICT | c | deployment blueprints |
| #287 | 05-10 | clean | b | economic-trust ROI modeling |
| #288 ⧉ | 05-10 | CONFLICT | c | replay integrity suite |
| #289 | 05-10 | clean | b | simplicity compression layer |
| #290 | 05-10 | clean | b | production acceptance layer |
| #291 | 05-10 | clean | b | ecosystem readiness activation |
| #292 | 05-10 | clean | b | SAFE audit convergence |
| #293 ⧉ | 05-10 | CONFLICT | c | freeze verification suite |
| #294 | 05-10 | clean | b | activation readiness verification |
| #295 ⧉ | 05-11 | CONFLICT | c | activation audit |
| #296 | 05-11 | clean | b | governance stewardship |
| #297 | 05-11 | clean | b | covenant finalization |
| #298 ⧉ | 05-11 | CONFLICT | c | ecosystem activation finalization |
| #299 ⧉ | 05-11 | CONFLICT | c | runtime activation tests |
| #300 | 05-11 | clean | b | production seal |
| #301 ⧉ | 05-11 | CONFLICT | c | ignition validation |
| #302 ⧉ | 05-11 | CONFLICT | c | activation runbook tests |
| #303 ⧉ | 05-11 | CONFLICT | c | operational activation tests |
| #304 | 05-11 | CONFLICT | c | institutional hero rewrite |
| #305 | 05-11 | CONFLICT | c | wallet activation reality pass |
| #306 | 05-11 | clean | b | passport runtime audit |
| #307 | 05-11 | clean | b | dashboard hydration status |
| #308 | 05-11 | clean | b | scaffold apps/web-v2 sandbox (base of web-v2 stack) |
| #309 | 05-11 | clean | b | surface proofManifest |
| #310 ⧉ | 05-11 | CONFLICT | c | web-v2 Clerk sign-in |
| #311 | 05-11 | clean | b | activation flow audit |
| #312 | 05-11 | CONFLICT | c | passport replayLineage |
| #313 ⧉ | 05-11 | CONFLICT | c | backend replay-lineage |
| #314 | 05-11 | clean | b | Clerk + Google OAuth runbook |
| #315 | 05-11 | clean | b | crypto stack audit |
| #316 ⧉ | 05-11 | clean | b | web-v2 JWKS endpoint |
| #317 | 05-11 | clean | b | credential status audit |
| #318 | 05-11 | clean | b | signed export envelope |
| #319 | 05-11 | CONFLICT | c | durable schema additions |
| #320 | 05-11 | clean | b | pg_dump/pg_restore scripts |
| #321 | 05-11 | clean | b | verifier quickstart docs |
| #322 ⧉ | 05-11 | clean | b | web-v2 security headers |
| #323 ⧉ | 05-11 | clean | b | Trust State Console (web-v2) |
| #324 ⧉ | 05-11 | CONFLICT | c | wire ProofManifestPanel |
| #325 ⧉ | 05-11 | clean | b | TruthBoundary (web-v2) |
| #326 | 05-11 | clean | b | ES256 keypair generator |
| #327 | 05-11 | clean | b | status health route |
| #328 | 05-11 | clean | b | onboarding readiness checker |
| #329 | 05-11 | CONFLICT | c | .env.example template |
| #330 ⧉ | 05-11 | CONFLICT | c | passport lineage bridge |
| #331 | 05-12 | CONFLICT | c | wire /get-ready NPI binding |
| #332 | 05-12 | CONFLICT | c | reject anonymous pilot events |
| #333 ⧉ | 05-12 | CONFLICT | c | structured CORS rejection |
| #334 | 05-12 | CONFLICT | c | /api/health expansion |
| #335 ⧉ | 05-12 | clean | b | DegradedState renderer (web-v2) |
| #336 | 05-12 | clean | b | recent-NPI history primitive |
| #337 | 05-12 | CONFLICT | c | runtime channel taxonomy |
| #338 | 05-12 | clean | b | production promotion protocol |
| #339 | 05-12 | clean | b | trust-readiness boundary |
| #340 | 05-12 | CONFLICT | c | passport proxy shape fix |
| #341 | 05-12 | clean | b | trust primitives Lane B (base of trust stack) |
| #342 ⧉ | 05-12 | CONFLICT | c | primitives adoption Wave 2 |
| #343 | 05-12 | CONFLICT | c | replay identity Wave 10 |
| #344 ⧉ | 05-12 | CONFLICT | c | survivability simulation suite |
| #345 ⧉ | 05-12 | CONFLICT | c | /verify surface (shipped canonically since — 08-02 spot-check) |
| #346 | 05-12 | clean | b | issuer purity guards |
| #347 | 05-12 | CONFLICT | c | anonymous write extinction |
| #348 | 05-12 | clean | b | audit-chain actor attribution |
| #349 | 05-12 | clean | b | well-known discovery (base of verifier stack) |
| #355 ⧉ | 05-13 | CONFLICT | c | verifier completion surfaces |
| #356 | 05-13 | clean | b | Tier-1 merge readiness audit (meta-doc about a dead PR stack) |
| #357 | 05-13 | CONFLICT | c | build artifacts + apex forensics |
| #358 | 05-13 | clean | b | canonical trust route map |
| #363 | 05-15 | clean | b | retract vcv-web canonical claim |
| #364 | 05-16 | clean | b | launch-readiness synthesis |
| #366 | 05-16 | CONFLICT | c | /launch + /demo flows |
| #367 | 05-17 | CONFLICT | c | OpenEvidence demo spine (dup of #368) |
| #368 | 05-17 | CONFLICT | c | OpenEvidence demo spine (dup of #367) |
| #369 | 05-17 | clean | b | persist pilot/walkthrough leads |
| #371 | 05-17 | clean | b | audit event id after acceptance |
| #372 | 05-17 | clean | b | source-health remediation hints |
| #374 | 05-17 | clean | b | founder smoke checklist |
| #376 | 05-18 | clean | b | Vercel exit emergency plan (Vercel already exited — need gone) |
| #377 | 05-18 | clean | b | local Cloudflare demo operator |
| #378 | 05-19 | clean | b | trust surfaces canon |
| #379 | 05-19 | clean | b | codebase map (.planning) |
| #381 | 05-19 | clean | b | prisma namespace contracts |
| #382 | 05-19 | clean | b | trust primitives (base of stack) |
| #383 ⧉ | 05-19 | clean | b | trust systems integration |
| #384 | 05-19 | clean | b | .well-known per-request host |
| #385 | 05-19 | clean | b | matuschak provenance panes |
| #386 ⧉ | 05-19 | clean | b | provenance navigation |
| #387 | 05-19 | clean | b | Pilot Deployment Kit route |
| #391 | 05-20 | clean | b | truth-constrained semantics |
| #395 ⧉ | 05-20 | clean | b | exchange rehearsal infra |
| #400 ⧉ | 05-21 | clean | b | pilot narrative compression |
| #401 ⧉ | 05-21 | clean | b | institutional intake momentum |

### Ancient cohort (43) — all bucket (c): no merge base with today's main

#1, #2, #4–#29 (Dec 2025 codex waves: MATCHA, Ed25519 VC issuance,
verifier DID checks, World ID gating, pulse/discover, compliance packs,
employer risk, issuer registry, notifications, renewals, ATS adapters,
trust graph, OIDC4VP, ON readiness, PSL, lifecycle, trust ledger,
Merkle verification, revocation governance, consent receipts);
#30–#39 (Dec 28 wave), #40 (codex-wave-04), #41 ⧉ (stacked on #40),
#42 (role entry shell); #45/#46 (Feb 9, duplicate vercel-bot RSC CVE
drafts — CVE cleared by later Next upgrades).

All were last mass-touched 2026-03-22 04:20 UTC by a bulk operation. The
history they branch from was rewritten; merging is mechanically impossible.
Close all; anything still wanted is a re-cut from main.

---

*Supersedes the execution-pending portions of
[`open-pr-disposition-2026-08-02.md`](open-pr-disposition-2026-08-02.md);
that document's Tier-S sentence stands and is re-affirmed here with
merge-tree evidence. Verification data (merge bases, merge-tree results,
check-run enumerations) gathered 2026-08-07 19:50–21:40 UTC against
`main@f0b3749d3f8`.*
