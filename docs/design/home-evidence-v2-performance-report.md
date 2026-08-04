# Home Evidence Experience v2 — performance report

Measured 2026-08-02 against commit `b4b387efd`.

Every number here was produced by a command in this repo on that date. Nothing
is recalled, and nothing is carried over from an earlier wave. Where a metric
was **not** measured it says so and says what it would take — the release
receipt's discipline, applied to performance.

---

## The honest framing first

**These are lab numbers on localhost. They are not field data.**

The lab run has no network RTT, no CPU throttling, a warm OS page cache and a
single client. A 56 ms LCP on `127.0.0.1` says almost nothing about a clinician
on hospital wifi. Core Web Vitals thresholds are defined at the **75th
percentile of real users**, and this repo collects no field data, so no row
below may be read as "we pass LCP."

What the lab run *is* good for: catching a regression between two builds, and
proving layout stability. **CLS is the exception** — layout shift is a property
of the layout, not of the network, so a lab CLS of 0 is meaningful evidence.

---

## 1. Payload

| METRIC | BASELINE | FINAL | DELTA | TOOL | URL | DEVICE PROFILE | DATE | INTERPRETATION |
|---|---|---|---|---|---|---|---|---|
| First Load JS — shared by all | **102 kB** (recorded in `home-evidence-experience-v2.md` §"Bundle baseline") | **102 kB** | **0 kB** | `pnpm turbo run build --filter @vitalcv/web` | — | n/a (build output) | 2026-08-02 | The whole v2 program — `EvidenceInput`, `evidenceInputState`, the capsule, the surface and motion stylesheets — added **nothing** to the shared bundle. |
| First Load JS — homepage `/` | not recorded pre-v2 | **240 kB** | unknown | same | `/` | n/a | 2026-08-02 | Route-specific JS is 138 kB over the shared floor. No pre-v2 figure was ever recorded, so this is a baseline for the next wave, not a delta. |
| Route size — `/` | not recorded | **5.68 kB** | unknown | same | `/` | n/a | 2026-08-02 | The page's own chunk. Small; the weight is in shared and route-level vendor code. |
| Middleware | not recorded | **86.9 kB** | unknown | same | all routes | n/a | 2026-08-02 | Runs on every request. Larger than the homepage's own chunk. |
| CSS — homepage, uncompressed | not recorded | **649,951 B (634 kB)** across 4 files | unknown | `wc -c` on the 4 `<link rel=stylesheet>` hrefs the served HTML declares | `/` | n/a | 2026-08-02 | **The finding of this report.** See below. |
| CSS — homepage, gzipped | not recorded | **95,109 B (93 kB)** | unknown | `gzip -c` over the same 4 files | `/` | n/a | 2026-08-02 | Compressed CSS is ~91% of the entire shared JS bundle. |

### The CSS finding

Four stylesheets serve the homepage. One of them is **586,165 B — 90% of the
total**:

```
62c2e428fee498aa.css     6,158 B
6c8307d23cc95bb3.css   586,165 B   <-- 90%
d112128b4437a746.css    24,857 B
e023b5c8c1813e31.css    32,771 B
                       ---------
                       649,951 B   (95,109 B gzipped)
```

93 kB of gzipped CSS is not a crisis, and it is render-blocking on a page whose
LCP element is text. But it is the largest single asset class the homepage
ships, it is **not** attributable to this program (the v2 stylesheets —
`home-surfaces.css`, `motion.css`, `evidence-input.css`, `evidence-capsule.css`,
`ask-home.css` — are a small fraction of it), and nobody had measured it.

Recorded as a **finding for a future wave**, not fixed here: identifying what
that 586 kB file contains, and whether it is one global Tailwind/`@theme`
build being shipped whole to every route, is its own investigation with its own
risk. Changing global CSS to chase a number is exactly how this repo has broken
paint order before.

---

## 2. Runtime — lab

Method: `apps/web/scripts/measure-home-vitals.mjs`, 5 cold contexts against a
`next start` production build, viewport 1440×900, page brought to front.

The script is deliberately standalone rather than a Playwright spec: the e2e
config runs `dev:e2e` locally, and a dev build's timings measure nothing
shippable. It also does not use the in-app browser pane — that pane loads tabs
hidden, and Chromium reports **no LCP for a page that was never visible**. The
first attempt returned `lcp: null` for exactly that reason, and the script
carries a comment saying so.

| METRIC | BASELINE | FINAL (median of 5) | DELTA | TOOL | URL | DEVICE PROFILE | DATE | INTERPRETATION |
|---|---|---|---|---|---|---|---|---|
| LCP (lab) | none | **56 ms** — raw 128 / 68 / 36 / 56 / 48 | n/a | `measure-home-vitals.mjs` | `http://127.0.0.1:3461/` | localhost, no throttle, Apple silicon | 2026-08-02 | **Not field-predictive.** No RTT and no CPU throttle. Useful only as a regression tripwire against an identically-run future build. The 128 ms first run is cold-cache. |
| CLS (lab) | none | **0** — 0 in **5 of 5** runs, zero shift entries recorded | n/a | same | same | same | 2026-08-02 | **This one is meaningful.** Layout shift is a property of the layout, not the network. Corroborated independently by §3. |
| FCP (lab) | none | **56 ms** | n/a | same | same | same | 2026-08-02 | Equal to LCP: the largest element paints in the first frame, consistent with a text hero. |
| TTFB (lab) | none | **5 ms** | n/a | same | same | same | 2026-08-02 | Localhost. Says nothing about Railway. |
| `domInteractive` | none | **23 ms** | n/a | same | same | same | 2026-08-02 | — |
| `loadEventEnd` | none | **56 ms** | n/a | same | same | same | 2026-08-02 | 31 subresources. |

### Not measured

| METRIC | WHY NOT | WHAT IT WOULD TAKE |
|---|---|---|
| **INP** | INP needs real interactions sampled over a session; there is no field-data pipeline in this repo, and a synthetic single-click "INP" would be a made-up number wearing a real metric's name. | RUM (`web-vitals` reporting to an endpoint), or an explicit lab interaction-latency harness that is not called INP. |
| **Input-to-validation response** | Not instrumented. `checkNpi` runs synchronously during render, so the plausible answer is "one frame" — but plausible is not measured. | A `performance.mark` around keystroke → derived state, run over N keystrokes. |
| **Submit-to-resolving render** | Not instrumented. Confounded by the mocked vs. live API distinction: the e2e path stubs `/api/identity/bootstrap`, so any figure would measure the mock. | Marks around submit → first `resolving` paint, measured separately for mocked and live. |
| **Field LCP / CLS / INP** | No RUM. | A field-data pipeline. Until then no row here may be presented as passing Core Web Vitals. |

---

## 3. Layout stability — §10.3

Measured by `apps/web/tests/e2e/home-layout-stability.spec.ts`, which asserts
these and writes what it measured to `artifacts/home-v2/layout-stability.json`.
The report quotes numbers that test produced.

Anchors in **document** coordinates (`rect + scroll offset`), viewport 1440×900,
all values CSS px as `y/height`:

| FRAME | scrollY | h1 | CTA | message band | field |
|---|---|---|---|---|---|
| 1 idle | 0 | 248/118 | 623/44 | 563/26 | 421/128 |
| 2 focused (label floated) | 0 | 248/118 | 623/44 | 563/26 | 421/128 |
| 3 valid (CTA enabled) | 0 | 248/118 | 623/44 | 563/26 | 421/128 |
| 4 submitting | 0 | 248/118 | — | — | — |
| 5 resolved (capsule) | 0 | 248/118 | — | — | — |
| 6 reset | 552 | 248/118 | 623/44 | 563/26 | 421/128 |

`—` = the field is unmounted while the capsule is shown; that is the intended
composition, not a missing measurement.

**Every anchor is identical in every frame it exists in.** The headline never
moves and never resizes. The CTA returns to its idle geometry **exactly** after
a full round trip. The message band holds 26 px whether it carries the counter
or the correction — measured separately in the second test, which drives a
bad-checksum NPI and asserts the band's height delta is `0` and the CTA's `y`
delta is `0`.

Against the contract's six required checks:

| CHECK | RESULT |
|---|---|
| Label float does not move surrounding page | **PASS** — h1, CTA, band, field all identical between frames 1 and 2 |
| Error reserves or predictably adds space | **PASS** — band height delta 0 with the correction shown |
| Button does not change width | **PASS** — CTA `w`/`h` delta 0 on enablement; ≤1 px on the `Checking…` swap |
| Narration container has stable minimum dimensions | **PASS** — band constant at 563/26 |
| Result insertion does not move the active control | **PASS** — h1 delta 0 across the capsule mount |
| Reset restores geometry | **PASS** — frame 6 identical to frame 1 |

### One measurement bug worth recording

The first run of this spec **failed**, reporting the headline moving 232 px on
reset. That was the measurement, not the page: `getBoundingClientRect` is
viewport-relative, and this flow scrolls twice (the capsule mounts, then reset
focuses the field back). `scrollY` is **552** at frame 6 and `0` at frame 1.

Measured in document coordinates the movement is zero. The spec now adds the
scroll offset and records `__scroll` in its artifact so the next reader can see
the correction rather than rediscover it. A layout-stability test that does not
account for scroll will report a scroll as a regression, every time.

---

## 4. What this report does not establish

- **Any field performance claim.** Lab only, one machine, no throttling.
- **Cross-browser behaviour.** Chromium only, matching the suite.
- **Real-device behaviour.** Viewport emulation; no physical phone.
- **That 93 kB of gzipped CSS is acceptable.** It is measured, not judged.
