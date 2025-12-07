#!/usr/bin/env node
import { runQueueCommand } from './queue.js';

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  cli queue trigger-safety --clinician <id> [--sweep-id <id>] [--drift <file>] [--fusion <file>]
  cli queue mobility-eval --clinician <id> --clinician-org <id> --target-org <id> [--profile <file>] [--request <file>]`);
}

async function main(): Promise<void> {
  const [, , ...argv] = process.argv;

  if (argv.length === 0) {
    printUsage();
    process.exit(1);
  }

  const [domain, command, ...rest] = argv;

  if (domain !== 'queue') {
    throw new Error(`Unsupported CLI domain: ${domain}`);
  }

  await runQueueCommand(command, rest);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exitCode = 1;
});
#!/usr/bin/env node
import { runQueueCommand } from './queue.js';

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  cli queue trigger-safety --clinician <id> [--sweep-id <id>] [--drift <file>] [--fusion <file>]
  cli queue mobility-eval --clinician <id> --clinician-org <id> --target-org <id> [--profile <file>] [--request <file>]`);
}

async function main(): Promise<void> {
  const [, , ...argv] = process.argv;

  if (argv.length === 0) {
    printUsage();
    process.exit(1);
  }

  const [domain, command, ...rest] = argv;

  if (domain !== 'queue') {
    throw new Error(`Unsupported CLI domain: ${domain}`);
  }

  await runQueueCommand(command, rest);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exitCode = 1;
});

