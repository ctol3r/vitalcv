# VitalCV Post-Polish Design & Story Audit

**Date:** 2026-03-27
**Auditor:** Claude (Cowork — Opus)
**Production:** https://vitalcv.com
**Scope:** All public surfaces — /, /passport, /review, /explore, /employers, /developers
**Method:** Live site fetch + source code review + prior audit cross-reference

---

## Executive Summary

The post-polish site reads as **premium healthcare infrastructure, not SaaS startup**. The Antigravity dark-surface system, OKLch token palette, and restrained motion create a calm institutional identity. Five of six audited surfaces have one clear dominant job. Copy is honest — no verification overclaims survive.

Seven design issues and four story issues remain. One is medium-severity. None are architectural blockers.

**Verdict: GO for hardening and ship prep.** The issues below are polish-grade, fixable in a single sprint day.

---

## The Five Core Questions

### 1. Does the site feel premium?

**Yes.** The evidence:

- **Color system:** OKLch perceptual color space with 30+ semantic tokens per theme. Four theme modes (light, dark, midnight, graphite). This is enterprise-grade, not theme-generator output.
- **Typography:** Fraunces (serif heading) + Nunito Sans (variable-weight body) + JetBrains Mono (code). The serif/sans pairing signals "institution with modern tooling."
- **Glass morphism:** White-alpha overlays with backdrop blur create depth without clutter. Surfaces layer correctly (ops-base → raised → glass → card).
- **Spacing:** Generous whitespace throughout. max-w-sm centered layouts on /passport and /review create breathing room.
- **Code quality:** Tailwind v4 with full CSS variable integration. Semantic class names (success, warning, critical) not raw hex values. Design system maturity is visible in the source.

**One crack:** The `/employers` page showing 1 employer, 5 listings, and 1 state undermines the premium feel through data sparsity rather than design failure. The design is good; the marketplace thinness is exposed by it.

### 2. Does it feel calm rather than chaotic?

**Yes, across the wedge.** The homepage renders exactly three sections (Hero, TrustStrip, HowItWorks). The 5 additional marketing sections (Problem, Traction, WhyNow, Moneyball, PlatformVision) exist in HomeSections.tsx but are **not wired into page.tsx** — correct decision for a wedge demo.

/passport is the calmest surface: single-column, NPI-in → progressive source checks → two CTAs. No sidebar, no feature lists, no competing narratives.

/review is a single centered card. Appropriate minimalism for a redirect state.

**Exception:** /developers packs 12+ sections into a single scroll. For a developer audience this is acceptable reference density. For a non-developer pilot demo audience, it's overwhelming.

### 3. Does the visual system support trust?

**Strongly yes.** The trust communication architecture is well-executed:

- **TrustStatusBadge:** Semantic badge with states (verified, clear, enrolled, blocked, unavailable, pending, checked). Consistent across all surfaces.
- **TrustStateCard:** Alert-style card with tone variants (default/warning/critical/success). Color coding is immediately legible: green = verified, amber = pending, rose = problem.
- **Source attribution:** Every check is labeled with its primary source (NPPES, OIG/LEIE, CMS PECOS, CA State Board/FSMB). Users see *where* the data comes from.
- **Honest gap labeling:** Pending, Access required, Unavailable, Preview only. No state is faked or hidden.
- **Revocation-first posture visible in UI:** The sanctions check runs prominently. Exclusion status shows Clear/Flag found/Possible match/Excluded. This maps to VitalCV doctrine.

### 4. Does each page have one dominant job?

| Surface | Dominant Job | Clear? |
|---------|-------------|--------|
| / (Homepage) | Enter your NPI → see readiness in ~10 seconds | Yes |
| /passport | NPI input → watch live source checks → view passport or share | Yes |
| /review | Tell visitor they need a real share link → redirect to NPI lookup | Yes |
| /explore | Show trust-matched opportunities (readiness-gated) | Yes, but empty |
| /employers | Show live employer directory with trust scores | Yes, but thin |
| /developers | API reference + sandbox + SDK docs | Job is clear; execution is dense |

### 5. Is the pilot story understandable without explanation?

**Partially.** The homepage-to-passport flow tells a legible story: enter NPI → see what VitalCV knows → get a readiness snapshot. The three-step indicator (Enter NPI → Review readiness → Share intent) is clear in concept.

**Gaps:**
- The /passport page assumes users understand what "readiness" means in a credentialing context. No contextual explainer exists between the homepage and the NPI input.
- The /review page assumes the visitor arrived via a share link. Cold visitors get a redirect card with no value proposition for *why* an employer would want to review a passport.
- The /explore page is aspirational — "Opportunities You're Already Matched For" but the marketplace is largely empty during pilot. The demo disclaimer helps but creates friction.

---

## Route-by-Route Verdicts

### / (Homepage) — PASS

**Premium:** Yes. Dark institutional surface, serif/sans typography, honest source coverage strip.
**Calm:** Yes. Three sections, no clutter.
**Trust:** Yes. Source-backed labels, honest gap disclosure.
**One job:** Yes. Enter NPI.

**Issues:**
- D1 (LOW): Inline `#080e1a` background bypasses token system. Replace with `bg-vt-surface-ops-base`.
- D2 (LOW): Grid textures use inline styles instead of design tokens.
- S1 (MEDIUM): Step 3 label "Share intent" doesn't match actual flow (opens /passport). Either change label to "Open passport" or wire the share flow.

### /passport — PASS (strongest surface)

**Premium:** Yes. Glass morphism cards, progressive SSE ingest, semantic badges.
**Calm:** Very calm. Single-column, max-w-sm, zero noise.
**Trust:** Strongest trust expression. Real-time source checks with honest phase labels.
**One job:** Yes. NPI → live checks → view/share.

**Issues:**
- D3 (LOW): "Check another NPI" ghost button has no hover feedback. Add `hover:bg-white/5`.

### /review — CONDITIONAL PASS

**Premium:** Yes. TrustStateCard with amber warning tone is well-executed.
**Calm:** Yes. Single centered card.
**Trust:** Adequate. Honest about access requirements.
**One job:** Yes, but the job is "redirect elsewhere," which is inherently weak.

**Issues:**
- S2 (LOW): Title copy may differ between deployed build and workspace HEAD ("packet preview" vs "passport review"). Verify deploy matches HEAD.
- D4 (LOW): Secondary CTA "Packet preview" links to `/interview` — employer persona sees "interview" in URL, creating role confusion.
- S3 (MEDIUM): No employer value proposition. Cold visitors get zero motivation to engage. For pilot, this is acceptable if employers always arrive via share link. For broader launch, this page needs a "why verify with VitalCV" narrative.

### /explore — CONDITIONAL PASS

**Premium:** Yes. Gradient hero, trust-native matching language.
**Calm:** Yes. Clean hero with two CTAs.
**Trust:** Conceptually strong ("trust-native matching").
**One job:** Show matched opportunities — but the marketplace is largely empty.

**Issues:**
- S4 (MEDIUM): Empty marketplace undercuts the promise. Demo disclaimer helps but creates friction. For pilot demo, consider whether this route should be in the nav at all, or gated behind a "coming soon" state.

### /employers — CONDITIONAL PASS

**Premium:** Yes. Dark gradient, rounded-3xl cards, emerald accents.
**Calm:** Mostly. Launch note box competes visually with employer spotlight.
**Trust:** Good. Trust score (97), verification date, proof link.
**One job:** Browse employer directory — but 1 employer is visible.

**Issues:**
- D5 (LOW): Single employer listing makes the directory feel premature. Consider whether to keep this route live during pilot or redirect to a "launching with select partners" message.
- S5 (LOW): "Live employer directory" framing + 1 result creates credibility tension. "Launch-safe entry point" language is defensive.

### /developers — CONDITIONAL PASS

**Premium:** Yes. Code blocks, emerald developer accents, sandbox tools.
**Calm:** No. 12+ sections on a single scroll. Densest page in the wedge.
**Trust:** Yes, for technical audience. Honest "preview" labeling.
**One job:** API reference — clear, but execution is overwhelming.

**Issues:**
- D6 (MEDIUM): Page density too high for non-developer demo audiences. Wave labels (Wave 107, 114, 118) are internal execution tracking visible to external visitors.
- D7 (LOW): `text-vt-neutral-800` may have insufficient contrast on dark backgrounds. Audit token value.
- S6 (LOW): Consider removing /developers from pilot demo nav if audience is clinicians/employers, not integration partners.

---

## Top Design Issues (Ranked)

| # | Severity | Surface | Issue | Fix |
|---|----------|---------|-------|-----|
| D6 | MEDIUM | /developers | 12+ sections, wave labels visible to external visitors | S — hide wave labels, consider pilot nav removal |
| D1 | LOW | / | Inline `#080e1a` bypasses token system | S — `bg-vt-surface-ops-base` |
| D2 | LOW | / | Grid textures use inline styles | S — extract to CSS vars |
| D3 | LOW | /passport | Ghost button hover has no feedback | S — `hover:bg-white/5` |
| D4 | LOW | /review | "Packet preview" links to /interview (persona confusion) | S — relabel or reroute |
| D5 | LOW | /employers | 1 employer makes directory feel empty | S — gate or reframe |
| D7 | LOW | /developers | Neutral-800 contrast on dark BG | S — audit token |

## Top Story Issues (Ranked)

| # | Severity | Surface | Issue | Fix |
|---|----------|---------|-------|-----|
| S1 | MEDIUM | / | Step 3 "Share intent" ≠ actual flow (opens passport) | S — fix label or wire share |
| S3 | MEDIUM | /review | No employer value prop for cold visitors | M — add "why verify" copy block |
| S4 | MEDIUM | /explore | Empty marketplace undercuts promise | S — gate or "coming soon" |
| S2 | LOW | /review | Deployed copy may differ from HEAD | S — verify and redeploy |
| S5 | LOW | /employers | "Live directory" + 1 result = credibility tension | S — reframe copy |
| S6 | LOW | /developers | Internal wave labels visible externally | S — remove or feature-flag |

---

## Missing Motion Opportunities

The motion system is well-built (12 keyframe animations, scroll-driven support, reduced-motion respect) but underutilized on some surfaces:

1. **/review:** No entrance animation on the TrustStateCard. Adding `animate-fade-in-up` would match /passport's feel. (S effort)
2. **/explore:** Hero text could benefit from staggered entrance matching homepage HowItWorks cards. (S effort)
3. **/employers:** Employer spotlight card has no entrance motion. A subtle `animate-panel-enter` would add polish. (S effort)
4. **Global nav:** No transition on route changes. Not critical, but a subtle crossfade on page content would elevate the premium feel. (M effort — Next.js app router transition API)

---

## Audit Criteria Matrix

| Criterion | / | /passport | /review | /explore | /employers | /developers |
|-----------|---|-----------|---------|----------|------------|-------------|
| Premium feel? | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Calm? | ✅ | ✅✅ | ✅✅ | ✅ | ✅ | ⚠️ Dense |
| Trust support? | ✅ | ✅✅ | ✅ | ✅ | ✅ | ✅ |
| One job? | ✅ | ✅ | ✅ | ⚠️ Empty | ⚠️ Thin | ✅ (dense) |
| Story clear? | ✅ | ✅ | ⚠️ Cold gap | ⚠️ Empty | ⚠️ Thin | ✅ |
| Motion appropriate? | ✅ | ✅ | ➖ Missing | ➖ Missing | ➖ Missing | ✅ |

---

## GO / NO-GO Verdict

### **GO for hardening and ship prep.**

The wedge is honest, calm, and trust-forward. The visual system is mature (OKLch tokens, 4 themes, glass morphism, semantic trust components). Copy has been scrubbed of overclaims. The core flow (/ → /passport → share) works and tells a legible story.

**No architectural issues. No truth violations. No blockers.**

**Recommended pre-ship polish (all S-effort unless noted):**

1. Fix Step 3 label: "Share intent" → match actual flow (S1)
2. Remove wave labels from /developers (D6/S6)
3. Replace inline `#080e1a` with token reference (D1)
4. Add hover feedback to passport ghost button (D3)
5. Add `animate-fade-in-up` to /review TrustStateCard (motion gap)
6. Decide pilot nav: keep or hide /explore and /employers if marketplace is thin (S4/D5)
7. Add employer value prop copy to /review for cold visitors (S3, M-effort)

Items 1–5 are a half-day sprint. Items 6–7 are product decisions that should be resolved before pilot demo audience selection.
