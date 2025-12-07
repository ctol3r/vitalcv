/**
 * Batch 69: License Cache Sweeper
 * Deletes expired LicenseCache entries
 * Run nightly via cron: 0 2 * * * node dist/scripts/license_cache_sweeper.js
 */

import { pool } from '../src/agent/db';

(async () => {
  try {
    const result = await pool.query('DELETE FROM "LicenseCache" WHERE expires_at < now()');
    console.log(`LICENSE_SWEEP_OK: removed ${result.rowCount || 0} expired entries`);
    process.exit(0);
  } catch (err) {
    console.error('LICENSE_SWEEP_ERROR:', err);
    process.exit(1);
  }
})();


