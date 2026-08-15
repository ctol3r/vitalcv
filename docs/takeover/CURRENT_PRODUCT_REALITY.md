# Current product reality — 2026-08-15

Measured against `origin/main` @ `a8db9734cd60f26162c0f46e776389d8ac95abaf`,
which is exactly what production serves.

This document answers one question: **what can a real person actually complete
today?** Not what renders. Not what has a route. What completes.

---

## The loop the strategy asks for

```
NPI → claim record → account → source-attributed profile → correct it
    → discover roles → Apply with VitalCV → authorize exact sharing
    → employer reviews packet → remaining work explicit → start
    → profile survives → second move begins from existing state
```

## The loop that exists

```
NPI → claim record → account → profile → discover roles → ┃ WALL ┃
                                                          ┃
                          "View original listing" ────────┘
                                    ↓
                       employer's own site, no VitalCV
```

Everything left of the wall is real and, in places, genuinely good. Everything
right of the wall is built, tested, and **unreachable from the front door**.

---

## Segment-by-segment

### 1. NPI → public record — **WORKS**

`/directory/[npi]` returns HTTP 200 with a source-attributed record, and is
findable, claimable, measurable, and refusable (#1358).

**Defect: it takes 8.31 seconds.** Every other public surface answers in
0.12–0.23s. This is the acquisition wedge and the slowest page in the product.

### 2. Account + NPI binding — **WORKS, BUT UNVERIFIED IDENTITY**

Clerk account creation works. `POST /api/profile/npi/bootstrap` upserts the
PersonProfile from the live NPPES record and emits an audit event. The truth
contract is respected in the code's own words — `npi-binding.ts` states an NPPES
match is "an IDENTITY record match only."

**Gap: nothing proves possession.** `validateNpi()` checks that the input is ten
digits. There is no institutional-email challenge, no document check, no human
fallback. Any signed-in user can bind any clinician's NPI.

This is C4.4 in the directive, and it is the hard gate on any pilot involving a
real clinician who is not the founder. Until it exists, the honest framing is
"founder-verified cohort," not "self-serve activation."

### 3. Profile — **PARTIAL**

Source-attributed profile with coverage states exists. Self-attestation exists
(`POST /api/profile/self-attested`).

**Gap: no correction lane.** A clinician cannot contest a *source observation*
about themselves. The `NpiDidBindingStatus.CONTESTED` state exists
(`schema.prisma:312`, `:3854`) but its only writers are machine-side in
`services/identity/npiDidBinding.ts`, raised on source-fingerprint mismatch to
guard NPI↔DID binding integrity. It accepts no attached evidence, has no review
or resolution lineage, and no route exposes it to a clinician.

The public claim that promised this was **correctly removed** (#1372) and is now
held down by a regression test asserting its absence
(`apps/web/__tests__/trust-center.test.tsx:77`). The copy is honest. The
capability is still missing.

### 4. Discovery — **WORKS, AND IS HONEST**

498 live opportunities from 8 real employers, ingested from public feeds. I
sampled the full set through `/api/opportunities?limit=500`. The truth discipline
is genuinely strong:

- `source`: real Greenhouse URLs, real `fetchedAt`/`observedAt` timestamps
- `availability`: `open` with `confidence: "recent_observation"` and an explicit
  `limitation` — *"The source was observed recently; the employer can still change
  or close the role."*
- `compensationProvenance`: `state: "not_supplied"` rather than a guess
- `transparency`: `"Start timing not stated"`, `"Visa policy not stated"`,
  `"Benefits not listed"`
- `freshness`: `completenessScore: 55`, `isUncertain: true`

Nothing is fabricated. No trust score, no invented recent-hire count, no
made-up start date. This directly answers the directive's C7.2 concern, and it
answers it well.

Supply shape:

| Dimension | Reality |
|---|---|
| Total | 498, all `open`, none truncated |
| Employers | 8 — onemedical 130, charliehealth 28, twochairs 17, firsthand 12, valerahealth 4, parsleyhealth 4, galileo 3, midihealth 2 |
| Professions | advanced_practice 66, physician 56, behavioral_health 51, not_stated 19, nursing 8 (of first 200) |
| States | CA 38, WA 27, NY 24, DC 16, TX 11, … |
| Compensation present | **0 / 498** |
| Credential requirements present | **0 / 498** |

**Weakness: 65% of sampled inventory is one employer.**

### 5. Apply with VitalCV — **BLOCKED, ZERO INVENTORY**

```
applicationMode: Counter({'external': 498})
isFeedListing:   Counter({True: 498})
```

Every single live role is an external feed listing. The product correctly says
"View original listing" and correctly withholds "Apply with VitalCV," because
the honest boundary is that VitalCV cannot submit into an employer's ATS it has
no relationship with.

**This is the single most important fact in this report.** The canonical
transaction of the entire strategy has no live instance.

**And the code is not the reason.** All of this already exists on `main`:

- `apps/web/app/api/employer/opportunities/route.ts` — employer role creation
- `apps/web/app/api/opportunities/[id]/apply/route.ts` — the apply path
- `opportunityTruth.ts:1486` — `const requirements = isFeedListing ? [] : buildRequirementList(opportunity)`

That last line is the crux: **requirements are built for any non-feed listing.**
The machinery to produce a role with structured requirements, integrated apply,
and evidence-fit is present and waiting. Zero employers have used it.

This reclassifies the problem. It is not "build the apply flow." It is
**"get one employer to create one role"** — a go-to-market act, after which the
existing stack becomes testable end to end.

### 6. Employer review + acceptance — **BUILT, TWO WRITERS**

Down from four acceptance emitters to two:

| Emitter | Auth | Scope key |
|---|---|---|
| `POST /api/applications/:appId/workflow-action` | `requireOrgRole` + `requireClerkUserId` | application id |
| `POST /api/employer-review/:entityId/accept` | Clerk + `enforceEmployerMutationRbac` + denial audit | entity id |

Retired since the last audit: `POST /api/pilot/acceptance` (VCD-01d, #1353 —
was unauthenticated and fed an org-unfiltered metric) and `POST /api/hiring/accept`
(VCD-01e, #1356 — recorded acceptance with no packet linkage). Both tombstoned
in place with their reasoning, which is the right way to close a route.

**Remaining gap:** two writers keyed on *different identifiers* means picking a
canonical one is not mechanical — it decides which auth posture wins and what
the acceptance record anchors to. This is the C10.4 decision, and PRs #1378/#1384
propose an answer to it (see triage).

**Two further findings from the second pass:**

- **The review console's action button silently does nothing.**
  `apps/web/app/review/[entityId]/ConsoleWrapper.tsx:170` POSTs to
  `/api/employer-action` with a hardcoded `employerId: 'pilot-employer-1'`.
  That route exists nowhere — the backend `employerActionRouter` is exported
  but never mounted (`src/app.ts:51` imports `./routes/employerActions`, a
  different file), and there is no Next handler or rewrite. The response is
  never checked, so the reviewer sees success theater over a 404. Any pilot
  that seats an employer at this console records none of their actions.
- **A third acceptance door exists on a machine lane.** The wedge routes are
  mounted (`src/app.ts:10`): `POST /acceptances` (`routes/wedge.ts:336`) and
  `POST /starts` (`wedge.ts:444`), both behind `apiKeyAuth`, writing the
  parallel `Acceptance` and `Start` models — the tables the 2026-08-11 audit
  (and `docs/product/evidence-network/canonical-transaction-baseline.md:102`,
  now stale) recorded as dead with no writers. Not publicly reachable, but it
  is a live Recognition→Acceptance→Start lane that the one-canonical-writer
  decision must explicitly retire or scope.

### 7. Hire-to-start — **ENTIRELY IN DRAFT**

Models exist in `schema.prisma`: `Application` (1994), `ApplicationPacket` (2029),
`ActivationRequirement` (2088), `EmployerAcceptance` (2115), `StartActivation`
(2147), `StartAttestation` (4290).

The joined case, requirement ledger, start-ready state and confirmed first day
all live in the unmerged stack #1378 → #1380 → #1381 → #1384. Nothing of it is
in production.

### 8. Reuse / second move — **DOES NOT EXIST AS PRODUCT**

No reuse surface, no delta view, no "already reusable / needs refresh /
employer-specific" classification, no instrumentation of fields not re-entered.

The reuse artifacts that *do* exist are in the issuer/verifier PSV lane —
`lib/issuer-verification/psvReceiptReuse.ts`, `app/issuer/psv-reuse/[receiptId]`,
`components/trust/ReuseSignalBadge.tsx` — a different lane from a clinician's
second job application.

`apps/api/backend/__tests__/reuseAcrossEmployers.e2e.test.ts` is named as if it
proves the thesis. Read, it constructs an in-memory `PsvStore`, `AuditLedger` and
`CrsEngine` with a **mocked** `verifyPrimarySource`, and asserts identical CRS
across two employers with no new PSV. It proves the *domain packages* can express
verify-once-reuse-everywhere. It does not touch an application, a packet, an
employer decision, or a second clinician move.

**The feature most aligned with VitalCV's thesis remains unbuilt.**

### 9. Operator — **NOT PRESENT**

No single console for source health, identity collisions, correction review,
mutation tracing, or integration staleness. Supporting a pilot today means SQL.

---

## What is true about the product's honesty

Worth stating plainly, because it is the thing most at risk when a new agent
takes over and starts "improving":

**This product does not lie.** Across every surface I probed — opportunity data,
availability, compensation, freshness, source labels, the Trust Center, the
retired acceptance routes — claims are qualified, provenance is attached, absence
is labelled as absence, and closed routes are tombstoned with their reasoning.
The `/trust` overclaim that stood on 2026-08-11 was found and removed, and a
regression test now prevents its return.

The gap between VitalCV and a useful product is **not a truth gap.** It is a
transaction gap: one employer, one real role, one completed application.
