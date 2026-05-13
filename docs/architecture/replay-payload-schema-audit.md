# Replay Payload Schema Audit

**Branch under audit**: `wave/canonical-route-map` (HEAD `164e7039`).
**Scope**: what each institutional payload-producing surface *actually serves
on the wire today*, against what a generic external verifier client (or a
browser probe) needs to read in order to render full institutional trust
state without side-channel knowledge.

This is **not** a route-existence audit
(`deployed-route-registration-audit.md`) and not a topology audit
(`replay-topology-gap-analysis.md`). It inspects payload field shapes and
canonical-key-path coverage.

Pre-flight finding — `canonical-trust-route-map.md` lists nine canonical
handlers; **most route files are absent on this branch**:

- `/.well-known/jwks.json`, `/.well-known/did.json`,
  `/.well-known/openid-credential-issuer`,
  `/.well-known/openid-configuration`, `/.well-known/trust-register` —
  **none exist** under `apps/web/app/.well-known/` (only
  `apple-app-site-association/` and `assetlinks.json/` are mounted).
- `/api/receipt/[npi]` and `/api/receipt/by-lineage/[lineageKey]` —
  **absent**. The only receipt route present is plural
  `/api/receipts/verify` (a JWT verification endpoint, not an issuance
  endpoint).
- The legacy mirror `/api/.well-known/jwks.json` is the only key-discovery
  surface actually mounted.

Surfaces actually present and producing institutional payloads:

- `app/api/passport/npi/[npi]/route.ts`
- `app/api/passport/entity/[id]/route.ts`
- `app/api/receipts/verify/route.ts` (verifies JWTs minted by
  `lib/crypto/receiptIssuer.ts`)
- `app/api/trust-state/[npi]/route.ts` + `/refresh` + `/history`
- `app/api/trust-proof/[npi]/route.ts`
- `app/api/ingest/[npi]/route.ts` (POST) + `app/api/ingest/stream/[runId]/route.ts` (SSE)
- `app/api/.well-known/jwks.json/route.ts` (legacy path)

The seven audit criteria below are: 1 `checkedAt`, 2 `runId`, 3 `lineageKey`,
4 ownership (issuer DID + kid), 5 T1–T4 tier coverage, 6 receipt continuity
(prior pointers), 7 deterministic chronology.

---

## §1 `GET /api/passport/npi/[npi]`

Handler: `apps/web/app/api/passport/npi/[npi]/route.ts:7-38` — a thin proxy
that re-emits `${BACKEND_URL}/api/passport/npi/${npi}` through
`assertPassportData` (`apps/web/lib/trust/passport-contract.ts:540-549`).
The wire payload is the `PassportData` interface at
`apps/web/lib/trust/passport-contract.ts:91-210`:

```ts
// passport-contract.ts:91-210 (abridged)
export interface PassportData {
  entityId: string;
  npi?:     string;
  identity:  { displayName; specialty?; entityType; status; npi? };
  authority: { credentials: Array<{ verifiedAt?; observedAt?; nextReverifyAt?; … }>;
               summary: { active; expired; stale; missing } };
  training:  { records: Array<{ id; recordType; … }>; … };
  standing:  { exclusionCheckedAt?; licensureStatus; pecosStatus; … };
  readiness: { status; score; level; blockers; gaps; nextActions[] };
  sources:        { checked: string[]; lastFetch: Record<string,string> };
  sourceCoverage: PassportSourceCoverageReport;
  truth?:          CanonicalTruthSet;
  trustPosture:    PassportTrustPosture;     // dimensions[]: id ∈ identity|safety|authority|eligibility
  decisionPosture?: DecisionPosture;
  lastCheckedAt:   string;                    // ← top-level ISO timestamp
  divergence?:     PassportDivergence;
  monitoring?:     PassportMonitoringStatus;
  trustContainer?: TrustContainerManifestView | null;
}
```

Per criterion:

1. **checkedAt** — ✓ `lastCheckedAt` top-level; also per-credential
   `verifiedAt`/`observedAt`/`nextReverifyAt`,
   `standing.exclusionCheckedAt`, and `trustPosture.dimensions[i].checkedAt`
   (`passport-contract.ts:38, 46, 76, 197, 371, 380`).
2. **runId** — ✗ absent. No `runId`, no `replay` block.
3. **lineageKey** — ✗ absent. No `lin_v1_*` anywhere in the contract.
4. **ownership** — ✗ unsigned JSON body. No `iss`, no `kid`. Issuer
   attribution rests on host + TLS only.
5. **T1–T4** — ⚠ the four dimensions on this branch are
   `identity | safety | authority | eligibility`
   (`passport-contract.ts:27-32`), not `T1/T2/T3/T4`. A verifier can map
   them, but the literal `T1`/`T2`/`T3`/`T4` labels do not appear in any
   payload, component, or test on this branch (greps return zero hits).
   Tier states are carried as
   `trustPosture.dimensions[i].state ∈ current|stale|gated|review_required|blocked|missing`.
6. **receipt continuity** — n/a; this is a state snapshot, not a receipt.
   No prior-pointer.
7. **chronology** — ⚠ `lastCheckedAt` anchors the snapshot;
   `credentials[]` and `training.records[]` ordering is **not pinned by
   the contract**, so two consecutive responses may reorder them. Flagged.

## §2 `GET /api/passport/entity/[id]`

Handler: `apps/web/app/api/passport/entity/[id]/route.ts:11-48`. Auto-routes
10-digit ids to the NPI upstream (`route.ts:13-17`). Same `PassportData`
shape; identical verdict on all 7 criteria.

---

## §3 `POST /api/receipts/verify` and the receipt JWT shape

Handler: `apps/web/app/api/receipts/verify/route.ts:6-16` accepts
`{ token }`, calls `verifyReceiptJWT` (`apps/web/lib/trust/jwtVerifier.ts:11-28`),
returns:

```ts
// jwtVerifier.ts:4-9
export interface ReceiptVerificationResult {
  verified: boolean;
  payload?: Record<string, unknown>;
  error?:   string;
  errorCode?: 'signature_invalid' | 'token_expired'
            | 'algorithm_rejected' | 'malformed' | 'unknown';
}
```

The receipt JWT itself is minted by
`apps/web/lib/crypto/receiptIssuer.ts:94-133`:

```ts
// receiptIssuer.ts:111-130
const jti = `rcpt_${response.responseId}_${Date.now()}`;
const payload = {
  iss: issuerUrl,                 // env VITACV_ISSUER_URL ?? https://vitalcv.com
  sub: context.providerId,
  jti,
  vcv: {
    claimId:     context.claimId,
    source:      context.source,
    status:      'confirmed',
    observed_at: response.respondedAt,
    raw_hash:    context.rawHash,
  },
};
const jwt = await new SignJWT(payload)
  .setProtectedHeader({ alg: 'ES256', kid })
  .setIssuedAt()                  // iat
  .setExpirationTime('90d')       // exp
  .sign(privateKey);
```

Per criterion (against the JWT body a verifier consumes):

1. **checkedAt** — ⚠ inside the custom `vcv.observed_at` claim (not at a
   top-level standard claim).
2. **runId** — ✗ the `jti` shape is `rcpt_<responseId>_<unix-ms>`. It is
   **not** `receipt:run_v1_<16hex>`; the audit prompt's stated convention
   does not match this branch's `signIssuerReceipt`.
3. **lineageKey** — ✗ no `lin_v1_*`, no `lineageKey`, no
   `vc.credentialSubject.lineageKey`. A verifier cannot derive continuity
   from a single receipt.
4. **ownership** — ✓ JWT header `alg: ES256 + kid` and JWT body `iss`.
   `kid` is `RECEIPT_KID` env, otherwise an ephemeral
   `vcv-es256-dev-<unix-ms>` (`receiptIssuer.ts:54`). Key resolution
   requires JWKS — but the canonical `/.well-known/jwks.json` route file
   is absent (§7), so a strict RFC-conformant client following `iss` will
   404.
5. **T1–T4** — ✗ the `vcv` block carries only
   `{ claimId, source, status, observed_at, raw_hash }`. No tier ladder.
6. **receipt continuity** — ✗ no `priorJti`, no `priorLineageKey`, no
   `priorRunId`. Two consecutive receipts for the same `sub` can only be
   linked server-side.
7. **chronology** — ✓ JWT `iat` provides deterministic ordering;
   `vcv.observed_at` is a secondary key.

## §4 `GET /api/receipt/[npi]` *(promised, route file absent)*

The handler does not exist on this branch — `find apps/web/app/api/receipt`
returns nothing (only the plural `/api/receipts/verify`). All 7 criteria
fail by absence (404).

## §5 `GET /api/receipt/by-lineage/[lineageKey]` *(promised, route file absent)*

Same as §4. `lineageKey` is not used as a path segment, claim, or field
anywhere in `apps/web/app/api/**`, `apps/web/lib/**`, or
`apps/api/backend/src/**` on this branch (grep returns only RBAC-permission
strings like `'view_lineage'`).

## §6 `GET /.well-known/trust-register` *(promised, route file absent)*

Directory `apps/web/app/.well-known/trust-register/` does not exist. The
identifier `trust-register` is not used by any handler on this branch.
External verifiers discovering VitalCV via OID4VCI cannot enumerate the
trust register at the RFC-canonical path.

## §7 `GET /api/.well-known/jwks.json` (non-canonical path)

Handler: `apps/web/app/api/.well-known/jwks.json/route.ts:19-29`. Wire
payload:

```ts
return NextResponse.json(
  { keys: [publicKeyJwk] },
  { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
);
```

`publicKeyJwk` comes from `getPublicKeyJwk()`
(`receiptIssuer.ts:77-81`): `{ ...jwk, alg: 'ES256', use: 'sig', kid }`. A
single ES256 key with `kid`. No `controller`, no `did:web` linkage, no
`x5c`. Per criterion: 1, 2, 3, 5, 6 are n/a; **4 ownership**: ⚠ kid is
present but no DID — a verifier holding a receipt with
`iss: https://vitalcv.com` cannot tie this key cryptographically to the
issuer beyond URL coincidence, and `iss → /.well-known/jwks.json`
discovery 404s because this surface is served at `/api/.well-known/...`
not at the RFC 8615 root. **7 chronology**: ordering is moot today (one
key only); becomes load-bearing during rotation.

---

## §8 `GET /api/trust-state/[npi]`

Handler: `apps/web/app/api/trust-state/[npi]/route.ts:15-31` — pure proxy of
`${BACKEND_URL}/api/trust-state/${npi}`. The web layer does **not** declare
a TS type for the response (`route.ts:28`), so the wire shape is the
backend `TrustState` (`packages/trust-state/contracts.ts:16-33`):

```ts
// packages/trust-state/contracts.ts:16-33
export type TrustState = {
  clinician_id:     string;
  start_ready:      boolean;
  score:            number;
  band:             'GREEN' | 'YELLOW' | 'RED';
  blocking_reasons: BlockingReason[];          // 8 enumerated reasons, contracts.ts:6-14
  last_verified_at: string;
  audit_ref:        string;
  metrics:          { latency_ms; p90_ms; verification_latency_ms };
  verification_messages?:    readonly string[];
  linked_employers_count?:   number;
  linked_clinicians_count?:  number;
  timeline_preview?: readonly TrustTimelinePreviewEntry[];
};
```

Per criterion:

1. **checkedAt** — ✓ `last_verified_at`; `timeline_preview[i].occurred_at`
   per entry.
2. **runId** — ✗ engine does not return one.
3. **lineageKey** — ✗.
4. **ownership** — ✗ unsigned JSON. `audit_ref` is an opaque server-side
   pointer, not a cryptographic binding.
5. **T1–T4** — ⚠ verdict is collapsed into `band` + `blocking_reasons[]`;
   no per-tier breakdown on the wire.
6. **receipt continuity** — n/a. `PsvReceiptRecord` exists *inside* the
   engine (`contracts.ts:46-59`) with
   `receipt_id, fetched_at, ttl_seconds, revoked` — but **none of these
   are exposed on the `TrustState` wire shape**.
7. **chronology** — ⚠ `timeline_preview` order is not pinned by the type
   (`contracts.ts:32-38`); built via the optional
   `audit_timeline.buildTimeline` dependency adapter
   (`contracts.ts:196-203`). External verifiers cannot assume a sort key.

## §9 `GET /api/trust-state/[npi]/history`

Handler: `apps/web/app/api/trust-state/[npi]/history/route.ts:15-28` —
same proxy pattern, body untyped at the web layer. Per entry the
`TrustState` shape repeats. Per criterion: same as §8 for each entry, with
the **extra unspecified-ordering caveat across entries** — the proxy
forwards the backend body without pinning ascending vs descending
`last_verified_at`. Flagged.

## §10 `GET /api/trust-proof/[npi]`

Handler: `apps/web/app/api/trust-proof/[npi]/route.ts:11-44` — proxy
returning either JSON or a PDF buffer based on `?format=pdf`. The web
layer does not declare a JSON shape; backend type lives elsewhere
(`services/passport/passportPdf.ts`, not contract-pinned at the web tier).
A generic JSON verifier cannot rely on any specific field. All 7 criteria
treated as ⚠ "not contracted on the wire."

---

## §11 `POST /api/ingest/[npi]`

Handler: `apps/web/app/api/ingest/[npi]/route.ts:113-199`.

**Success path**: proxies the upstream body as-is
(`route.ts:184`). Shape is not contracted at the web layer; the client
extracts `runId` via `parseIngestStartResponse`
(`hooks/ingestStreamState.ts:570-587`), confirming the upstream returns a
top-level `runId` string.

**Fallback path** — fully specified `FallbackBody` (`route.ts:44-61`):

```ts
interface FallbackBody {
  ok:       false;
  fallback: true;
  reason:   'timeout' | 'network' | 'non_json' | 'upstream_5xx' | 'upstream_4xx';
  npi:      string;
  runId:    null;                         // ← always null on fallback
  lanes:    readonly { source; state; detail }[];  // 4 fixed lanes
  message:  string;
  truth: {
    unavailable_is_not_blocked:             true,
    access_required_is_not_clinician_fault: true,
    unknown_is_not_negative:                true,
  };
}
```

Per criterion: 1 ✗ no `checkedAt` (fallback static lanes have no
timestamp); 2 ⚠ field present but explicitly `null` on fallback; 3 ✗; 4 ✗;
5 ✗ (lanes are source-keyed `NPPES|OIG_LEIE|PECOS_PUBLIC|STATE_BOARD`, not
tier-keyed); 6 n/a; 7 ✓ `FALLBACK_LANES` is a fixed-order static array
(`route.ts:35-40`).

The fallback body is the most self-describing payload on the entire
surface — `truth: { … }` documents its own non-defect semantics, which a
verifier can consume programmatically.

## §12 `GET /api/ingest/stream/[runId]` (SSE)

Handler: `apps/web/app/api/ingest/stream/[runId]/route.ts:6-19` —
streaming pass-through of the upstream SSE as `text/event-stream`. Event
contract is defined client-side at `apps/web/hooks/ingestStreamState.ts:3-32`:

```ts
export const INGEST_EVENT_TYPES = [
  'source_start', 'source_complete', 'claim_update',
  'passport_ready', 'done', 'error',
] as const;

export interface IngestEvent {
  type:      IngestEventType;
  sourceId?: string;
  timestamp: string;                // event envelope ISO
  payload:   Record<string, unknown>;
  rawEvent:  RawIngestEvent;
}
```

Per-event payload merges (`ingestStreamState.ts:182-258`):

- `source_start`/`source_complete`: NPPES merges `displayName, specialty,
  taxonomies, address, identityStatus, entityType, npiType,
  enumerationDate, lastUpdated, credentials`; OIG/PECOS merge
  `exclusionStatus, exclusionClear, exclusionChecked, enrollmentStatus,
  enrollmentChecked`.
- `claim_update`: `readinessScore, readinessLevel, readinessStatus,
  claimCount, blockerCount, credentialCount, credentialIds[], checkedAt`.
- `passport_ready`/`done`: final merge + `entityId` anchor.
- `error`: `payload.message`.

Per criterion: 1 ⚠ two `checkedAt` semantics — envelope `timestamp` is
"event emitted at," `claim_update.payload.checkedAt` is "claim checked at"
(`ingestStreamState.ts:256`); 2 ⚠ `runId` is in the URL only, **not echoed
in each event**, so replay-without-URL is lossy; 3 ✗; 4 ✗ unsigned text
frames; 5 ✗ events are pipeline-stage-keyed, not tier-keyed; 6 n/a; 7 ⚠
events appended in arrival order (`ingestStreamState.ts:390`); envelope
`timestamp` is an explicit ordering key but monotonicity is not
contracted.

---

## §13 Trust-state engine output (in-process)

Source: `packages/trust-state/contracts.ts:16-33` (`TrustState` type) and
the audit-event sibling at `contracts.ts:112-149`. The engine emits the
`TrustState` object consumed by `services/trustStateEngine` and serialized
to §8/§9.

Strictly more information lives inside the engine than reaches the wire:
`PsvReceiptRecord` (`contracts.ts:46-59`) carries
`receipt_id, fetched_at, ttl_seconds, revoked,
verification_request_id?` — none of which appear on the `TrustState` wire
shape. Audit events
(`TRUST_STATE_CHECK`, `TRUST_STATE_DECAY`) are appended via
`audit.append` and not placed on the wire.

Per criterion: 1 ✓ `last_verified_at` + audit `occurred_at`; 2 ✗; 3 ✗;
4 ⚠ `audit_ref` opaque pointer only; 5 ⚠ `band` + `blocking_reasons`;
6 ⚠ receipt continuity exists *inside* the engine but is stripped before
egress; 7 ⚠ `receipts.listByClinician` adapter contract
(`contracts.ts:155-157`) does not pin a sort key.

---

## §14 Browser probe expectations matrix

Cell legend: `✓` present at a canonical key · `⚠` present at a
non-canonical key or in a custom block · `✗` absent · `404` route file
absent · `n/a` does not apply.

| Criterion | passport/npi | passport/entity | receipt/npi (§4) | receipt/by-lineage (§5) | trust-register (§6) | jwks (legacy) | receipts/verify *(input JWT)* | trust-state | trust-state/history | trust-proof | ingest POST (fallback) | ingest SSE | trust-state engine |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. checkedAt | ✓ `lastCheckedAt` | ✓ `lastCheckedAt` | 404 | 404 | 404 | n/a | ⚠ `vcv.observed_at` | ✓ `last_verified_at` | ⚠ per-entry only | ⚠ not contracted | ✗ | ⚠ envelope `timestamp` + payload `checkedAt` | ✓ `last_verified_at` |
| 2. runId | ✗ | ✗ | 404 | 404 | 404 | n/a | ✗ (`jti=rcpt_*`, not `run_v1_*`) | ✗ | ✗ | ⚠ not contracted | ⚠ `null` on fallback | ⚠ URL only, not in events | ✗ |
| 3. lineageKey | ✗ | ✗ | 404 | 404 | 404 | n/a | ✗ | ✗ | ✗ | ⚠ not contracted | ✗ | ✗ | ✗ |
| 4. ownership (iss + kid) | ✗ | ✗ | 404 | 404 | 404 | ⚠ kid only, no DID | ✓ header `alg+kid`, body `iss` | ✗ | ✗ | ⚠ not contracted | ✗ | ✗ | ⚠ `audit_ref` opaque |
| 5. T1–T4 | ⚠ `trustPosture.dimensions[]` (identity/safety/authority/eligibility) | ⚠ same | 404 | 404 | 404 | n/a | ✗ | ⚠ `band` + `blocking_reasons` | ⚠ same | ⚠ not contracted | ✗ | ✗ | ⚠ `band` + `blocking_reasons` |
| 6. receipt continuity (prior pointer) | n/a | n/a | 404 | 404 | n/a | n/a | ✗ no `priorJti`/`priorLineageKey` | n/a | ⚠ implicit by order | n/a | n/a | n/a | ⚠ internal only |
| 7. chronology deterministic | ⚠ `credentials[]`/`training.records[]` unpinned | ⚠ same | 404 | 404 | n/a | n/a | ✓ JWT `iat` | ⚠ `timeline_preview` unpinned | ⚠ entry order unpinned | ⚠ not contracted | ✓ fixed-order `FALLBACK_LANES` | ⚠ arrival order; no monotonicity guarantee | ⚠ `listByClinician` unpinned |

---

## §15 Browser institutional-readability verdict

**`/api/passport/npi/[npi]`** — A generic verifier reads identity,
authority, training, standing, readiness, and a four-dimension trust
posture directly. Cannot verify authorship (unsigned JSON), cannot chain
to a prior snapshot (no `runId`/`lineageKey`), cannot deterministically
order `credentials[]`. Reads as a state snapshot, not a cryptographic
claim; side-channel trust in `vitalcv.com` + TLS is required.

**`/api/passport/entity/[id]`** — Same verdict as the NPI variant.

**`/api/receipt/[npi]` and `/api/receipt/by-lineage/[lineageKey]`** — Route
files absent. Verifier hits 404; cannot render institutional trust state
from these paths today.

**`/.well-known/trust-register`** — Route file absent. Verifier cannot
enumerate the issuer's trust register from the RFC 8615 canonical path;
cross-surface coherence with JWKS + DID is not testable today.

**`/api/.well-known/jwks.json`** — Valid JWKS with one ES256 key, served
from a non-canonical path. JWK lacks a DID `controller`. RFC-conformant
clients following `iss → /.well-known/jwks.json` will 404 on apex.
Partial readability for clients with explicit knowledge of the
`/api/.well-known` fallback; opaque to RFC-conformant clients.

**`/api/receipts/verify`** — Accepts an ES256 JWT and returns
`{ verified, payload?, error?, errorCode? }`. A verifier can confirm the
signature but cannot derive run scope or lineage continuity from the
verified body (`jti` is not run-shaped; `vcv` block has no continuity
fields). Useful only as a per-receipt signature oracle.

**`/api/trust-state/[npi]`** — Verifier reads `band`, `score`,
`blocking_reasons`, `last_verified_at`, and a `timeline_preview`. Cannot
prove authorship (no signature, only `audit_ref` opaque pointer), cannot
link to a `runId`/`lineageKey`, depends on server-side ordering of
`timeline_preview`. Renders an institutional verdict but is
non-evidentiary on its own.

**`/api/trust-state/[npi]/history`** — Same as the singleton, with the
extra unspecified-ordering caveat across entries. Comparing "now" vs
"last week" requires the verifier to assume a sort key not contracted at
the web layer.

**`/api/trust-proof/[npi]`** — Wire shape is not contracted at the web
proxy layer. A generic JSON verifier cannot rely on any specific field;
PDF format is opaque to a JSON probe. Unreadable to a generic verifier
without backend-shape cooperation.

**`/api/ingest/[npi]` (POST)** — On fallback, the body is fully specified
and even self-documents its truth-preservation contract via
`truth: { unavailable_is_not_blocked, access_required_is_not_clinician_fault,
unknown_is_not_negative }`. The fallback path is the most self-describing
payload on the entire surface; the success path is opaque without backend
cooperation.

**`/api/ingest/stream/[runId]` (SSE)** — Envelope is fully shaped and the
six event types are enumerated. A verifier can follow a run to
completion deterministically; however, `runId` is in the URL not the
events, so a verifier capturing the stream from a CDN replay without the
original URL must infer the run ID out-of-band. State-transition stream
is readable; replay-without-URL is lossy.

**Trust-state engine output (`TrustState`)** — Internal contract, not
directly on the wire. Carries strictly more information internally
(`PsvReceiptRecord`, audit events) than it serializes; everything
cryptographically continuity-bearing is stripped before egress.

---

## §16 Summary — what a verifier actually gets today

A generic external verifier hitting VitalCV apex today **can**:

- Read a `PassportData` JSON snapshot with `lastCheckedAt`, identity,
  authority, training, standing, readiness, four-dimension trust posture,
  and source coverage — but cannot verify authorship.
- Follow an SSE ingest stream through six enumerated event types — but
  cannot resume without out-of-band knowledge of the `runId` URL.
- Verify a previously-issued receipt JWT by POSTing to
  `/api/receipts/verify` — but cannot fetch a fresh receipt by NPI or
  lineage from the canonical paths (route files absent).
- Hit `/api/.well-known/jwks.json` and get an ES256 JWK with a kid — but
  cannot resolve the issuer via `did:web:vitalcv.com` (no
  `/.well-known/did.json`), and the JWKS itself is at a non-canonical
  RFC 8615 path.

The verifier **cannot**:

- Establish run-scoped or entity-scoped continuity from a single payload
  (no `runId`/`lineageKey` claims on receipts, no backward pointers
  between receipts).
- Deterministically order multi-entity lists (credentials, training,
  `timeline_preview`, history entries) without trusting server-side
  order.
- Discover the issuer's DID, JWKS URI, or OID4VCI metadata at
  RFC-canonical paths — every promised `/.well-known/*` surface (except
  `apple-app-site-association` and `assetlinks.json`) is absent.

The largest single gap, from a wire-payload perspective, is the
**absence of any cryptographic continuity field** (`runId`, `lineageKey`,
`priorJti`) inside the receipt JWT body — the only signed payload on the
surface. Even when the canonical `/api/receipt/[npi]` route is restored,
its JWT shape as defined in `receiptIssuer.ts:113-124` carries only
`iss, sub, jti, iat, exp, vcv` with `vcv ∈ { claimId, source, status,
observed_at, raw_hash }` — none of which expose a run identity or a
lineage anchor a verifier can chase.
