# Information architecture audit

**Date:** 2026-08-05 · **Wave:** 1077 (PR C) · **Method:** every destination below
was checked for an existing `page.tsx` before it was written down. Nothing here
proposes a label without a route behind it.

Canonical targets come from
[`vitalcv-strategy-operating-brief.md`](./vitalcv-strategy-operating-brief.md) §
"What customers should remember" and the Wave 1077 instruction §8.

---

## 1. Public navigation

**Target:** Clinicians · Employers · Trust · Sign in

**Actual** (`apps/web/components/layout/Navbar.tsx`):

| Position | Label | Destination | Route exists | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Clinicians | `/onboarding`, `/passport` | ✅ | **Keep** |
| 2 | Employers | `/employers` | ✅ | **Keep** |
| 3 | **Evidence** | `/evidence-network`, `/trust/attribution` | ✅ | **Demote** — extra top-level concept |
| 4 | Trust | `/trust`, `/status` | ✅ | **Keep** |
| 5 | Sign In | `/sign-in` | ✅ | **Keep** |
| 6 | **Check Readiness** | `/passport` | ✅ | **Rename + re-point** |

### Finding 1 — "Evidence" is a fifth top-level concept

The strategy says a customer should hold four things: VitalCV, their VitalCV
profile, VitalCV Jobs, Apply with VitalCV. "Evidence" is none of them; it is the
name of the machinery. Its two children are genuinely useful pages, and both
exist, so this is a **demotion, not a deletion**: move `/evidence-network` and
`/trust/attribution` under **Trust**, which is where a visitor already goes to ask
"what does this company actually know."

*Cost:* none — both destinations keep working, and Trust already carries
`/status`, which is the same kind of page.

### Finding 2 — "Check Readiness" is the retired promise, pointing at the retired noun

The primary nav CTA reads **Check Readiness** and points at **`/passport`**. Both
halves are retired vocabulary: "readiness" was the credentialing-first promise,
and "passport" is on the retire list. The homepage now says **Build my free
profile**; the nav says something else, for the same action.

*Recommended:* label **Build my profile**, pointing at `/onboarding` (which is
already the "begin with your NPI" destination). `/passport` stays reachable — see
Finding 3.

### Finding 3 — `/passport` is a live route named after a retired concept

`/passport` exists, renders, and is linked twice. The strategy explicitly says
**do not mass-rename** to satisfy marketing vocabulary, and a public route is a
URL other people may have linked. So:

- **Do** change the visible label ("Your evidence record" → "Your VitalCV profile")
- **Do not** rename the route in this wave
- If the route is ever renamed, it needs a redirect, which is its own change

---

## 2. Clinician application navigation

**Target:** Profile · Jobs · Applications

**Actual** (`apps/web/app/holder/*` — 11 routes):

| Target | Real destination | Exists | Verdict |
| --- | --- | --- | --- |
| Profile | `/holder` | ✅ | Label as **Profile** |
| Jobs | `/holder/matcha` | ✅ | Label as **Jobs** — the route keeps `matcha`; MATCHA stays the engine name |
| Applications | `/holder/applications` | ✅ | Label as **Applications** |

**Eight further routes exist under `/holder`:** `blockers`, `garden`, `home`,
`opportunities`, `readiness`, `recognition`, `scoreboard`, `settings`, `timeline`.

Two observations, offered as findings rather than actions:

- `/holder/opportunities` and `/holder/matcha` are **two destinations for one
  concept**. The strategy says to remove duplicate or competing top-level
  concepts. Which survives is a product decision, not a labelling one.
- `recognition`, `scoreboard`, `garden` and `readiness` are concept names from
  earlier waves. They are real pages with real content; they are also four more
  nouns. They belong in secondary navigation, not the primary three.

`/holder` itself is a retired customer word ("Holder" is on the retire list). Same
treatment as `/passport`: change labels, leave the route.

---

## 3. Employer application navigation

**Target:** Roles · Candidates · Starts

| Target | Real destination | Exists | Verdict |
| --- | --- | --- | --- |
| Roles | `/employers` (marketing) | ✅ | **Gap** — no signed-in employer roles list audited in this wave |
| Candidates | `/employer/dashboard` | ✅ | Candidate review surface exists |
| Starts | — | ❌ | **Gap** — no destination |

**Do not create placeholder routes.** "Starts" is the north-star noun and has no
surface yet; inventing an empty page to satisfy a nav list would be exactly the
failure the instruction warns against. Recorded as a gap below.

---

## 4. Implementation gap list

| # | Gap | Blocks | Size |
| --- | --- | --- | --- |
| 1 | No employer **Starts** surface | The north-star metric has no product home | Real feature |
| 2 | `/holder/opportunities` vs `/holder/matcha` duplication | One concept, two doors | Product decision |
| 3 | Signed-in employer **Roles** management not audited | Employer nav target 1 of 3 | Audit, then decide |
| 4 | `/passport` and `/holder` are routes named after retired words | Cosmetic; needs redirects if changed | Deferred deliberately |
| 5 | Four secondary `/holder` concepts (recognition, scoreboard, garden, readiness) | Vocabulary sprawl inside the app | Product decision |

---

## 5. Decisions applied in this PR (founder-approved 2026-08-05)

| Decision | Applied |
| --- | --- |
| Demote `Evidence` beneath `Trust` | ✅ `Navbar.tsx` — both pages keep working, now under Trust |
| Remove `Check Readiness → /passport` from primary nav | ✅ desktop CTA removed; mobile overlay now `Build my profile → /onboarding` |
| No retired terms in primary navigation | ✅ "Check your readiness" → "Build your profile"; "Your evidence record" → "Your VitalCV profile" |
| Preserve working routes until redirects exist | ✅ `/passport` and `/holder/*` unchanged and still reachable |
| No backend renaming for cosmetics | ✅ nothing renamed |
| No empty labels or placeholder destinations | ✅ none created |
| No top-level `Starts` page | ✅ not created — a metric is not a navigation destination |

## 6. What this audit does not do

It changes no labels. Every recommendation above is a proposal with a verified
destination attached, so the founder can approve them individually. The one thing
it deliberately refuses to do is invent a route to make a navigation diagram look
complete.
