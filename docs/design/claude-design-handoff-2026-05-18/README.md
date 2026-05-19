# Claude Design handoff · 2026-05-18

A controlled-document folder that records what shipped in
`feat/design-trust-surfaces-canon-v1` (PR opened against `main`).

## What this folder contains

| File | Purpose |
|------|---------|
| `README.md` | This index. |
| `implementation-inventory.md` | Per-file classification (A–E) of every artifact in the handoff. |

## Wave scope

| Item | Result |
|------|--------|
| Trust route group `(trust)` | 5 routes shipped — `/passport/[npi]`, `/verify/[receipt]`, `/replay`, `/receipt/[id]`, `/trust` |
| Canonical CSS | `apps/web/styles/trust.css` ported verbatim from the handoff drop |
| Shared primitives | `apps/web/components/trust/*` — 7 components |
| Shared library | `apps/web/lib/trust/{types.ts,format.ts,demoData.ts}` |
| Tests | 4 vitest suites — lineage order, demo disclaimers, copy safety, route render |
| Demo banner | Required on every route. Literal copy: "Demo data — not a real credentialing decision." |
| Live claims | **None**. No live signature verification, no live registry, no customer cohort, no SLA, no AES, no deletion receipt, no BAA, no HIPAA / SOC 2 / NCQA / HITRUST claim. |

## Doctrine preserved

1. **Reading order is binding.** Object → Ownership → checked_at → Channel → Replay → run_id. Encoded in `LINEAGE_READING_ORDER`; asserted by `trust-lineage-order.test.tsx`.
2. **Ownership is explicit.** `subject` / `delegated` / `unbound` — three values, no default. `OwnershipBadge` renders each distinctly.
3. **Degraded uses dashed border, never opacity.** `DegradedRow` emits `data-degraded={reason}` and explicitly sets `style={{ opacity: 1 }}` as a defensive guard. Asserted by `trust-surfaces-routing.test.tsx`.
4. **Inverted dark surface is reserved for cryptographic planes.** Only `SignaturePanel` (and nested `ChainStrip` inside it) uses the `.t-sig` register; no other component adopts it.
5. **No adverse findings = success, not failure.** Empty degraded lists and clean lineage do not render error chrome.
6. **Mono / tabular numerals for every identifier.** The `<Mono>` primitive carries the `.mono` class which the CSS pins to Geist Mono with `font-variant-numeric: tabular-nums`.
7. **Controlled-document headers.** `SurfaceHeader` and `SurfaceControlFooter` render the form / classification / effective / revision / controlled_by stripe above and below every route.
8. **Signatures are visibly distinct.** The dark `.t-sig` register, the explicit `fixture:` prefix on every fingerprint, and the "design fixture · not a live registry" footer are all in the same component.

## Routes & how to view them locally

```bash
# From the worktree:
cd /private/tmp/vitalcv-design-trust-surfaces
pnpm install --frozen-lockfile
pnpm turbo build --filter='@vitalcv/trust-state' --filter='@vitalcv/shared'
pnpm --filter @vitalcv/web dev

# Then open:
#   http://localhost:3030/passport/1346053246
#   http://localhost:3030/verify/rcpt_demo_004
#   http://localhost:3030/replay
#   http://localhost:3030/receipt/rcpt_demo_004
#   http://localhost:3030/trust
```

Or run via the Cloudflare tunnel operator (PR #377):

```bash
bash scripts/vitalcv-demo-operator.sh
```

## Truth contract — explicit non-claims

This wave **does not claim**:

- a real Cedar Health pilot or any named customer artifact
- the N=47 / Q2 2026 cohort
- live signature verification
- offline re-verifiability
- `did:web:vitalcv.health` registry continuity
- ed25519 fingerprints, AES-256, deletion receipts, or SLAs
- HIPAA, SOC 2, NCQA, HITRUST, or BAA-not-required
- a credentialing decision of any kind

Every demo fixture carries the canonical banner and a `DEMO · FIXTURE`
classification stripe.

## Sources read for this implementation

- `/Users/christoler/vitalcv-web/styles/trust.css` — copied verbatim
- `/Users/christoler/vitalcv-web/app/trust-canon/trust/page.tsx` — patterned after; ported to apps/web shape
- `/Users/christoler/Library/CloudStorage/Dropbox/vitalcv (7)/primitives.jsx` — primitive vocabulary (Chip, Mono, SectionHeader)
- `/Users/christoler/Library/CloudStorage/Dropbox/vitalcv (7)/{Visual Grammar Canon, Trust Primitives, Lineage Header, Lineage Row, Degraded State Semantics, Failure Taxonomy, Receipt Reading Doctrine, Replay Memory, Replay Chronology Topology, Trust State Register, Verifier Reading Mode, Institutional Receipt}.html` — design doctrine reference

The Dropbox path was the handoff's location on this machine. The
implementation read it as the source of truth for component shapes
and copy. No file was copied into the repo without re-writing it
under the truth-contract guards above.
