#!/usr/bin/env ts-node
/**
 * Run all investigators once against the connected database.
 * Usage: DATABASE_URL="..." pnpm exec ts-node scripts/run-investigators.ts
 */
import { runScheduledInvestigators } from '../src/services/investigators/investigatorEngineService';

async function main() {
  console.log('[Ignition] Running all investigators...');
  try {
    const results: Array<{ investigatorId: string; findingsGenerated: number }> =
      await runScheduledInvestigators();

    let total = 0;
    for (const r of results) {
      console.log(`  ${r.investigatorId} → ${r.findingsGenerated} findings`);
      total += r.findingsGenerated;
    }
    console.log(`\n[Ignition] Total findings: ${total}`);

    if (total === 0) {
      console.log('⚠️  No findings generated. Investigators ran but found nothing to flag.');
      console.log('    This means the seeded data conditions may not match investigator thresholds.');
    }
  } catch (err) {
    console.error('[Ignition] Failed:', (err as Error).message);
    console.error((err as Error).stack);
    process.exit(1);
  }
}

main();
