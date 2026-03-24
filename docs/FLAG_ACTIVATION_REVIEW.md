# Flag Activation Review — 2026-03-24

## OFAC_SDN_ENABLED

**Verdict: SAFE TO ENABLE when pipeline wiring is complete**

### What's ready
- `ofacAdapter.ts` — full SDN list fetch, name+DOB scoring, `potential_match` / `confirmed_match` distinction
- `passportService.ts` — `exclusionStatus: 'POSSIBLE_MATCH'` and `'EXCLUDED'` both render correctly in `PassportWallet` and `ReviewClient`
- OFAC import already wired into `identityIngestionPipeline.ts` (line 43)

### What's missing
- Pipeline wiring: `runOfacCheck()` is not yet called in the pipeline body — it's imported but unused
- The PECOS handler pattern (line ~1626) should be followed to add an OFAC check stage
- **CRITICAL guard**: `potential_match` (name-only) MUST set `reviewRequired=true` and MUST NOT auto-block — this is enforced in `ofacAdapter.ts` (`POTENTIAL_THRESHOLD=0.45`, `CONFIRMED_THRESHOLD=0.90`)

### Steps to enable
1. Wire `runOfacCheck()` call into `identityIngestionPipeline.ts` after identity is resolved, gated by `process.env.OFAC_SDN_ENABLED === 'true'`
2. Set `OFAC_SDN_ENABLED=true` in Vercel env
3. Set `OFAC_SDN_ENABLED=true` in backend env
4. Verify: NPI 1003000126 shows `exclusionStatus: 'CLEAR'` (not `UNCHECKED`) after ingest

### Risk level: LOW — rendering is complete, guard logic enforces non-auto-block

---

## CMS_OPT_OUT_ENABLED

**Verdict: DO NOT ENABLE YET**

### What's ready
- `medicarePostureNormalizer.ts` — normalizes PECOS + CMS_OPT_OUT + CMS_ORDER_REFERRING into `MedicarePosture`
- `ClaimState` union includes `'OPTED_OUT'`
- Bulk file ingestion is designed

### What's missing
- **UI rendering for `OPTED_OUT` is absent** — no case in `PassportWallet`, `ReviewClient`, or `buildEligibilityRow`
  - If enabled, opted-out providers would silently show as `UNKNOWN` enrollment, which is misleading
- CMS Opt-Out bulk file is not yet being ingested (monthly bulk, needs download + parse pipeline)

### Steps to enable
1. Add `OPTED_OUT` rendering to `buildEligibilityRow()` in `ReviewClient.tsx`:
   - Label: "Medicare Opt-Out"
   - Explanation: "This provider has formally opted out of Medicare assignment. Verify private pay arrangement before referral."
   - ActionFlag: true
2. Add `OPTED_OUT` to `PassportWallet`'s eligibility section
3. Wire CMS Opt-Out bulk file download into ingestion pipeline
4. Set `CMS_OPT_OUT_ENABLED=true` in env

### Risk level: MEDIUM — enabling without UI would silently misrepresent opted-out providers

---

## CMS_ORDER_REFERRING_ENABLED

**Verdict: DO NOT ENABLE YET**

### What's ready
- `CMS_ORDER_REFERRING` in `SOURCE_CATALOG` with correct freshness semantics
- `medicarePostureNormalizer.ts` handles the cross-signal

### What's missing
- No UI rendering for the Order/Referring data specifically
- Bulk file ingestion not wired
- Claim-level rendering in PassportWallet/ReviewClient needs `ORDER_REFERRING_ELIGIBLE` / `NOT_ELIGIBLE` display

### Risk level: MEDIUM — same as CMS_OPT_OUT

---

## Summary

| Flag | Safe to enable now? | Blocker |
|---|---|---|
| `OFAC_SDN_ENABLED` | ✅ Yes, after pipeline wiring | Wire `runOfacCheck()` in pipeline |
| `CMS_OPT_OUT_ENABLED` | ❌ No | UI rendering missing for `OPTED_OUT` state |
| `CMS_ORDER_REFERRING_ENABLED` | ❌ No | UI rendering + bulk file ingestion not wired |
| `NIH_REPORTER_ENABLED` | ✅ Yes | Feature-flagged, enrichment-only, no trust impact |
| `ORCID_ENABLED` | ✅ Yes | Feature-flagged, enrichment-only, no trust impact |
| `HRSA_CONTEXT_ENABLED` | ✅ Yes | Already handled in map routes |
| `ACGME_ENABLED` | ✅ Yes | Always review_required, no trust impact |
