# Trust Integration Coherence Audit

Audit trail for `feat/trust-integration-coherence`. Documents which
trust-canon routes were upgraded with canonical primitives, what was
left intact, and where semantic drift still exists.

## Routes audited

| Route | File | Status |
|---|---|---|
| `/receipt/[receiptId]` | `apps/web/app/receipt/[receiptId]/page.tsx` | **upgraded — canonical lineage strip added at top** |
| `/verify/receipt/[receiptId]` | `apps/web/app/verify/receipt/[receiptId]/page.tsx` | **upgraded — canonical lineage strip + local LineageHeader renamed** |
| `/dossier/[receiptId]` | `apps/web/app/dossier/[receiptId]/page.tsx` | **upgraded — canonical lineage strip added at top** |
| `/passport/[id]` | `apps/web/app/passport/[id]/PassportEntityClient.tsx` | **deliberately not modified — see "remaining gaps"** |
| `/passport` (entry) | `apps/web/app/passport/page.tsx` | **deliberately not modified — see "remaining gaps"** |
| `/verify` (entry) | `apps/web/app/verify/page.tsx` | not a receipt surface; no lineage to render |

## What was changed

### Coherence: canonical reading order is now visible on every receipt-style surface

Three surfaces now render the canonical six-cell `LineageHeader`
primitive (binding reading order
`OBJECT → OWNERSHIP → checked_at → CHANNEL → REPLAY → run_id`) at the
top of the page, sourced from existing route-local data via inline
adapters that call `composeLineage(...)` from
`apps/web/lib/trust/replay-grammar.ts`.

- `/receipt/[receiptId]` — adapter maps `PublicReceiptResponse` → six slots.
  State: `signed` if `signing_key_id` present, else `snapshot`.
- `/verify/receipt/[receiptId]` — adapter maps `ReplayInspection` → six slots.
  State: `signed` if `signingKeyId` present, else `snapshot`.
- `/dossier/[receiptId]` — adapter maps `DossierMeta + counts + chainOk` → six slots.
  State: `snapshot` (dossier is a delegated-ownership view).

The strip is **purely additive**: it sits above existing route chrome
without modifying any existing zone, header, or data flow.

### Resolved name collision

`apps/web/app/verify/receipt/[receiptId]/page.tsx` had a local function
named `LineageHeader` that rendered a route-specific dense replay-
inspection summary header — not the binding six-cell reading-order
strip. The collision was real semantic drift: two different surfaces
used the same name for two different contracts.

Resolution: the route-local function was renamed to
`ReplayInspectionHeader`. The canonical `LineageHeader` primitive is
imported as `CanonicalLineageHeader` and rendered above the legacy
header. The canonical name is now reserved for the binding contract.

## What was deliberately left intact

The wave constraints explicitly forbid:
- No broad refactors
- No new infrastructure
- No "while I'm here" expansion
- No redesign of existing trust-canon routes

These pre-existing surfaces have working, validated visual systems and
were not touched:

1. **`ZoneMasthead` / `ZoneSignature` / `ZoneReplayChain` / `ZoneProvenanceStrip` / `ZoneVerificationInstructions`** in `/receipt/[receiptId]`. Print-style and `vcv-receipt-section` / `vcv-anchor-band` chrome is load-bearing for the offline-verification PDF flow.
2. **`DegradationBar`** in `/verify/receipt/[receiptId]`. Uses a legacy 6-state ownership ontology (`no_adverse_findings | issuer_outage | vitalcv_outage | anonymous_preview | stale_data | unknown`) with red/amber/green coloring that drifts from the canonical five-mode taxonomy and slate-only palette in `apps/web/lib/trust/degradation.ts`. Fixing this requires either (a) widening the canonical taxonomy or (b) rewriting the legacy bar — both out of scope for an integration wave.
3. **`/passport`** routes. The passport flow is a complex client-component hydration with SSE-driven progressive rendering. Adding a canonical lineage strip requires deriving slot values from in-flight ingest state; risk-to-value is too high for an additive wave.
4. **`DossierHeader` / `CountsStrip` / `CustodyLedgerSection` / `ReceiptDetailSection`** in `/dossier`. The dossier is a demo surface with its own palette; replacing palettes mid-wave constitutes redesign.

## Semantic duplication catalogued

| Duplication | Location | Disposition |
|---|---|---|
| `LineageHeader` (function) vs `LineageHeader` (primitive) | `verify/receipt/[receiptId]/page.tsx` | **resolved** — local renamed to `ReplayInspectionHeader` |
| Degradation ontology drift | `verify/receipt/[receiptId]/page.tsx` `DegradationBar` vs `lib/trust/degradation.ts` `FailureMode` | **documented** — collapse deferred (different shape: 6 ownership states vs 5 modes × 3 planes) |
| Tier-rendering: `TrustTierBadge` vs `TierBadge` (primitive) | `/receipt`, `/verify/receipt` use `@/components/proof/TrustTierBadge`; primitive ships `@/components/trust/primitives/TierBadge` | **documented** — collapse deferred until `TrustTierBadge` consumers can be safely retargeted |
| Reading-order rendering | three routes each had their own ad-hoc `Receipt ID + Run ID + Checked + Issuer` grid | **collapsed** — all three now render canonical `LineageHeader` |
| ISO + relative timestamp rendering | several call sites format timestamps inline | **documented** — `CheckedAtStamp` primitive available; consumer wiring deferred |
| Ownership label "Subject"/"Delegated"/"Unbound" | strings repeated across routes | **collapsed via primitive call site** — `OWNERSHIP_LABELS` table is single source |

## Replay grammar integrations

Three surfaces now share the binding tuple via `composeLineage(...)`.
Any future surface that wants to render lineage is expected to do the
same. No surface invents a new ordering; the type system enforces
totality.

## Degradation-system integrations

The canonical `DegradedStatePanel` / `FailureTaxonomyBadge` /
`RevocationStateBanner` primitives ship in `apps/web/components/trust/
primitives/` but are **not yet wired** into the three integrated
routes for this wave. Reason: each existing route already renders
some form of degradation surface; replacing it requires reconciling
the 6-state legacy `DegradationOwnership` ontology with the
canonical 5-mode `FailureMode` taxonomy. That mapping work is a
follow-up integration wave by itself.

## Language-system integrations

`apps/web/lib/trust/institutional-language.ts` ships canonical
phrases. The integrated routes consume `READING_ORDER_LABELS` via
the `LineageHeader` primitive (which imports them internally).
Direct route-level imports of `INSTITUTIONAL_PHRASES` were not
added — touching every "fully verified" / "verified" / "instant"
string is the next coherence wave, not this one.

## Truth-contract audit

All touched files pass the banned-institutional-phrase guard
(`apps/web/__tests__/institutional-trust-primitives.test.tsx` was
extended to cover the three modified route files — see
`apps/web/__tests__/trust-integration-coherence.test.tsx`).

No touched file introduces:
- bare `Verified`
- `automatically verified`, `guaranteed verification`, `complete credentialing`, `instant credentialing`, `legally accepted`, `risk transferred`, `final verification without review`, `source confirmed before response`, `certified compliant`, `HIPAA compliant`, `SOC2 certified`
- new crypto/compliance claims

## Coherence gaps (remaining)

1. `DegradationBar` color palette in `/verify/receipt` — uses red/amber/green; canonical spec says slate-only. Migration requires a wider FailureMode ⇄ DegradationOwnership taxonomy reconciliation.
2. `TrustTierBadge` (`@/components/proof/TrustTierBadge`) vs canonical `TierBadge` primitive — two implementations of the same concept.
3. `/passport` routes do not yet show the canonical lineage strip; passport-side adapters need to map SSE hydration state to lineage slots.
4. `/receipt` keeps two stacked lineage representations (canonical strip + `ZoneMasthead` + `ZoneReplayChain`) — the canonical strip is additive; long-term we may want to collapse the masthead into the strip.
5. `ReplayTimeline` and `TrustReceipt` primitives are not yet wired into `/receipt/[receiptId]` — `ZoneReplayChain` would be the natural call site, but its existing layout is load-bearing for the print PDF.

## Validation

- `pnpm install --frozen-lockfile` → clean
- `pnpm --filter @vitalcv/web exec tsc --noEmit` → 2 pre-existing errors in `components/clinician/intake-types.ts`; 0 errors introduced
- `pnpm --filter @vitalcv/web lint` → clean
- `pnpm --filter @vitalcv/web exec vitest run trust-integration-coherence.test.tsx` → passing
