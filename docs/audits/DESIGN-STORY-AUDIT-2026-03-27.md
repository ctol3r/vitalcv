# VitalCV Post-Polish Design & Story Audit

**Date:** 2026-03-27
**Auditor:** Claude (Cowork)
**Production URL:** https://vitalcv.com
**Deployment:** `dpl_27PvhS5wK9qMjenKvVW8eTUoUqiM` — READY on main

---

## Executive Summary

The site reads as **premium, calm, and trust-forward** across every live public surface. The dark-mode Antigravity design system, responsive typography scale, and locked motion system are working together to create a cohesive institutional feel. The visual language says "healthcare infrastructure" rather than "SaaS startup."

However, four issues block a clean ship: three public routes return 404, the marketing layer (HomeSections.tsx) has 28+ inline style violations that bypass the design token system, the pilot story is implicit rather than explicit on the landing page, and CTA density is too low on the hero.

**Verdict: CONDITIONAL GO** — fix the four blockers below and this is ship-ready for hardening.

---

## Part 1: Top Design Issues

### CRITICAL

**D1. Three public routes are 404:**
`/docs`, `/verify`, `/trust-state` all return HTTP 404. These are linked in navigation/footer or referenced by other pages. Dead links on a trust platform are a credibility killer.

**D2. HomeSections.tsx has 28+ inline style violations:**
Hardcoded `#080e1a`, `#070d18`, `#070c16` backgrounds and 12+ inline `rgba()` color values bypass the token architecture. This creates fragility — theme changes won't propagate, and it signals design system immaturity to any technical evaluator who inspects source.

### HIGH

**D3. Landing page hero has weak CTA density:**
The hero section offers "Get Started" in the nav bar but no high-contrast, above-the-fold primary action button in the hero body itself. The NPI input is the implicit CTA but it doesn't visually read as the dominant action. Compare: `/get-ready` and `/explore` both have clear, high-contrast buttons immediately visible.

**D4. Color-only status differentiation on `/labs` and `/updates`:**
Emerald (stable), sky-blue (preview), amber (experiment) status badges rely on color alone. Colorblind users lose the signal. Text labels exist but the visual weight is on the color dot. Needs secondary affordance (icon shape, pattern, or bolder label weight).

### MODERATE

**D5. `/interview` is a dead-end redirect page:**
Shows "Interview mode needs a homepage NPI lookup before it can open." This is technically correct but visually it's a bare error state with no brand reinforcement. For a route a clinician might bookmark or share, this needs a warmer treatment with illustration or context.

**D6. `/labs` exposes "Ops Only" items to public visitors:**
Faded-opacity internal features appear on a public page. This leaks internal implementation surface to external visitors. Either gate behind auth or remove from public render.

---

## Part 2: Top Story Issues

### CRITICAL

**S1. Pilot story is not legible on the landing page without explanation:**
The homepage hero says "NPI first. Honest coverage." with a three-step process and source coverage table. This communicates *what* VitalCV does but not *why now* or *for whom specifically*. A first-time visitor — especially a pilot prospect — cannot tell from the landing page that VitalCV is running pilots, what a pilot involves, or how to engage. The pilot story lives entirely in `/investors` and internal routes.

**Recommendation:** Add a single "For Pilot Partners" or "Currently onboarding" section to the landing page, or create a dedicated `/pilot` public route that tells the story in 30 seconds.

### HIGH

**S2. `/investors` tries to tell too many stories:**
This page covers: the $4.2B problem, the technical solution, platform metrics, market opportunity, three competitive advantages, founder story, product roadmap through Series A, AND a contact form. That's 8 distinct narrative beats on one scroll. The page would be stronger with the roadmap and metrics pulled into an expandable or linked section, keeping the investor page to: problem → solution → traction → ask.

### MODERATE

**S3. Homepage "How It Works" section is functional but not emotional:**
The 01-02-03 steps explain mechanics (Enter NPI → Review readiness → Share intent) without conveying the *relief* or *transformation* a clinician feels. For a trust platform, the story should end with a moment of recognition — "Your credentials, already verified." This is a copy opportunity, not a structural issue.

**S4. No public "review" surface is accessible:**
The `/review` route requires an `entityId` parameter, meaning there's no public-facing review experience to audit. If the review surface is employer-facing and gated, this is fine — but if it's meant to be part of the public trust story, it needs a demo or preview mode.

---

## Part 3: Route-by-Route Verdict

| Route | Feel | Job Clarity | Trust Signal | Verdict |
|-------|------|-------------|--------------|---------|
| `/` (landing) | Premium, calm | Good — NPI-first message is clear | Strong — source coverage table | **PASS** with CTA density fix |
| `/get-ready` | Premium, calm | Excellent — single task: NPI preview | Strong — "preview only" safety framing | **PASS** |
| `/explore` | Premium, calm | Excellent — matched opportunities | Strong — demo data disclaimer, trust-native language | **PASS** |
| `/search` | Premium, calm | Excellent — search gateway | Strong — "source-backed results" | **PASS** |
| `/investors` | Premium, calm | Overloaded — 8 narrative beats | Strong — market data, compliance certs, founder story | **PASS** with narrative tightening |
| `/partners` | Premium, calm | Excellent — three partnership tiers | Strong — enterprise logos, HIPAA-native language | **PASS** |
| `/developers` | Premium, calm | Excellent — API integration guide | Strong — governance rules, conformance, code samples | **PASS** |
| `/intake` | Premium, calm | Excellent — credential upload flow | Strong — PSV framing, step-based progression | **PASS** |
| `/sign-in` | Premium, calm | Single task: authenticate | Adequate — Clerk integration | **PASS** |
| `/updates` | Premium, ops-feel | Excellent — deployment + changelog | Strong — commit SHAs, live indicators | **PASS** |
| `/status` | Premium, ops-feel | Excellent — system health dashboard | Strong — trust metrics, incident tracking | **PASS** |
| `/labs` | Premium, calm | Good — feature maturity tiers | Moderate — "Ops Only" leak | **PASS** with ops-only items gated |
| `/interview` | Minimal | Adequate — prerequisite redirect | Weak — bare error state | **NEEDS WORK** |
| `/docs` | **404** | N/A | N/A | **FAIL** |
| `/verify` | **404** | N/A | N/A | **FAIL** |
| `/trust-state` | **404** | N/A | N/A | **FAIL** |

---

## Part 4: Design System Health

**Overall Score: 78/100**

| Layer | Rating | Notes |
|-------|--------|-------|
| Typography | 95% — Excellent | Responsive clamp() scale, consistent font stack, no violations |
| Spacing | 95% — Excellent | Systematic 4px-base tokens, no hardcoded values found |
| Motion | 98% — Excellent | Single canonical easing curve, locked duration bands, reduced-motion support |
| Color | 70% — Moderate | Solid token architecture undermined by 28+ inline violations in marketing layer |
| Buttons/CTAs | 80% — Good | Antigravity system (primary/accent/secondary/glass) well-defined but marketing components bypass it |

**Critical path to 90+:** Fix HomeSections.tsx inline styles. This alone eliminates ~80% of violations.

---

## Part 5: GO / NO-GO

### Verdict: CONDITIONAL GO

The site is **substantially ship-ready**. The visual system supports trust. The calm-over-chaotic principle is achieved. Each page (with noted exceptions) has one dominant job. The design system foundation is world-class.

### Four blockers before hardening:

| # | Blocker | Effort | Why it blocks |
|---|---------|--------|---------------|
| B1 | Fix 404s on `/docs`, `/verify`, `/trust-state` | S — route stubs or redirects | Dead links destroy trust credibility on a trust platform |
| B2 | Refactor HomeSections.tsx inline styles to use design tokens | M — 28 replacements, mechanical | Design system integrity for any technical evaluator; theme-breaking risk |
| B3 | Add above-the-fold primary CTA to landing hero | S — button + styling | Conversion: visitors need a clear dominant action |
| B4 | Add pilot story surface (section on `/` or dedicated `/pilot` route) | M — copy + one component | Pilot prospects must understand the story without explanation |

### Recommended but not blocking:

- Tighten `/investors` from 8 narrative beats to 4-5
- Add secondary affordance to color-coded status badges (accessibility)
- Warm up `/interview` dead-end with illustration and context
- Gate "Ops Only" items on `/labs` behind auth
- Add subtle scroll-reveal motion to landing page sections (motion system supports it, just not wired)

### Once blockers are resolved:

**GO for hardening and ship prep.**
