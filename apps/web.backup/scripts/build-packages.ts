import { spawn } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = path.join(repoRoot, 'packages');
const tscBin = require.resolve('typescript/bin/tsc');

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function runTsc(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tscBin, ...args], {
      cwd: repoRoot,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code && code !== 0) {
        reject(new Error(`tsc exited with code ${code}`));
      } else {
        resolve();
      }
    });

    child.on('error', reject);
  });
}

async function main(): Promise<void> {
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const packages = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (packages.length === 0) {
    console.log('No packages found to build.');
    return;
  }

  for (const pkgName of packages) {
    const tsconfigPath = path.join(packagesDir, pkgName, 'tsconfig.json');
    if (!(await pathExists(tsconfigPath))) {
      continue;
    }

    console.log(`\n🛠️  Building ${pkgName}`);
    await runTsc(['-b', tsconfigPath]);
  }

  console.log('\n✅ Finished building all packages.');
}

main().catch((error) => {
  console.error('Failed to build packages.');
  console.error(error);
  process.exitCode = 1;
});


