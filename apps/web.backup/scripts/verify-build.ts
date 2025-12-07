/**
 * Build verification script
 * B175B-TSFIX-012: Run `tsc -b` and fail CI on project reference errors
 */

import { spawnSync } from 'child_process';

const result = spawnSync('npx', ['tsc', '-b'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error('Failed to launch TypeScript compiler:', result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error('TypeScript project references build failed. See output above.');
  process.exit(result.status === null ? 1 : result.status);
}

console.log('TypeScript project references build succeeded.');

