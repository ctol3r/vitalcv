// Serve the production build on :3311 with the same ephemeral receipt key the
// Playwright harness injects — without it /trust and /status return 500 for a
// missing env var, not a page defect. Run from apps/web.
import { generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = JSON.stringify(privateKey.export({ format: 'jwk' }));

const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-p', '3311'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      RECEIPT_KID: 'vitalcv-f-evidence-ephemeral',
      RECEIPT_PRIVATE_KEY_JWK: jwk,
    },
  },
);
child.on('exit', (code) => process.exit(code ?? 0));
