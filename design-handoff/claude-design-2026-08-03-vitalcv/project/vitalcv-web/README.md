# `@vitalcv/web` · Trust Surfaces · Implementation Drop

Drop-in implementation of the five canonical trust surfaces, built against the Visual Grammar Canon v1.

## What's here

```
vitalcv-web/
├── README.md
├── styles/trust.css                ← @import into your global stylesheet
├── lib/trust/
│   ├── types.ts                    ← canonical types (Claim, Receipt, OwnerState, …)
│   └── format.ts                   ← short-hash, relative-time, UTC formatters
├── components/trust/
│   ├── primitives.tsx              ← 8 consolidated components (see §05 of canon)
│   ├── LineageHeader.tsx           ← top/bottom anchor bands · object→ownership→checked_at→channel→replay→run_id
│   ├── SignaturePanel.tsx          ← issuer continuity · key in service · status list · backup signer
│   ├── ChainStrip.tsx              ← replay lineage · receipt chain · arrows reading prev←this
│   ├── VerdictBar.tsx              ← single-line verdict · 30-s read commitment
│   ├── FailureBanner.tsx           ← five failure modes · A/B/C/D/E
│   └── DegradedRow.tsx             ← dashed chip + age · never opacity
└── app/(trust)/
    ├── layout.tsx                  ← shared masthead + trust.css scope
    ├── passport/[npi]/page.tsx     ← priority 1 · holder passport
    ├── verify/[receipt]/page.tsx   ← priority 2 · verifier reading mode
    ├── replay/page.tsx             ← priority 3 · holder replay memory
    ├── receipt/[id]/page.tsx       ← priority 4 · signed receipt artifact
    └── trust/page.tsx              ← priority 5 · trust state register
```

## Integration · 6 steps

1. **Copy `vitalcv-web/` into `apps/web/`** so the tree merges with your existing app-router. Resolve any path conflicts; nothing here uses unconventional aliases.
2. **Add Geist + Geist Mono** to your root layout. Either `next/font/google` or the `@fontsource` packages — they're the only typefaces this drop uses.
3. **Import the stylesheet:** add `@import "../styles/trust.css";` to your global stylesheet (or import it once in `app/(trust)/layout.tsx`, which is the default here).
4. **Wire your data sources.** Each page reads from a `getXxx()` function at the top — replace these stubs with calls into your existing trust APIs (the names match the canonical types in `lib/trust/types.ts`).
5. **Run:** `pnpm --filter @vitalcv/web dev -- -p 3030`. Surfaces live at `/passport/[npi]`, `/verify/[receipt]`, `/replay`, `/receipt/[id]`, `/trust`.
6. **Verify the 30-second read.** Open `/verify/<any-receipt>` first; if a credentialing reviewer can't answer "who asserted · when checked · what source · what signer · replay yes/no" without scrolling, the integration is incomplete.

## Doctrine · non-negotiable

- **Reading order is rendered, not styled.** All claim rows go through `<LineageRow />`, which renders OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID. Don't reorder.
- **Ownership is a token, not an inference.** Every claim renders `<OwnershipBadge state="subject" | "delegated" | "unbound" />`. Logging-in implies nothing.
- **Degraded uses dashed, never opacity.** Stale data carries `<DegradedRow />`. The visual is the border + age label; opacity is reserved for nothing.
- **Inverted register is reserved.** Dark ink-950 surfaces are for the cryptographic plane only — `<SignaturePanel />`, `<ChainStrip />` in dark variant, signed receipts. Don't apply to chrome.
- **`No adverse findings` is success, not failure.** Mode D in `<FailureBanner />` renders solid border, not dashed. It is the desired outcome of an exclusion-list check.

## What this drop does NOT do

- It does not call out to NPPES, OIG-LEIE, PECOS, CA Medical Board, or DEA. Wire your existing source-fetch layer into the `getXxx()` stubs.
- It does not validate signatures. The `<SignaturePanel />` and `<ChainStrip />` render whatever your trust API returns. Signature verification belongs in your existing `@vitalcv/trust` (or equivalent) package.
- It does not implement Status List 2021 lookups. The `revoked` flag on `Receipt` is read, never computed.

## Cross-reference

Maps to Visual Grammar Canon v1, §§ 02 (primitives), 05 (consolidations), 07 (recommendations).
