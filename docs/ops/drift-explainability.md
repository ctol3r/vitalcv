# Drift Explainability — W2-PR12B Track A

**Date:** 2026-05-08
**Reviewer role:** drift-explainability reviewer
**Scope:** Can a runtime operator (not a code author) read the surfaces VitalCV exposes today and correctly identify the *kind* of drift in front of them?

---

## What "drift" means here

Drift is any divergence between two views of the same trust fact:

| Drift class | Two views that may diverge |
|---|---|
| Replay drift | Stored decision capsule vs. recomputed replay |
| Survivability drift | Live runtime state vs. capsule's recorded `trustStateAtDecision` |
| Export drift | Audit bundle artifact vs. live audit row that produced it |
| Dashboard drift | Composite badge color vs. underlying status fields |
| Taxonomy drift | Audit-event taxonomy in code vs. event types actually emitted at runtime |
| Lineage drift | Authority chain in capsule vs. live `SOURCE_LABELS` table at replay time |

For each: *if a real divergence existed today, would an operator looking at VitalCV's surfaces (audit timeline, replay panel, /status, /passport, /employer/dashboard) understand which class of drift they are looking at?*

---

## Verdict scale

- 🟢 EXPLAINABLE — surface names the drift class and its consequence
- 🟡 PARTIAL — surface shows divergence but operator must reason it out
- 🟠 CONFUSING — surface shows fields without naming the drift class; risk of wrong inference
- 🔴 MISLEADING — surface presents drift as cohesion, or hides the divergence entirely

---

## Track A findings

### A.1 Replay drift — 🟡 PARTIAL

**Real surface today:** [`replayEngine.ts`](apps/api/backend/src/services/audit/replayEngine.ts) returns `DecisionReplay` with both `recorded` and `computed` evidence spines plus a `tamperEvidence` list. Test [`replayEngine.runtimeCohesion.test.ts`](apps/api/backend/src/services/audit/__tests__/replayEngine.runtimeCohesion.test.ts:78) confirms recorded fields survive into the envelope.

**What works:** A divergence between `storedHash` and `recomputedHash` produces specific tamper-evidence locations. Hash mismatch is detectable at API level.

**What doesn't:** There is no operator-facing replay panel today. The DecisionReplay envelope wraps everything in `replayMetadata.replayCategory = 'R-CAT-6'` (dossier_replay) regardless of the inner action's true category (R-CAT-1…5) — confirmed at [`runtimeTrustCohesion.test.ts:52`](apps/api/backend/src/services/__tests__/runtimeTrustCohesion.test.ts:52). When a UI surface eventually renders this envelope, the outer R-CAT-6 will mask the inner classification. Operator inference: *"this is a replay" — true. "...of a replay" — false; it could be a replay of an acceptance, refresh, denial, or routing action.*

**Operator overconfidence risk:** medium. No surface today, so no live mis-inference; but the masking is baked into the envelope shape, not into a renderer choice — fixing it later means changing API output, not CSS.

---

### A.2 Survivability drift — 🟠 CONFUSING

**Real surface today:** [`LaneHealthMount`](apps/web/components/source-health/LaneHealthMount.tsx) is rendered on `/passport`, `/passport/[id]`, and `/employer/dashboard`. It shows current per-lane state (LIVE / RATE_LIMITED / UNAVAILABLE / UNKNOWN) plus userFacingMessage. The `DecisionTrustSnapshot` captured by [`employerReviewActions.ts`](apps/api/backend/src/services/entity/employerReviewActions.ts) records `sourceHealth[]` and `readinessAtCheck` at decision time.

**What works:** Both views exist independently — operator can see live source health on the dashboard *and* historical snapshot in the audit row's `decisionTrustSnapshot`.

**What doesn't:** No surface places them side-by-side and labels the divergence as "survivability drift." A clinician's NPPES lane was LIVE when the employer accepted (snapshot frozen) but is UNAVAILABLE today (live LaneHealth). The dashboard shows red; the audit row shows green; nothing says "this acceptance was made when the lane was LIVE — current state is UNAVAILABLE — this is expected, not tampering." Operators can construct that explanation but the surface does not.

**Operator overconfidence risk:** high. An operator who only checks the live dashboard may assume the entity's prior acceptances are now invalid; an operator who only checks audit history may not realise the lane has degraded since.

---

### A.3 Export drift — 🟠 CONFUSING

**Real surface today:** [`buildAuditBundle()`](apps/api/backend/src/services/audit/replayEngine.ts) at `/api/employer-review/:entityId/packet` (format=json|zip) and `share-packet` route emit `AuditBundle` with schema `https://vitalcv.com/audit-bundle/v1`. Audit event `ARTIFACT_EXPORTED` is written before response.

**What works:** The bundle is content-addressed (artifact hash) and the schema URL is in the envelope — a verifier with the schema can detect schema mismatch.

**What doesn't:** Bundles do not carry a "live ledger as of {timestamp}" marker that lets an operator compare a bundle exported on Tuesday against the live ledger on Friday. If the ledger has new audit rows since the bundle was cut, nothing in the bundle says "snapshot was at T0." The ARTIFACT_EXPORTED event records the export, but a downstream auditor reading only the bundle does not see the live ledger's current head; reading only the ledger does not see the bundle's frozen content. This is a structural gap, not a UI gap.

**Operator overconfidence risk:** high. A bundle is presented as authoritative; if the ledger has since corrected an event (e.g., REFRESH_REQUESTED follow-up) the bundle reader will not know unless they re-export.

---

### A.4 Dashboard drift — 🟠 CONFUSING

**Real surface today:** Multiple composite badges — `TrustStatusBadge` (`apps/web/components/ui/trust-status-badge.tsx`), readiness composed badge (per W2-PR7B `operator-model-integrity.md`), `LaneHealthBadge` (per `statusCopy.ts`).

**What works:** `statusCopy.ts` is a single lookup table — copy is deterministic for a given `(sourceId, state)` tuple, so two surfaces reading the same status emit the same string. No copy drift between surfaces.

**What doesn't:** *Composite* badges that mix status and score (per W2-PR7B finding) can show yellow when status is BLOCKED and score is high. The dashboard shows yellow; the underlying field is BLOCKED. An operator who treats yellow as "almost ready" misreads the situation. This is dashboard ↔ runtime drift: the composite render no longer faithfully maps to the canonical field.

**Operator overconfidence risk:** high. Yellow is the most under-specified color in the design system; operators infer "warning, but proceeding" when the canonical state is "blocked, do not proceed."

---

### A.5 Taxonomy drift — 🟡 PARTIAL

**Real surface today:** [`auditEventTypes.ts`](apps/api/backend/src/types/auditEventTypes.ts) is the canonical union (post-W2-PR4A normalization). Test suites pin event-type literals.

**What works:** The canonical union is one file; new event types must be added there. Replay engine refuses to deserialize unknown types.

**What doesn't:** Three structural denial reasons (`already_accepted`, `passport_unavailable`, `acceptance_blocked`) collapse into one event type `EMPLOYER_REVIEW_MUTATION_DENIED` with `refusalReason` in the payload. Group-by-type metrics (the natural first cut an operator runs on the audit timeline) flatten all three into "denials." Operators reading `denials_per_day` cannot distinguish "users tried to double-accept" from "passport was unavailable" from "structural block fired" without joining payload fields. Operator-side, this looks like the audit taxonomy is finer than the displayed taxonomy.

**Operator overconfidence risk:** medium. The data is there; the surface flattens it.

---

### A.6 Lineage drift — 🟡 PARTIAL

**Real surface today:** [`replayEngine.ts`](apps/api/backend/src/services/audit/replayEngine.ts) carries an `authorityChain` (CLINICIAN → CREDENTIAL → ISSUER → VERIFIER → DECISION → ATTESTATION) and a `SOURCE_LABELS` map (NPPES, STATE_BOARD, NURSYS, OIG_LEIE, DEA, ABIM, ABFM, ABEM, ABP, ABNS, ABOG, ABS, BOARD_CERTIFICATION, NPI_ENROLLMENT, ACGME, TRAINING_RECORD).

**What works:** Authority chain is explicit and pinned in the capsule; replays render the same six-link chain across time.

**What doesn't:** `SOURCE_LABELS` is a live constant. If the human-readable label for an authority is renamed in code (e.g., NPPES from "NPI Registry (CMS)" to "NPI Registry") an old capsule's chain renders with the new label. The capsule does not pin the label string used at decision time — only the authority *enum*. Drift between rendered label and historical label is silent.

**Operator overconfidence risk:** low today (labels rarely change), but high if the labels are ever localized or rebranded — the historical record will appear to retroactively change.

---

## Track A summary

| Drift class | Verdict | Risk |
|---|---|---|
| Replay drift | 🟡 PARTIAL | medium — masking baked into envelope |
| Survivability drift | 🟠 CONFUSING | high — no side-by-side surface |
| Export drift | 🟠 CONFUSING | high — no "as-of" marker on bundles |
| Dashboard drift | 🟠 CONFUSING | high — composite badges misalign with canonical fields |
| Taxonomy drift | 🟡 PARTIAL | medium — denial reasons collapse in default views |
| Lineage drift | 🟡 PARTIAL | low → high if labels ever change |

**No 🟢 EXPLAINABLE surfaces exist today.** Three of six drift classes are 🟠. The pattern: VitalCV's underlying *data* is faithful (truth contract holds), but no surface *names the drift class* for an operator. The fix is largely doc + surface labeling, not architecture.

**Single most impactful fix:** add a "snapshot-as-of vs. live" comparator to the replay panel and audit-bundle viewer. That single surface would convert A.1 (Replay), A.2 (Survivability), and A.3 (Export) from 🟡/🟠 to 🟢.
