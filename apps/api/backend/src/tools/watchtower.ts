import fs from 'node:fs/promises';
import path from 'node:path';
import { getWatchtowerState } from '../services/identity/watchtowerEngine';

function usage(): string {
  return [
    'Usage:',
    '  pnpm exec ts-node src/tools/watchtower.ts inspect <npi>',
    '  pnpm exec ts-node src/tools/watchtower.ts examples',
  ].join('\n');
}

async function printExamples(): Promise<void> {
  const fixturesDir = path.resolve(__dirname, '../../fixtures/watchtower');
  const files = (await fs.readdir(fixturesDir))
    .filter((entry) => entry.endsWith('.json'))
    .sort();

  for (const file of files) {
    const body = await fs.readFile(path.join(fixturesDir, file), 'utf8');
    process.stdout.write(`\n# ${file}\n${body}\n`);
  }
}

async function inspectNpi(npi: string): Promise<void> {
  const state = await getWatchtowerState(npi);
  process.stdout.write(`${JSON.stringify({ npi, ...state }, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);

  if (!command) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }

  if (command === 'examples') {
    await printExamples();
    return;
  }

  if (command === 'inspect') {
    if (!arg || !/^\d{10}$/.test(arg)) {
      process.stderr.write('inspect requires a 10-digit NPI\n');
      process.exitCode = 1;
      return;
    }
    await inspectNpi(arg);
    return;
  }

  process.stderr.write(`${usage()}\n`);
  process.exitCode = 1;
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
