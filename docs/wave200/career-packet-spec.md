# W200-2 — Career Packet Specification

**Wave:** 200 (Revenue Wedge Extraction)
**Deliverable:** the *Verified Clinician Career Packet* — structure, rendering, and data contract.
**Depends on:** [W200-1 gap analysis](./passport-gap-analysis.md).
**Gates:** W200-3 (UI at `/packet/[entityId]`), W200-4 (PDF).
**Date:** 2026-06-20.

---

## 0. Design principle

**One packet, two renderers, one derivation module.** The screen (`/packet/[entityId]`) and the PDF consume the *same* pure derivation functions over `PassportData`. They can never disagree, and every honest-gating rule lives in exactly one place. This mirrors the existing issuer-verification discipline (`receiptCandidate.ts` / `policyReview.ts` are pure transforms with no fetches/writes).

```
PassportData ──> buildCareerPacket(passport, opts) ──> CareerPacketModel
                                                          ├─> <PacketView/>      (W200-3)
                                                          └─> renderPacketPdf()  (W200-4)
```

The packet is a **snapshot of an already-computed passport**, not a new computation. It performs zero source checks and zero writes. It is read-only and honest about coverage state.

---

## 1. Packet structure (sections)

Ten sections, each a pure function of `PassportData`. Roadmap order preserved.

| # | Section | Purpose (recruiter answers it in <30s) | Primary source fields |
|---|---|---|---|
| 1 | **Executive Summary** | "Who is this, are they ready, what's the one blocker?" | `identity`, `readiness.status/score`, `trustPosture.band`, top blocker |
| 2 | **Identity Summary** | Confirmed identity against federal source | `identity.{displayName,specialty,entityType,status,npi}`, NPPES `sourceCoverage` check |
| 3 | **Credential Readiness** | Readiness verdict + score + time-to-start | `readiness.{status,score,level,estimatedStartDays}`, `authority.summary` |
| 4 | **Verification Sources** | Which sources were checked, when, freshness | `sourceCoverage.checks[]` (state, checkedAt, expiresAt, reason) |
| 5 | **Evidence Summary** | Credentials + training the candidate carries | `authority.credentials[]`, `training.records[]` |
| 6 | **Recruiter View** | Ready / Needs Review / Blocked / Missing-Evidence rollup | derived (see §4.2) |
| 7 | **Employer View** | "Start Ready?" + blocking reasons + what to request | `readiness`, `trustPosture.blockers`, `standing` |
| 8 | **Trust Signals** | Trust band + four truth dimensions | `trustPosture`, `truth` (identity/safety/authority/eligibility) |
| 9 | **Missing Evidence** | Honest gaps: gated / stale / accessRequired / not-decision-grade | `sourceCoverage.summary`, `readiness.gaps[]` |
| 10 | **Recommendations** | Clinician-actionable next steps | `readiness.nextActions[]`, derived from gaps |

**Footer (both renderers):** `lineageKey` (replay attribution), `lastCheckedAt`, packet SHA-256 hash (PDF only, reuse existing `stableValue` hashing), `_degraded` honesty banner when set.

---

## 2. Data requirements

### 2.1 Input

Single input: a hydrated `PassportData` (`apps/web/lib/trust/passport-contract.ts`), fetched server-side via `GET /api/passport/entity/[id]` (or `…/npi/[npi]`). No client fetch, no wallet dependency, no auth redesign (W200-3 constraint).

### 2.2 Required vs. optional fields

| Field | Required? | If missing |
|---|---|---|
| `entityId` | required | 404 — cannot render a packet without an entity |
| `identity.displayName`, `npi` | required | render with "Identity unavailable" honest state |
| `readiness.status`, `readiness.score` | required | treat as `CHECKING`, score withheld |
| `sourceCoverage.checks[]` | required (may be empty) | empty → all sources render `pending`/`unknown` |
| `trustPosture` | optional | omit Trust Signals section; do not fabricate a band |
| `truth` | optional | omit the four-dimension grid |
| `authority.credentials[]`, `training.records[]` | optional | Evidence Summary shows "No source-backed evidence on file yet" |
| `_degraded` | optional | when `true`, render banner: *"Partial snapshot — some sources were unavailable at check time."* |

### 2.3 Degraded / partial behavior

- `_degraded === true` → packet renders, top banner declares partial coverage, **export gate may block PDF** (that is correct — see §5).
- `readiness.status !== 'DECISION_GRADE'` → packet renders the partial state honestly; **never upgraded** to decision-grade (Trust Graph Rule 5).

---

## 3. Rendering requirements

### 3.1 Shared (UI + PDF)

- Section order is fixed (§1). Sections with no data **collapse to an honest empty state**, never disappear silently (a missing Trust Signals block that just vanishes reads as "hidden bad news").
- Status vocabulary is rendered verbatim from the coverage model — `checked / stale / pending / gated / unavailable / accessRequired / reviewRequired / notDecisionGrade / previewOnly`. No relabeling to friendlier-but-false words.
- **No bare `Verified`** anywhere (passes `banned-verified-label.test.ts`). Use compound, honest labels: "Checked against NPPES", "Source coverage: checked", etc.
- All new copy passes `pnpm check:claims` (no `automatically verified`, `guaranteed verification`, `legally accepted`, `HIPAA compliant`, etc.).
- Monospace for NPI / IDs / hashes; `tabular-nums` for scores; relative + absolute timestamps ("checked 3 days ago · 2026-06-17").

### 3.2 Screen (`/packet/[entityId]`, W200-3)

- Read-only. No mutations, no wallet, no auth redesign.
- Reuse: `PassportTrustPosture` (§8), `CredentialReadinessCard` (§3), `TrustStatusBadge` (per-source chips, §4), `CandidateResultCard`/`TrustStatePanel` patterns (§6/§7), `CRSRing` (score), `Card`/`GlassCard` layout.
- Recruiter-readable + employer-readable + shareable (export button → PDF; share affordance reuses `chk_*` token mechanism, full wiring deferred to W210-4).
- Responsive; print-stylesheet friendly as a fallback.

### 3.3 PDF (W200-4)

- Extend `EmployerProofPacketPdfModel` (`apps/web/lib/export/employer-proof-packet-pdf.tsx`) to the ten sections via the **same** derivation module.
- Keep the existing SHA-256 `stableValue` hash + deterministic serialization.
- Add an entityId→export path (`/api/export/packet` currently `?npi=` only; resolve entityId→npi server-side or add `?entityId=`).
- Honor the existing `resolveEmployerPacketExportGate` — blocked export returns 409 + `replayAttribution`, never a half-true PDF.

---

## 4. Derivation module API (single source of truth)

New module: `apps/web/lib/packet/career-packet.ts` — **pure transforms, no fetches, no writes** (same discipline as `lib/issuer-verification/*`).

```ts
// All functions are pure: (PassportData [, opts]) => value. No I/O.

export interface CareerPacketModel {
  entityId: string;
  generatedFor: { displayName: string; npi: string | null; specialty: string | null };
  executive: ExecutiveSummary;
  identity: IdentitySummaryView;
  readiness: ReadinessView;
  sources: VerificationSourceRow[];
  evidence: EvidenceSummaryView;
  recruiter: RecruiterRollup;
  employer: EmployerView;
  trustSignals: TrustSignalsView | null;   // null when trustPosture absent
  missingEvidence: MissingEvidenceItem[];
  recommendations: Recommendation[];
  footer: { lineageKey: string | null; lastCheckedAt: string | null; degraded: boolean };
}

export function buildCareerPacket(
  passport: PassportData,
  opts?: { audience?: 'recruiter' | 'employer' | 'clinician' }, // changes emphasis only, never truth
): CareerPacketModel;

// --- the four NET-NEW derivations (everything else is field projection) ---

// G2: 3-line "who / ready? / one blocker"
export function deriveExecutiveSummary(p: PassportData): ExecutiveSummary;

// G3: ready | needs_review | blocked | missing_evidence  (+ short reason)
export type RecruiterStatus = 'ready' | 'needs_review' | 'blocked' | 'missing_evidence';
export function deriveRecruiterRollup(p: PassportData): RecruiterRollup; // { status: RecruiterStatus; headline; reasons[] }

// G5: honest gaps from sourceCoverage.summary buckets, in human copy
export function deriveMissingEvidence(p: PassportData): MissingEvidenceItem[];

// G4: clinician-actionable, ordered by readiness.nextActions priority
export function deriveRecommendations(p: PassportData): Recommendation[];
```

### 4.1 `deriveExecutiveSummary` rules

- Line 1: `{displayName}, {specialty}` — identity, honestly stated (or "Identity unavailable").
- Line 2: maps `readiness.status` → plain verdict: `DECISION_GRADE`→"Source-backed and review-ready", `PARTIAL`→"Partially checked — review recommended", `CHECKING`→"Checks in progress", `BLOCKED`→"Blocked — see blockers".
- Line 3: the single highest-priority item from `readiness.blockers[0] ?? readiness.gaps[0] ?? nextActions[0]`, or "No blockers on file."

### 4.2 `deriveRecruiterRollup` rules (the W210-2 primitive)

Deterministic precedence (first match wins):
1. any `readiness.blockers[]` **or** `trustPosture.blockers[]` non-empty → **`blocked`**
2. `readiness.status === 'CHECKING'` **or** any `sourceCoverage` check in `reviewRequired` → **`needs_review`**
3. `sourceCoverage.summary` has `gated`/`accessRequired`/`notDecisionGrade`/missing entries → **`missing_evidence`**
4. `readiness.status === 'DECISION_GRADE'` and no blockers → **`ready`**
5. else → **`needs_review`** (never default to `ready`)

This is the same status surfaced on the W210-2 Recruiter Summary Card — define it here once and reuse.

### 4.3 Honesty invariants (enforced inside the module, tested)

- `deriveRecruiterRollup` may return `ready` **only** when `readiness.status === 'DECISION_GRADE'` and zero blockers. Unit-tested against a partial fixture to prove it never green-lights partial coverage.
- No derivation upgrades a source state. `stale` stays `stale`; `gated` stays `gated`.
- No derivation invents a `trustPosture.band` when `trustPosture` is absent.

---

## 5. Export gating (carried from existing system)

The PDF path **reuses** `resolveEmployerPacketExportGate(passport)` unchanged:

- `DECISION_GRADE` readiness + clean sources → `allowed` → PDF with `X-VitalCV-Export-Gate: allowed`.
- partial / blockers / stale / gated → `blocked` → 409 + `replayAttribution` (lineageKey).

**The screen renders even when the PDF is gated** — a recruiter can read a partial packet on `/packet/[entityId]`, but the downloadable PDF is withheld until decision-grade. The export button reflects gate state ("PDF available" vs. "Resolve blockers to export"). This keeps the partial-stays-partial boundary intact while still showing value.

---

## 6. Test plan (for W200-3/4)

| Test | Asserts |
|---|---|
| `career-packet-derive.test.ts` | recruiter rollup never returns `ready` for a `PARTIAL` fixture; exec summary surfaces the top blocker; missing-evidence buckets map from `summary` |
| `career-packet-honesty.test.ts` | no bare `Verified`; rendered output passes the banned-string set; degraded banner present when `_degraded` |
| `packet-route.test.ts` | `/packet/[entityId]` renders all ten sections from a fixture; collapses empty sections to honest empty states; 404 on missing entity |
| `packet-pdf.test.ts` | PDF model has all ten sections; export gate blocks a partial fixture (409); SHA-256 hash deterministic |
| `pnpm check:claims` | green on the new route + components |

Render server components via `renderToStaticMarkup` (existing pattern, `issuer-receipt-candidate.test.ts`). Vitest 4.x.

---

## 7. Done-criteria check (W200-2)

- [x] Full packet structure defined — §1 (ten sections + footer).
- [x] Rendering requirements documented — §3 (shared / screen / PDF).
- [x] Data requirements documented — §2 (input, required/optional, degraded behavior) + §4 (derivation API).

---

## 8. Handoff to W200-3

Builder starts with: create `apps/web/lib/packet/career-packet.ts` (pure module + the four derivations + unit tests), **then** the `/packet/[entityId]` route composing existing components. PDF (W200-4) extends the model afterward through the same module. The wave is **assembly + honest framing**, not new infrastructure — no source checks, no writes, no new auth.
