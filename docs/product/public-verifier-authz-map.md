# Public Verifier Authorization Map — Epic Wave 2C

**Status:** authoritative map of the public verification path (`/verify/[npi]`) and its
authorization model, produced for Epic Wave 2C (Identity + Public Verifier Repair).
**Risk tier:** Tier 2 — external review (Codex) or explicit Chris override required before merge.

Wave 2C was dispatched against a production finding ("`/api/trust-proof/:npi` returns
`401 organization_context_required` for all NPIs, blocking `/verify/[npi]`"). Mapping
established that **PR #490 (`ddf9c0141`, merged 2026-07-02) already repaired that finding and
the fix is live in production** (verified by direct probes, §2–§3). The remaining Wave 2C work
delivered here: this map, one further private-data leak found during mapping and fixed
(employer review notes served on the anonymous acceptance-history read, §5), and the test
coverage the wave requires (§8).

---

## 1. Current `/verify/[npi]` route behavior

File: `apps/web/app/verify/[npi]/page.tsx`

- Public Next.js **server component** (`force-dynamic`), no auth required, the share target for
  Recognition (Recognition Elevation, PRs #484–#488).
- Fetches two anonymous backend reads (server-side, `Accept: application/json`, 60s revalidate):
  1. `${BACKEND}/api/passport/npi/:npi` — the `PassportData` contract the page renders
     (identity, source-coverage lanes, readiness summary). Chosen by #490; the page previously
     pointed at `/api/trust-proof/:npi`, whose `TrustProofBundle` never matched the page's
     contract (Defect B in the wave dispatch's terms).
  2. `${BACKEND}/api/employer-review/:npi/acceptance-history` — Recognition (employer
     acceptances), NPI-keyed, anonymization-aware org labels.
- Renders: verdict bar, identity hero, source-coverage lanes, **employer acceptances
  (Recognition)**, receipt pane, issuer continuity, replay chronology. Failed fetches render a
  NotFound / system state — never fabricated data.
- **Production verification (2026-07-02):** `https://vitalcv.com/verify/1234567890` renders the
  full verifier view anonymously (verdict "Partial coverage", "2 of 4 sources confirmed",
  source lanes, acceptances section). The wave-dispatch symptom (NotFound for every NPI) is no
  longer reproducible.

## 2. Current `/api/trust-proof/:npi` behavior

- **Backend** (`apps/api/backend/src/routes/trustProof.ts`, Wave 252): 10-digit NPI validation →
  `buildTrustProofBundle(npi)` → JSON or PDF. `proofRateLimit`-guarded. The bundle is
  redacted by design: claims appear only as `claimType` + sha-256 digest (+ optional Merkle
  path); `credentialClaims.redacted: true`; raw payloads are never serialized.
- **Authorization:** public read since #490 added `/api/trust-proof/` to the tenant-guard skip
  list — deliberately, alongside its sibling verifier reads (`/api/trust-state/`,
  `/api/trust-decision/`). The Wave 251 public profile (`/api/public/profile/npi/:npi`) links to
  it as the public proof download, and the command-palette PDF download proxies it.
- **Web proxy** (`apps/web/app/api/trust-proof/[npi]/route.ts`): pass-through, forwards no auth.
- **Production verification (2026-07-02):** `https://api.vitalcv.com/api/trust-proof/1234567890`
  returns `200` with the redacted bundle, anonymously.

## 3. The authz gate that caused the original 401 (repaired by #490)

- `apps/api/backend/src/app.ts` mounts `app.use(requireTenantContextOrReadAccess)` (W1300
  tenant guard) ahead of route registration. Any path not matched by
  `shouldSkipTenantContext()`'s explicit public prefix list falls through to
  `requireTenantContext`, which resolves org context from the `x-org-id` header or JWT
  org/tenant claims (`middleware/organizationContext.ts`) and answers
  `401 { error: 'organization_context_required' }` when absent.
- Wave 252 registered `/api/trust-proof/:npi` without adding it to the skip list, so anonymous
  verifier traffic 401'd. **Root cause was a skip-list omission, not an access decision.**
  PR #490 added the missing entry (`tenantGuard.ts`) with regression tests pinning both the
  skip-list entry and the anonymous pass-through.

## 4. Data safe for public verification (what the path serves today)

Only fields that are public record, deliberately-public product surface, or non-reversible
commitments:

| Field | Basis |
| --- | --- |
| NPI | Public identifier (NPPES). |
| Clinician display name, specialty, provider type | NPPES public registry data. |
| Recognition summary: accepted-organization count, org labels (real name only for named non-pilot scopes; otherwise "Pilot organization N"), `acceptedAt`, acceptance scope, canonical acceptance copy | Anonymization applied in `loadEmployerAcceptanceHistory` / `buildAcceptanceHistoryOrgLabel`. |
| Readiness summary: band, status label, score, blockers/gaps as generic phrases, `computedAt` | Same summary Wave 251 serves on the public profile. |
| Per-source coverage: source label, canonical state (checked / stale / pending / gated / unavailable / review_required), `checkedAt`, source URL | Source-coverage honesty; revoked/suspended stays visible (fails closed, never hidden). |
| Restricted credential entries | Label + issuer replaced by `"Restricted credential"` / `"Restricted"` at build time (`routes/passport.ts` `inferName`/`inferIssuer`) — redaction is unconditional, not viewer-dependent. |
| Verification timestamps (`lastCheckedAt`, snapshot `verifiedAt`) | Freshness honesty. |
| Proof commitments: bundle hash, artifact hashes, claim digests, Merkle roots/paths, snapshot checksum | Non-reversible commitments (see §5 caveat on digest salting). |

## 5. Data that must remain private — and the leak this wave fixed

Must never appear on anonymous surfaces: raw artifact payloads / uploaded documents, employer
review notes, private organization context, sanctions match detail (wallet-mode only), scoring
internals beyond the readiness summary, user PII beyond public professional identity.

**Leak found during mapping (fixed in this wave):** employer free-text review notes reached the
fully public acceptance-history read — rendered on `/verify/[npi]` ("Employer acceptances"
section) and `/holder/recognition` — through two paths in
`apps/api/backend/src/services/entity/employerReviewActions.ts`:

1. **Write path:** `recordEmployerReviewAcceptance` stored
   `acceptanceReason: input.acceptanceReason ?? context.notes ?? <canonical copy>` — when the
   employer gave no explicit reason but typed private notes (sanitized 500 chars), the notes
   were persisted into the acceptance record's public-facing reason field.
2. **Read path:** `loadEmployerAcceptanceHistory` served
   `acceptanceReason ?? metadata.context.notes ?? null` — falling back to private notes even
   for records that never copied them.

**Fix (this wave):** the write path now falls back only to the canonical copy
(`DEFAULT_ACCEPTANCE_REASON`); the read path never touches `context.notes` and additionally
suppresses legacy records whose stored reason equals the private note (serving the canonical
copy instead — fails closed). Notes remain stored in `context.notes` for the org-scoped
review-state reads, which require employer attribution. Regression tests cover both paths and
the anonymous route (§8).

Residual exposures documented as **follow-ups, deliberately not expanded or changed here**:

- `hashClaim` (`utils/claimHash.ts`) is **unsalted** `sha256("type:value")`. Public claim
  digests (trust-proof bundle `claims[]`, public-profile `claimHashes[]`) are therefore
  dictionary-attackable for low-entropy values (statuses, dates, license/DEA numbers). #490
  accepted the redacted bundle as-is; salting the digests is the right follow-up before any
  further widening of digest exposure.
- `acceptedByOrgId` (opaque org id) and `acceptanceId` (internal record id) remain in the
  acceptance-history payload — consumed by holder Recognition evidence surfaces
  (`lib/recognition/acceptance-evidence.ts`); removing them requires a split public/holder
  payload. Org display exposure is already governed by the anonymization rule.
- The backend trusts identity headers (`x-clerk-user-id`, `x-org-id`) set by the web tier;
  `api.vitalcv.com` is directly reachable, so header-attributed (non-anonymous) reads such as
  `/api/employer-review/:id/status` and `/packet` rely on that platform-wide W1300-era model.
  Unchanged here; belongs to a dedicated authn hardening wave.
- `/api/passport/npi/:npi` and `/api/employer-review/:id/acceptance-history` carry **no rate
  limit** (unlike `proofRateLimit` on trust-proof, `publicApiRateLimit` on the public profile).
  Deliberately not added in this wave: the current limiter keys on the caller and these reads
  are fetched server-side by the Next.js web tier, so every visitor shares the web egress
  identity — a naive limit would throttle the whole public verifier surface. Needs
  client-IP-forwarding keying first.

## 6. Existing proof / packet / passport / share surfaces

| Surface | Access today |
| --- | --- |
| `/verify/[npi]` page | Public; the Recognition share target. |
| `/api/passport/npi/:npi` (passportEntity.ts) | Public ("value before login"), unconditional restricted-label redaction. |
| `/api/passport/:npi` (+ `/trust`, `/disclose`, `/embed.svg`, `/card.json`) | Public **mode** by default (redacted); wallet mode gated by token; permissive `authMiddleware` tags but never blocks. |
| `/api/trust-proof/:npi` (Wave 252) | Public since #490; redacted bundle; `proofRateLimit`. |
| `/api/public/profile/npi/:npi` (Wave 251) | Public, `publicApiRateLimit`, redacted profile; links to trust-proof downloads. |
| `/api/artifact/bundle/:npi` | Public by skip-list prefix (audit bundle). |
| `/api/employer-review/:id/acceptance-history` | Public read, NPI- or entity-keyed, anonymization-aware; **notes leak fixed in this wave**. |
| `/api/employer-review/:id/status`, `/packet` | Header-attributed employer reads (see §5 header-trust caveat). |
| `/api/employer-review/share-token/:token` | Capability-token-gated packet share. |
| `/verify/receipt`, `/api/receipts/verify`, `/api/replay/runs/*` | Public receipt/replay verification surfaces. |
| Wallet passport mode, employer packet export, audit-bundle exports with org context | Authenticated / org-scoped; unchanged. |

## 7. Authorization model (minimal, as it stands after this wave)

1. **Public verification tier** — anonymous, read-only, allowlist-shaped surfaces enumerated in
   §6: the `/verify/[npi]` page and the reads it composes. Public paths are governed by exactly
   one mechanism: the tenant-guard skip list (`shouldSkipTenantContext`), pinned by tests. No
   header-based bypasses, no viewer-conditional payloads on anonymous routes; redaction and
   anonymization are applied unconditionally at build time.
2. **Holder tier** — authenticated clinician (wallet passport mode, holder surfaces). Unchanged.
3. **Organization tier** — org context (`x-org-id` / JWT claims) required by
   `requireTenantContext` for everything outside the skip list; org-scoped data additionally
   guarded by `enforceOrganizationMatch`. Unchanged — pinned by tests
   (`/api/clinician/activate` still answers 401 `organization_context_required` anonymously).

Invariants preserved: audit-first mutation rule (all changed code paths are reads except the
acceptance write, which already writes its audit event), source-coverage honesty, revoked fails
closed, zero PHI on-chain, no banned strings, no bare "Verified" label.

## 8. Tests delivered with this wave

- `services/entity/__tests__/employerReviewActions.test.ts` —
  write path never copies notes into the stored acceptance reason (notes still persisted for
  org-scoped reads); history read suppresses legacy notes-copies (canonical copy served) and
  serves `null` (not notes) when no reason was stored; serialized history contains no note text.
- `routes/__tests__/employerActions.test.ts` — **anonymous** (no `x-clerk-user-id`, no
  `x-org-id`) NPI-keyed acceptance-history request returns 200 with the canonical copy and the
  serialized response contains no note/role/facility text; pre-existing tests pin the unknown-NPI
  404 (no data reflection) and the NPI-format guard against UUID lookups.
- `middleware/__tests__/tenantGuard.test.ts` — skip-list pins for
  `/api/passport/npi/:npi` and `/api/employer-review/:npi/acceptance-history` (new), for
  `/api/trust-proof/:npi` (#490), and the anonymous-401 pin for protected routes (existing).
- Production probes (2026-07-02, recorded in §1–§2) confirm the deployed path end-to-end.

## 9. Rollback plan

- This wave's change is a **single additive commit**: one service-file fix (three edits), test
  additions, and this document. No schema changes, no migrations, no config or env changes, no
  route additions/removals, no tenant-guard changes.
- **Rollback:** `git revert` of the wave commit restores the previous read/write fallback
  behavior exactly. Nothing else depends on the new constant or helper.
- The fix only narrows what the public read serves; org-gated surfaces are untouched, so
  rollback cannot widen or narrow organizational access. The tenant-guard pins added here keep
  protecting `/api/trust-proof` and companions independently of rollback.
- If a regression were suspected in production, the acceptance-history read degrades safely:
  `/verify/[npi]` renders its "system state" fallback when the endpoint errors, without
  affecting the rest of the verifier page.
