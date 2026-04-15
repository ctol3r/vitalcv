# VitalCV Wedge — Final Design & Story Audit

**Date:** 2026-03-27
**Auditor:** Claude (Cowork — Opus)
**Production:** https://vitalcv.com
**Deployment:** `dpl_27PvhS5wK9qMjenKvVW8eTUoUqiM` (READY, main)
**Scope:** Homepage, /passport, /review, /developers

---

## Executive Summary

The wedge is **calm, trust-forward, and narratively honest**. Each of the four audited surfaces has a clear dominant job. The Antigravity dark-surface system, consistent TrustStatusBadge primitive, and restrained motion create an institutional feel that reads as healthcare infrastructure — not SaaS startup. Copy has been scrubbed of verification overclaims per the postrelease-truth-cleanup pass.

Three design issues and two story issues remain. None are architectural. All are fixable in a single sprint day.

**Verdict: GO for pilot demo.** The issues below are polish, not blockers.

---

## Page-by-Page Audit

### 1. Homepage (/)

**Dominant job:** Enter your NPI → see what VitalCV knows about you in ~10 seconds.

**Does the visual system support trust?** Yes. The hero is a single NPI input with a 3-step flow indicator (Enter NPI → Review readiness → Share intent). Source stages appear progressively with TrustStatusBadge labels. The TrustStrip below the hero shows current source coverage with honest labels (Checked / Pending / Access required). Copy is precise: "marks each lane as Checked, Pending, Access required, Unavailable, or Preview only."

**Is the product calm or cluttered?** Calm. The homepage renders exactly three sections: Hero (LiveTrustConsole), TrustStrip, HowItWorksSection. The remaining 5 marketing sections (ProblemSection, TractionSection, WhyNowSection, MoneyballSection, PlatformVisionSection) exist in HomeSections.tsx but are NOT wired into page.tsx. This is the right call for a wedge demo — tight focus.

**Does motion help or distract?** Helps. FadeIn on HowItWorks cards uses `once: true` with staggered 0.1s delays and `margin: '-80px'` viewport trigger — subtle, not distracting. The LiveTrustConsole loading panel uses `animate-fade-in-up` on state transitions. No gratuitous animation.

**Issues found:**

- **D1 (LOW).** Homepage `<div style={{ background: '#080e1a' }}>` — inline hardcoded background color bypasses the token system (`bg-vt-surface-ops-base`). Cosmetic inconsistency; works visually but signals design system immaturity if inspected.
- **D2 (LOW).** HowItWorksSection and TrustStrip both repeat subtle grid/noise background textures with inline styles. Same token bypass pattern. Not user-visible but contributes to style drift.
- **S1 (MEDIUM).** The homepage hero says "Share intent" as step 3 but the actual flow-through lands on `/passport?npi=`. The step label implies the clinician is sharing something with an employer, but the actual action is "Open passport." The label was recently changed from "Open passport" per activation-packet-conversion — the new label is aspirationally correct but doesn't match the current implementation.

### 2. Passport (/passport)

**Dominant job:** Enter NPI → watch live source checks → view full passport or view as employer.

**Does the visual system support trust?** Strongly yes. The passport page is the most well-executed surface. The SSE ingest stream drives progressive source rows (Identity → Sanctions → Enrollment) with real-time TrustStatusBadge transitions. Phase labels are honest: "Connecting to primary sources…", "Checking sanctions and exclusions…", "Checking Medicare enrollment…". Terminal states are explicit: "No profile found", "Profile resolved but not yet anchored", "Stream disconnected."

**Is the product calm or cluttered?** Very calm. Single-column, max-w-sm centered layout. NPI input hides once the ingest starts. Source rows are minimal (label + badge). The two CTAs after completion ("View full passport" / "View as employer") are clearly differentiated with success vs outline variants.

**Does motion help or distract?** Helps. `animate-fade-in-up` on the ingest panel is the only animation. Source rows transition in-place without layout shift.

**Issues found:**

- **D3 (LOW).** The "Check another NPI" ghost button at the bottom has `hover:bg-transparent` — on hover, nothing visually changes except text opacity. Minor affordance gap.
- **(CLEAN).** The `resolveSourceBadge()` function correctly maps all terminal states including edge cases (Possible match, Opted out, Flag found). No overclaims found.

### 3. Review (/review)

**Dominant job:** Tell the visitor this page requires a real passport share link → redirect to NPI lookup.

**Does the visual system support trust?** Yes. Uses TrustStateCard with `tone="warning"` (amber border). Copy is honest: "Employer review opens from a real passport share link. Access required lanes stay attached to the passport itself."

**Is the product calm or cluttered?** Very calm. Single centered card. Two CTAs: "Start with NPI lookup" (primary) + "Packet preview" (secondary ghost). No extraneous content.

**Does motion help or distract?** No motion present. Appropriate for a redirect/landing state.

**Issues found:**

- **S2 (LOW).** Live site shows "Open a shared packet preview" as title, but the source code says "Open a shared passport review." The live site appears to be running a slightly different build than what's in the workspace. Verify the deployed copy matches HEAD. (This may already be resolved by the latest deploy.)
- **D4 (LOW).** The secondary CTA says "Packet preview" and links to `/interview`, but for an employer-facing surface, the word "interview" in the URL creates persona confusion. The employer thinks they're reviewing; the URL says interview. This is a known routing artifact — not a new issue.

### 4. Developers (/developers)

**Dominant job:** Show what the current VitalCV API preview exposes, with sandbox and SDK examples.

**Does the visual system support trust?** Yes, for a developer audience. Emerald accent for developer tools, dark glass surfaces, code blocks with proper syntax framing. The hero explicitly says "Build against the current VitalCV API preview" — not "production API." Honest framing.

**Is the product calm or cluttered?** This is the one page that leans toward information density rather than calm. It packs: hero + stats row + API key manager + webhook log + cURL sandbox + drop-in widget SDK + network gateway + verifier SDK + trust governance + conformance report + HealthStart docs + SDK docs + resource links. That's 12+ sections on a single scroll.

**Does motion help or distract?** Minimal motion. Hover transitions on resource cards. No scroll-triggered animations. Appropriate for a developer reference page.

**Issues found:**

- **D5 (MEDIUM).** Developer portal is the densest page in the wedge. For a pilot demo, most visitors won't be developers. If this page is reachable from the nav during a pilot demo with a clinician or employer audience, it could overwhelm. Consider: is `/developers` in the pilot demo nav? Currently yes — it's the 4th nav item.
- **S3 (LOW).** Wave labels ("Wave 107", "Wave 114", "Wave 118", "Phase 7") are visible in section headers. These are internal execution tracking labels, not meaningful to external visitors. They should be removed or hidden behind a debug flag before pilot demo.
- **D6 (LOW).** The `text-vt-neutral-800` class is used for muted text throughout the page. On a dark background, `neutral-800` typically reads as nearly invisible. Verify the token resolves to the intended contrast ratio — it may be a misnamed token (should be `neutral-400` or similar for readable muted text on dark surfaces).

---

## Top Design Issues (Ranked)

| # | Severity | Surface | Issue | Fix Effort |
|---|----------|---------|-------|------------|
| D5 | MEDIUM | /developers | Page density too high for non-developer demo audiences; wave labels visible | S — hide wave labels, consider removing from pilot nav |
| D1 | LOW | / | Inline hardcoded `#080e1a` background bypasses token system | S — replace with `bg-vt-surface-ops-base` |
| D2 | LOW | / | Grid textures use inline styles instead of tokens | S — extract to CSS custom properties |
| D3 | LOW | /passport | Ghost button hover has no visual feedback | S — add `hover:bg-white/5` |
| D4 | LOW | /review | "Packet preview" CTA links to /interview — persona confusion | S — rename route or CTA label |
| D6 | LOW | /developers | `text-vt-neutral-800` may have insufficient contrast on dark BG | S — audit token value |

## Top Story Issues (Ranked)

| # | Severity | Surface | Issue | Fix Effort |
|---|----------|---------|-------|------------|
| S1 | MEDIUM | / | Step 3 "Share intent" doesn't match actual flow (opens passport) | S — change label to "Open passport" or wire share flow |
| S3 | LOW | /developers | Internal wave labels visible to external visitors | S — remove or feature-flag |
| S2 | LOW | /review | Title copy may differ between deployed build and workspace HEAD | S — verify deploy matches HEAD |

---

## Audit Criteria Summary

| Criterion | Homepage | Passport | Review | Developers |
|-----------|----------|----------|--------|------------|
| One dominant job? | Yes | Yes | Yes | Yes (but dense) |
| Visual system supports trust? | Yes | Strongly yes | Yes | Yes |
| Calm or cluttered? | Calm | Very calm | Very calm | Dense |
| Motion helps or distracts? | Helps | Helps | N/A | Neutral |

---

## Verdict: GO for Pilot Demo

The wedge is honest, calm, and trust-forward. The four surfaces each have a clear job. The visual system is cohesive. Copy has been scrubbed of overclaims. The only surface that needs attention for a non-technical demo audience is `/developers` (density + wave labels).

**No architectural issues. No truth violations. No blockers.**

Recommended pre-demo polish (all S-effort):
1. Remove wave labels from /developers section headers
2. Fix step 3 label on homepage ("Share intent" → match actual flow)
3. Replace inline `#080e1a` backgrounds with token references
4. Verify deployed copy matches workspace HEAD on /review
