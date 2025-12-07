import { PrismaClient } from '@prisma/client';
import { NCQARunner } from '../services/compliance/runner';

const prisma = new PrismaClient();

/**
 * Nightly NCQA Monitoring Job
 * Runs compliance checks on all active credentials
 */
async function runNightlyMonitoring() {
  console.log('[NCQA] Starting nightly monitoring...');
  const start = Date.now();

  // Fetch all active credentials
  // In a large system, this should be paginated or processed via queue
  const credentials = await prisma.credential.findMany({
    where: { status: 'active' },
    select: { id: true },
  });

  console.log(`[NCQA] Found ${credentials.length} active credentials to check.`);

  let processed = 0;
  let errors = 0;

  for (const cred of credentials) {
    try {
      await NCQARunner.runForCredential(cred.id);
      processed++;
    } catch (e) {
      console.error(`[NCQA] Error checking credential ${cred.id}:`, e);
      errors++;
    }

    if (processed % 50 === 0) {
      console.log(`[NCQA] Processed ${processed}/${credentials.length}`);
    }
  }

  const duration = (Date.now() - start) / 1000;
  console.log(`[NCQA] Monitoring completed in ${duration}s. Processed: ${processed}, Errors: ${errors}`);
}

// Allow running directly
if (require.main === module) {
  runNightlyMonitoring()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

export { runNightlyMonitoring };














