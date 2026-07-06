# Institutional Productization Audit
Generated: 2026-05-13T20:30:00Z
Evaluated against: enterprise credentialing product standard

---

## Evaluation Frame

VitalCV is evaluated as an institutional product used by:
- **Clinicians** checking their own readiness
- **Recruiters/Employers** making credential-based hiring decisions
- **Credentialing reviewers** at healthcare staffing firms

Not evaluated as infrastructure. Not evaluated as engineering sophistication.

---

## 1. What Still Feels Prototype-Like

### Medium priority

| Surface | Issue |
|---|---|
| `PassportEntityClient` loading state | Delegates entirely to `<PassportWallet loading />` — no loading skeleton for surrounding sections |
| Knowledge Inbox section | Still has 3-sentence technical explanation; content is genuine but density is high |
| `verify/[npi]/page.tsx` | Layout sequence works but has no visual "entry point" — reviewer lands on a full-page information dump without a clear starting anchor |
| Trust register `/.well-known/trust-register` | Returns `prisma_upsert_dedupe` mechanism label — fine for machines, but if ever rendered in UI, would feel infrastructure-y |

### Low priority

| Surface | Issue |
|---|---|
| `ReplayChronologyPanel` | Still shows raw receipt IDs as primary navigation element |
| `/ops` pages | Clearly internal — acceptable in pilot context |

---

## 2. What Still Feels Engineering-Centric

### Remaining after this wave

| Location | Pattern | Status |
|---|---|---|
| `trust/doctrine/page.tsx` | `algorithm="djb2-hash(npi:checkedAt) → hex → first 8 chars"` | Intentionally technical — doctrine page is for technical reviewers |
| `/api/status` response | `algorithm: 'djb2-hash(...)'` | Machine API — acceptable |
| `ReplaySurvivabilityPanel` | `mechanism: 'Prisma upsert dedupe'` | Technical panel, /ops surface — acceptable |
| Replay chronology | `run_id` terminology exposed | Partially mitigated with "ref:" prefix; still requires context |

### Fully resolved this wave

- `runtimeStatusLabel`: "Unavailable" → "Not checked", "Cannot verify" → "Not available"
- `nextAction` copy: decisive, non-engineering language
- ConsoleWrapper loading: "Loading decision console…" → "Reviewing source data…"
- Error states: red anxiety removed → muted/neutral
- Degraded banner: "Partial source coverage" → "Source data loading"
- `lineageKey` raw → human label (Identity / Exclusion check / Medicare enrollment)

---

## 3. What Still Prevents Enterprise Trust

### Hard blockers (structural)

| Issue | Impact |
|---|---|
| Only 1 NPI ingested (Macie Miller) | Employer sees identical data every time — doesn't feel like a live system |
| OIG/state/PECOS lanes show "Not checked" | Employer review surface always shows incomplete coverage — feels like beta product |
| No credential issuance (SD-JWT) wired to passport | Trust tier stays at T3; "Decision Grade" never actually reached |
| Production backend (Railway) not confirmed reachable | Replay chain / by-npi routes return `degraded: true` in production |

### Soft blockers (UI/UX)

| Issue | Impact |
|---|---|
| Verifier page `/verify/[npi]` has no scannable summary at top | 30-second audit pass goal not achieved — reviewer must scroll to find verdict |
| Employer decision "score" shows as null when lanes are empty | Employer sees no confidence signal — needs a minimum "Identity verified" state |

---

## 4. What Still Creates Cognitive Overload

| Surface | Overload Source |
|---|---|
| `EmployerDecisionConsole` blockers section | Each blocker has 4 sub-fields (reason, requiredAction, estimatedDaysImpact, displayName) — information density is high for a decision moment |
| Source health panel | Shows all lanes including unintegrated ones — reviewer sees "Not checked" for most lanes, which dilutes confidence |
| Passport wallet metadata | `entityId`, `npiType`, `canonicalId` still visible in some views — these are DB concepts, not clinician concepts |
| Knowledge inbox | Present but always empty in production — creates a blank section with explanation copy |

---

## 5. What Still Weakens Employer Confidence

| Issue | Confidence Impact |
|---|---|
| `continuityState: "stable"` shown only when 2+ runs exist | First-time NPI lookup shows no chain — employer cannot tell if this is a live system |
| `proofTier: "none"` → "NEEDS MORE DATA" | Default state for all new NPIs — employer's first impression is "insufficient data" |
| Source lanes all "Not checked" except NPPES | Employer sees 1 of 6 sources verified — reads as incomplete, not "primary identity confirmed" |
| No start-date prediction or time-to-ready estimate | Employer cannot assess operational impact of pending sources |

---

## 6. Highest-Leverage UX Simplifications Remaining

Ranked by employer confidence impact:

### 1. Verdict-first layout on verifier surface
**File:** `apps/web/app/verify/[npi]/page.tsx`
**Change:** Move the ProvenanceStrip's highest-confidence lane (NPPES) to a hero verdict block at the top of the page. "Identity confirmed: Macie Miller · NPI 1457128589 · Active" in a large, clear statement before any lane detail.
**Impact:** Employer has answer in 3 seconds, not 30.

### 2. Source coverage reframing: verified-first, pending-quiet
**File:** `EmployerDecisionConsole.tsx` lane list
**Change:** Show verified lanes first with a green check. Show pending/unintegrated lanes collapsed into "3 sources pending" (not listed individually). Currently shows all 6 lanes with most in "Not checked" — this dilutes the confidence from the 1–2 that ARE verified.
**Impact:** Employer focus shifts to what IS confirmed, not what isn't.

### 3. Empty Knowledge Inbox → hide until populated
**File:** `PassportEntityClient.tsx`
**Change:** Conditionally render the Knowledge Inbox section only when `inboxItems.length > 0`. Currently renders with empty state copy every time — adds visual weight with no value.
**Impact:** Cleaner passport, less scrolling, fewer unexplained empty sections.

### 4. Minimum confidence signal when only NPPES verified
**File:** `ConsoleWrapper.tsx` score derivation
**Change:** When `posture === 'partial'` and NPPES is the only verified lane, show score as "Identity · 1 of 4 active sources" instead of a numeric percentage (which will always be low). Reframe from completeness to confirmation: "Identity confirmed. Additional sources checking."
**Impact:** Employer reads "confirmed" rather than "20% complete."

### 5. Production backend connectivity
**Ops action (not UI)**
**Change:** Confirm Railway backend URL is reachable from Vercel production. `/api/replay/chain/1457128589` currently returns `degraded: true` in production because the backend proxy fails.
**Impact:** Replay and chain endpoints become externally verifiable — currently only local.

---

## Summary Scorecard

| Dimension | Score | Notes |
|---|---|---|
| Decision confidence | 6/10 | Decision-first layout delivered; source coverage still sparse |
| Emotional calmness | 8/10 | Degraded states, loading, errors all calmed this wave |
| Operational trust | 7/10 | Replay chain live; production backend connectivity gap |
| Institutional readability | 7/10 | Language purification in progress; lineageKey humanized |
| Enterprise composure | 7/10 | Visual rhythm improved; Knowledge Inbox empty section still present |
| **Overall** | **7/10** | Enterprise-adjacent. Not yet enterprise-grade. Gap is content, not architecture. |

---

## What Changed This Wave

| Wave | File | Change |
|---|---|---|
| 1 | PassportEntityClient.tsx | Compact replay strip, structural reorder, calm degraded copy |
| 2 | PassportEntityClient, verify/[npi], ConsoleWrapper | State labels, ISO timestamps, calm error states |
| 3 | EmployerDecisionConsole, ConsoleWrapper | Decision-first, trust-weighted lanes, decisive copy |
| 5 | PassportEntityClient, verify/receipt | Replay humanization, lineageKey labels, "ref:" prefix |
| 6+7 | PassportEntityClient, ConsoleWrapper | Section rhythm, sliding loading bar, knowledge inbox tightening |
| 8 | LaneHealthBadge, EmployerCockpit, ingest route | NPPES_API → NPPES Registry, language purification |
