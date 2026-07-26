import fs from 'fs';
import path from 'path';

/**
 * Loads the W3C Verifiable Credentials Data Model v1.0 context, used to
 * validate and work with VC-compliant data.
 *
 * (Previously described as an integration point for the credential-registry
 * Substrate pallet; that pallet was deleted on 2026-07-25 — see
 * docs/architecture/adr-substrate-anchoring.md. This loader is independent of
 * it and stays.)
 */
export function loadVcContext(): Record<string, unknown> {
  const filePath = path.join(__dirname, 'vc-data-model-v1.jsonld');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}
