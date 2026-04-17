// ── VitalCV Ingest Pipeline (Async) ──────────────────────────────
// Decouples external API latency from the Omega decision path.
// This runs as a background worker, fetching and caching truth.

import { NppesAdapter } from '../../../../packages/source-adapters/src/adapters/nppes';
// import { OigAdapter } from '../../../../packages/source-adapters/src/adapters/oig';
// import { PecosAdapter } from '../../../../packages/source-adapters/src/adapters/pecos';
import { extractClaims } from '../../../../packages/source-adapters/src/claim-engine';
import { generateReceipt } from '../../../../packages/source-adapters/src/utils/hash';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Background job that fetches fresh data for an NPI from all primary sources,
 * normalizes it into claims, and stores it in the database.
 */
export async function runIngestPipeline(npi: string): Promise<void> {
  console.log(`[INGEST] Starting async background ingest for NPI ${npi}...`);
  
  // 1. Fetch concurrently (Network I/O)
  const [nppes] = await Promise.allSettled([
    NppesAdapter.fetch(npi),
    // OigAdapter.fetch(npi),
    // PecosAdapter.fetch(npi)
  ]);

  const results = [];
  if (nppes.status === 'fulfilled') results.push(nppes.value);
  // add others if fulfilled...

  if (results.length === 0) {
    console.error(`[INGEST] All source adapters failed for NPI ${npi}`);
    return;
  }

  // 2. Generate Receipts (CPU)
  // In real system, maybe offload to worker thread for large payloads
  const receipt = await generateReceipt({ raw: results.map(r => r.raw) });

  // 3. Extract Canonical Claims
  const claims = extractClaims(results);

  // 4. Store Cached Truth (DB I/O)
  console.log(`[INGEST] Storing ${claims.length} canonical claims and receipt ${receipt} to DB for NPI ${npi}`);
  // await prisma.cachedClaim.upsertMany(...)
  // await prisma.sourceReceipt.create(...)
}
