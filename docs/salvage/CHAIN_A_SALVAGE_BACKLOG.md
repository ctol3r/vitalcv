# Chain A Salvage Backlog
*Generated: 2026-03-06 — Wave/Phase1-Hardening*

## Status
Chain A branches are **behind main by 13+ commits** and cannot be merged directly without conflict.
All unique, non-conflicting capabilities have been catalogued below for clean re-implementation as waves.

**Archived branches (do not merge directly):**
- `feature/interoperability-wave65` — 123 unique files, 23 ahead / 13 behind
- `feature/revocation-blast-sim` — 78 unique files, 19 ahead / 13 behind
- `feature/decision-capsule-engine` — 26 unique files
- `feature/decision-capsule-viz` — 59 unique files
- `feature/system-integrity-kg` — 70 unique files
- `feature/trust-graph-explorer` — 22 unique files
- `feature/trust-visibility` — 29 unique files
- `feature/cross-surface-trust` — 45 unique files
- `feature/matcha-engine` — 14 unique files
- `feature/native-wallet-clips` — 19 unique files
- `feature/akg-foundation` — 0 unique files (fully superseded)

---

## ✅ SALVAGED IN PHASE 1 (Wave A — wave/phase1-hardening)

| Capability | Source Branch | Files | Status |
|---|---|---|---|
| `DecisionCapsule` Prisma model | interoperability-wave65 | schema.prisma | ✅ Applied |
| `capsuleEngine.ts` (with snapshot + hash) | interoperability-wave65 | services/decision/ | ✅ Applied |
| `revocationCascade.ts` (propagate + blast radius) | interoperability-wave65 | services/decision/ | ✅ Applied |
| `cascadeEngine.ts` (memoized graph traversal) | interoperability-wave65 | services/revocation/ | ✅ Applied |
| `decisionCapsules.ts` routes (blast-radius + create + cascade) | interoperability-wave65 | routes/ | ✅ Applied |
| NPPES v2 field-length guards + expanded normalization | main (new) | engine/adapters/ | ✅ Applied |
| NPPES smoke tests | main (new) | __tests__/ | ✅ Applied |

---

## 🔄 PENDING SALVAGE — Priority Order

### P1 — Trust Core (Wave 123 dependency resolved; these extend it)

| Capability | Source | Key Files | Wave |
|---|---|---|---|
| `cascadeEngine.ts` full report (employer/deployment impact) | interoperability-wave65 | services/revocation/cascadeEngine.ts | Wave 123 extended |
| `decisionGraphExtension.ts` | interoperability-wave65 | services/graph/ | Wave 123 |
| `systemIntegrity` sweep + routes | interoperability-wave65 | services/integrity/systemSweep.ts, routes/systemIntegrity.ts | Wave 124 |
| Revocation cascade tests | interoperability-wave65 | __tests__/revocation.cascade.*.ts | Wave 123 |

### P2 — Compliance + Interoperability

| Capability | Source | Key Files | Wave |
|---|---|---|---|
| `hipaaGuard.ts` — PHI field masking middleware | interoperability-wave65 | services/compliance/hipaaGuard.ts | Wave 125+ |
| `fhirAdapter.ts` — FHIR R4 mapping layer | interoperability-wave65 | services/integrations/fhirAdapter.ts | Wave 126 |
| `licenseMonitor.ts` + `stateLicensure.ts` | interoperability-wave65 | services/licensure/ | Wave 125 |
| `sdJwt.ts` — SD-JWT VC with salted hashes | interoperability-wave65, matcha-engine | services/crypto/sdJwt.ts | Check vs main |
| OIDC routes (oidc.ts) | interoperability-wave65 | routes/oidc.ts | Check vs main |

### P3 — Intelligence + MATCHA

| Capability | Source | Key Files | Wave |
|---|---|---|---|
| `crsEvaluator.ts` — credential readiness scoring | matcha-engine, interoperability-wave65 | services/intelligence/crsEvaluator.ts | Wave 127 |
| `gapAnalyzer.ts` — missing credential analysis | matcha-engine | services/intelligence/gapAnalyzer.ts | Wave 127 |
| `matchaEvaluate.ts` route | matcha-engine | routes/matchaEvaluate.ts | Wave 127 |
| `intelligenceEngine.ts` | interoperability-wave65 | services/clinician/intelligenceEngine.ts | Wave 127 |

### P4 — Mobile + Portability

| Capability | Source | Key Files | Wave |
|---|---|---|---|
| `appleWallet.ts` — PKPass generation | native-wallet-clips | services/mobile/appleWallet.ts | Wave F |
| `googleWallet.ts` — Google Wallet passes | native-wallet-clips | services/mobile/googleWallet.ts | Wave F |
| `shareProofToken.ts` | cross-surface-trust | services/mobile/ | Wave F |
| `mobileTrust.ts` route | interoperability-wave65 | routes/mobileTrust.ts | Wave F |
| App Clip page (`/clip/verify/[npi]`) | native-wallet-clips | apps/web/app/clip/ | Wave F |
| PWA service worker + manifest | native-wallet-clips | apps/web/public/sw.js, manifest.json | Wave F |

### P5 — Embed SDK + Widget

| Capability | Source | Key Files | Wave |
|---|---|---|---|
| `embed-sdk` package | apply-widget-sdk | packages/embed-sdk/ | Wave F |
| `CrossOriginBridge.tsx` | native-wallet-clips | components/widget/ | Wave F |
| `PresentationGateway.tsx` | native-wallet-clips | components/verifier/ | Wave F |
| `usePresentationPolling` hook | native-wallet-clips | hooks/ | Wave F |

### P6 — Decision Capsule Visualization (UI)

| Capability | Source | Key Files | Wave |
|---|---|---|---|
| Capsule timeline panel | decision-capsule-viz | components/decision/ | Wave C |
| Blast radius graph | decision-capsule-viz | components/simulation/ | Wave C |
| Capsule dependency status badges | decision-capsule-viz | components/ | Wave C |

### P7 — Trust Graph Explorer + Knowledge

| Capability | Source | Key Files | Wave |
|---|---|---|---|
| `trustGraphExplorer.ts` route | system-integrity-kg | routes/trustGraphExplorer.ts | Wave C |
| `knowledgeGraph.ts` extension | system-integrity-kg | services/graph/ | Wave C |
| Trust graph explorer 3-panel page | trust-graph-explorer | apps/web/app/ | Wave C |

---

## ❌ DO NOT SALVAGE — Frozen Permanently

| Item | Reason |
|---|---|
| `blockchain/` directory (15 files) | Dead code, wrong direction, NFT/DeFi/XCM |
| `yield_farming.ts`, `deflationary_token.ts` | Directly contradicts infrastructure doctrine |
| `polkadot_service.ts`, `xcm_handler.ts` | Not the product wedge |
| `nft_badge_service.ts` | No roadmap path |
| `chainlink_oracle.ts` | Not applicable |
| `substrateCanon.ts` | Not applicable |

---

## Branch Lifecycle Recommendation

After each capability is salvaged into main via a clean wave:
1. Mark the source branch as `archived` in GitHub
2. Delete local tracking ref
3. Update this document with ✅

All Chain A branches should be fully drained and archived within 72 hours.
