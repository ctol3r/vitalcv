# VitalCV — Clarity, Marketing & SEO Prompt Arsenal

## Market Intelligence (gathered 2026-04-09)

**Market size:** Credentialing software market valued at $1.2B (2025), projected $2.5B by 2034, 8.5% CAGR.

**Competitors:**
- Atlas Systems (PRIME) — provider data management, NCQA-compliant
- Symplr — end-to-end provider lifecycle for large health systems
- VerityStream/HealthStream — CredentialStream platform, NCQA-certified CVO
- Verisys — FACIS sanctions monitoring, LicenseCheck
- Practolytics, MediBillMD, CureMD — RCM-integrated credentialing

**Key differentiator VitalCV must exploit:**
- incumbents are enterprise-only, slow, expensive, built for credentialing *departments*
- VitalCV is NPI-first, instant, source-backed, clinician-owned
- No other platform gives the *clinician* a portable readiness snapshot

**Core buyer pain points:**
- "Time to start" is 60-90 days for new providers
- Re-credentialing every 2 years means repeated paperwork
- Employers spend $500-2,000 per provider on credentialing
- No portable trust artifact — every new employer starts from scratch
- Manual primary source verification is slow and error-prone

---

## PROMPT 1: Landing Page Clarity Overhaul (Claude Code)

**What this fixes:** The current homepage confuses first-time visitors. A healthcare provider should understand what VitalCV does, why it matters to them, and what to do next — in under 3 seconds, without scrolling.

```text
Task: Rewrite the VitalCV homepage for instant clarity and conversion.

Context: VitalCV is an NPI-first healthcare credentialing verification platform. The target audiences are:
1. CLINICIANS (doctors, NPs, PAs) who want to check their credentialing readiness and carry a portable trust snapshot
2. HEALTHCARE EMPLOYERS (hospitals, clinics, locums agencies) who want to reduce time-to-start from 90 days to under 60

The current homepage confuses both audiences. It uses insider jargon (NPPES, OIG/LEIE, PECOS) in the hero without explanation. The "Step 1/2/3" cards are visual noise. The "Time-to-Start" comparison widget makes unsubstantiated claims. There is no clear single action the user should take.

Requirements:

HERO SECTION (above the fold, no scroll required):
- A single, bold headline that a tired ER doctor at 2am can instantly understand. Examples of clarity:
  - "Check if you're ready to work. In 10 seconds."
  - "Your credentialing status. Instantly verified."
- A one-line subheadline that explains the value without jargon:
  - "Enter your NPI number. We verify your identity, check exclusions, and confirm your enrollment status — from the actual sources."
- ONE prominent input field (the NPI input) with the button directly beside it.
- NO step cards, NO source coverage badges, NO time-to-start widget in the hero. Those go below.

SOURCE EXPLANATION SECTION (below the fold):
- After the hero, add a clean section: "What we check"
- Use plain-English labels, NOT acronyms:
  - "NPI Identity" (not NPPES) — "Confirms your identity from the federal provider registry"
  - "Exclusion Check" (not OIG/LEIE) — "Verifies you are not on any federal exclusion list"
  - "Medicare Enrollment" (not PECOS) — "Confirms your Medicare provider enrollment status"
  - "State License" (not FSMB) — "Verifies your state medical board license (where available)"
- Each item shows its real-time status: ✅ Active, ⏳ Pending, 🔒 Requires Access

SOCIAL PROOF SECTION:
- "Trusted by healthcare systems that need faster credentialing"
- Include placeholder for one or two testimonials from real clinicians or credentialing managers

FOR EMPLOYERS SECTION:
- Clear, separate value proposition: "For healthcare employers: Reduce provider time-to-start. See verified readiness, not self-reported claims."
- CTA: "Request a pilot" → /pilot

FOOTER:
- Clean, minimal. Copyright + key links only.

Design rules:
- Use semantic tokens (bg-background, text-foreground, text-muted-foreground, bg-card, border-border) for full dark mode support.
- No hardcoded hex colors.
- The page must look clean and readable in BOTH light and dark modes.
- Mobile-first: the NPI input must be full-width on mobile with the button below it.
```

---

## PROMPT 2: SEO & Content Strategy (ChatGPT / Claude / Perplexity)

**What this does:** Generates keyword strategy, content calendar, and competitive positioning data.

```text
I need a comprehensive SEO and content marketing strategy for VitalCV (vitalcv.com), a healthcare credentialing verification platform.

Context:
- The credentialing software market is $1.2B (2025), growing at 8.5% CAGR to $2.5B by 2034
- Competitors: Atlas Systems, Symplr, VerityStream, Verisys, Practolytics, CureMD
- VitalCV's differentiator: NPI-first, instant, source-backed, clinician-owned portable trust snapshot
- Target audiences: (1) clinicians wanting to check readiness, (2) healthcare employers wanting faster time-to-start

Please provide:

1. KEYWORD STRATEGY
- Top 50 keywords VitalCV should target, organized by:
  - Head terms (high volume, competitive)
  - Long-tail keywords (lower volume, high intent)
  - Question-based keywords (what clinicians actually search)
  - Local/geo keywords (state-specific credentialing searches)
- For each keyword: estimated search intent (informational/transactional/navigational), difficulty estimate, and content recommendation

2. COMPETITOR CONTENT GAP ANALYSIS
- What keywords do Atlas Systems, Symplr, and Verisys rank for that VitalCV doesn't?
- What content types are they producing (blog posts, tools, calculators, guides)?
- What search queries do they NOT answer well that VitalCV could own?

3. CONTENT CALENDAR (12 weeks)
- Weekly content topics targeting high-value keywords
- Mix of: landing pages, blog posts, interactive tools (e.g., "Credentialing Time Calculator"), comparison pages ("VitalCV vs Verisys")
- Each topic should target 1-2 primary keywords

4. PROGRAMMATIC SEO OPPORTUNITIES
- What pages could we auto-generate at scale?
- Examples: state-specific pages ("/credentialing/california"), specialty-specific pages ("/credentialing/nurse-practitioner"), source-specific pages ("/npi-lookup")

5. BACKLINK STRATEGY
- Which healthcare directories, medical associations, and industry publications should we target for backlinks?
- What linkable assets should we create?

6. TECHNICAL SEO CHECKLIST
- Critical technical SEO fixes specific to Next.js App Router
- Schema markup opportunities (MedicalOrganization, MedicalWebPage, FAQPage)
- Core Web Vitals optimization for a Next.js site with heavy JS
```

---

## PROMPT 3: Conversion Rate Optimization (Claude Code)

**What this does:** Fixes every conversion leak in the user journey from landing to NPI check to result display.

```text
Task: Optimize the full VitalCV conversion funnel for first-time clinician visitors.

Context: VitalCV converts when a clinician enters their NPI and sees their readiness result. Currently, the conversion funnel has leaks at every step.

The funnel: Landing page → NPI entry → Loading state → Results display → Sign-up prompt

Fix each stage:

1. LANDING → NPI ENTRY
- The NPI input must be the single visual focal point of the page
- Add a micro-animation or subtle pulse to draw the eye to the input
- Below the input, show trust signals: "No sign-up required · Checks federal sources · Takes 10 seconds"
- Remove everything that competes for attention (step cards, time comparison, source badges) from the hero

2. NPI ENTRY → LOADING STATE
- After the user clicks "Check Readiness", show a deterministic loading sequence (NOT a spinner):
  - "Verifying NPI identity..." (2s)
  - "Checking exclusion status..." (2s)  
  - "Confirming enrollment..." (2s)
  - "Building readiness snapshot..." (1s)
- This builds trust by showing what's happening and takes exactly as long as the real API calls

3. LOADING → RESULTS DISPLAY
- When results appear, animate them in with a staggered reveal
- Show a clear "Readiness Score" or status indicator at the top (e.g., "3 of 4 sources verified — Ready to present")
- Each source check should show: source name, status badge (✅/⏳/🔒), timestamp, and a "Verified by [source name] on [date]" provenance line
- Add a clear "Download Proof" button for the PDF packet

4. RESULTS → SIGN-UP
- After 2-3 seconds of viewing results, show a non-intrusive banner:
  - "Create your VitalCV Passport — carry this snapshot to any employer"
  - Button: "Save my results (free, 30 seconds)"
- The sign-up CTA must NOT block the results. The user can dismiss it and still see their full results.

5. MOBILE OPTIMIZATION
- The NPI input must be full-width on mobile
- Results must be in a single scrollable card
- "Download Proof" must use a mobile-friendly download (not try to render in-browser PDF)
- Touch targets must be at least 44x44px

Design rules:
- All components must use semantic CSS tokens for dark mode support
- No hardcoded colors anywhere
- TypeScript strict mode
```

---

## PROMPT 4: Copywriting & Messaging Framework (ChatGPT / Claude)

**What this does:** Creates the entire messaging architecture — taglines, value props, objection handling, audience-specific copy.

```text
I need a complete messaging framework for VitalCV, a healthcare credentialing verification platform.

Product: VitalCV lets healthcare providers (doctors, NPs, PAs) enter their NPI number and instantly receive a source-backed credentialing readiness snapshot from federal sources (NPPES, OIG/LEIE, PECOS). Employers can review these verified snapshots to make faster hiring decisions.

Competitors are all enterprise-only, expensive, slow (60-90 day credentialing cycles), and built for credentialing departments — not for the clinicians themselves.

VitalCV is different: it's instant, free for clinicians, source-backed (not self-reported), and portable.

Please create:

1. BRAND TAGLINE (5 options)
- Must work for a healthcare professional on first sight
- Must NOT use insider jargon

2. ELEVATOR PITCH (3 versions: 10 seconds, 30 seconds, 60 seconds)
- 10-second: one sentence a doctor can understand
- 30-second: what you'd say at a healthcare conference
- 60-second: investor pitch opener

3. VALUE PROPOSITION BY AUDIENCE
- For clinicians (doctors, NPs, PAs):
  - Primary value prop
  - 3 supporting benefits
  - Objection handlers ("Why should I trust this?", "Is my data safe?", "What does this actually do?")
- For healthcare employers (hospitals, clinics, locums agencies):
  - Primary value prop
  - 3 supporting benefits  
  - ROI argument ("How much does credentialing cost you now vs with VitalCV?")
- For health systems executives (CMO, VP Medical Staff):
  - Primary value prop
  - Risk reduction framing
  - Compliance alignment messaging

4. PAGE-BY-PAGE COPY
- Homepage hero: headline, subheadline, CTA button text
- /passport page: headline, subheadline, source explanations, privacy text
- /employers page: headline, value props, CTA
- /pilot page: headline, what to expect, success criteria
- /about page: mission statement, founding story placeholder
- /pricing page: pricing philosophy, pilot pricing CTA

5. MICROCOPY
- NPI input placeholder text
- Loading state messages (sequence of 4)
- Error states (invalid NPI, source unavailable, network error)
- Success state headline
- Download button text
- Sign-up prompt text
- Empty state text for explore page

6. OBJECTION FAQ (10 questions)
Write answers for the 10 most likely objections from:
- Clinicians who are skeptical
- Credentialing managers who are risk-averse
- IT/Security teams at hospitals

7. COMPARISON PAGES
- "VitalCV vs manual credentialing" — 5 key differences
- "VitalCV vs Symplr" — positioning against the biggest competitor
- "VitalCV vs traditional CVO" — why portable + instant beats batch + slow
```

---

## PROMPT 5: Visual Design Polish (Claude Code or Cursor)

**What this does:** Makes the site look professional, trustworthy, and premium — not like a developer side project.

```text
Task: Polish the VitalCV visual design to match healthcare SaaS standards.

Context: VitalCV is a healthcare credentialing platform. It needs to look as trustworthy as a hospital's internal system while being as clean as a modern SaaS product. Currently it looks like a developer project — inconsistent spacing, flat hierarchy, no visual breathing room.

Execute these specific visual improvements:

1. TYPOGRAPHY HIERARCHY
- Establish a strict type scale using the existing font variables:
  - Display: font-display (Fraunces/Instrument Serif) — ONLY for the main headline
  - Heading: font-heading (Plus Jakarta Sans) — H2, H3
  - Body: font-sans (DM Sans) — paragraphs, labels
  - Mono: font-mono (JetBrains Mono) — NPI numbers, data values, code
- The homepage hero headline must use font-display at clamp(2.5rem, 5vw, 4rem)
- Section headings must use font-heading at 1.5rem/700
- Body text must be 1rem/400 with 1.6 line-height
- All text must be readable: minimum contrast ratio 4.5:1 in both light and dark modes

2. SPACING SYSTEM
- Apply consistent spacing using multiples of 0.5rem (8px)
- Sections: py-20 (5rem) between major sections
- Cards: p-6 (1.5rem) internal padding
- Between cards: gap-6 (1.5rem)
- Between label and input: gap-2 (0.5rem)

3. CARD DESIGN
- All cards: rounded-xl, border border-border, bg-card, shadow-sm
- On hover: shadow-md, -translate-y-0.5
- On focus-visible: ring-2 ring-ring ring-offset-2 ring-offset-background
- Consistent padding: p-6

4. BUTTON DESIGN
- Primary CTA: rounded-full bg-foreground text-background px-6 py-3 font-semibold
- Secondary: rounded-full border border-border text-foreground px-6 py-3 font-medium
- Ghost: rounded-full text-muted-foreground px-4 py-2 hover:bg-foreground/5
- All buttons: transition-all duration-200
- Min touch target: h-10 w-10 (44x44px for mobile)

5. FORM DESIGN (NPI Input)
- The NPI input should feel premium:
  - rounded-xl border border-border bg-card px-4 py-3.5 text-lg font-mono
  - Placeholder: "1234567890" in muted-foreground
  - Focus state: ring-2 ring-ring border-ring
  - Valid state: border-trust-green
  - Invalid state: border-destructive
- The "Check Readiness" button should be directly beside the input (desktop) or below it (mobile)
- Button should have a subtle loading animation (not a spinner — a progress bar inside the button)

6. COLOR HARMONY
- Light mode: warm neutral palette (cream background, dark text, teal accent for trust)
- Dark mode: cool neutral palette (near-black background, light text, teal accent for trust)
- Accent color (trust-green/teal) used SPARINGLY — only for success states, primary CTAs, and key trust signals
- Status colors: green=verified, amber=pending, red=excluded, gray=unavailable

7. WHITESPACE & BREATHING ROOM
- Every section needs at least 5rem vertical padding
- The hero needs min-h-[70vh] (not full screen — leave room for the source section to peek)
- Cards need 1.5rem internal padding
- Remove ALL visual clutter that doesn't serve the user's goal

8. FOOTER REDESIGN
- Minimal, clean, professional
- Logo left, links center, copyright right
- Links: Passport, Explore, Employers, Developers, Pilot, Compliance, Status
- Remove git commit hashes
- Add: "Built for healthcare mobility" tagline

Implementation rules:
- Use ONLY semantic CSS tokens (bg-background, text-foreground, bg-card, border-border, etc.)
- No hardcoded hex colors, no oklch() literals in className
- Must render correctly in both light and dark modes
- Mobile-first responsive
```

---

## PROMPT 6: Analytics & KPI Instrumentation (Claude Code)

**What this does:** Wires up tracking to measure what actually converts and what doesn't.

```text
Task: Instrument the VitalCV homepage and key pages with conversion analytics.

Context: We need to measure the clinician conversion funnel to optimize it. The funnel is:
1. Page view (homepage or /passport)
2. NPI input focused
3. NPI submitted (10 digits entered + button clicked)
4. Results displayed
5. Sign-up CTA shown
6. Sign-up CTA clicked
7. Sign-up completed
8. Proof packet downloaded

We use PostHog (already configured in the app).

Implementation:

1. Create a funnel tracking utility in /lib/analytics/funnel.ts:
```typescript
export const FUNNEL_EVENTS = {
  HOMEPAGE_VIEWED: 'homepage_viewed',
  NPI_INPUT_FOCUSED: 'npi_input_focused',
  NPI_SUBMITTED: 'npi_submitted',
  RESULTS_DISPLAYED: 'results_displayed',
  SIGNUP_PROMPT_SHOWN: 'signup_prompt_shown',
  SIGNUP_PROMPT_DISMISSED: 'signup_prompt_dismissed',
  SIGNUP_CLICKED: 'signup_clicked',
  SIGNUP_COMPLETED: 'signup_completed',
  PACKET_DOWNLOADED: 'packet_downloaded',
  TIME_TO_START_CLICKED: 'time_to_start_clicked',
} as const;
```

2. Instrument the LiveTrustConsole component:
- Track NPI_INPUT_FOCUSED when the input receives focus
- Track NPI_SUBMITTED when 10 digits are entered and button is clicked (include the NPI hash, not the raw NPI)
- Track RESULTS_DISPLAYED when the readiness preview renders (include number of sources checked)

3. Instrument the CreateAccountModal:
- Track SIGNUP_PROMPT_SHOWN when it appears
- Track SIGNUP_PROMPT_DISMISSED when user closes it
- Track SIGNUP_CLICKED when user clicks the sign-up button

4. Instrument the proof packet download:
- Track PACKET_DOWNLOADED when the PDF endpoint is hit

5. Create a /internal/funnel-debug page (protected, auth-required) that shows:
- Total homepage views today
- NPI submission rate (submissions / views)
- Result display success rate
- Sign-up conversion rate (signups / results shown)
- Packet download rate
- Average time from page view to NPI submission
- Average time from NPI submission to result display

6. Add UTM parameter capture:
- Capture utm_source, utm_medium, utm_campaign from URL
- Store in localStorage
- Include in all PostHog events as properties
```

---

## PROMPT 7: Competitive Landing Pages (Claude Code)

**What this does:** Creates SEO-optimized comparison pages that capture high-intent search traffic.

```text
Task: Create competitive comparison landing pages for VitalCV.

Context: When healthcare decision-makers evaluate credentialing solutions, they search for comparisons. We need to own these searches.

Create these pages:

1. /compare/vitalcv-vs-manual-credentialing
- Target keyword: "credentialing verification vs manual"
- Structure: Side-by-side comparison table
  - Feature | Manual Process | VitalCV
  - Time to verify NPI | 2-5 days | 10 seconds
  - Exclusion check | Manual OIG search | Automatic
  - Medicare enrollment | Manual PECOS lookup | Automatic
  - Re-verification | Start from scratch every time | Instant re-check
  - Cost per provider | $500-2,000 | Free for clinicians
  - Portability | None | Carry snapshot to any employer
- CTA: "Try it now — enter your NPI"

2. /compare/vitalcv-vs-symplr
- Target keyword: "vitalcv vs symplr"
- Position VitalCV as: fast, clinician-first, affordable complement
- Acknowledge Symplr's enterprise strength, position VitalCV as the clinician-side entry point

3. /compare/vitalcv-vs-verisys
- Target keyword: "vitalcv vs verisys"  
- Focus on: instant vs batch, portable vs institutional, free vs enterprise-priced

4. /credentialing/california (template for all 50 states)
- Target keyword: "medical credentialing [state]"
- Content: state-specific licensing board info, typical timeline, how VitalCV helps
- Make this a template that can be parameterized by state

5. /tools/credentialing-time-calculator
- Interactive tool: "How much does credentialing cost your organization?"
- Inputs: number of providers, average time-to-start, hourly rate of credentialing staff
- Output: estimated annual cost, potential savings with VitalCV
- Capture email before showing results (lead gen)

Each page must:
- Have unique meta title, description, and canonical URL
- Use semantic HTML (proper heading hierarchy)
- Have Organization + FAQPage JSON-LD where applicable
- Use semantic CSS tokens for dark mode
- Have a clear CTA above the fold
- Link back to /passport for the NPI check
```

---

## EXECUTION ORDER

1. **PROMPT 1** (Clarity) → Claude Code — this is the highest impact change
2. **PROMPT 4** (Copywriting) → ChatGPT — generates the words for Prompt 1
3. **PROMPT 5** (Visual Polish) → Claude Code — makes the words look premium
4. **PROMPT 3** (CRO) → Claude Code — optimizes the funnel after the visual is clean
5. **PROMPT 6** (Analytics) → Claude Code — measures what works
6. **PROMPT 2** (SEO Strategy) → Perplexity/ChatGPT — generates the content roadmap
7. **PROMPT 7** (Competitive Pages) → Claude Code — executes the SEO content
