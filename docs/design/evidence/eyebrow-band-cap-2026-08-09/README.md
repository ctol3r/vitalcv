# Eyebrow — the rectangle stops growing (EC-20 amendment A-3)

**Directive (founder, 2026-08-09, on the A-2 chrome as shipped):** *"can we make the top bar
eyebrow less wide and more exact to the palantir.com size"*.

**DESIGN-ONLY BOUNDARY**
This wave may change UI, UX, visual design, interaction design, responsive behavior, animation,
information hierarchy, customer-facing copy, navigation presentation, and brand expression.
It may not change application truth, authentication, authorization, consent semantics, data
models, APIs, readiness calculations, agent policy, source behavior, employer decisions,
business logic, or pricing behavior.
If the proposed experience requires one of those changes, record it as a product dependency and
stop. Do not solve it inside the design PR.

## The defect: a constant that was really a coordinate

A-2 measured palantir.com at **1440** (and 390) and wrote down "the rectangle is inset 10px left
and right". That is true at 1440 and false as a rule. Re-probed across the range:

| viewport | reference `x` | reference width | VitalCV before | VitalCV after |
| --- | --- | --- | --- | --- |
| 1280 | 10 | 1260 | 1260 ✓ | 1260 ✓ |
| 1440 | 10 | 1420 | 1420 ✓ | 1420 ✓ |
| 1512 | 16 | **1480** | 1492 ✗ | 1480 ✓ |
| 1728 | 124 | **1480** | 1708 ✗ | 1480 ✓ |
| 1920 | 220 | **1480** | 1900 ✗ | 1480 ✓ |
| 2560 | 540 | **1480** | 2540 ✗ | 1480 ✓ |

The reference holds a 10px inset only until the rectangle reaches **1480px**, then stops growing
and centres. VitalCV had no cap, so on a 1920 display the chrome measured 1900 against the
reference's 1480 — visibly the whole complaint.

**Every desktop assertion in `eyebrow.spec.ts` ran at 1440 — below the cap — so no test could see
it.** The new spec measures at 1512/1728/1920/2560, where the cap actually bites.

## The instruments are band-relative too

The same single-width probe hid this. The reference wordmark sits at `x` 30 / 36 / 144 / 240 / 560
as the viewport grows — always **20px inside the rectangle**, never at a fixed viewport gutter.
Below the cap that is 10 + 20 = the 30px gutter A-2 recorded, which is why the two readings agreed
at 1440 and only at 1440. Right cluster: same, 20px inside the rectangle's right edge.

**The takeover rides the same band.** Measured open at 1920: columns start at 240 and the last
closes at 240 — the 1480 band plus its 20px inner. Ours was full-bleed at a 30px viewport gutter.

## Implementation note worth keeping

The band is `max(10px, (100% - 1480px) / 2)` resolved against `.vcv-eb`, **not `100vw`**. A classic
(non-overlay) scrollbar makes `100vw` wider than the layout box, which would push the centred band
off-centre by half the scrollbar width on exactly the platforms least likely to be checked here.

Mobile collapses the band (`--eb-band-inset: 0`), so the full-bleed 65px band and the 20px gutter
are untouched — verified, not assumed.

## Recorded, NOT changed: the reference action is fluid

The reference's dominant action measures **178 / 205 / 217 / 253 / 285 / 392** across the same six
widths — approximately `16.7vw − 36px`. EC-20 locks ours at a 205px minimum, a number A-2 read at
1440 for exactly the same reason it misread the inset.

Ours stays 205 in this wave, deliberately: matching the reference would make the action *wider* on
large displays, which is the opposite of the directive being served, and the action's shape was
separately founder-ruled under A-2. **Flagged for a founder decision, not folded into a
width-reduction PR.**

## Verification

- `local-verify.json` — all six widths measured against the reference numbers: shape `x`, width,
  equal side gutters (centred, not merely inset), wordmark at band + 20, cluster right edge at
  band + 20. Mobile 390: shape `0,0,390×65` radius 0, wordmark `x` 20, zero horizontal overflow.
- `reference-vs-vitalcv-widths.json` — the raw paired probe of palantir.com and the live
  vitalcv.com (the "before"), same run, same widths.
- **Injection proof:** with `eyebrow.css` reverted to `origin/main`, the two new specs fail with
  `shape width @1512 — Expected 1480, Received 1492` and `menu column — Expected 240, Received 30`.
  They are not vacuous.
- e2e `eyebrow.spec.ts` 18/19; `a11y-public-routes` + `design-kernel` + `home-easy` 63/63;
  `eyebrow-chrome.test.tsx` 16/16; production build green; design-lint PASS (22 rules, no baseline
  raised).
- **One failure, PRE-EXISTING and not caused by this change:** `eyebrow — mobile recomposition ›
  the takeover works on mobile` times out opening the menu at 390px. Reproduced identically with
  `eyebrow.css` reverted to unmodified `origin/main`, single-worker, so it is not a flake and not
  this wave's. Reported rather than absorbed.

## Reproducing

```bash
node probe-widths.mjs   # palantir.com vs live vitalcv.com, six widths
node probe-local.mjs    # BASE=http://127.0.0.1:3311 — the change under a local server
```
