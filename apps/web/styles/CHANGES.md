# Public style changes

## 2026-08-16 — Amendment E.2: homepage clinical motion set

- Added five house animations in `motion.css`, all consumed by
  `easy-home.css` behind arming attributes hydration sets only outside
  reduced motion:
  - `ezh-badge-swing` — the hero badge clips on with a ≤1.4° swing settle and
    rests untransformed (Option 1 "Chart & Badge"; one shot, 450–800ms band).
  - `ezh-fig-draw` — one-shot figure line-draw: offset animates from the
    element's `--ezh-draw-len` (set ≥ its real path length; the resting
    dasharray is that same var, so the resting stroke is visually solid).
    Chromium does not scale CSS dash values by SVG `pathLength`, so lengths
    are explicit.
  - `ezh-row-in` — one-shot arrival for late-mounted live-feed rows.
  - `ezh-status-pulse` — the route's ONE lawful loop (EC-29 system-status
    exception): the "Listed as open" availability dot, opacity-only, slow.
  - `ezh-count-pop` — 100ms control feedback on the NPI digit counter,
    animating only between real typed counts (EC-3).
- SSR, no-JS, and reduced motion render the complete resting frame; the
  easy-home reduced-motion block now also sets `animation: none`.

## 2026-08-14 — Homepage warm-glass career horizon

- Added the single-shot `ezh-horizon-travel`, `ezh-horizon-breathe`, and
  `ezh-glass-catch` house animations in `motion.css`.
- The animations communicate NPI start, distinct source states, and the
  opportunity horizon; they do not loop or gate content.
- Reduced-motion and no-JavaScript states render the complete final frame.
