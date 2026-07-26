# Migration Note: Canonical Source Integration Path

## Architectural Decision
We have elected to use a **single canonical source integration path** located in `apps/api/backend/src/services/identity/`.

Going forward, **all source integrations** (fetching, parsing, validating) must occur via the pipeline defined in `identityIngestionPipeline.ts`, `claimEngine.ts`, and the phase-specific source files (`phase2Sources.ts`, etc.). 

The older architecture—represented by `packages/psv-adapters/` and individual fetchers like `packages/psv/sources/`—is **deprecated**. Dual architectures introduce source-integration ambiguity and weaken the defensibility of the trust layer. No new adapters should be added to `packages/psv-adapters/`.

## How to Extend the Spine (Contractor Guide)

When adding a new source to the VitalCV spine, follow this exact sequence:

1. **Register the Source** 
   Identify the source in `services/identity/sourceCatalog.ts` with its `EvidenceTier` (GOLD/SILVER/BRONZE), `RefreshCadence`, and supported `ClaimType`s.
   
2. **Implement Fetcher and Parser**
   In the appropriate `phaseXSources.ts` (or `claimEngine.ts` for Phase 0/1 sources), implement:
   - A fetcher function that returns `SourceFetchResult` (raw response, checksum, fetchedAt, sourceUrl, fetchHeaders).
   - A parser function that receives `raw` data and outputs exactly `NormalizedClaim[]` and `VerificationReceipt[]`.
   
   **Hardening Requirements for Parsers:**
   - **Artifact capture**: Pass down `artifactId` and `artifactChecksum` unmodified to each created claim.
   - **Parser version**: Explicitly declare a `const SOURCE_PARSER = 'v1.X.X'` and attach it to claims. Any logic change in parsing must bump this version.
   - **Observed At**: Persist the `observedAt` timestamp from the original artifact creation down to the claim.
   - **Freshness Window (`expiresAt`)**: If the data has an explicit valid-until date or SLA (from `sourceCatalog.ts`), calculate and assign `expiresAt`.
   - **Review Required**: Any non-definitive match (e.g. fuzzy name matches) or unhandled error _must_ set `reviewRequired: true`.
   - **Gated Sources**: If an API requires credentials that are not configured, return `reviewRequired: true` and an explicit fallback claim (confidence `UNCERTAIN` or `LOW`). Do NOT pretend live coverage exists if the API key is missing.

3. **Wire to Pipeline**
   Add the handler mapping into the `handlers` record inside `identityIngestionPipeline.ts`. The pipeline handles the rest: checksum diffing, indexing, watchtower events, and artifact lineage.

4. **Verify Tests**
   Write explicit parser tests covering:
   - Live source success paths.
   - Gated source truth handling (when keys are missing or API fails).
   - Parser drift/quarantine behaviors.
   - Replay integrity.
