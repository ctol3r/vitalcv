# Home Evidence Experience v2 — accessibility report

Measured 2026-08-02. Code evidence against `b4b387efd`; rendered evidence
against **production** (`https://vitalcv.com/`).

Rendered measurements were taken against production deliberately. A local
`next start` on this build returns **HTTP 400 for its own stylesheets**, so the
page renders unstyled — every contrast reading came back as black-on-white
21:1, which is the browser default and not the product. That is a local-run
artifact (the Playwright dev server and production both style correctly), but
it is exactly the kind of thing that produces a page of confident, wrong
numbers. Production is Authority 2 in this program's hierarchy and is what
users get.

**Result vocabulary:** PASS = measured and met. NOT MEASURED = no evidence was
produced; a reason and a method are given rather than an assumption.

---

## The matrix

| # | REQUIREMENT | STANDARD | TEST METHOD | VIEWPORT | MOTION | RESULT | EVIDENCE | KNOWN LIMITATION |
|---|---|---|---|---|---|---|---|---|
| 1 | Persistent NPI label | [W3C labels](https://www.w3.org/WAI/tutorials/forms/labels/) | `renderToStaticMarkup` across 7 states; `<label for>` extracted and compared | n/a | n/a | **PASS** | `evidence-input.test.tsx` → *never renames itself between states*; `new Set(names).size === 1` | Asserts the SSR string, not a screen reader's announcement |
| 2 | Accessible name is stable across states | [WCAG 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name) | same as #1, plus a11y tree read while focused + holding digits | 1280×800 | n/a | **PASS** | a11y tree reports `textbox "Your 10-digit NPI"` in mixed case while floated — `text-transform` is not folded into the name | Chromium only; other engines may compute the name differently |
| 3 | Visible keyboard focus | [WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) | e2e tab-to-field | 1440×900 | default | **PASS** | `homepage-degradation.spec.ts` → *keyboard reaches the NPI input from the top of the page — no trap* | Asserts reachability and focus landing, not the indicator's contrast ratio |
| 4 | Focus not obscured | [WCAG 2.4.12](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | — | — | — | **NOT MEASURED** | — | A floating feedback widget sits bottom-right. Method: focus each control, compare its rect against the widget's and the sticky header's |
| 5 | Error programmatically associated | [W3C instructions](https://www.w3.org/WAI/tutorials/forms/instructions/) | SSR markup: `aria-invalid` + `aria-describedby` → `#ask-hint`, which is the band in **both** states | n/a | n/a | **PASS** | `evidence-input.test.tsx`; the error span carries `role="alert"` and is deliberately *not* also named in `describedby`, to avoid a double announcement | Double-announcement avoidance is reasoned, not verified with a screen reader |
| 6 | Resolving status announced | [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | code read: `role="status"` on the resolving region | n/a | n/a | **PASS** (structural) | `LiveNpiResult` | Structure only. Whether it announces *well* needs a real AT pass — see #18 |
| 7 | System error announced as a system state | WCAG 4.1.3 | e2e: registry outage path | 1440×900 | default | **PASS** | `npi-truth-engine.spec.ts` → *registry outage is a system state, not a finding about the NPI* | — |
| 8 | Tab semantics | [APG tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | code read + rendered DOM | 1440×900 | default | **PASS** | `SpineTabs`: `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, `aria-orientation`, roving `tabIndex`, Arrow ↑↓←→, Home, End | Keyboard traversal is not asserted by a test; the handlers are read, not driven |
| 9 | Logical heading order | [WCAG 1.3.1](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships) | DOM walk of `h1..h4` | 1280×800 | n/a | **PASS** | Sequence `1, 2, 3` — no skipped level | — |
| 10 | Exactly one `h1` | WCAG 1.3.1 | `document.querySelectorAll('h1').length` | 1280×800 | n/a | **PASS** | `1` | — |
| 11 | Touch target — primary action | [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | measured `getBoundingClientRect().height` | 1440×900 and 640×400 | n/a | **PASS** | CTA height **44 px** at both — meets the 44 px product target, well over the 24 px floor | Inline text links measure 18 px line-boxes; they fall under 2.5.8's **inline exception**, but that exception was reasoned, not verified per-link |
| 12 | Mobile input ≥16 px (no iOS zoom) | WebKit behaviour | computed `font-size` | 390×844 | n/a | **PASS** | `home-a11y-floor.spec.ts` asserts ≥16 px; production measures **60 px** at 1440 and **42 px** at 640 | The 16 px rule is a WebKit behaviour, not something inherited from any reference — see the reference analysis |
| 13 | 200% zoom | [WCAG 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text) | viewport halved to 640×400 (≙ 1280 at 200%); `scrollWidth - innerWidth`; per-element right-edge check | 640×400 | n/a | **PASS** | Horizontal overflow **0 px**. Title, label, input, band and CTA all within the viewport; CTA still 44 px | Reflow-by-viewport, not true browser zoom |
| 14 | Reduced motion | [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion), [WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions) | Playwright `emulateMedia({ reducedMotion: 'reduce' })` | 1440×900 | **reduce** | **PASS** | `homepage-degradation.spec.ts` → *reduced motion: the NPI action and source strip stay complete without graph motion*. All `ask-art` animation is inside `@media (prefers-reduced-motion: no-preference)`, guarded by `ask-home-diagrams.test.tsx` | Content completeness is asserted; no screenshot baseline — deliberately, see below |
| 15 | No-JS readability | [WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) | JS disabled, SSR only | 1440×900 | n/a | **PASS** | `homepage-degradation.spec.ts` → *no-JS SSR floor: heading, NPI form, source cadence, and spine are served*. `SpineTabs` renders all four panels unhidden until hydration | — |
| 16 | Colour contrast | [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) | canvas-normalised luminance (resolves OKLCH, which a naive RGB parse mangles) against nearest opaque ancestor | 1280×800 | n/a | **PASS** | h1 **15.28** (56 px/560) · input **16.27** (60 px) · promise **6.61** (18.4 px) · permission **6.61** (14.1 px) · eyebrow **6.61** (10.6 px) · label **5.57** (12.5 px) · hint **5.23** (11.5 px) · cadence **5.23** (10.1 px) — all ≥ their required 4.5 or 3.0 | Text only. Non-text contrast (1.4.11) — borders, the field outline, the digit guide — is **not** measured |
| 17 | Mobile landscape | WCAG 1.3.4 | — | — | — | **NOT MEASURED** | Portrait 390×844 is covered by `homepage-degradation.spec.ts`; **landscape is not** | Method: 844×390, check the field and CTA remain reachable without the keyboard occluding them |
| 18 | Real screen-reader pass | — | — | — | — | **NOT MEASURED** | Nobody drove the page with VoiceOver or NVDA. axe is static analysis plus rendered-DOM rules | Carried from the release receipt, unchanged. Rows 1, 5 and 6 are structurally correct and could still *read* badly |
| 19 | Long error copy | — | — | — | — | **NOT MEASURED** | Longest real `checkNpi` reason fits; no synthetic long string was tried | Method: inject a long reason, assert the band's height delta stays 0 |
| 20 | Long provider specialty / missing optional identity fields | — | — | — | — | **NOT MEASURED** | Capsule fixtures cover the shapes the API returns, not adversarial lengths or sparse records | Method: fixtures with a very long specialty and with optional fields absent |

---

## Why there is still no screenshot baseline

The release receipt lists visual regression as **skipped**, with the reason that
layout was measured numerically instead. That decision stands, and this wave
strengthened the numeric side rather than reversing it — `home-layout-stability.spec.ts`
measures six state changes in document coordinates.

Adding a screenshot baseline now would trade a known gap for a worse one.
Screenshot diffs are font- and machine-sensitive, and this repo has already
recorded that a screenshot diff **cannot catch paint order** — the exact failure
it would be adopted to prevent. A flaky baseline that misses the failure mode it
was bought for is worse than an honest gap.

---

## The four gaps, ranked

1. **Real screen-reader pass (#18).** Everything structural passes. Nothing
   confirms it *reads* well. The highest-value next check, and the only one
   here a machine cannot do.
2. **Focus not obscured (#4).** There is a floating widget bottom-right. This is
   cheap to measure and currently unmeasured.
3. **Mobile landscape (#17).** Portrait is covered; landscape is where the
   on-screen keyboard occludes a focused field.
4. **Non-text contrast (#16, partial).** Text passes everywhere. Borders and the
   field outline carry meaning and were not measured.
