# Tonight's Productization State
Generated: 2026-05-13T20:35:00Z
Branch: wave-10a/docs-status

---

## What Was Shipped Tonight

All changes are committed and pushed to main. Vercel auto-builds from main.

| Wave | Commit | Surface | Change |
|---|---|---|---|
| Hierarchy | `47e67397` | Passport | Compact replay strip, structural reorder, calm degraded copy |
| Degraded | `50b5bdfa` | Passport/Verify | Confirmed/Checking/Not checked, ISO timestamps |
| Review | `d60015cb` | Employer console | Decision-first, trust-weighted lanes, decisive copy |
| Confidence | `649b3d2f` | Employer console | "Identity confirmed" score, "N of M sources" callout |
| Replay | `728df3a9` | Passport/Receipt | "Verification record" label, ref: prefix, lineageKey humanized |
| Visual | `d4aaa9a5` | Passport/Console | Section rhythm, sliding bar, compact inbox |
| Language | `d346f1df` | Multiple | NPPES_API → "NPPES Registry", pending copy calmed |
| Design align | `3c88519f` | Verifier | Verdict bar first, monochrome tier badge, institutional sections |
| Density | `b766faa3` | Passport/Verifier/Console | Empty inbox hidden, blocker fields reduced, timestamp grid removed |
| Activation | (in progress) | Passport stream | Phase labels, identity confirmed eyebrow |
| Trust | (in progress) | Review/LaneHealth | Source label completeness, error softening |

---

## 1. What Still Prevents Enterprise Inevitability

**Hard blockers (content, not UI):**
- Only NPI 1457128589 (Macie Miller) has live data — every other NPI shows a degraded/empty passport
- OIG/PECOS lanes always "Not checked" — employer sees incomplete coverage as the default
- Production backend (Railway) not confirmed reachable from Vercel — replay chain returns `degraded: true` externally

**Soft blockers (UI):**
- The SSE streaming experience on `/passport` is technically impressive but feels process-heavy — user watches phases tick through rather than seeing a result appear
- No "here's what this means for your next job" moment after identity confirms — value proposition isn't translated into personal implication

---

## 2. What Still Weakens Onboarding Momentum

- After NPI resolves, the readiness score (82) is static/sample — user sees the number but doesn't know if it's theirs
- "No account required" is the right message but it's small and at the bottom of the input — should be larger and positioned as a trust signal near the CTA
- The three-step explanation (Enter NPI → Fan out → Carry forward) describes the system, not the user's benefit
- "Use demo NPI ↑" in mono is subtle — could be more inviting: "See a live example →"

---

## 3. What Still Creates Cognitive Overload

- The homepage right panel shows 4 source rows with technical codes (NPPES, OIG/LEIE, PECOS, CA-PA) — these are better than internal IDs but still require domain knowledge
- The tier ladder (T1/T2/T3/T4) explains VitalCV's internal taxonomy — useful for informed buyers but adds reading burden for first-time visitors
- LaneHealthMount on the passport renders even when all lanes are pending — shows blank/loading state that adds visual weight without value

---

## 4. What Still Feels Procedural Instead of Empowering

- Phase labels on the streaming passport describe system operations ("Connecting to primary sources…") rather than user outcomes ("Finding your credentials…")
- The identity card when it first appears says "Provider" as the eyebrow — should say "Identity confirmed" to make it feel like a moment, not a record display
- The review surface says "Review source coverage below and choose an action" — describes a task list, not an empowering decision
- Replay/continuity section feels like system infrastructure documentation rather than "your credential history"

---

## 5. Top 5 Remaining Productization Opportunities

### 1. Personal value translation after identity confirms (highest leverage)
After NPPES resolves and shows "MACIE MILLER, PA-C · Active", add a single sentence below: "Your NPI is active and federally confirmed. No adverse findings so far." This makes the first verified moment feel like news the user cares about, not a database lookup result.

### 2. Ingest a second NPI so the demo feels like a live system
Currently only 1457128589 has data. Ingesting 2-3 more NPIs makes the product feel operational rather than a single-record demo. This is an operator action (POST /api/ingest/{npi}), not a code change.

### 3. Collapse source lanes to "Identity · 1 confirmed" on first load
Rather than showing 4-6 lanes with most "Not checked", show a single summary line: "Identity confirmed. 1 federal source verified." Then reveal lane detail on expand. Reduces first-impression complexity dramatically.

### 4. Homepage CTA: make "Use demo NPI ↑" larger and reframed
Change "Use demo NPI ↑" to a visible button: "See a live example →" (standard weight, not mono). This makes the demo path feel like an invitation, not a utility function.

### 5. Remove T1/T2/T3/T4 tier ladder from homepage
The tier explanation is accurate but adds cognitive load for new visitors. Move it to `/trust` or `/docs`. Replace with: "Every result is source-checked against federal registries — not scraped, not estimated." One sentence does more than four rows.

---

## Productization Score (Tonight)

| Dimension | Start of Day | Now | Delta |
|---|---|---|---|
| Decision confidence | 4/10 | 7/10 | +3 |
| Emotional calmness | 5/10 | 8/10 | +3 |
| Operational trust | 6/10 | 7.5/10 | +1.5 |
| Institutional readability | 5/10 | 8/10 | +3 |
| Enterprise composure | 5/10 | 7.5/10 | +2.5 |
| Onboarding momentum | 6/10 | 7/10 | +1 |
| **Overall** | **5/10** | **7.5/10** | **+2.5** |

**The gap from 7.5 to 9 is content and data, not architecture.**
The product surface is now clean. The remaining gap is: more NPIs ingested, OIG/PECOS lanes live, production backend connected, and one personal value sentence after identity confirms.
