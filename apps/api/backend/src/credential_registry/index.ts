import fs from 'fs';
import path from 'path';

/**
 * Loads the W3C Verifiable Credentials Data Model v1.0 context.
 * This is a lightweight integration point for the credential-registry pallet
 * to validate and work with VC compliant data.
 */
export function loadVcContext(): Record<string, unknown> {
  const filePath = path.join(__dirname, 'vc-data-model-v1.jsonld');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}
