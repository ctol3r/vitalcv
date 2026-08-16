// Serve the production build on :3311 with the SAME env Playwright's CI
// webServer injects (see playwright.config.ts webServer.env), so a local run
// exercises the same gated routes and inlined flags CI does. Run from apps/web.
import { generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = JSON.stringify(privateKey.export({ format: 'jwk' }));

const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '3311'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CLERK_SECRET_KEY: '',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
      RECEIPT_KID: 'vitalcv-e2e-ephemeral',
      RECEIPT_PRIVATE_KEY_JWK: jwk,
      MATCHA_DECK_PREVIEW: '1',
      PAGE_STACK_PREVIEW: '1',
      STORY_RAIL_PREVIEW: '1',
      COMPETE_FILM_PREVIEW: '1',
      DESIGN_PREVIEW: '1',
      DEV_PREVIEW: '1',
      PUBLIC_HOME_VARIANT: 'easy',
      NEXT_PUBLIC_SCENE_DEBUG: '1',
    },
  },
);
child.on('exit', (code) => process.exit(code ?? 0));
