# PR #834 — audit against the horizontal-film contract

**Audited:** 2026-07-21 (COMPETE-0, dispatch item 2)
**Subject:** [PR #834](https://github.com/ctol3r/vitalcv/pull/834) — `design/wave1501-homepage`
**Contract:** [`docs/strategy/competitive-mandate.md`](../strategy/competitive-mandate.md) (retired mechanisms R1–R8)
**Base:** branch is 1 ahead / 0 behind `origin/main` — this is an audit of current work, not a stale base.

## Verdict

> **Keep isolated as a design reference. Do not promote to `/`. Do not build on its layout.**

## Correction to the dispatch

The mandate directed: *"Do not merge [PR #834](https://github.com/ctol3r/vitalcv/pull/834) as the homepage."* That instruction is **already satisfied by the PR as written** — it never touches `/`. Verified three ways:

1. `git diff --name-only origin/main...origin/design/wave1501-homepage -- apps/web/app` returns exactly one path: `apps/web/app/design/wave1501/page.tsx`.
2. Blob hashes for `apps/web/app/page.tsx`, `apps/web/app/HomePageClient.tsx`, and `apps/web/app/layout.tsx` are **identical** on both branches.
3. The stylesheet is imported from the island, not a global entry, and every rule is scoped `.w1501` — enforced by a selector-walking assertion at `apps/web/__tests__/design-wave1501.test.tsx:46-58`.

The mandate also implies #834 contains a horizontal Rolodex. **It does not.** No `overflow-x`, `scroll-snap`, carousel, or marquee appears in any of its six TSX files or its 496-line stylesheet. It is a conventional **vertical** editorial page. The gap from the target is therefore larger, not smaller, than "remove a Rolodex": it fails the film contract's *positive* requirement outright.

The only change to a pre-existing file is a route-count bump at `apps/web/__tests__/page-density-system.test.tsx:38-40` (138 → 139), the known exact-count tripwire.

## Contract violations

Five of the eight retired mechanisms are present. All are **blocking for `/`**; none matter on the isolated `noindex` route.

| Retired mechanism | Evidence | Detail |
| --- | --- | --- |
| **R1 — public graph / constellation** | `components/home/w1501/Sky.tsx:31-42` | 10 labeled career nodes (`{ t: 0.02, a: 206, r: 0.92, label: 'NPI issued', src: 'NPPES' }`) |
| R1 — node-link edges | `Sky.tsx:46-47`, `:145-159` | `skyPath()` builds `M…L…` and renders `<path d={skyPath(recorded)} />` — literal edges between nodes |
| R1 — drag/physics control | `Sky.tsx:90-102`; `styles/wave1501-home.css:375-376` | `onDown` rotation drag; `.sky-stage.draggable { cursor: grab; }` |
| R1 — named in visible copy | `Sky.tsx:107,110,264` | `data-screen-label="Career constellation"`, `eyebrow="Constellation"`, `DRAG TO ROTATE` |
| **R3 — feature-card grid** | `sections.tsx:99-118`; CSS `:320` | `.why-grid { grid-template-columns: repeat(3, 1fr); }` with 3 `PaperCard`s |
| R3 — product-card grid | `sections.tsx:275-292`; CSS `:406` | `.door-grid` with 4 role-door `Link` cards |
| **R4 — numbered steps** | `sections.tsx:21-35,52-54`; CSS `:307-310` | Steps `1`–`5` rendered at `font-size: 44px` |
| R4 — percentage ring | `primitives.tsx:318-385`, esp. `:366-367` | `role="meter"` ring rendering `{value}%` |
| R4 — hard-coded 72% readiness | `Hero.tsx:126,132`; `primitives.tsx:319` | `setTimeout(() => setRing(72), 260)`. **Also trips the existing `/` guard** `__tests__/homepage-truth-pass.test.tsx:33` (`expect(html).not.toContain('72%')`) |
| R4 — "72%" in body copy | `sections.tsx:134-135` | `'What does 72% readiness mean?'` |
| **R6 — generic section headers** | `sections.tsx:38,41` | `eyebrow="How it works"` |
| R6 — visible section taxonomy | `sections.tsx:41,92,177,271,322`; `Sky.tsx:110` | Six taxonomy eyebrows |
| **R7 — retired legacy copy** | `Hero.tsx:239-240`; `Wave1501Client.tsx:128-130` | `Find the opportunity. Prove your career once.` — and **pinned by a new test** at `__tests__/design-wave1501.test.tsx:74`, so it cannot drift silently |
| R5 — in-page section navigator | `Wave1501Client.tsx:49-76` | `#how` / `#roles` anchors. Cosmetic here (the route self-chromes); a duplicate-nav violation only if promoted |
| — **copy ceiling** | `sections.tsx` and others | ≥479 prose words in single-quoted literals alone, excluding JSX text nodes. The mandate's ceiling is one short phrase per scene |

### Explicitly clean — do not credit these as violations

- **R2 (Rolodex / carousel): absent.** Verified by grep across all six TSX files and the stylesheet.
- **R5 (dot rail / outline rail): absent.** The nav anchors are the only in-page navigation, and the global Navbar is suppressed for `/design` (`components/layout/publicSurfaceRoutes.ts:56`).
- **R8 (competing scroll owners): essentially absent.** One entrance-motion pattern, one fire-once rAF (`shared.tsx:40`), no scrub, no pin. Each below-fold `Reveal` does register its own scroll listener (`shared.tsx:91`) — roughly 30 at runtime. That is redundancy, not competition.
- **Truth-contract strings: clean.** All eleven banned phrases appear only inside the PR's own negative test assertions (`design-wave1501.test.tsx:112-113`). The state table uses `'Checked'`, never a bare `'Verified'` (`primitives.tsx:129`, guarded at `:111`).
- **Cloud Dancer: compliant.** `--paper-100: var(--vt-cloud-dancer, #f0eee9)` (`wave1501-home.css:36`); the handoff's `#f4f2ec` is explicitly rejected and guarded (`design-wave1501.test.tsx:63-64`).
- **Synthetic data is disclosed, not passed off as real.** `HonestyLabel` "Illustrative example · not a real clinician" (`Hero.tsx:192`); the constellation's future events are sourced `'Illustrative'` with a screen-reader parallel list marking each entry recorded vs not recorded (`Sky.tsx:39-41,252-258`). Acceptable on a `noindex` design route; would need re-review on `/`.

## Salvage list — harvest into COMPETE-1

| Asset | Location | Why it survives |
| --- | --- | --- |
| `TrustGlyph` + `STATE_META` + `StateChip` | `primitives.tsx:55-185` | Eleven monochrome state glyphs from one source-of-truth table. This is precisely the "evidence as fragments, receipts, source light" vocabulary the mandate permits — glyph-first, near-wordless, already truth-safe |
| `HonestyLabel` | `primitives.tsx:207-232` | Disclosure as a designed mark rather than fine print. Reusable verbatim in a film frame |
| `FreshnessStamp` + corrected lane cadences | `primitives.tsx:189-203`; `Hero.tsx:188-190` | Reconciles the July 12 handoff against `lib/trust/sourceLanes.ts`, fixing the handoff's "2h ago" and PECOS-as-gated errors. **This correction is independently valuable — do not discard it with the layout** |
| Segmented NPI field | `Hero.tsx:46-120` | One real accessible input rendered into ten mono cells, using the canonical shared `checkNpi` rather than a duplicated Luhn. A ten-cell fill is a strong, almost copyless moment |
| Scoped-token discipline | `wave1501-home.css:33-154`; guarded `design-wave1501.test.tsx:25-65` | `.w1501`-only publication + `w1501-*` keyframe namespacing + a selector-walking test. The right pattern for any scoped homepage island; defends against a real `--vt-focus-ring` collision |
| No-JS motion gate | `wave1501-home.css:200-215`; `shared.tsx:36-43` | `.hp-reveal` hides only under `html.js.motion-live`, armed in a rAF from the island root — SSR HTML is always visible, the fold never flashes. Directly transferable |
| `SecHead` scaffold | `shared.tsx:111-131` | Structurally sound; the component survives, its six taxonomy `eyebrow=` strings do not |

**Not salvageable for `/`:** `Sky.tsx` (entire constellation), `ReadinessRing`, `how-grid` / `why-grid` / `door-grid`, and the hero + footer copy.

## Reasoning

The PR is honestly scoped and technically careful: it changes nothing live, it noindexes itself, its stylesheet is provably confined, it corrects three real truth errors in the source handoff, and it carries no banned claim strings. Closing it would destroy the only in-repo copy of the nine JSX handoff sources, which previously existed only in a Dropbox archive — an archival loss for no gain.

But it is not the direction. Rework would mean deleting `Sky.tsx`, `ReadinessRing`, all three card grids, the numbered steps, every section eyebrow, and the hero and footer copy — most of its 1,841 shipped lines. What would remain is the primitives layer, the scoping discipline, and the NPI field, all of which the salvage list already captures.

**Treat any argument beginning "we already built the homepage at `/design/wave1501`" as answered: the surface it built is the one this mandate retired.**
