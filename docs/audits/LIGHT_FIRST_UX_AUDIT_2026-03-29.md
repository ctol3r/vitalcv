# VitalCV — Light-First Redesign Audit
**Date:** 2026-03-29
**Auditor:** Ruthless-visitor mode — no collaboration credit given
**Scope:** Homepage, readiness flow, /passport, /review, /review/request, nav/header/footer, theme toggle, scroll, motion

---

## TL;DR

The design direction — calm, light-first, typographic, trust-forward — is the right call and materially better than what came before it. But the execution has a structural fracture that makes the current state **NOT ready for a real first impression**: the primary conversion action on the marketing homepage routes to a dead page. Everything downstream of that is largely good. Everything before it is currently broken.

**Verdict on design direction: GO.**
**Verdict on current production state: NO-GO until P0s are resolved.**

---

## What This Is — First-Time Visitor Test

Reading the marketing homepage cold:

- **What is this?** A credentialing verification platform. The tagline "Verify once. Keep forever." lands cleanly in two seconds.
- **Who is it for?** Unclear from the hero. The subtitle says "clinicians and verifiers" — that is unexplained industry jargon. A hiring manager from a hospital system doesn't know if they're a "verifier."
- **What should I do first?** Enter an NPI into the search box. That is clearly the primary action.
- **What do I get in 30–60 seconds?** Nothing. The NPI input in the marketing app routes to `/clinician?npi=...`, which renders: *"Credential profile loading… Coming soon."* The primary wedge is a dead end. Full stop.

---

## The Structural Problem Nobody Can Miss

There are **two separate apps** with two separate visual systems:

1. **`apps/marketing`** — public-facing marketing site. Light theme (`#ffffff`), Inter font, 6 CSS tokens, clean.
2. **`apps/web`** — the actual product. Dark-by-default (`oklch(0.08 0.005 255)`), Nunito Sans font (aliased as Inter), 200+ CSS tokens, operational surfaces hardcoded to dark.

These apps have different fonts, different nav structures, different color systems, and — most critically — **different NPI flows**. The marketing app's NPI entry routes to a dead `/clinician` page. The web app's homepage has a fully functional NPI → readiness pipeline. If a visitor encounters the marketing site and tries the primary CTA, they hit a wall.

If these apps share a domain, the marketing `/clinician` route masks the web app's live flow. If they're on different domains, a first-time visitor on the marketing site never reaches the actual product.

Either way: **the primary conversion path is broken at the seam between the two apps.**

---

## Homepage Judgment

### One dominant action?
**Yes, barely.** The NPI input box is visually dominant. But directly below it, two underline links ("Clinician →" and "Verifier →") split attention immediately after the CTA. And below the fold, a "YC-ready demo path" section with three more action buttons appears. The single dominant action erodes within one scroll.

### One understandable story?
**Mostly.** The marketing headline works. But the subtitle — "Portable credential verification infrastructure for clinicians and verifiers" — is developer copy on a page that should speak to clinicians or hiring directors. The word "infrastructure" kills emotional connection.

### Cleaner spacing/hierarchy?
**Yes, genuinely improved.** The marketing site's whitespace is generous, the font scale is clean, the section borders are subtle. This is the redesign's biggest win.

### Better emotional pull?
**No.** There is no emotional moment. The hero is static — no entrance animation, no motion. The credential graph section is a static SVG of dots and lines that communicates nothing to a non-technical visitor. The "Security & Standards" section (OpenID4VCI, HAIP 1.0, ES256-only) reads like protocol documentation. Clinicians and HR buyers don't know what ES256 is. This section should not be on the homepage.

---

## The "YC-Ready Demo Path" Section — P0 Trust Failure

The section below the hero renders:

```
YC-ready demo path:    [Try demo]  [Read security]  [See progress]
```

The label "YC-ready demo path" is internal product language. It appears to every external visitor. This is a founder telling the product what it is, not the product speaking to users. Remove or rename immediately.

---

## Light-First Theme — Is It Real?

### Marketing app: Yes, genuinely.
`--background: #ffffff`, `--foreground: #0a0a0a`, `--border: #e5e7eb`. This is clean, high-contrast, premium. The light mode on the marketing site earns its description. It reads trustworthy.

### Web app: No — dark is default, not light.

The theme token file (`styles/themes/index.css`) defines:

```css
:root, html.dark, html[data-theme='dark'] {
  --vt-bg: #000000;
  ...
}

html.light, html[data-theme='light'] {
  --vt-bg: #FFFFFF;
  ...
}
```

Dark is the `:root` default. Light requires explicit opt-in. The `ThemeToggle` component reinforces this: `if (!theme) { setTheme('dark'); }`.

More critically: the operational surface tokens (`--vt-surface-ops-base: oklch(0.08 0.005 255)`) are defined once in a flat `:root` block in `vitalTokens.css` and **never overridden in the light theme**. The `/passport`, `/review`, and `/review/request` pages all use `bg-vt-surface-ops-base` as their page background. Switching to light mode via the ThemeToggle will not change these pages — they remain dark regardless. The theme toggle on these operational surfaces is essentially decorative.

**The "light-first wave" is real on the marketing site and does not exist on the product.**

---

## Motion — Helps or Decorates?

### Marketing app: Non-existent (appropriate but flat)
The hero has no entrance animation. The `transition-theme` utility (300ms color transitions) is the only motion. This is coherent with "calm" positioning but means zero delight on first load.

### Web app: Well-disciplined where it exists
- Framer Motion hero entrance: `opacity: 0 → 1, y: 20 → 0`, 600ms. Clean.
- `animate-panel-enter` for ingest loading card: subtle `translateY(4px)` reveal.
- `animate-fade-in-up` for readiness preview card: 380ms, same easing.
- All animations use `cubic-bezier(0.2, 0.8, 0.2, 1)` — consistent.
- `prefers-reduced-motion` respected with `0.01ms` override — correct.

The motion does help comprehension: the staged source-check reveal (NPPES → OIG → CMS) tells the story of what's happening in real time. This is motion serving trust, not decoration.

**Concern:** `node-breathe` (5s infinite float), `animate-marquee` (25s infinite scroll), `animate-glow-breathe` (6s infinite pulse), and `animate-badge-pulse` (1.5s infinite pulse) are defined. If these are active on any visible surface, they will create visual noise that undermines the calm positioning. Infinite animations on a trust-product feel cheap.

---

## Page-by-Page Verdict

### `/passport`

**What it is:** Clear. "Check your readiness." Works.
**What to do:** "Enter your NPI. No login required." Works.
**Prototype seams?** None visible. This is the cleanest page in the product.
**Concerns:**
- All color tokens assume dark background (text-white/xx, border-white/xx). Light mode will destroy legibility here.
- The "Check another NPI" ghost button is extremely low contrast (`text-white/25`). It will fail WCAG AA.
- The readiness score displays as `{score}/100` — a number without context. A clinician seeing "47/100" doesn't know if that's good or bad.

**Rating: Good. Fix light mode, fix ghost button contrast.**

### `/review`

**What it is:** Not clear on direct access. The page immediately renders a warning-toned `TrustStateCard` saying "Open a shared passport review." This is a correct technical message but it greets any direct-access employer visitor with an amber warning card, which feels like an error state.
**What to do:** Ambiguous. Two buttons appear: "Start with NPI lookup" and "View passport."
**Prototype seams?** The page is a redirect wall. It doesn't stand on its own.

**Rating: Needs redesign for the employer-direct-access case.**

### `/review/request`

**What it is:** Crystal clear. "Request a passport review." Excellent.
**What to do:** Clear. Enter NPI, get a shareable review link.
**Prototype seams?** The sign-in gate (if Clerk enabled) also shows a warning-toned card — same issue as /review.
**Success state:** The best UI in the product. Context ID, review URL, copy button, open link — clean and functional.

**Rating: Best page in the wedge. Ship it.**

---

## Nav / Header / Footer

### Marketing app nav (SiteHeader):
8 navigation links + 3 CTA buttons = 11 interactive elements in the header. On mobile these wrap to multiple rows. This is brutal. No clear primary CTA hierarchy exists when "Try demo," "Read security," and "See progress" are all equal-weight bordered buttons. A first-time visitor doesn't know where to go.

There is no theme toggle in the marketing nav. Correct — don't add noise to an already crowded header.

### Web app nav (Navbar):
4 nav items: "Check Readiness," "Explore Roles," "For Employers," "Developers." Reasonable.
CTAs: ThemeToggle + "Sign In" + "Check Readiness" button.
"Check Readiness" appears both as a nav item AND as the primary CTA button. This is redundant. Remove it from the nav or rename the nav item to something like "Passport."

The VitalCV wordmark uses `font-heading` (Fraunces, a serif). This is the right call — distinct, authoritative, not generic sans.

### Footer:
Marketing site: functional. Has relevant links (How it works, Security, Demo, Progress, Contact). The `© 2026 VitalCV. Production-ready OpenID4VCI trust stack.` tagline is too technical for a footer — this is documentation language.

Web app: extremely sparse — just copyright and an "Updates" link. This is probably appropriate for the operational product but the "Updates" link feels orphaned.

---

## Scroll Behavior

No physical testing was possible (code-only audit), but:

- `scroll-behavior: smooth` is set on `html`.
- `scroll-padding-top: 4.5rem` accounts for the sticky header.
- `overflow-x: clip` prevents horizontal bleed without creating scroll containers.
- The web app uses `scroll-animate` with CSS scroll-driven animation (`animation-timeline: view()`). This is technically modern but has inconsistent browser support.
- No janky scroll handlers detected. No `onScroll` listeners that could hurt performance.

**Assessment: Scroll implementation is clean. No major concerns.**

---

## Top 10 Remaining Problems

### P0 — Blocking (Do These First)

**#1 — Marketing NPI CTA routes to dead page**
`/clinician?npi=...` renders "Credential profile loading… Coming soon." The primary conversion action on the marketing homepage is broken. Any investor, clinician, or buyer who tries the hero CTA sees a placeholder. This has to be fixed before any demo or launch.
_Effort: S (routing fix or redirect to /passport in the web app)_

**#2 — Dark-is-default contradicts "light-first" positioning**
`:root` maps to dark tokens. Light theme requires explicit class. Switching to light mode via ThemeToggle breaks operational surfaces (passport, review) because `vt-surface-ops-base` is not redefined in light mode. The toggle is cosmetically present but functionally incomplete.
_Effort: M (define light-mode overrides for ops surface tokens)_

**#3 — Dual-app visual discontinuity**
Marketing app: Inter font, `#ffffff` background, minimal token system. Web app: Nunito Sans, dark navy background, 200+ tokens. A visitor crossing from marketing site to product encounters a complete visual system change — different font, different colors, different nav, different tone. This is not a design system. It's two products.
_Effort: L (align fonts and base color tokens across apps, or accept the split and make it intentional with explicit "Enter product" moment)_

### P1 — Significant

**#4 — "YC-ready demo path" visible to all visitors**
Internal framing leaked to the public surface, positioned immediately after the hero. Remove or replace with a real user-facing section label.
_Effort: XS_

**#5 — Marketing nav has 11 interactive elements**
8 nav links + 3 CTA buttons. Action hierarchy is absent. "Read security" and "See progress" as CTA buttons competing with "Try demo" is broken hierarchy. Strip to: logo + 3 nav links + 1 primary CTA.
_Effort: S_

**#6 — /review direct-access shows warning card as landing state**
Employers who land directly on /review see an amber warning card as their first impression. This is technically accurate but emotionally wrong. An employer who clicks a link to /review should see a welcoming surface, not an error state.
_Effort: S (design a proper landing state for unauthenticated employer access to /review)_

**#7 — "Check Readiness" duplicated as both nav item and CTA button**
The web app nav has "Check Readiness" in the nav list AND as the primary CTA button. One of these should be renamed or removed.
_Effort: XS_

**#8 — Homepage /passport readiness score has no context**
The score `{score}/100` appears without explanation. A clinician seeing "62/100" doesn't know what to do with that number. It needs a brief descriptor: "Strong," "Needs attention," etc.
_Effort: S_

**#9 — Trust language drift on homepage marketing copy**
"Portable credential verification infrastructure for clinicians and verifiers" — subtitle uses infrastructure jargon. The security section lists ES256, HAIP 1.0, DPoP + PKCE on the homepage. This alienates the non-technical buyer. The homepage should speak to outcomes ("Start deploying clinicians in days, not months"), not protocols.
_Effort: S (copy change, no code)_

**#10 — Ghost button contrast failure on /passport**
The "Check another NPI" / "Cancel" button uses `text-white/25` (approximately 15% opacity white on dark background). This fails WCAG AA contrast requirements. Secondary actions should be at minimum `text-white/45` to be legible.
_Effort: XS_

---

## Strongest Improvements From The Redesign

1. **Marketing site light theme is genuinely premium.** White background, clean typography, generous whitespace, subtle borders. This is the best version of the marketing surface to date.

2. **The web app NPI → readiness live pipeline is compelling.** The staged source-check reveal (NPPES → OIG → CMS, each flipping from "Queued" → "Checking" → "Checked") builds trust through visible transparency. No other credentialing product shows this.

3. **/review/request is the most polished page in the product.** Clear purpose, clean form, excellent success state with context ID, review URL, and copy button. This page is ready to show to employers.

4. **Motion is disciplined.** Single easing curve across all animations, `prefers-reduced-motion` respected, no gratuitous entrance effects. The CSS animation system is coherent.

5. **The /passport page is focused and trustworthy.** Full-screen, centered, zero-login-required, progressive reveal. It feels like a real product, not a prototype.

6. **Typography hierarchy on the web app hero is sharp.** `clamp(2rem, 5vw, 3.5rem)` headline with `font-bold leading-[1.08] tracking-tight` is strong. The `text-emerald-400` on "about 10 seconds" anchors the time-to-value claim emotionally.

---

## GO / NO-GO on Design Direction

**Design direction: GO.**
The decision to go calm, typographic, light-first, trust-forward is correct and clearly better than the previous version. The marketing site's light theme is a real aesthetic improvement. The dark operational surfaces (passport, review) are intentional and work well for that surface type. The motion discipline is exactly right.

**Current implementation state: NO-GO.**
The primary conversion action on the marketing homepage is dead. The "light-first" claim does not reflect the web app's actual theme default. The dual-app architecture creates visual discontinuity that undermines trust precisely where trust is the product. None of this is a design problem — it is an execution and routing problem.

**Required before any real first impression:**
1. Fix the marketing NPI CTA → route to the live /passport flow (or web app equivalent)
2. Remove or rename "YC-ready demo path"
3. Strip the marketing nav to ≤4 links + 1 CTA
4. Decide: unified domain or explicit product-entry moment between marketing and app

**Nice to have before YC demo:**
5. Define light-mode overrides for vt-surface-ops-base
6. Fix /review landing state for direct-access employers
7. Remove "infrastructure" from homepage subtitle
8. Fix ghost button contrast on /passport

---

_Audit conducted via static code analysis. No browser rendering or network calls were made. Conclusions are based on JSX, CSS, and TypeScript source only._
