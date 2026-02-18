/**
 * Phase 1C — Deterministic JSON canonicalization (RFC 8785-like).
 *
 * Re-exports the project-wide canonicalize + hash utilities with
 * PSV-specific convenience wrappers. The single source of truth
 * for canonical form is `src/utils/canonicalizeJson.ts`.
 */
export { canonicalizeJson } from '../../utils/canonicalizeJson';
export { sha256Hex, sha256ForPayload } from '../../utils/deterministic';
