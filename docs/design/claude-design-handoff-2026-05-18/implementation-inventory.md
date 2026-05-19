# Claude Design handoff · implementation inventory

Five-category classification per the brief:

- **A — IMPLEMENT NOW**
- **B — IMPLEMENT AFTER DEMO SPINE MERGES**
- **C — REFERENCE ONLY**
- **D — DO NOT IMPLEMENT AS FACTUAL CLAIM**
- **E — DUPLICATE / SUPERSEDED**

## Handoff source

Located on this machine at:

```
/Users/christoler/vitalcv-web/                                          (partial implementation drop)
/Users/christoler/Library/CloudStorage/Dropbox/vitalcv (7)/             (design source)
```

## Inventory

| # | Source file | Category | Shipped target | Notes |
|---|-------------|----------|----------------|-------|
| 1 | `vitalcv-web/styles/trust.css` | **A** | `apps/web/styles/trust.css` | Verbatim. 1,702 lines. Fully scoped under `.trust-scope`. |
| 2 | `vitalcv-web/app/trust-canon/trust/page.tsx` | **A** | `apps/web/app/trust-canon/trust/page.tsx` | Re-shaped to use the new TS primitive set. |
| 3 | `Dropbox/primitives.jsx` | **A** | `apps/web/components/trust/primitives.tsx` | Rewritten as TS. The original used `window` globals and `Icon` from a sandbox shim; the port drops both. |
| 4 | `Dropbox/Visual Grammar Canon.html` | **A** (as doctrine) | encoded in primitive class names + `LINEAGE_READING_ORDER` constant | Doctrine, not chrome. |
| 5 | `Dropbox/Trust Primitives.html` | **A** | `apps/web/components/trust/{primitives,SurfaceHeader,LineageHeader,SignaturePanel,ChainStrip,FailureBanner,DegradedRow}.tsx` | Each primitive ported. |
| 6 | `Dropbox/Lineage Header.html` + `Lineage Row.html` | **A** | `apps/web/components/trust/LineageHeader.tsx` | Reading-order constant + per-cell `data-cell` attrs. |
| 7 | `Dropbox/Degraded State Semantics.html` | **A** | `apps/web/components/trust/DegradedRow.tsx` | Dashed-border contract; `data-degraded` attr; explicit `opacity:1` guard. |
| 8 | `Dropbox/Failure Taxonomy.html` | **A** | `apps/web/components/trust/FailureBanner.tsx` + `FAILURE_MODES` data | A–E modes with refusal copy. |
| 9 | `Dropbox/Trust State Register.html` + `Trust State Visual System.html` | **A** | `apps/web/app/trust-canon/trust/page.tsx` | Three-state stage + reading-order + ownership + failure modes + degraded + non-claims. |
| 10 | `Dropbox/Verifier Reading Mode.html` + `Verifier Reading Runtime.html` | **A** | `apps/web/app/trust-canon/verify/[receipt]/page.tsx` | 30-second answer surface. Verdict bar uses safe compound copy only. |
| 11 | `Dropbox/Institutional Receipt.html` + `Receipt Reading Doctrine.html` | **A** | `apps/web/app/trust-canon/receipt/[id]/page.tsx` | Inverted `.t-sig` cryptographic plane + `ChainStrip`. |
| 12 | `Dropbox/Replay Memory.html` + `Replay Chronology Topology.html` + `Institutional Replay Ledger.html` | **A** | `apps/web/app/trust-canon/replay/page.tsx` | Chain strip + chronological nodes. No marketing copy. |
| 13 | `Dropbox/Human Trust Surface.html` (passport view) | **A** | `apps/web/app/trust-canon/passport/[npi]/page.tsx` | Holder readiness preview. Renders the degraded-row list. |
| 14 | `Dropbox/Verifier Continuity System.html`, `Verifier Trust Registry.html`, `Verifier Walkthrough.html` | **B** | (not shipped this wave) | Continuity / registry coupling requires live trust-state endpoints; defer until backend regression on `origin/main` (`replayEngine.ts` missing imports) is resolved. |
| 15 | `Dropbox/Institutional Trust Canon.html` + `Institutional Trust Surface.html` + `Final Institutional Trust Surface.html` | **C — REFERENCE ONLY** | not ported as routes | Capstone documents the doctrine encoded across primitives + `/trust`. Re-shipping them as separate routes would be duplicate doctrine. |
| 16 | `Dropbox/Trust State Transitions.html` | **C** | not ported | The transitions are state-machine doctrine; the runtime is enforced by `TrustState` + `ReplayState` types and the `t-stamp[data-state]` CSS, not by a dedicated route. |
| 17 | `Dropbox/Clinician Activation.html` | **B** | (not shipped this wave) | Activation wave is its own surface family; depends on lead-capture (PR #369) and demo spine PRs. |
| 18 | `Dropbox/PR-B Crypto Receipt Verifier Decision.html` + `PR-B Crypto Verifier Superseded.html` + `…v2.html` | **E — DUPLICATE / SUPERSEDED** | not ported | Superseded by the canonical Verifier Reading Mode (row 10). |
| 19 | Cedar Health named pilot artifacts (referenced in Dropbox HTML copy) | **D — DO NOT IMPLEMENT AS FACTUAL CLAIM** | actively stripped | No file in this PR mentions Cedar Health. |
| 20 | N=47 / Q2 2026 cohort numbers | **D** | actively stripped | No file in this PR claims a cohort size or quarter. |
| 21 | `did:web:vitalcv.health` signer identity | **D** | rendered ONLY as a fixture string with sub-label "design fixture — not a live registry" | The CSS classes still exist; the data is fixture-only. |
| 22 | ed25519 fingerprints | **D** | replaced with `fixture:demo-signer-a-not-a-real-key` | `SignaturePanel` carries a defensive check that any non-fixture-prefixed string is replaced. |
| 23 | 5-minute SLA / AES-256 / 72-hour deletion / deletion receipt | **D** | not present | Truth-contract scan in `trust-copy-safety.test.ts` asserts absence. |
| 24 | Pilot Intake / Why VitalCV / Employer Pipeline (HTML files in Dropbox) | **B** | deferred to `feat/design-demo-pilot-visual-grammar` (not in this PR) | Per brief: do not create that branch yet. |
| 25 | `Dropbox/wave18-verify.jsx` + `wave23-verify-v2.jsx` (sandbox jsx) | **C** | referenced for verdict-bar shape | Used as design source for the `VerdictBar` component; not directly ported. |
| 26 | emergency Vercel / Cloudflare docs (PRs #376, #377) | C — kept separate | not part of trust surfaces | Lives outside `(trust)` group. |

## Wave gating

| Gate | Status |
|------|--------|
| Trust surfaces canon (this PR) | shipped |
| Demo-spine routes (PR #368) | open / not merged |
| Lead capture (PR #369) | open / not merged |
| Audit-event visibility (PR #371) | open / not merged |
| Wallet-sdk unblocker (PR #375) | open / not merged — but real Web Quality blocker is the unrelated `replayEngine.ts` regression on `origin/main` |
| `feat/design-demo-pilot-visual-grammar` | **not created** per brief |

## What this wave intentionally did NOT do

- did not touch product runtime code outside the new `(trust)` group
- did not modify Prisma schema, env vars, DNS, Vercel, or any paid service
- did not add any new npm dependency
- did not introduce a new package
- did not revive Apply-with-VitalCV
- did not produce factual customer claims, factual SLA claims, or factual security certifications
- did not break or modify the existing `apps/web/app/trust/page.tsx` doctrine page (which lives outside the `(trust)` route group)
