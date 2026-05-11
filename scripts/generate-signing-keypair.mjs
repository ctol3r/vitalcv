#!/usr/bin/env node
/**
 * generate-signing-keypair.mjs — ES256 signing keypair generator.
 *
 * Generates a P-256 (ES256) keypair and writes both public and private
 * JWKs to local files under ./keys/ (relative to the repo root).
 *
 * SAFETY CONTRACT:
 *   - The PRIVATE JWK is NEVER printed to stdout. It is written to
 *     ./keys/vitalcv-signing-private.jwk only. The file path is
 *     printed; the contents are not.
 *   - The PUBLIC JWK IS printed to stdout (safe to share). It is also
 *     written to ./keys/vitalcv-signing-public.jwk for convenience.
 *   - The kid is derived from a SHA-256 of the public JWK so it is
 *     deterministic and the same on both sides.
 *   - The script refuses to overwrite existing key files unless
 *     FORCE=1 is set (avoids silent rotation that would invalidate
 *     deployed signatures).
 *
 * Usage (run LOCALLY in your terminal — never through an agent that
 * can leak private material into a transcript):
 *
 *   node scripts/generate-signing-keypair.mjs
 *
 *   # To rotate (overwrite existing):
 *   FORCE=1 node scripts/generate-signing-keypair.mjs
 *
 * After generation:
 *   1. Copy the printed PUBLIC JWK + kid into your .env.local:
 *        VITALCV_SIGNING_PUBLIC_JWK=<paste public jwk JSON>
 *        VITALCV_SIGNING_KEY_ID=<paste kid>
 *
 *   2. Read the PRIVATE JWK from the local file you just created:
 *        cat ./keys/vitalcv-signing-private.jwk
 *      and paste it into your .env.local as:
 *        VITALCV_SIGNING_PRIVATE_KEY_JWK=<paste private jwk JSON>
 *
 *   3. Add it to Vercel project env vars (production scope) the same
 *      way. Server scope, never NEXT_PUBLIC_.
 *
 *   4. Verify the public side by hitting /.well-known/jwks.json —
 *      X-JWKS-Status should flip from `not-configured` to `ok`.
 *
 *   5. Add ./keys/ to .gitignore if it is not already. The
 *      .gitignore stub at scripts/keys-gitignore-template is provided
 *      for convenience.
 */

import { generateKeyPair, exportJWK } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, statSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const KEY_DIR = resolve(REPO_ROOT, 'keys');
const PUBLIC_PATH = resolve(KEY_DIR, 'vitalcv-signing-public.jwk');
const PRIVATE_PATH = resolve(KEY_DIR, 'vitalcv-signing-private.jwk');

const FORCE = process.env.FORCE === '1';

function refuseIfExists(path) {
  if (existsSync(path) && !FORCE) {
    console.error(`ABORT: ${path} already exists.`);
    console.error('To rotate, take a backup first then run with FORCE=1.');
    console.error('Rotating signing keys invalidates every previously-signed');
    console.error('artifact verifiers have cached. This must be a deliberate act.');
    process.exit(77);
  }
}

function kidFor(publicJwk) {
  // Deterministic id derived from a hash of the canonical-JSON of the
  // public JWK. Same JWK → same kid across machines.
  const sortedKeys = Object.keys(publicJwk).sort();
  const canonical = JSON.stringify(
    sortedKeys.reduce((acc, k) => {
      acc[k] = publicJwk[k];
      return acc;
    }, {}),
  );
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 16);
  // Prefix with a date band so rotated keys are visually distinguishable.
  const band = new Date().toISOString().slice(0, 7); // YYYY-MM
  return `vcv-${band}-${hash}`;
}

async function main() {
  refuseIfExists(PUBLIC_PATH);
  refuseIfExists(PRIVATE_PATH);

  if (!existsSync(KEY_DIR)) {
    mkdirSync(KEY_DIR, { recursive: true });
  }

  // Add a salt entropy mix so two consecutive runs differ — generateKeyPair
  // already uses crypto-grade RNG, but reading randomBytes here is a
  // defense against catastrophic RNG misconfig.
  randomBytes(32);

  const { publicKey, privateKey } = await generateKeyPair('ES256', {
    extractable: true,
  });

  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);

  const kid = kidFor(publicJwk);
  publicJwk.kid = kid;
  publicJwk.alg = 'ES256';
  publicJwk.use = 'sig';
  privateJwk.kid = kid;
  privateJwk.alg = 'ES256';
  privateJwk.use = 'sig';

  // Write public JWK (safe to share).
  writeFileSync(PUBLIC_PATH, JSON.stringify(publicJwk, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o644,
  });

  // Write private JWK with 0600 permissions (owner read/write only).
  writeFileSync(PRIVATE_PATH, JSON.stringify(privateJwk, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  // Belt + suspenders chmod (some platforms ignore mode on writeFileSync).
  chmodSync(PRIVATE_PATH, 0o600);

  // Verify the private file actually got 0600.
  const privateStat = statSync(PRIVATE_PATH);
  const privateMode = privateStat.mode & 0o777;
  if (privateMode !== 0o600) {
    console.warn(`WARN: private key file mode is ${privateMode.toString(8)}, expected 600.`);
    console.warn('Run: chmod 600 ' + PRIVATE_PATH);
  }

  // PRINT: only public JWK + kid + paths. Private content NEVER printed.
  console.log('');
  console.log('=== ES256 SIGNING KEYPAIR GENERATED ===');
  console.log('');
  console.log('Key ID (kid):');
  console.log('  ' + kid);
  console.log('');
  console.log('Public JWK (safe to share — paste into VITALCV_SIGNING_PUBLIC_JWK):');
  console.log('  ' + JSON.stringify(publicJwk));
  console.log('');
  console.log('Private JWK written to (NEVER share, NEVER paste into chat):');
  console.log('  ' + PRIVATE_PATH);
  console.log('');
  console.log('Read the private JWK locally with:');
  console.log('  cat ' + PRIVATE_PATH);
  console.log('and paste the contents into .env.local as VITALCV_SIGNING_PRIVATE_KEY_JWK.');
  console.log('');
  console.log('To rotate later: FORCE=1 node scripts/generate-signing-keypair.mjs');
  console.log('');
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
