# apps/status-api — VC revocation status service (StatusList2021)

**Status (2026-07-04, Wave 0 re-baseline):** real, minimal, **not deployed**. Workspace member `@vitalcv/status-api` (Express + `src/routes/statusList.ts`). The earlier "empty app" classification was wrong.

Purpose: serves revocation status lists for verifiable credentials using the StatusList2021 mechanism.

Forward path: **Wave E** of the god-mode plan (`docs/research/god-mode-research-report.md`) moves the revocation registry to the W3C VC 2.0 **Bitstring Status List** with revocation-first, fail-closed verifier checks. This service is the predecessor and reference implementation — keep it until Wave E lands, then fold or retire it inside that wave.

Run locally: `pnpm --filter @vitalcv/status-api dev`
