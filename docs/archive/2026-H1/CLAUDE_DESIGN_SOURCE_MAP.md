# Claude Design Source Map
Generated: 2026-05-13T17:53:14Z
Source: `/Users/christoler/Library/CloudStorage/Dropbox/vitalcv (7).zip` (2026-05-12)
Runtime: `localhost:3030` · branch `wave-10a/docs-status` · commit `8912bc7e`

> **Note on path:** The requested path `/mnt/data/vitalcv (7)(2).zip` does not exist on this machine.
> The highest-versioned archive on disk is `vitalcv (7).zip` in Dropbox (2026-05-12T10:07).
> All source analysis uses that file as authoritative.

---

## A. File Inventory — Design Archive

### Institutional Design Specifications (HTML — 34 files)

| File | Domain | Design Version |
|------|--------|---------------|
| `Lineage Header.html` | Six-slot header spec — canonical reading order | vc.2026.05.11-a |
| `Visual Grammar Canon.html` | Master visual ontology — 8 surfaces, 6 primitives, 4 states, 5 modes | pre-rollout canon v1 |
| `Trust State Register.html` | Three states (A/B/C) — five visual differentiators | v1 2026-05-11-a |
| `Verifier Reading Mode.html` | Verifier surface layout — provenance-first, trust-first | vc.2026.05.11-a |
| `Verifier Continuity System.html` | Canonical six-primitive system — binding spec | VCV-SYS-001 r.1.0 |
| `Verifier Walkthrough.html` | Full verifier walkthrough — 30-second audit pass | — |
| `Verifier Trust Registry.html` | Trust registry surface for verifiers | — |
| `Verifier Reading Runtime.html` | Live runtime verifier surface | — |
| `Failure Taxonomy.html` | Five modes A–E — cause / owner / action | v1 vc.2026.05.11-a |
| `Degraded State Semantics.html` | Five-mode taxonomy — three planes — binding doctrine | VCV-DEG-001 r.1.0 |
| `Replay Memory.html` | Holder replay memory — 90d timeline — chain-linked | vc.2026.05.11-a |
| `Replay Chronology Topology.html` | 4-subject chronology topology — 47 receipts — sigma chains | VCV-CHR-001 r.1.0 |
| `Institutional Receipt.html` | Canonical receipt rendering doctrine | — |
| `Institutional Replay Ledger.html` | Replay ledger surface — full institutional format | — |
| `Institutional Trust Canon.html` | Master institutional trust spec | — |
| `Institutional Trust Surface.html` | Trust surface — all panels | — |
| `Final Institutional Trust Surface.html` | Final state — all panels assembled | — |
| `Receipt Reading Doctrine.html` | 12 rules of receipt reading — VCV-DOC-002 r.1.0 | — |
| `Trust Primitives.html` | 8 primitive components — only permitted renderers | — |
| `Trust State Transitions.html` | State machine — A→B→C transitions | — |
| `Trust State Visual System.html` | Visual system for state A/B/C | — |
| `Human Trust Surface.html` | Human-readable trust surface | — |
| `Runtime Continuity Dashboard.html` | Runtime health / continuity dashboard | — |
| `Runtime Health.html` | Runtime health surface | — |
| `Runtime Observability.html` | Observability panel | — |
| `Lineage Row.html` | Compact lineage row — table context | — |
| `PR-B Crypto Receipt Verifier Decision.html` | Receipt verifier decision surface | — |
| `PR-B Crypto Verifier Superseded v2.html` | Superseded verifier (historical) | — |
| `PR-B Crypto Verifier Superseded.html` | Superseded verifier (historical) | — |
| `Onboarding IA Map.html` | Information architecture — onboarding | — |
| `Clinician Activation.html` | Clinician activation surface | — |
| `Wave Operating Stack.html` | Wave operating model | — |
| `Wave Skill Merge Card.html` | Wave skill card | — |
| `VitalCV.html` | Root surface | — |

### Reference Implementation (`vitalcv-web/` — TypeScript)

| File | Component / Purpose |
|------|---------------------|
| `components/trust/LineageHeader.tsx` | **Canonical `<LineageHeader>` and `<LineageFooter>`** — six-slot rendering, full + compact |
| `components/trust/primitives.tsx` | **8 canonical primitives**: `TrustChip`, `TierBadge`, `IdRender`, `CheckedAt`, `OwnershipBadge`, `ReplayChip`, `VerdictBar`, `SectionHeader` |
| `components/trust/DegradedRow.tsx` | `<DegradedRow>` — stale-but-signed wrapper, never recolors |
| `components/trust/FailureBanner.tsx` | `<FailureBanner>` — five modes with distinct icons |
| `components/trust/SignaturePanel.tsx` | `<SignaturePanel>` — issuer continuity in 4 cells |
| `components/trust/ChainStrip.tsx` | `<ChainStrip>` — replay continuity, `head ← prev` direction |
| `components/trust/SurfaceHeader.tsx` | Surface-level header wrapper |
| `lib/trust/types.ts` | **Canonical type system**: `TrustState`, `OwnerState`, `TrustTier`, `ReplayState`, `FailureMode`, `Lineage`, `Claim`, `SignerContinuity`, `ChainNode`, `Verdict`, etc. |
| `lib/trust/format.ts` | **Canonical formatters**: `shortHash()`, `formatCheckedAt()`, `relativeAge()`, `lineageWhen()` |
| `styles/trust.css` | **Canonical CSS tokens**: `--ink-0` → `--ink-950`, `.trust-scope`, `.t-lineage`, `.t-chip`, `.t-tier`, `.t-own`, `.t-sig`, `.t-chain`, `.t-fb`, `.t-verdict` |

### Wave JSX Components (`wave10.jsx` → `wave29-admin.jsx`)

Historical wave-by-wave surface evolution. Reference only — do not implement new features from these files.

---

## B. Semantic Inventory

### B1. Canonical Reading Order

```
OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
```

- **Source:** `LineageHeader.tsx` comment "Canon v1 · §02", `Visual Grammar Canon.html`, `Verifier Continuity System.html` P1
- **Rule:** Slot order never reorders. Slots may not be added or omitted. If no value, render `none` in monospace `ink-500`.
- **Tick rail:** Mandatory on first encounter (doctrine docs). Optional on production surfaces where order is known.

### B2. Trust State Definitions

| Design State | Design Name | Border | Background | Register |
|---|---|---|---|---|
| A | `preview` | 1.5px dashed, slate-400 | `#f4f1ea` paper (warm) | Exploratory — anonymous |
| B | `snapshot` | 1px solid, ink-900 | `--ink-50` | Authenticated — owned |
| C | `signed` | 1px solid + fill, ink-950 | ink-950 (inverted) | Institutional — cryptographic |

- **Source:** `Trust State Register.html`, `trust.css` `.t-stamp` variants

### B3. Ownership Types

| Design Value | Rendering | Meaning |
|---|---|---|
| `subject` | Solid fill badge | Clinician owns claim through authenticated DID match |
| `delegated` | Outlined badge | Counterparty (operator/employer) verifies on behalf |
| `unbound` | Dashed badge | Asserted by source, not yet DID-bound |

- **Source:** `primitives.tsx` `OwnershipBadge`, `types.ts` `OwnerState`

### B4. Replay States

| Value | Chip Variant | Meaning |
|---|---|---|
| `anchored` | `outline` (solid border) | RFC 3161 TSA + chain head committed |
| `pending` | `dotted` | Receipt written, anchor batch not yet committed (≤90s) |
| `none` | *(omit entirely)* | Anonymous preview — no replay written |

### B5. Trust Tier Badges

`T1` → `T4` — monospace, weight 600, 10.5px, ink-900 fill. Adjacent to Replay slot.

- T1: Anonymous check / self-reported
- T2: Source-confirmed, unsigned
- T3: Source-confirmed, signed (authoritative)
- T4: Issuer-signed VC (highest)

---

## C. Failure Taxonomy Inventory

| Mode | Name | Plane | Owner | Border/Frame | Recovery |
|---|---|---|---|---|---|
| A | Source unreachable | 1 — Upstream | Registry (not VitalCV) | 1px dashed, paper | Upstream restoration |
| B | Anonymous restriction | 5 — Policy | VitalCV policy + holder | 1px solid, ink-0 | Caller authentication |
| C | Infrastructure outage | 2 — Verifier (VitalCV) | VitalCV | 1px solid, ink-900 fill (inverted) | VitalCV restoration |
| D | No adverse findings | 4 — Subject outcome | None (success) | 2px solid, ink-0 | **No recovery needed — this is a SUCCESS** |
| E | Issuer unavailable | 3 — Issuer (cryptographic) | VitalCV keyholder | 1px solid, ink-950 fill (inverted) | Quorum activation |

**Critical invariant:** Mode D renders GREEN, never red/orange. It is the desired outcome of an exclusion check. Existing receipts remain valid even during Mode C or E.

---

## D. Chronology Inventory

From `Replay Chronology Topology.html` (VCV-CHR-001 r.1.0):

- Chain direction: `head ← prev ← prev…` (most recent leftmost)
- Per-node σ-pill: `σ ok` | `σ defer` | `rotation co-sign`
- Inverted plane reserved for cryptographic register
- σ-defer (Mode A) is a **notch in the line**, not a break
- Key rotation is a crossover node — **must co-sign across all chains it crosses**
- TSA anchor (normalized to `did:web:tsa.vitalcv.com` per DID authority decision 2026-05-13) appears once at bottom — countersigns every receipt

**Format.ts canonical formatters:**
- `shortHash(hash, 4, 4)` → `"7a2c…b8d3"` (4 chars + `…` + 4 chars — NOT 8 contiguous hex)
- `formatCheckedAt(iso)` → `"14:31:58Z"` (intraday) or `"2026-05-04"` (cross-day)
- `relativeAge(iso)` → `"10 s ago"`, `"2 m 54 s ago"`, `"7 d ago"` (terse, mono-friendly)

---

## E. Receipt Reading Doctrine Inventory (VCV-DOC-002 — 12 rules)

| Rule | Binding Requirement |
|---|---|
| R-01 | Verdict before content — no subject content above verdict pill |
| R-02 | Receipt-ID renders THREE times: head + lineage + chain |
| R-03 | Issuer ≠ Authority — stated in plain English on artifact, not footnote |
| R-04 | Signed-tone surfaces render ink-950 (inverted); holder/source surfaces on paper |
| R-05 | Six slots, fixed order, tick rail teaches it |
| R-06 | Timestamps are ISO 8601 UTC Z-suffix; relative time beneath, both render |
| R-07 | Gaps are named with dashed empty record — cause and owner named |
| R-08 | σ is per-node, not per-receipt |
| R-09 | (from Verifier Canon) Issuer continuity panel mandatory on every signed surface |
| R-10 | Tier descending — T4 first, T1 last |
| R-11 | Stale-but-signed rows remain visible, never removed |
| R-12 | Offline verifiability — trust path goes around VitalCV |

---

## F. Trust/Verifier Inventory

### Canonical Verifier Surface (from `Verifier Reading Mode.html`)

Layout order (top → bottom):
1. **Subject + Issuer masthead** — NPI, name, did, generated timestamp, run_id
2. **Export controls** — `.vc`, Print, Verify link
3. **Verdict bar** — dark pill: "Verifiable" | facts pipe-separated | read time
4. **Lineage header** — 6-slot reading order
5. **Issuer continuity panel** — 4 cells: active key, DID doc, status list, backup signer
6. **Claims table** — Tier / Ownership / checked_at / Claim / Source / Receipt — tier descending
7. **Chain strip** — replay lineage, RFC 3161 anchored, head ← prev
8. **Limitation statement** — what VitalCV asserts vs what it doesn't credential

### Canonical `/.well-known/` Discovery Matrix

| Endpoint | Standard | Required Fields |
|---|---|---|
| `jwks.json` | RFC 7517 | `keys[]` with `kid`, `kty`, `crv`, `x`, `y`, `alg`, `use` |
| `did.json` | W3C DID Core | `@context`, `id`, `verificationMethod[]`, `authentication[]`, `service[]` |
| `openid-credential-issuer` | OID4VCI Draft 13 | `issuer`, `credential_issuer`, `credential_endpoint`, `jwks_uri`, `credentials_supported[]` |
| `openid-configuration` | OIDC Discovery | `issuer`, `jwks_uri`, `credential_endpoint` |
| `trust.json` | VitalCV internal | `issuer`, `jwks_uri`, `did_document_uri`, `proof_tiers`, `environment` |
| `trust-register` | VitalCV internal | `version`, `doctrine`, `trust_states`, `proof_tiers`, `verifier_endpoints` |

---

## G. Runtime Alignment Status

### ✅ ALIGNED

| Design Requirement | Runtime Implementation | Match |
|---|---|---|
| Six-slot order: OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID | `TrustRegisterRow.tsx` — labeled slots in exact order | ✓ |
| Failure mode D = SUCCESS (green) | `FailureTaxonomyMatrix.tsx` mode D = `bg-green-400` | ✓ |
| Monospaced identifiers (run_id, DID, receipt hash) | `font-mono tabular-nums` on all ID fields | ✓ |
| `/.well-known/` all public (no auth) | All 6 endpoints: 200, no Clerk middleware | ✓ |
| DID document with `service[]` entries | ✓ Fixed this session — 3 services present | ✓ |
| Receipt issuer_did uses canonical DID (not 'mock (dev)') | ✓ Fixed this session | ✓ |
| Deterministic jti in receipts | ✓ Fixed this session — `rcpt_{responseId}` | ✓ |
| Deterministic signing key kid (dev) | ✓ Fixed this session — `vcv-es256-dev` stable | ✓ |
| Anonymous writes rejected | 401 at all API write edges | ✓ |
| Replay chain direction: head ← prev | `ReplayChronology.tsx` renders priorRunId chain | ✓ |
| Five failure modes named distinctly | `FailureTaxonomyMatrix.tsx` A/B/C/D/E | ✓ |
| Tier badges T1–T4 | `TrustTierBadge.tsx` T1/T2/T3/T4 | ✓ |
| Status endpoint lists 11+ endpoints | `/api/status` — 11 endpoints | ✓ |
| Degraded state with named cause + owner | Degraded banner, mode attribution | ✓ |

### ⚠️ SEMANTIC DRIFT (non-blocking, tracked)

| Design Spec | Runtime Implementation | Gap |
|---|---|---|
| Trust state names: `preview / snapshot / signed` | `TrustRegisterRow.tsx` state: `anonymous / owned / signed` | `preview` → `anonymous`, `snapshot` → `owned` — semantically equivalent but names differ |
| Ownership type: `OwnerState = "subject" \| "delegated" \| "unbound"` | `ownershipType?: 'actor' \| 'system' \| null` | Different vocabulary — `actor` ≠ `subject`, `system` ≠ `delegated` |
| run_id rendered as `7a2c…b8d3` (shortHash 4+…+4) | Rendered as `3a60de4c` (8 contiguous hex) | Missing ellipsis separator — should call `shortHash(runId, 4, 4)` |
| `CheckedAt` shows `14:31:58Z` intraday / `2026-05-04` cross-day | `checkedAt` passed as `"2026-05-13 17:48:40 UTC"` format | ISO 8601 Z-suffix expected; current format uses space + UTC suffix |

### ❌ DISCREPANCY (requires decision)

| Design Spec | Runtime Reality | Action Required |
|---|---|---|
| DID: design archive used a non-production domain placeholder | Runtime DID: `did:web:vitalcv.com` | **RESOLVED 2026-05-13** — `did:web:vitalcv.com` is the canonical institutional DID. All design-era placeholder references are superseded. See `DID_AUTHORITY_NORMALIZATION_AUDIT.md`. |
| Signing algorithm: `ed25519 EdDSA` in several design surfaces | Runtime: `ES256` (P-256) | Both are valid for JWT VCs. Design surfaces may be updated if ES256 is the confirmed production algorithm. Low priority. |
| `SignaturePanel` component (4 cells: key, DID doc, status list, backup signer) | No dedicated `<SignaturePanel>` in runtime | Missing component — issuer continuity panel not rendered as canonical 4-cell layout on verifier surfaces |
| `ChainStrip` component (explicit `← ` arrows, inverted plane) | `ReplayChronology.tsx` renders chain lineage | Implementation exists but may not match inverted plane + explicit per-node σ-pill format exactly |
| RFC 3161 TSA anchor node in chain topology | Not implemented | TSA anchoring not wired — `anchored` state is synthetic |

---

## H. Missing Implementations

| Canonical Component | Status | Priority |
|---|---|---|
| `<SignaturePanel>` — issuer continuity 4-cell layout | Not in runtime | Medium — required on every signed surface |
| `<ChainStrip>` — canonical chain rendering with inverted plane | Partial (`ReplayChronology` exists, different format) | Low — functional equivalent exists |
| `shortHash(runId, 4, 4)` applied to all run_id renders | Not applied — plain 8-hex used | Low — cosmetic, but required for format consistency |
| ISO 8601 Z-suffix checkedAt formatting | Not applied — uses space-separated format | Low — `formatCheckedAt()` from `lib/trust/format.ts` should be adopted |
| `OwnerState` vocabulary alignment (`subject/delegated/unbound`) | Uses `actor/system/null` | Medium — semantic mismatch in type system |
| TSA/RFC 3161 anchor wiring | Not wired | Hard — requires TSA integration |
| Status List 2021 credential status URL | Not live | Hard — requires StatusList infrastructure |
| `statusListUrl` in SignaturePanel | Not rendered | Blocked by above |

---

## I. Design-Surface Inventory — Runtime Alignment Summary

| Surface | Design File | Runtime Route | Alignment |
|---|---|---|---|
| Verifier reading mode | `Verifier Reading Mode.html` | `/verify` | Partial — layout exists, SignaturePanel missing |
| Receipt surface | `Institutional Receipt.html` | `/receipt/[id]` | Partial — shape correct, format gaps |
| Replay ledger | `Institutional Replay Ledger.html` | `/api/replay/[runId]` | Partial — synthetic, not DB-persisted |
| Trust register | `Trust State Register.html` | `/trust` + `/.well-known/trust-register` | ✅ Aligned |
| Failure taxonomy | `Failure Taxonomy.html` | `FailureTaxonomyMatrix.tsx` | ✅ Aligned |
| Degraded state | `Degraded State Semantics.html` | Degraded banners in verifier | ✅ Aligned |
| Chronology topology | `Replay Chronology Topology.html` | `ReplayChronology.tsx` | Partial — no per-node σ-pill |
| Runtime health | `Runtime Health.html` | `/status` + `/api/status` | ✅ Aligned |
| Lineage header | `Lineage Header.html` | `TrustRegisterRow.tsx` | Partial — state/ownership names differ |
| Replay memory | `Replay Memory.html` | `/api/replay/[runId]` | Partial — holder memory view not implemented |

---

## J. Authoritative Source Location

Design archive: `/Users/christoler/Library/CloudStorage/Dropbox/vitalcv (7).zip`
Extracted at: `/tmp/vcv-design/` (session-scoped)
Reference TSX: `/tmp/vcv-design/vitalcv-web/components/trust/`
Reference types: `/tmp/vcv-design/vitalcv-web/lib/trust/types.ts`
Reference CSS: `/tmp/vcv-design/vitalcv-web/styles/trust.css`
Runtime implementation: `/Users/christoler/vitalcv/apps/web/components/trust/`

**This document is the authoritative cross-map between design archive and runtime implementation.**
All future convergence work must reference this file before modifying trust surfaces.
