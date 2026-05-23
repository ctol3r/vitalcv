#!/usr/bin/env node
/**
 * scripts/generate-receipt-keypair.mjs
 *
 * One-shot helper: generate the ES256 (P-256) keypair JWK that the
 * production receipt issuer requires. Prints the env-var lines
 * ready to paste into the Railway service Variables tab.
 *
 * Uses Node's built-in Web Crypto API — no npm install required.
 *
 * Usage:
 *   node scripts/generate-receipt-keypair.mjs
 *
 * Outputs (to stdout):
 *   RECEIPT_KID=<kid>
 *   RECEIPT_PRIVATE_KEY_JWK=<json>
 *
 * Treat the private key as a secret. Generate ONCE, paste into the
 * Railway Variables tab, never commit to git. If the key is lost,
 * generate a new one — old receipts minted with the old key will
 * stop verifying.
 */

import crypto from 'node:crypto';

async function main() {
  // ES256 = ECDSA over P-256 with SHA-256.
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    /* extractable */ true,
    ['sign', 'verify'],
  );

  const privateJwk = await crypto.subtle.exportKey('jwk', privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', publicKey);

  // Strip Web Crypto API metadata (key_ops, ext) that jose's
  // importJWK rejects with "Unsupported key usage". The receipt
  // issuer uses jose to import the key at startup.
  delete privateJwk.key_ops;
  delete privateJwk.ext;
  delete publicJwk.key_ops;
  delete publicJwk.ext;

  // Stable kid: ISO date + short random suffix.
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(4).toString('hex');
  const kid = `vcv-es256-${date}-${rand}`;

  // Embed the kid + alg + use in both JWKs.
  privateJwk.kid = kid;
  privateJwk.alg = 'ES256';
  privateJwk.use = 'sig';
  publicJwk.kid = kid;
  publicJwk.alg = 'ES256';
  publicJwk.use = 'sig';

  console.log('# Generated', new Date().toISOString());
  console.log('# Paste these into the Railway service Variables tab.');
  console.log('# DO NOT commit the private key to git.');
  console.log('');
  console.log(`RECEIPT_KID=${kid}`);
  console.log(`RECEIPT_PRIVATE_KEY_JWK=${JSON.stringify(privateJwk)}`);
  console.log('');
  console.log('# Public side (for reference; this is what /.well-known/jwks.json publishes):');
  console.log(`# ${JSON.stringify(publicJwk)}`);
}

main().catch((err) => {
  console.error('failed:', err);
  process.exit(1);
});
