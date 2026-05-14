# Institutional Productization Audit V2
Generated: 2026-05-13T20:38:00Z
Branch: wave-10a/docs-status

Evaluated against: enterprise healthcare credentialing platform standard.
Not infrastructure. Not a demo. An institutional product clinicians carry and employers trust.

---

## What Changed Between V1 and V2

| V1 Gap | Resolution |
|---|---|
| Colored tier badges (green/amber) | ✅ Monochrome `bg-gray-900 text-white` |
| No verdict bar on verifier | ✅ Dark verdict bar leads `/verify/[npi]` |
| "Provider" eyebrow on identity card | ✅ "Identity confirmed" |
| Phase labels procedural ("Checking…") | ✅ Personal ("Confirming your identity…") |
| "packet" language throughout | ✅ "credentials" / "verification data" |
| "Start Pilot" buttons | ✅ "Start Assessment" |
| Equal-weight blocker fields | ✅ displayName + requiredAction only |
| Empty Knowledge Inbox always rendered | ✅ Hidden when empty |
| T1/T2/T3/T4 ladder on homepage | ✅ Replaced with single-sentence explanation |
| No personal value sentence after identity | ✅ "Your NPI is active and federally confirmed." |
| "Use demo NPI ↑" (utility framing) | ✅ "See a live example →" |
| Raw NPPES_API / OIG_LEIE in UI | ✅ "NPPES Registry" / "OIG LEIE" |
| 3-field timestamp grid in verifier | ✅ Single inline timestamp |

---

## 1. What Still Feels Prototype-Like

### Moderate

| Surface | Issue |
|---|---|
| Passport `/passport?npi=...` | The `animate-panel-enter` cards appear sequentially but without a clear visual hierarchy — first-time visitor sees cards stacking, doesn't know which is most important |
| Verifier `/verify/[npi]` | Sections "Source coverage", "Verification receipt", "Issuer", "Verification history" are in equal-weight order — the verdict bar helps but sections still lack visual weight differentiation |
| Review console | `score: null` with only 1 verified lane still shows the fallback "Score unavailable" — needs the "1 of 6 sources checked" framing from V1 recommendation |
| Passport page `/passport` (NPI entry) | The right panel with the static sample (score 82, Coverage 3/3, Receipts 3) updates to live data only for NPI 1457128589 — for all other NPIs it shows the static sample, which reads as fake |

### Low

| Surface | Issue |
|---|---|
| Trust register page | Lists machine-readable doctrine JSON in a human page — fine for technical reviewers, but feels technical to non-engineers if they land there |

---

## 2. What Still Weakens Onboarding Momentum

- **After identity confirms**: The value sentence "Your NPI is active and federally confirmed." is now present, but the experience still ends without a clear call-to-action for what happens next. There's no moment that says "here's what you can now share with employers."
- **NPI entry validation**: The counter "3 / 10 digits" is accurate but feels procedural — consider replacing with a progress bar or simply hiding it until digits are entered
- **"No account required · Nothing stored without your consent"** appears at the bottom right of the input — it should be more prominent as a trust signal, not a legal disclaimer buried at the bottom
- **After done phase**: The completion state shows "Identity confirmed" as the phase label, but no celebration or momentum — a simple "You're ready to share" would help

---

## 3. What Still Creates Cognitive Overload

- **Source health panel on passport**: `LaneHealthMount` renders all 6 lanes including unintegrated ones — employer sees "Not checked" for 4/6 lanes as the default, which feels incomplete
- **Homepage 3-step explanation**: The STEPS section (Enter NPI → Fan out → Sources → Carry forward) describes the technical flow — consider replacing with a 3-step user benefit flow: "See what's confirmed → Know what's missing → Share with confidence"
- **Trust strip on homepage**: Three items (VC 2.0 compatible, OpenID4VCI aligned, Audit-ready receipts) are correct but technical — visitors who aren't familiar with these terms get no meaning from them

---

## 4. What Still Weakens Employer Trust

- **Only 1 NPI in DB**: Production backend shows degraded for all chains except Macie Miller. Every employer demo starts with degraded state unless the demo NPI is used. This is the single biggest trust-weakening factor.
- **Source coverage reads as incomplete by default**: For any new NPI, OIG/PECOS/state lanes show "Not checked" — the impression is "this system is missing most data"
- **Replay chain `degraded: true` in production**: The external API returns `degraded: true` for all chain requests because Railway backend isn't confirmed connected from Vercel

---

## 5. What Still Visually Fragments the Experience

- **Passport page and passport entity page are separate**: User entering NPI at `/passport` sees the streaming experience, but the "full passport" at `/passport/[entityId]` is a completely different layout — no visual continuity between the two
- **Verifier and employer review are different visual systems**: `/verify/[npi]` uses `bg-white` with `border-gray-200`, while employer review uses `bg-card` with the design token system — same product, two different visual grammars
- **Homepage uses VT design tokens, passport page uses Tailwind grays directly**: Creates subtle inconsistency between the entry surface and the result surface

---

## 6. Top Remaining UX/Productization Opportunities

### 1. "You're ready to share" completion moment (high leverage)
After the passport streaming completes (phase === 'done'), show a clear action moment:
- "Your credential readiness snapshot is ready."
- Primary CTA: "Share with an employer" (generates a review link)
- Secondary: "View your full passport"
This converts the technical "done" state into an emotional completion and clear next action.

### 2. Collapse unintegrated source lanes from default view
On LaneHealthMount and source rows, show only integrated/active lanes by default. Collapse "State Board", "Employment History", "Board Certification" into a "3 additional sources — coming soon" note. This shifts first impression from "mostly empty" to "what's available is confirmed."

### 3. "No account required" → trust feature, not disclaimer
Move the "No account required · Nothing stored without your consent" line to a visual trust badge above the submit button — same content, 10× more visible. Make it feel like a product feature, not a privacy footnote.

### 4. Ingesting 3-5 more real NPIs (operator action)
This is the single highest-ROI non-code action. With 3-5 NPIs, the product feels like a live system. Demo path stops being a single-point case. Employer demos are more credible.

### 5. Unified visual system between `/passport` and `/verify/[npi]`
Both pages use different color/border approaches. Aligning them to the same `border-gray-200 bg-white` or the same design token system would make the product feel like one coherent experience.

---

## Productization Score V2

| Dimension | V1 | V2 | Delta |
|---|---|---|---|
| Decision confidence | 7/10 | 7.5/10 | +0.5 |
| Emotional calmness | 8/10 | 8.5/10 | +0.5 |
| Operational trust | 7.5/10 | 7.5/10 | = |
| Institutional readability | 8/10 | 8.5/10 | +0.5 |
| Enterprise composure | 7.5/10 | 8/10 | +0.5 |
| Onboarding momentum | 7/10 | 7.5/10 | +0.5 |
| **Overall** | **7.5/10** | **8/10** | **+0.5** |

**The gap from 8 to 9 requires:**
1. More NPIs ingested (operator action, 20 min)
2. "You're ready to share" completion moment (1 component, ~30 min)
3. Source lane collapse for unintegrated sources (1 component change, ~30 min)
4. Production backend confirmed connected (~10 min operator action)

**None of these require architectural changes. The product surface is now enterprise-adjacent.**
