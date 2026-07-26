# VHS-2.1 — Homepage Baseline & Contract Map

**Bundle:** VHS-2.1 (baseline, merge resolution, public-page audit) — **no product code**.
**Prepared against:** `origin/main` @ `55cbcd9f2` (which *is* PR #741, now merged) and live `vitalcv.com`, 2026-07-18.
**Companion:** `docs/design/vhs-2-merge-decision.md` (GATE-0).

> Purpose: give VHS-2.2+ one current baseline, a map of every homepage test contract to the element that will own it after the Evidence Field / rail overhaul, and the protected CTA/state/copy list that must survive every phase.

---

## 1. Current hero anatomy (the thing VHS-2.2 changes)

`apps/web/app/HomePageClient.tsx` (328 lines). The hero right panel is conditional:

```tsx
// HomePageClient.tsx:248–262
<div className={submittedNpi ? 'flex justify-center' : 'hidden lg:block'}>
  {submittedNpi
    ? <LiveNpiResult npi={submittedNpi} onReset={…} />
    : <div data-home-hero-graph>
        <CareerGraph initialTheme="light" transparentBg narratedIntro />   // dynamic(ssr:false), :46
        <a href="/evidence-network">Explore the network →</a>
      </div>}
</div>
```

- **`CareerGraph` is `dynamic(… , { ssr:false })`** (`:46`) → it never appears in the SSR/no-JS HTML; it hydrates client-only and labels itself "illustrative structure · 123 links."
- **Graph is desktop-only** (`hidden lg:block`) → on mobile/tablet below `lg` it is absent; the NPI form is the first and primary action (confirmed in the mobile baseline shot).
- **`LiveNpiResult`** (my W2-consolidated component) replaces the graph on valid submit. **This transition is the load-bearing contract VHS-2.2 must preserve.**
- The `Explore the network →` link (`:258`) is the only homepage entry to `/evidence-network`; VHS-2.2 must re-home it (into a later Trust/product section) before removing it from the hero.

**Baseline behavior by environment** (code + captured screenshots):

| Environment | Hero right panel | NPI form |
|---|---|---|
| Desktop ≥ lg (1280 shot) | force-directed `CareerGraph` + Explore link | present, left column |
| Narrow desktop / tablet < lg (638 shot) | **hidden** (no graph) | present, full width |
| Mobile (375 shot) | **hidden** (no graph) | present, first action, form-first |
| Reduced motion | graph still mounts but `CareerGraph` gates its rAF via `matchMedia` (narrated intro skips) | unaffected |
| No-JS / SSR | **no graph** (ssr:false) — H1, narrative, NPI form, CTAs, sections all render | present |
| Renderer/canvas failure | `CareerGraph` is dep-free 2D canvas; failure leaves an empty `[data-home-hero-graph]` box (a gap VHS-2.2's static poster fixes) |

---

## 2. `data-home-*` hook inventory

Hooks asserted by tests (their owner element must carry the same hook after VHS, or the test moves with it deliberately):

**In `HomePageClient.tsx`:** `data-home-hero` · `data-home-hero-stage` · `data-home-eyebrow` · `data-home-hero-subhead` · `data-home-primary-cta` · `data-home-secondary-cta` · `data-home-hero-graph` · `data-home-source-strip` · `data-home-experience` (×2) · `data-home-trust-footer`.

**In child components (asserted by `home-npi-role-doors.test.tsx`):** `data-home-sticky-product-story` · `data-home-loop` · `data-story-card="{recognize|prepare|match|apply|accept}"` · `data-home-evidence-truth` · `data-home-evidence-trace` · `data-home-truth-boundary` · `data-home-product-carousel` · `data-carousel-flow="continuous"` · `data-carousel-card="{wallet|readiness|matcha|apply|recognition|reuse}"` · `data-carousel-autoplay` · `data-home-section-rail` · `data-home-metric-strip` · `data-home-dual-cta` · `data-scrub-heading="static"`.

**Explicitly-removed hooks the test forbids (must NOT reappear):** `data-home-workflow-tabs` · `data-home-outcome-triad` · `data-home-moat` · `data-home-value` · `data-home-audiences` · `data-home-role-doors` · `data-home-proof-strip` · `data-scrub-scene` · `data-scrub-pin=""`.

> ⚠️ **`data-home-hero-graph` becomes `CareerEvidenceField`.** VHS-2.2 will retire this hook (or repoint it). The npi-truth-engine e2e `reset` test asserts the pre-lookup panel is `[data-home-hero-graph]` showing "illustrative structure" — that assertion must be **rewritten** to the Evidence Field's static poster, not deleted (it guards "reset returns to a labeled, non-fabricated preview").

---

## 3. Homepage test-contract map

Every guard, what it locks, and its VHS owner. **All must stay green through every phase.**

| Test | Locks | VHS owner after overhaul |
|---|---|---|
| `__tests__/homepage-truth-pass.test.tsx` | no fabricated readiness % (`72%`, `N% ready`); ProductCarousel glyph grammar (check only on source-backed/checked, lock on gated); `0/10 digits` NPI microcopy | Hero (Field must not emit a fake score); ProductCarousel unchanged; NPI form unchanged |
| `__tests__/home-npi-role-doors.test.tsx` | hero copy (`Find the opportunity. Prove your career`, `Check readiness`, `No account required`, `aria-label="NPI number"`), the 5 narrative phrases, `data-home-*` set, the 5 story cards + labels, `VitalCV Recognition`, `institution review remains the final step`, carousel 6-cards-once + pause control, `data-home-section-rail` link order `#wallet→#readiness→#matcha→#apply→#employers`, removed-hooks list, truth-boundary strings (`Evidence trace`, `What this does not mean`, `This is not a completed credentialing, privileging, or employer clearance decision.`), `data-scrub-heading="static"` + no `data-scrub-pin`, metric strip (`NPPES live · OIG/LEIE + PECOS snapshot`, `No pilot outcomes are claimed`), 13 banned patterns | Rail chapters must preserve every hook/string; the "static scrub heading, no pin" contract means the rail must not reintroduce a blank pinned runway |
| `__tests__/homepage-public-truth.test.tsx` | (public-copy truth guard — extend, never weaken) | all rail chapters |
| `tests/e2e/npi-truth-engine.spec.ts` | hero NPI lookup/error/continuation; `Reading primary sources`; `LiveNpiResult` reveal; **reset → `[data-home-hero-graph]` + "illustrative structure"** | Hero chapter — the reset target moves from graph to Field poster (rewrite, not weaken) |
| `tests/e2e/homepage-motion.spec.ts` | (#741-updated) narrated-graph captions, sticky rolodex `matrix3d`/`data-active-step`, carousel marquee pause on hover/focus, reduced-motion static fallbacks, scrub headings | Rail motion must keep these; the narrated-graph-caption block changes when the graph leaves the hero — rewrite for the Field |
| `__tests__/holder-home-page.test.tsx` | signed-in holder home | unaffected by VHS (public hero) |

**New tests VHS-2 must add:** Field renderer fallbacks (no-JS/reduced-motion/canvas-fail = static poster, never blank/black), rail pin/unpin boundaries + skip-story link + no wheel-trap, liquid-menu keyboard path.

---

## 4. Protected CTA / state / copy contracts (must survive verbatim or move deliberately)

- **Headline:** `Find the opportunity. Prove your career once. Start faster.`
- **Narrative (one coherent statement):** recognizes your identity · checks the primary sources · shows what still needs review · matches the right opportunity · carries your evidence forward. *(VHS-2 risk #2: `ScrollTypeNarrative` must not expose duplicate animated + static prose — fix at source in 2.2.)*
- **NPI action:** `aria-label="NPI number"`, `Check readiness` primary CTA, `No account required`, `0/10 digits`.
- **Legend under Field (2.2):** `Source-backed · Checked · Access required · Employer decision` (non-claiming).
- **Truth boundary:** `Evidence trace` · `What this does not mean` · `This is not a completed credentialing, privileging, or employer clearance decision.` · `institution review remains the final step` · `final credentialing authority`.
- **Metrics honesty:** `NPPES live · OIG/LEIE + PECOS snapshot`, `No pilot outcomes are
  claimed`. (Updated 2026-07-21: the old pin sat under a `federal source lanes, live`
  label that overclaimed all three lanes as live reads — OIG/LEIE is a monthly
  snapshot and PECOS quarterly per `/api/status`. See PR #822.)
- **Section rail order:** `#wallet → #readiness → #matcha → #apply → #employers`.
- **Source lanes:** NPPES, OIG/LEIE, PECOS live; state licensure access-gated. Source-backed identity ≠ credentialing; no-adverse OIG ≠ good-standing guarantee.
- **13 banned patterns** (home-npi-role-doors) incl. bare `verified`, `Get verified`, `accepted everywhere`, `instant/complete credentialing`, `HIPAA compliant`. Plus `check:claims` + copy-compliance CI.

---

## 5. Live-vs-repo copy drift

Compared the live `vitalcv.com` render (this session's screenshots) against `origin/main` source: **no drift found** in the hero contract — H1, the 5-part narrative, eyebrow (`THE CLINICIAN CAREER EVIDENCE NETWORK`), section rail (`WALLET · READINESS · MATCHA · APPLY · EMPLOYERS`), desktop nav (`For Clinicians · For Employers · Trust · Sign In · Check Readiness`), NPI microcopy (`0/10 digits · No account required`), and the graph caption (`Every record links to primary sources — NPPES, OIG, state boards, specialties` · `123 links · illustrative structure`) all match. The promo bar (`The VitalCV Wallet is free for clinicians. Check your NPI →`) is present live. Production is at or ahead of `55cbcd9f2`; no deploy-drift blocker for VHS-2.

---

## 6. Screenshot / visual-regression baseline manifest

Captured this session from live `vitalcv.com` (store per repo convention when a visual-regression harness is added; described here as the textual baseline):

| Shot | Viewport | Baseline state |
|---|---|---|
| `home-desktop-1280` | 1280×820 | conventional desktop nav; hero left (eyebrow/H1/narrative/NPI form) + **force-directed CareerGraph** right with Explore link + "123 links · illustrative structure" |
| `home-narrow-638` | 638 wide | hamburger nav; hero copy + NPI form full width; **no graph** (below `lg`) |
| `home-mobile-375` | 375×812 | hamburger nav; eyebrow/H1/narrative; **NPI form first**, no graph |

The wide-desktop shot is the canonical "before" for VHS-2.2's graph→Field replacement.

---

## 7. Acceptance (VHS-2.1 exit)

- ✅ **No code changes.**
- ✅ **GATE-0 resolved:** PR #741 is **merged** — the pill row / rolodex / diagram / manifesto / outline are the current baseline, not a competing branch (see merge-decision doc). VHS-2 proceeds from `main`.
- ✅ **One baseline + a full contract map**: every `data-home-*` hook and homepage test assertion mapped to the element that will own it after the Evidence Field + rail overhaul, with the protected copy/CTA/state list and the two e2e assertions (`npi-truth-engine` reset target; `homepage-motion` narrated-graph caption) flagged for deliberate rewrite rather than deletion.

**Next:** VHS-2.2 — mount the progressive `CareerEvidenceField` in the hero (static poster → Canvas 2D → optional WebGPU), replace `[data-home-hero-graph]`'s `CareerGraph` while preserving the `submittedNpi ? LiveNpiResult` transition and every hook above, and re-home `/evidence-network`.
