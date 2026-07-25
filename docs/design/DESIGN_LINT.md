# Design lint (DG-18.4) — the rules that keep the system honest

**Established:** 2026-07-22
**Source:** `wave1505/DESIGN_LINT.md` from the 2026-07-12 Claude Design handoff bundle, adapted to this repository.
**Enforced by:** `scripts/check-design-lint.ts` · CI job `Design Lint Gate` · `pnpm check:design`
**Composition contract:** [`docs/strategy/competitive-mandate.md`](../strategy/competitive-mandate.md) (R1–R8)

Two machine-enforceable specs keep the design system honest after the design
program ends: lint rules that make off-system code fail CI (DG-18.4, this
document and `check-design-lint.ts`), and a screenshot matrix that catches
visual drift ([DG-18.3](#dg-183--visual-regression), built for the film — with
a measured account of what a screenshot diff can and cannot catch).

---

## Why this is not a straight port of the handoff spec

The handoff's rules were written for a **greenfield** implementation of the
design system. Measured against this codebase on 2026-07-22, enforcing them
as-written would have failed on arrival:

| Rule | Existing violations |
| --- | --- |
| LINT-01 raw color | 237 |
| LINT-02 raw lucide import | 317 |
| LINT-03 `@keyframes` | 118 |
| LINT-05 literal `z-index` | 28 |
| LINT-06 non-token `box-shadow` | 82 |
| LINT-09 `font-family` literal | 88 |

A gate that is red the day it lands teaches everyone to ignore it. So every
rule carries a **mode**:

- **`error`** — must be zero. Used where the codebase is already clean, and for
  the COMPETE composition rules, which are new contract with no legacy.
- **`ratchet`** — a measured baseline in `scripts/design-lint-baseline.json`
  that may **shrink but never grow**.

Ratchets are not a permanent excuse. Lower a baseline as debt is paid — the
script tells you when a count has dropped below its recorded baseline and asks
you to re-record it. It cannot drift upward.

```bash
pnpm check:design            # enforce
pnpm check:design --update   # re-record baselines (review the diff)
```

---

## Rules

### Design system

| ID | Mode | Rule | Allowed |
| --- | --- | --- | --- |
| **LINT-01** | ratchet | No raw color (`#hex`, `oklch()`, `rgb()`, `hsl()`) on a color-bearing property | `styles/tokens.css`, `styles/theme.css`, `app/globals.css` |
| **LINT-02** | ratchet | No raw `lucide-react` import — the glyph set is closed | `components/Icon.tsx`. Truth-state iconography is `TrustGlyph` **only** |
| **LINT-03** | ratchet | No `@keyframes` outside the house motion file | `styles/motion.css`. Adding one needs a CHANGES entry |
| **LINT-04** | **error** | No dark/ops token (`data-theme="ops"`, `--vt-surface-inverse`, `var(--ink-950)`) on a public route | `app/(ops)/`-class surfaces and `publicSurfaceRoutes.ts` |
| **LINT-05** | ratchet | No literal `z-index` — use a `--vt-z-*` stop | token files |
| **LINT-06** | ratchet | No `box-shadow` other than `none` or a token | token files |
| **LINT-08** | **error** | No prohibited marketing copy: `cheapest`, `guaranteed roi/results`, `as seen in`, `trusted by N`, `100% secure/verified`, `blockchain-verified`, `bank-level` | A line that **negates** the phrase (`no`, `never`, `without`, `prohibit`) — a surface may quote a claim in order to forbid it |
| **LINT-09** | ratchet | `font-family` must be `var(--font-*)` | token files, `fonts.css` |

**LINT-07** — *gated/unavailable never renders a checkmark* — is a **component
test**, not a grep: `apps/web/__tests__/design-lint-state-chip.test.tsx`. It
asserts that `StateChip`'s rendered glyph agrees with the `affirmative` flag
declared in `lib/vital/evidenceState.ts`, so a new state or a flipped flag is
caught automatically. This is a truth rule before it is a style rule: a check
beside "access required" tells a clinician their licensure was confirmed when
nobody looked.

**LINT-10** — *glyph without label in a chip* — is **not implemented**. It needs
a custom eslint rule; the repo has no eslint plugin infrastructure for it yet.

### COMPETE composition rules

These are new contract from the competitive mandate, scoped to the homepage
surfaces. They are hard errors **in the film**, because the film was built to
them and has no legacy.

| ID | Mode | Rule |
| --- | --- | --- |
| **R1** | error | No graph vocabulary or node/edge drawing (`constellation`, `forceGraph`, `.lineTo(`, `.moveTo(`, "drag to rotate") |
| **R2** | error | No Rolodex, carousel, wide card queue, `scroll-snap-type`, `JourneyCard`, `HorizontalStoryRail` |
| **R4** | error | No metric theatre in the film (`AnimatedMetricValue`, `ReadinessRing`, `MetricStrip`, `role="meter"`) |
| **R4-legacy** | ratchet | The same rule on the un-migrated `/`. **Baseline 2** — `HomePageClient` still mounts `MetricStrip`, which the C5 ruling retires. Goes to zero when `/` switches to `HorizontalCareerFilm` |
| **R7** | error | No retired legacy copy (`Find the opportunity`, `VitalCV recognizes`) |
| **R8** | error | No second page-level scroll owner (`wheel`/`touchmove` listener, `onWheel`) |

R3, R5, and R6 are structural/visual and are guarded by
`homepage-composition-gate.test.tsx` and the film's own e2e suite rather than by
grep.

---

## Implementation notes

**Comments are stripped before matching** for code rules. Several of these files
*document* the rule they follow ("no wheel listener", "never `preventDefault`"),
and a naive scan matches the prose and fails correct code. Scan behavior, not
documentation.

**The gate has been proven to bite.** Introducing `Find the opportunity` into a
film source file fails R7 with exit code 1; removing it returns exit 0. A gate
nobody has watched fail is not a gate.

**Do not pipe the gate when asserting its exit code.** `pnpm check:design | tail`
reports `tail`'s status, not the gate's.

---

## Two things a ratchet cannot do (learned 2026-07-22)

**A buggy rule inflates its own baseline.** LINT-06 and LINT-09 shipped as
`/font-family\s*:\s*(?!var\()/`. That flags *correctly tokenised* code: the
engine backtracks `\s*` to zero width, evaluates the lookahead against the
leading space, finds no `var(` there, and matches. The `\s*` must sit **inside**
the lookahead. Fixing it dropped LINT-09 from 88 to **8** — 91% of that baseline
was noise — and LINT-06 from 82 to **61**.

A ratchet holding a fabricated number is worse than no ratchet: it looks like
enforcement while real debt hides underneath the false positives.
`apps/web/__tests__/design-lint-rules.test.ts` now pins each pattern against
hand-written good and bad lines, and asserts that **no** rule places `\s*`
outside a negative lookahead.

**A ratchet blames the PR for main's debt.** Baselines are committed numbers,
so when main lands new violations the next branch to merge main inherits them
and fails. That happened here: merging main brought `wave1501-home.css` with
exactly 2 `@keyframes` and 1 literal `z-index`, which is exactly the +2/+1 that
failed LINT-03 and LINT-05 on a branch that had added neither.

The current answer is to re-measure after merging main, and to **attribute the
delta before doing so** — `git diff --diff-filter=A $(git merge-base HEAD
origin/main) origin/main` names the files main added, so "is this mine?" is a
30-second check, not a judgement call. Re-baselining without that check is how a
ratchet quietly becomes a rubber stamp.

The better fix, not yet built: compute main's counts at runtime and compare
against those instead of a committed file, so the gate asks "did *this branch*
add debt?" directly.

---

## DG-18.3 — visual regression

Built, scoped to the film: `apps/web/tests/e2e/film-visual.spec.ts`, 11
captures across desktop (six scene boundaries + a mid-transition frame),
tablet 768×1024, mobile 360×740, the static tier, and reduced motion.
`maxDiffPixelRatio` 0.001, `animations: 'disabled'`, waiting on
`document.fonts.ready`. Dynamic content masks by the `data-vr-mask` attribute,
never by pixel coordinate.

**Determinism.** The atmosphere drifts continuously, so a naive screenshot is
flaky by construction. `?filmFreeze=1` renders one frame at time 0 — the same
frame the static tier and the SSR poster draw — so a capture is a real frame of
the composition, not a test-only rendering path. Reduced motion is deliberately
**not** used to stabilise the film: it resolves the static tier, which disables
the film and would silently baseline the vertical fallback instead.

**What it catches, and what it does not.** Measured 2026-07-22 by reintroducing
the paint-order bug: it moved **91 px**, while the run-to-run noise floor is
**33 px**, against a 0.001 budget of ~1296 px. Signal and noise overlap, so no
threshold separates them. The screenshot suite is the right instrument for
*gross* regressions — content blanking, scenes drifting, a card edge appearing.
It is the wrong instrument for paint order, which is asserted directly in
`compete-film.spec.ts` ("the film track paints in front of the atmosphere").

Two instruments were tried and rejected for paint order, both recorded in the
spec so they are not retried: `document.elementFromPoint` is **vacuous** here
(the atmosphere is `pointer-events: none`, so the canvas can never be the
hit-test result — that test passed with the bug deliberately reintroduced), and
the screenshot diff per above.

**Baselines are production-mode Linux, and only that.** Two axes change the
pixels; Playwright names only one:

- **Platform** — tagged `-chromium-darwin` / `-chromium-linux`. Font
  rasterisation differs enough to fail every diff.
- **Server mode** — *not* tagged. `next dev` renders the Next.js dev-tools
  badge in the corner; `next start` does not.

The second one bit immediately. The first baseline set was captured against
`pnpm dev`; running the same specs the way CI does (production build) failed
tablet and mobile on **899 px** and **777 px**, most of it that badge. A
baseline captured in dev mode encodes a dev-only UI element and is not evidence
about the product, so that set was **deleted rather than masked** — masking the
badge would patch the symptom and leave every other dev/prod difference
unaccounted for.

So there is one authoritative set: **ubuntu + production build**, generated by
the **Visual Baselines** workflow (`workflow_dispatch`, `CI=true` so webServer
runs `preview:e2e`). Download the artifact, unzip into
`apps/web/tests/e2e/film-visual.spec.ts-snapshots/`, commit in a PR. Committing
from CI is deliberately not automated: a baseline update asserts a visual change
was *intended*, and that needs a human.

> **A skip-guard placed before `toHaveScreenshot()` silently breaks
> generation.** `requireBaseline()` runs first, so under `--update-snapshots`
> the screenshot call never executes and nothing is written — the workflow
> reported `6 skipped`, uploaded the stale files already in the checkout, and
> went green. Measured, not assumed (Playwright 1.58):
> `config.updateSnapshots` is `'missing'` by default and `'changed'` under
> `--update-snapshots`, so the guard stands down unless the value is
> `'missing'`. The workflow now clears the snapshot dirs first, asserts files
> were written, and rejects a `-darwin` suffix on an ubuntu runner — a skipped
> generation run can no longer masquerade as a successful one.

Locally the suite therefore **skips** (`requireBaseline`), which is deliberate
rather than a gap — local dev-mode rendering is not what CI enforces, so a
passing local visual run would be false comfort. It arms itself the moment the
Linux baselines land, with no code change.

**The suite only ran at all because of a separate fix.** CI serves a production
build, where `/dev/compete-film` 404s unless `COMPETE_FILM_PREVIEW=1` is set in
`playwright.config.ts`. It was not, so all 19 film specs **silently skipped**
and the e2e job reported pass on a PR where none of them ran. `film-harness.ts`
now makes that asymmetric: locally a missing harness is a legitimate skip; in
CI it is a configuration error and **fails loudly**, because CI is the only
place the result is used as evidence.

**Not yet extended** to the nine other DG-18.3 matrix routes (`/`, `/pricing`,
`/contact`, `/legal/privacy`, `/get-ready`, `/passport`, `/p/[slug]`,
`/review/request`, `/trust`, `/status`). Those carry freshness stamps and run
ids that need `data-vr-mask` attributes added at the source first; the canonical
list is `REGRESSION_MATRIX.md` in the handoff bundle.

---

## Not yet built

- **DG-18.2 — `/dev/design`**, the living style guide: every primitive in every
  state with the usage rule beside it. "If it isn't here, it isn't in the
  system."
- **LINT-10**, per above.
- The nine remaining DG-18.3 matrix routes, per above.
