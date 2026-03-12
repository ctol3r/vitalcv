# DECISION_RULES.md — VitalCV Wave & Implementation Criteria
_Last updated: 2026-03-12._

---

## The Primary Filter

Before implementing anything, answer these questions in order:

### 1. Does this reduce time-to-start?
The primary metric. If a wave does not make it faster for a verified clinician to begin work,
it must pass a higher bar to be justified.

### 2. Does this close an open loop?
Open loops (seeded data, disconnected layers, broken flows) destroy credibility.
A broken core flow is always higher priority than a new feature.

**Current open loops (as of Wave 233):**
- Verifier inbox shows seeded data, not real applications
- MATCHA is disconnected from live opportunities
- Capacity modeling doesn't exist at all

### 3. Does this improve the demo?
The demo at `/demo` is the single highest-leverage surface for YC, investors, and pilots.
Any wave that makes the demo more compelling or trustworthy is high-priority.

### 4. Does this improve clinician adoption?
More clinicians on the platform → denser graph → better MATCHA → more employer value.
Anything that makes it easier for a clinician to activate (NPI → passport) compounds everything.

### 5. Does this improve verifier / buyer value?
Employers pay. Government agencies mandate. These are the revenue drivers.
Waves that give buyers something they can't get anywhere else are high-leverage.

### 6. Does this strengthen the moat?
The moat is: identity graph density + PSV permanence + network effects.
Waves that increase any of these compound over time.

---

## Green Light Criteria (any one is sufficient)

- Closes a broken core flow
- Reduces time-to-start measurably
- Adds a genuinely novel data source or intelligence capability
- Makes the demo significantly more compelling
- Unlocks an enterprise buyer conversation
- Advances the mobile app (high founder priority)
- Advances MATCHA + career intelligence
- Connects PSV to the trust graph (makes graph real, not demo)

---

## Yellow Light Criteria (proceed with caution)

- New UI that doesn't add functional value
- Dashboard or analytics that no one has asked for
- Infrastructure optimization with no user-visible benefit
- Graph features that look impressive but carry no data

---

## Red Light Criteria (stop, do not proceed)

- Feature that adds a step without removing one (violates ANTIGRAVITY contract)
- Cosmetic redesign of already-functional surfaces
- Generic dashboard churn
- Speculative integration with no clear buyer or user value
- Graph work that is visually impressive but operationally empty

---

## Sizing Rule

Before building full scope, ask:
**Is there a smaller version that delivers 80% of the value in 20% of the time?**

Examples:
- Full ABMS integration → start with hard-coded "board certification verified" signal + PSV stub
- Full clinic capacity model → start with a simple "time-to-start trend" chart from existing data
- Full mobile app → start with a PWA + deep-link to passport that installs from the web

---

## The ANTIGRAVITY Contract

From `ANTIGRAVITY.md` (repo root):

> VitalCV must only present itself at moments where progress cannot continue without it.
> Replace steps. Never add steps.
> If removing VitalCV does not break a workflow, VitalCV was misplaced.

**Test for every wave:** If we removed this feature, would the workflow break?
If no — it's in the wrong place.

---

## Technical Quality Gates

Every wave must pass before commit:
1. `pnpm --filter @vitalcv/api build` — zero errors
2. `pnpm --filter web build` — zero errors
3. Core routes tested manually or via `__tests__/`
4. No hardcoded light backgrounds in dark surfaces (design consistency)
5. No `console.log` debug output in production paths
6. Prisma schema changes accompanied by dry-run SQL in `docs/migrations/`
