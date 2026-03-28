# VitalCV Polished Wedge — UX/Design Review

**Reviewer:** Claude (ruthless mode)
**Date:** 2026-03-28
**Scope:** Homepage, /passport, /holder/readiness, /review, /review/request
**Verdict:** **CONDITIONAL GO** (see P0 list)

---

## Page-by-Page Assessment

### 1. Homepage (`/`)

**Main job:** Convert a cold visitor into someone who enters their NPI and sees real value in <10 seconds.

**One obvious next action?** YES. The NPI input + "Start with NPI lookup" CTA is prominent and singular. The 3-step breadcrumb (Enter NPI → Review readiness → Open passport) is excellent wayfinding.

**Calm or cluttered?** Calm. The dark canvas, single radial glow, and tight max-w-xl keep focus narrow. The TrustStrip beneath the fold is subtle enough not to compete. HowItWorksSection below provides narrative without disrupting the hero.

**Observations:**
- Hero headline "See your readiness snapshot in about 10 seconds" is sharp and specific — strongest copy in the product.
- The loading→preview transition is well-choreographed: stages animate in staggered (140ms), panel crossfades to preview, timing feels intentional not decorative.
- ReadinessPreview card (both real and demo paths) is information-dense but well-structured: header, readiness panel, gaps, accordion proof, footer CTA.
- Color rule (green only on CTA) is respected.

**Issues flagged below:** #1, #3, #7, #8

---

### 2. Passport Entry (`/passport`)

**Main job:** Let anyone check readiness via NPI with zero friction, then funnel to the full passport or employer view.

**One obvious next action?** YES in idle state (single NPI form → "Check my readiness"). YES in done state (dual CTA: "View full passport" primary, "View as employer" secondary). The hierarchy is correct — primary is `variant="success"`, secondary is outline.

**Calm or cluttered?** Very calm. Centered single-column (max-w-sm), progressive disclosure. Form hides during ingest. Source rows tick through. Identity card appears when NPPES resolves. Terminal states (no profile, disconnected, error) each have dedicated TrustStateCards.

**Observations:**
- The SSE streaming ingest with progressive hydration is the product's strongest UX moment. Watching Identity → Sanctions → Enrollment resolve in real-time is viscerally satisfying.
- "Check another NPI" ghost button at bottom is well-placed, doesn't compete.
- Input uses `text-center tracking-widest` for the NPI field — feels intentional and institutional.
- Readiness score appears inline as a quiet `score/100` — doesn't over-celebrate.

**Issues flagged below:** #2, #4, #5

---

### 3. Clinician Readiness Dashboard (`/holder/readiness`)

**Main job:** Show authenticated clinicians their readiness state, what's blocking them, and what to do next.

**One obvious next action?** YES — the primary action card at the top dynamically resolves to the right CTA based on blocker state (resolve blocker vs. view opportunities vs. continue onboarding).

**Calm or cluttered?** Mixed. The top hero card + readiness panel + "What's left" sidebar + proof section + history timeline is a LOT of information on one page. Each section is well-designed individually, but the aggregate feels dashboard-heavy for a clinician who wants one answer: "am I ready?"

**Observations:**
- The readiness progress bar (emerald→sky→cyan gradient) is the right visual shortcut.
- Blocker cards with amber tone are visually distinct and actionable.
- The "What changed because of VitalCV" proof section with 4-metric grid (baseline, current, delta, applications) is strong for demonstrating value but competes for attention with the primary action.
- History timeline entries are well-structured with delta scores, reasons, and gap changes.
- Refresh button with spinning icon is a nice touch.

**Issues flagged below:** #1, #6, #9

---

### 4. Review Landing (`/review`)

**Main job:** Route visitors to the correct entry point — either via a share link (which they should already have) or to the employer request flow.

**One obvious next action?** NO — this is the weakest page. It shows a warning card explaining why you can't do much here, then offers two outline buttons ("Start with NPI lookup" and "View passport") of equal visual weight, plus a third "Request a passport review" below. Three paths, none dominant.

**Calm or cluttered?** Calm but empty. The centered max-w-sm TrustStateCard is fine, but the page feels like a dead end with a polite apology. Employers who land here without a share link get a wall of explanation instead of a clear path forward.

**Issues flagged below:** #1, #10

---

### 5. Employer Request (`/review/request`)

**Main job:** Let an employer enter a clinician NPI and get a shareable review link.

**One obvious next action?** YES. Single NPI form → "Create review context". Success state clearly surfaces the review link with copy + open actions.

**Calm or cluttered?** Calm. Same centered single-column pattern as /passport. States are well-defined: idle → loading → needs_setup → done → error. The success card with emerald border, context ID, and link display is clean.

**Observations:**
- The `needs_setup` state gracefully pivots to inline EmployerWorkspaceSetup and auto-retries — this is a good UX recovery pattern.
- Error state shows in a rose-tinted card inline with the form — visible but not alarming.
- "Request another review" ghost button follows the same pattern as passport's "Check another NPI" — good consistency.
- Loading state is minimal text in a card — could use a subtle spinner for perceived responsiveness.

**Issues flagged below:** #2, #4

---

## Cross-Cutting Observations

### Motion
The motion system is disciplined. Single canonical easing curve `[0.2, 0.8, 0.2, 1]` across a 280-420ms duration band. No bouncy springs, no gratuitous parallax. Motion serves comprehension: stage rows stagger in to show sequence, panels crossfade to show state change, preview slides up to signal arrival. This is one of the product's strongest design decisions.

### Typography & Spacing
Nunito Sans works. The micro-label system (`text-[10px] font-bold uppercase tracking-[0.2em] text-white/30`) is consistent across all five pages for eyebrows/section labels. The hierarchy (label → heading → body → hint) is readable. Spacing is generous but not wasteful.

### Visual Language
The trust status badge system (checked/pending/access_required/review_required/demo/unavailable) is well-executed and carries across homepage, passport, and readiness. Color semantics are consistent: emerald=good, amber=attention, rose=problem, white/alpha=neutral.

### Navbar
Clean, professional. Sticky with backdrop-blur. Hides on non-public routes (smart). Mobile menu is functional. "Check Readiness" as the primary CTA in the nav is the right call. The ThemeToggle in the desktop nav is a nice polish detail.

### Error Boundary
The global error page is well-done: calm emoji, "View Interrupted" title, three recovery actions (reload/home/support), PilotFailureSignal for ops telemetry. Doesn't break trust.

---

## Top 10 UX/Design Issues (Ranked)

### P0 — Must fix before merge

**#1. /review landing page is a dead end with muddy CTA priority**
The page shows a warning card with three equal-weight links. An employer who lands here directly (no share link) should be funneled hard into `/review/request`. Make the employer CTA primary/success variant and move it above the warning card. The "Start with NPI lookup" and "View passport" links should be secondary/ghost.
*Pages affected:* /review
*Effort:* S

**#2. Loading states on /passport and /review/request lack a spinner or progress indicator**
The /passport page has phase labels ("Connecting to primary sources…") but no visual loading indicator between form submission and the first source row appearing. The /review/request loading state is just centered text in a card. Both need a subtle spinner or pulse animation to confirm the system is working. The homepage does this correctly with the spinning border on the loading stage row — apply the same pattern.
*Pages affected:* /passport, /review/request
*Effort:* S

**#3. Homepage ReadinessPreview card is too tall — CTA below the fold on mobile**
The full ReadinessPreview (header + readiness panel + gaps + accordion + footer CTA) on the homepage easily exceeds viewport height on mobile. The "Continue to passport" button is buried at the bottom. Consider collapsing the accordion by default and/or making the CTA sticky at the bottom of the preview card.
*Pages affected:* Homepage
*Effort:* M

### P1 — Should fix, but won't block merge

**#4. NPI input validation is inconsistent across pages**
Homepage shows amber text below input for invalid NPI. /passport shows `text-red-400/70 text-center`. /review/request shows `text-xs text-red-400/70` left-aligned. Pick one pattern and reuse it. The homepage's amber approach is better for the dark theme (red is too alarming for a validation hint).
*Pages affected:* All NPI entry points
*Effort:* S

**#5. /passport dual CTA buttons ("View full passport" / "View as employer") use different border-radius**
Primary uses `rounded-full`, secondary uses `rounded-full` — actually these match. However, the primary is `variant="success"` and the secondary uses a custom `variant="outline"` with manual hover states. These should both use the design system's button variants for consistency and maintainability.
*Pages affected:* /passport
*Effort:* S

**#6. Readiness dashboard information density — "Proof of impact" section competes with primary action**
The "What changed because of VitalCV" section is valuable for retention/proof but it's a secondary concern. A clinician opening readiness wants: (a) my score, (b) what's blocking me, (c) what to do next. The proof section should be collapsible or moved to a separate tab/section to keep the primary flow tight.
*Pages affected:* /holder/readiness
*Effort:* M

**#7. Homepage flow step indicators have weak contrast in "upcoming" state**
`text-white/34` + `border-white/6` + `bg-black/10` makes the "upcoming" steps nearly invisible on the dark background. Step indicators should be legible in all states — bump upcoming to `text-white/45` and `border-white/10` minimum.
*Pages affected:* Homepage
*Effort:* S

**#8. Homepage body copy in the hero is dense — includes too many status label names inline**
The paragraph "VitalCV gives healthcare professionals a source-backed credentialing snapshot…then labels each lane as Checked, Pending, Access required, Unavailable, or Preview only" reads like a spec, not marketing copy. Simplify to focus on the value prop; move status taxonomy to the preview or a tooltip.
*Pages affected:* Homepage
*Effort:* S

**#9. Readiness dashboard "Refresh readiness" button is a raw `<button>` instead of `<Button>`**
The refresh button in the readiness header uses a custom className string instead of the design system Button component. This means it doesn't get the CVA variants, focus ring, or consistent sizing. Swap to `<Button variant="outline">` with the RefreshCw icon.
*Pages affected:* /holder/readiness
*Effort:* S

**#10. /review page lacks any branding or heading — feels orphaned**
The page is just a TrustStateCard floating in a centered container. No "VitalCV" wordmark, no page heading, no breadcrumb. Compare to /passport which has wordmark + heading + subtitle. Apply the same pattern for consistency.
*Pages affected:* /review
*Effort:* S

---

## Strongest Improvements (What's Working)

1. **NPI-first hero with real-time ingest** — The homepage LiveTrustConsole is the single best UX in the product. The 3-step flow indicator, live source checking, and progressive preview reveal is exactly what a trust infrastructure product should feel like.

2. **Consistent trust status badge system** — The 6-state badge taxonomy (checked, pending, access_required, review_required, demo, unavailable) carries across every surface. Color coding is consistent. This builds institutional trust through visual language.

3. **Motion discipline** — Single easing curve, tight duration band, no decoration-only animation. Every transition communicates a state change. This is rare and good.

4. **Honest labeling** — Demo states are always labeled "Preview only". Access-required lanes are never hidden. The product doesn't fake trust — it shows uncertainty explicitly. This is the right design choice for a trust product.

5. **Dark theme execution** — The `bg-[#080e1a]` canvas with `white/alpha` text, `border-white/alpha` dividers, and semantic emerald/amber/rose accents feels premium without being tryhard. The glassmorphic cards with `bg-white/[0.04]` are subtle and tasteful.

---

## GO / NO-GO Verdict

### **CONDITIONAL GO**

The polished wedge is ready for merge **after the 3 P0 fixes** (estimated: 2–3 hours total).

The product feels calm, institutional, and trustworthy across the core flows. The homepage-to-passport pipeline is the strongest UX sequence. The readiness dashboard is information-rich but functional. The motion system, color discipline, and honest labeling are all production-grade.

The /review landing page is the only genuinely weak screen — but it's a routing page, not a core flow, and the P0 fix is trivial.

P1 issues are polish items that can ship in a follow-up pass without blocking the merge.
