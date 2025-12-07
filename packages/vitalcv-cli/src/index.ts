#!/usr/bin/env node
/**
 * VitalCV CLI
 *
 * Command-line interface for VitalCV platform operations
 */

import { runSimulateCommand } from './commands/simulate.js';

function printUsage(): void {
  console.log(`Usage:
  vitalcv simulate --scenario <id> [options]
  vitalcv simulate --batch <file> [options]
  vitalcv simulate --list [--scenario-type <type>]
  vitalcv simulate --metrics [--scenario <id>] [--scenario-type <type>]
  vitalcv simulate --create-baseline

Options:
  --scenario, -s <id>           Scenario ID to run
  --batch, -b <file>            Batch file with scenario IDs
  --dry-run                     Dry run mode (no actual execution)
  --output, -o <file>           Output file for results
  --time-acceleration <num>     Time acceleration factor
  --skip-faults                 Skip fault injection
  --list, -l                   List available scenarios
  --metrics, -m                 Show aggregated metrics
  --scenario-type <type>        Filter by scenario type
  --create-baseline             Create baseline scenarios
`);
}

async function main(): Promise<void> {
  const [, , ...argv] = process.argv;

  if (argv.length === 0) {
    printUsage();
    process.exit(1);
  }

  const [command, ...rest] = argv;

  try {
    switch (command) {
      case 'simulate':
        await runSimulateCommand(rest);
        break;
      default:
        throw new Error(`Unknown command: ${command}. Use 'simulate' or see --help`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal error: ${message}`);
  process.exitCode = 1;
});

