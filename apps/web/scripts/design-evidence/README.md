# Design evidence harness

Playwright capture used to produce the visual/accessibility evidence a design
wave ships with. Promoted out of `docs/design/evidence/d00-visual-baseline/`
during D-01A, where the same scripts lived as one-off copies.

They live under `apps/web/` for a boring but load-bearing reason: **ESM resolves
imports relative to the importing file, not the working directory.** The D-00
copies sat in `docs/`, where `@playwright/test` is not resolvable, so the
documented "run from apps/web" recipe could never have worked from that path.

## Running

Always against a **production** build, never `next dev` — dev serves unminified
CSS through a different pipeline and its timings are not comparable.

```bash
pnpm turbo run build --filter @vitalcv/web
pnpm --filter @vitalcv/web exec next start -H localhost -p 4319
```

Bind to `localhost`, not `127.0.0.1`: Next 15's router worker dials `localhost`,
and a `127.0.0.1` bind leaves it proxying to `::1` (ECONNREFUSED).

Then, from `apps/web/`:

```bash
BASE=http://localhost:4319 node scripts/design-evidence/verify-assets.mjs   # ALWAYS FIRST
BASE=http://localhost:4319 OUT=/path/to/evidence node scripts/design-evidence/capture-vitals.mjs
BASE=http://localhost:4319 node scripts/design-evidence/capture-geometry.mjs > geometry.json
BASE=http://localhost:4319 node scripts/design-evidence/capture-contrast.mjs > contrast.json
BASE=http://localhost:4319 OUT=/path/to/evidence node scripts/design-evidence/capture-shots.mjs
```

## Run verify-assets.mjs first. Every time.

`next start` serves the build it **booted with**. If anything rebuilds `.next`
underneath it — a parallel agent, a second worktree session, a stray
`turbo build` — the running server keeps emitting HTML that points at asset
hashes which no longer exist on disk. Those requests 400.

The failure is quiet and it looks like data. During D-01A a rebuild landed
mid-capture and the homepage stylesheet started 400ing. The captures kept
succeeding: screenshots rendered (as unstyled text), `getComputedStyle`
returned `border-radius: 0px` and `background: rgba(0,0,0,0)`, the NPI input
measured 18px tall, and CLS came back **0 at every width** — which reads as a
*fix* if you are looking for one. Nothing in the harness flagged it. Only the
element screenshot, which showed `NameNPPES` run together with no grid, gave it
away.

`verify-assets.mjs` turns that into an immediate non-zero exit: it compares the
served build id against `.next/BUILD_ID`, requires every referenced asset to
return 200 with a plausible content-type, and asserts a sentinel CSS rule is
really in the served bytes. Chain it:

```bash
node scripts/design-evidence/verify-assets.mjs && node scripts/design-evidence/capture-vitals.mjs
```

## What each script produces

| Script | Output |
| --- | --- |
| `verify-assets.mjs` | pass/fail gate; no artifacts |
| `capture-vitals.mjs` | `baseline.json` (LCP/CLS/FCP/bytes/fonts) + fold and full-page PNGs at 390/768/1280/1440, plus `no-script` and `reduced-motion` |
| `capture-geometry.mjs` | JSON on stdout: horizontal overflow, elements escaping the viewport, cross-column text overlaps, and sub-44px touch targets |
| `capture-contrast.mjs` | JSON on stdout: measured WCAG ratios for CTA rest/hover/focus-visible and the truth/source copy, overlap forensics, and the A-3 input box at 390/480 |
| `capture-shots.mjs` | element-level PNGs of the record rows and work surface, for judging spacing that a full-page shot compresses |

## Reading the overlap output

`capture-geometry.mjs` compares `getBoundingClientRect()` on inline elements.
Inline boxes include half-leading, so **adjacent rows can report a 2–3px
"overlap" with no glyph collision at all.** Before filing an overlap, check
whether the reported overlap is larger than `(line-height − font-size)`;
`capture-contrast.mjs` computes exactly that comparison and reports
`glyphCollision`. Confirm anything marginal against a `capture-shots.mjs` PNG —
the rect math alone will not settle it.
