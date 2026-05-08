# W2-PR2C — Truth Alignment Governance (Track D)

**Wave:** Wave 2, PR 2C — adversarial legitimacy governance, Track D · **Date:** 2026-05-08 · **Status:** governance review only; **NO product code, NO runtime modification, NO merge** · **Reviewer posture:** truth-alignment reviewer

This doc compares the wave's instrumentation semantics against (a) the runtime substrate, (b) live vitalcv.com marketing language, and (c) the constitutional doctrine docs in PR #277. It identifies semantic drift, trust inflation, proof inflation, audit inflation, and UI/runtime mismatch — bounded by what is actually inspectable in this conversation.

**Inspection scope (declared):**

- ✅ Runtime worktree at `/tmp/vitalcv-w2pr2b` (cut from `9eb5cdee`).
- ✅ Doctrine docs in PR #277 (`AUTHORIZATION_BASELINE_V1.md`, `MUTATION_GATE_SEQUENCE.md`, `SECURITY_INVARIANTS.md`, etc.).
- ✅ Live vitalcv.com (extracted via WebFetch).
- ❌ Listed artifact bundle (`*.html`, `*.jsx` files) — **NOT actually attached** to this conversation.
- ❌ Parallel implementation diff for W2-PR2C — not visible.

The missing artifacts limit this review's UI-runtime alignment claims. See R0 in `w2-pr2c-legitimacy-risk-register.md`.

---

## 1. Marketing claims surface (vitalcv.com extracted)

The live site states (verbatim, extracted via WebFetch):

| Source | Verbatim claim |
|---|---|
| Hero | "Stop Starting Over. Start Ready." |
| Source-backing | "source-backed credential readiness snapshot from federal sources" |
| Authority | "Authoritative sources, never scraped" |
| Source-checking | "Source-checked against a federal/state registry" |
| Processing | "One NPI in. A defensible packet out." |
| Processing | "We query authoritative registries in parallel" |
| Audit framework | "Audit-ready receipts" |
| Trust | "Every observation is tiered" |
| Cryptographic | "cryptographically-signed snapshot" |
| Compliance | "Conforms to NCQA CR §3, W3C VC 2.0, OpenID4VCI" |
| Compliance | "VC 2.0 compatible" / "OpenID4VCI aligned" |
| Velocity | "Credentialing eats 90–180 days per hire" |
| Portability | "Carry your packet forward" |
| Sharing | "Share a cryptographically-signed snapshot with any employer, CVO, or locum tenens partner" |
| Trust tier | "T4 · Issuer-signed: Cryptographically signed by the issuing authority" |
| Trust tier | "Board-issued VC 2.0 receipt" |
| Footer | "Delegated credential verification infrastructure · NCQA CR §3 · §4.2" |

These are the externally-visible truth claims. The wave's instrumentation must not contradict them — and must not be described in language that, if reflected on the marketing surface, would inflate them.

---

## 2. Banned-string check (CLAUDE.md doctrine)

The CLAUDE.md banned-strings list:

```
automatically verified, guaranteed verification, complete credentialing,
instant credentialing, legally accepted, risk transferred,
final verification without review, source confirmed before response,
certified compliant, HIPAA compliant, SOC2 certified
```

Extracted vitalcv.com surface scanned for these strings: **NONE PRESENT** in the live extraction. ✓

This is good doctrine compliance. The wave must not introduce any of these strings into:
- PR descriptions
- Audit-row labels (`metadata.action` literals, etc.)
- Dashboard copy
- Future marketing surfaces derived from instrumentation

---

## 3. Per-claim alignment matrix

Each marketing claim is paired with its runtime substrate. ✓ = aligned. ⚠ = aspirational / partially true. ✗ = misaligned.

| Marketing claim | Runtime substrate | Status | Risk |
|---|---|---|---|
| "Stop Starting Over. Start Ready." | `confirm-start` writes `StartAttestation` after `accept` | ⚠ (per-actor; not platform-validated start) | Implies platform validates start; runtime attests what actor declares |
| "source-backed credential readiness snapshot from federal sources" | `buildPassport` reads NPPES, OIG, CMS PECOS | ✓ | Sources are real |
| "Authoritative sources, never scraped" | Source adapters in `packages/source-adapters` | ✓ | True for the listed sources |
| "Source-checked against a federal/state registry" | Source-adapter outputs feed CRS / decision graph | ✓ | True |
| "One NPI in. A defensible packet out." | `packet` GET builds an evidence packet | ✓ (subject to "defensible" interpretation) | "Defensible" is qualitative |
| "We query authoritative registries in parallel" | Multiple source adapters fan out | ✓ | True |
| "Audit-ready receipts" | `AuditEvent` table + receipt persistence (TRUST-PERSIST-1 in progress) | ⚠ | Receipts not yet fully persisted end-to-end |
| "Every observation is tiered" | Confidence tiers in source adapters | ✓ | True (per `OIG MatchConfidence` work in W1.2) |
| "cryptographically-signed snapshot" | `manifestHash` (SHA-256) on packet; receipt signing in TRUST-PERSIST-1 | ⚠ | Hash ≠ signature; aspirational on signature |
| "Conforms to NCQA CR §3, W3C VC 2.0, OpenID4VCI" | Receipt issuance per VC 2.0 schema (per memory) | ⚠ | Standards-aligned but compliance is per-feature, not platform-wide |
| "Credentialing eats 90–180 days per hire" | Industry stat | ✓ (industry baseline) | Not a platform claim |
| "Carry your packet forward" | `packet` export + share-token | ✓ | Mechanism exists |
| "Share a cryptographically-signed snapshot..." | `share-packet` writes audit row with `shareTokenHash`; manifest hashed | ⚠ | "Signed" is aspirational; today's token is random + manifest hashed |
| "T4 · Issuer-signed: Cryptographically signed by the issuing authority" | TRUST-PERSIST-1 in progress (per memory `pr_b_crypto_decision.md`) | ⚠ | Issuer-signing primitive exists but not yet end-to-end persisted |
| "Board-issued VC 2.0 receipt" | Receipt schema aligned with VC 2.0; persistence in progress | ⚠ | Same as above |
| "Delegated credential verification infrastructure · NCQA CR §3 · §4.2" | Decision-graph + audit posture aligned with NCQA delegation requirements | ⚠ | Compliance posture is asserted; not third-party-attested |

**Aggregate:** 7 ✓ aligned, 8 ⚠ aspirational/partial, 0 ✗ misaligned.

The aspirational claims are concentrated around "signed," "issuer-signed," and "audit-ready receipts" — all of which depend on TRUST-PERSIST-1 fully landing. **The wave under review (W2-PR2C / W2-PR2B-LV2) does NOT touch any of these claims directly.** Its risk is *adjacency* — instrumentation that shipped under "audit coupling" might be construed as advancing toward "audit-ready receipts" when it is doing something narrower.

---

## 4. The "audit-ready" semantic

Marketing: "Audit-ready receipts."

Runtime: `AuditEvent` table records every mutation today. Receipts (the `Receipt` primitive in `packages/issuer-verification`) are a separate concern.

**Adversarial finding D-1:** "audit-ready receipts" elides two distinct concepts:

- **Audit row** = forensic event written by the platform; tamper-evident given DB integrity.
- **Receipt** = issuer-signed credential artifact (in W3C VC 2.0 sense); a portable, verifiable claim.

These are not the same. The wave's audit-coupling work strengthens the audit-row side; it does NOT advance the receipt-signing side. If the implementation PR's wording or downstream surfaces conflate "audit row" with "receipt," the inflation lands.

**Wave-bounded disclaimer required:** in any commit message or PR description, "audit row" must not be paraphrased as "receipt." The constitutional docs already preserve this distinction; the implementation must continue to.

---

## 5. The "signed" semantic

Marketing: "cryptographically-signed snapshot," "T4 · Issuer-signed," "Board-issued."

Runtime today:
- **Token:** random 128-bit-ish via `buildShareToken`; NOT a signature.
- **Manifest hash:** SHA-256 of canonical manifest; tamper-EVIDENT (not tamper-PROOF) given hash collision resistance; NOT a signature.
- **Receipt signing:** ES256 stack landed (#203, #204); persistence (TRUST-PERSIST-1) in progress.

**Adversarial finding D-2:** "signed" is the most leveraged marketing word in the surface. The wave's audit-coupling work does NOT add signatures. If the wave's PR description uses "signed," "signature," or any cryptographic-attestation framing, the wording is dangerously close to inflating against the marketing claim.

**Wave-bounded forbidden lexicon for this PR's audit-coupling work:**

- "signed audit"
- "signed receipt" (audit-row is not a receipt)
- "cryptographically attributed mutation"
- "non-repudiable mutation" (the EXISTING `START_ATTESTED` audit type uses "non-repudiation" language; that pre-dates the wave and is allowed to remain — but the wave does not extend that language to new types)

**Wave-bounded allowed lexicon:**

- "audit-coupled mutation"
- "transactional audit row"
- "correlationId-stamped audit row"
- "best-effort idempotency-checked mutation"
- "tamper-evident given DB integrity" (with the qualifier explicit)

---

## 6. The "verified" semantic

CLAUDE.md banned strings include "automatically verified," "guaranteed verification," "source confirmed before response."

The wave's domain (employer-review mutations) is downstream of verification. The wave does NOT change verification semantics.

**Adversarial finding D-3:** the wave's audit-coupling on `accept` produces an audit row recording "EMPLOYER_REVIEW_ACCEPTED" — an action that the actor performed. The audit row is NOT a verification claim about the *clinician's credentials*. If a downstream UI renders the audit row count as "X verifications" or similar, the inflation is severe.

**Wave-bounded contract:** audit rows record actor actions. They are not verification artifacts. This must be explicit in:
- The implementation PR's description.
- Any dashboard or admin UI that surfaces audit-row counts.
- Future receipt-issuance code that consumes the audit row.

---

## 7. The "ownership" semantic

Marketing surface does NOT use "tenant" or "organization-scoped" language directly. ✓

The wave's earlier name (Lock v1: "Ownership Authorization") was internally inflated against runtime. Lock v2 reframes to "Mutation Legitimacy Hardening" and explicitly defers ownership.

**Adversarial finding D-4:** if the wave's commit messages, audit-row labels, or downstream surfaces use the word "ownership" — or imply it via phrases like "your organization's resources" — the wave inflates against runtime reality (per-actor scope, not per-org).

The constitutional docs are clean here:
- `OWNERSHIP_INVARIANTS.md` is correctly scoped to Layer 3 (deferred).
- `RESOURCE_OWNERSHIP_DICTIONARY.md` is the future-state dictionary.
- `AUTHORIZATION_BASELINE_V1.md` correctly frames ownership as "planned, not yet load-bearing."

The wave must inherit this discipline.

---

## 8. The "decision-grade" semantic

Doctrine: `vitalcv-knowledge-trust-graph` uses "decision-grade" language. Marketing: "defensible packet."

Runtime: the `passport.decisionPosture.status` field has values `'OK' | 'BLOCKED' | 'REVIEW_REQUIRED'`. The `accept` handler uses `BLOCKED` as a reject gate.

**Adversarial finding D-5:** "decision-grade" is a doctrinal term. The wave's instrumentation does NOT change which observations are decision-grade. If the implementation PR claims "decision-grade audit coupling" or similar, the term is overloaded. Reviewer should ensure the term stays in its doctrinal home (the trust graph + CRS engine), NOT in the audit-coupling description.

---

## 9. UI / runtime mismatch (BOUNDED — UI artifacts not visible)

The prompt names UI files (`data-autopilot*.jsx`, `data-dossier*.jsx`, `data-inbox*.jsx`, `confidence.jsx`, `app.jsx`, `components-shared.jsx`) that I cannot inspect. The following is **what the review WOULD check if the artifacts were attached**, NOT what was checked.

| Surface | What review WOULD verify | Status |
|---|---|---|
| `data-dossier*.jsx` | The dossier surface does NOT label audit rows as "verifications" or "signed receipts"; renders only what runtime guarantees | NOT INSPECTED — artifacts missing |
| `data-autopilot*.jsx` | Autopilot does NOT imply autonomous legitimacy decisions; surfaces only ranking / suggestion / human-in-loop output | NOT INSPECTED — artifacts missing |
| `data-inbox*.jsx` | Inbox semantics (e.g., refresh-pending) do not over-promise immediacy or completeness of underlying audit state | NOT INSPECTED — artifacts missing |
| `confidence.jsx` | Confidence tiers map to T1–T4 trust tiers; do not collapse aspirational tiers (T4 issuer-signed) into present-state UI as if achieved | NOT INSPECTED — artifacts missing |
| `app.jsx` | Top-level app does not render copy that contradicts CLAUDE.md banned strings | NOT INSPECTED — artifacts missing |
| `components-shared.jsx` | Shared components (status badges, trust labels) do not promise more than backend delivers | NOT INSPECTED — artifacts missing |

**Adversarial finding D-6:** because the UI artifacts are not attached, this review cannot certify UI-runtime alignment. A SAFE governance determination on Track D is impossible without the artifacts. **The reviewer should request the artifacts before founder approval.**

---

## 10. Autopilot semantic risk

The prompt mentions "autopilot surfaces" as a focus. Without the JSX, the review can only enumerate **what would be unsafe** if the runtime / UI implies it:

| Implication risk | Mitigation required |
|---|---|
| Autopilot makes accept/reject decisions autonomously | UI must label autopilot output as "suggestion" / "ranking"; mutation requires human in the loop |
| Autopilot's confidence overrides decision posture | Autopilot scores must NOT short-circuit `passport.decisionPosture.status === 'BLOCKED'` checks |
| Autopilot trains on audit rows containing untrusted attribution (`organizationContextId`) | Training pipeline must filter or qualify untrusted attribution per Track C C-Rec-9 |
| Autopilot surfaces show "compliant decisions" or similar | Banned-string check must extend to autopilot copy |

These are speculative risks — they cannot be confirmed or denied without the artifacts. Flagged for the reviewer to confirm post-attachment.

---

## 11. Dossier semantic risk

Same posture. Without the JSX:

| Implication risk | Mitigation required |
|---|---|
| Dossier renders audit rows as "verifications complete" | Must label as "events recorded" |
| Dossier's "trust score" averages tier values across observations as if they were comparable | Tiers must be presented as tier names, not numeric averages, unless the trust graph guarantees comparability |
| Dossier "share" button ties to `share-packet` — copy must match the audit row's "this is a share-token issuance" semantics | Must NOT say "verified by VitalCV" or similar |
| Dossier shows expiry on share tokens | Must reflect SHARE_TOKEN_TTL_MS accurately |

Speculative; flagged for reviewer.

---

## 12. Inbox semantic risk

Per `apps/web/.../inbox/...` work + the listed `data-inbox*.jsx`:

| Implication risk | Mitigation required |
|---|---|
| Inbox shows "refresh requested" as if the clinician will act | Must reflect that refresh-request is an outbox event with no enforcement |
| Inbox aggregates refresh requests across orgs (per anonymous `refresh-requests` GET) | Must be transparent that the count is across employers, not org-scoped |
| Inbox communicates "new" vs "seen" semantics tied to audit rows | Must rely on durable persistence (audit retention covers); flag if inbox state is in-memory or session-bound |

Speculative; flagged for reviewer.

---

## 13. Confidence semantic risk

The wave's audit-coupling does NOT touch confidence semantics. But:

| Implication risk | Mitigation required |
|---|---|
| Confidence tiers shown as immutable post-mutation | Tiers can flip on source-state changes (e.g., a license revocation flips T4→T2) |
| Confidence tier presented as "verified" | "Verified" is a banned string; "tiered" / "source-confirmed" is allowed |
| Confidence tier confused with audit-row tier | Audit rows are not tiered |
| Autopilot confidence != observation confidence | Two different concepts; UI must distinguish |

Speculative; flagged.

---

## 14. Drift between PR description and runtime — the meta-concern

The single largest truth-alignment risk is NOT in the runtime substrate; it is in the **PR description and commit messages** the parallel implementation wave will produce. A merge gate that approves a PR with "implements ownership authorization" or "replay-resistant" or "signed audit coupling" wording would land a wave whose code is correct but whose framing is inflated.

**Adversarial finding D-7:** Codex SAFE audit must explicitly verify the PR description, commit messages, and audit-row literal labels for the following inflation patterns:

- "ownership authorization" → must be "mutation legitimacy hardening"
- "replay-resistant" → must be "replay observability + best-effort dedup"
- "tenant isolation" → must be "actor-scoped per-actor mutation hygiene"
- "atomic mutation+audit" applied to share-packet/packet → must be "single-row tx wrap; delivery not atomic"
- "signed receipt" / "signed audit" → not allowed; must be "audit row" or "tamper-evident audit row"
- "verified" applied to actor actions → not allowed; "recorded" / "audited"
- "complete" / "instant" / "guaranteed" / "automatically verified" → all banned per CLAUDE.md

The Codex prompt in Lock v2 §14 covers some of this; reviewer should ensure all 7 patterns are explicitly checked.

---

## 15. Track D recommendations

| # | Recommendation |
|---|---|
| **D-Rec-1** | Founder + reviewer demand the listed artifact bundle (`*.html` + `*.jsx`) before approving this wave; without it, UI-runtime alignment cannot be certified |
| **D-Rec-2** | Codex audit prompt extended to scan PR description / commit messages / audit-row literals for the 7 inflation patterns in §14 |
| **D-Rec-3** | The wave publishes a single "lexicon" doc (proposed: `w2-pr2c-allowed-lexicon.md`) listing allowed and forbidden phrasings; reviewer asserts every PR communication uses allowed lexicon |
| **D-Rec-4** | Banned-string check extended to ALL files touched by the wave (not just product code) — including doc files, audit-row label literals, dashboard copy |
| **D-Rec-5** | Marketing surface (vitalcv.com) lexicon is monitored; if a future marketing change introduces a banned string, flag at launch-blocker tier |
| **D-Rec-6** | "Audit-ready receipts" claim on the marketing surface is **NOT this wave's to deliver** — but the wave should ensure its instrumentation does not appear to deliver it; explicit disclaimer in PR description |

---

## 16. Closing principle (Track D)

Truth alignment is the discipline of refusing to inflate. The runtime substrate is honest where the wave touches it. The marketing surface contains aspirational claims (signed, issuer-issued, audit-ready) that are ahead of the runtime by some margin. The wave's risk is to be described as if it is closing that margin — when it is doing focused, narrower, scope-bounded legitimacy work.

**The wave is safe IF its language stays narrow. The wave is unsafe if its language is read as advancing the marketing claims.** Reviewer enforces the gap. Track D's job is to keep that gap visible at every surface where the wave's output is described.

A SAFE governance determination on Track D is **bounded by inspection of the missing artifact bundle**. Without it, the UI-runtime alignment portion of this review is incomplete.
