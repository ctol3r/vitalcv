import { anchorPendingEvents } from '../services/ledger/merkleBatcher';
import { assertHashOnlyAnchor, PhiOnChainError } from '@vitalcv/poe-engine';
import { log } from '../obs/logger';

const ANCHOR_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runAnchorCycle(): Promise<void> {
  try {
    const result = await anchorPendingEvents();

    if (result) {
      // M4-1: fail closed before anything crosses the on-chain boundary. Only a
      // bare Merkle-root hash may be anchored — never a PHI/PII-bearing payload.
      try {
        assertHashOnlyAnchor(result.merkleRoot);
      } catch (guardErr) {
        if (guardErr instanceof PhiOnChainError) {
          log('error', '[AUDIT SCRAPBOOK] Anchor BLOCKED — zero-PHI-on-chain guard', {
            reason: guardErr.reason,
          });
          return; // never anchor a non-hash payload
        }
        throw guardErr;
      }

      log('info', `[AUDIT SCRAPBOOK] Anchored ${result.eventCount} events. Merkle Root: 0x${result.merkleRoot}`);

      // Simulate writing the root to a Substrate / public ledger.
      // In production this would be an on-chain extrinsic call.
      log('info', '[AUDIT SCRAPBOOK] Simulated ledger write', {
        root: `0x${result.merkleRoot.slice(0, 16)}`,
        block: Math.floor(Date.now() / 1000),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', `[AUDIT SCRAPBOOK] Anchor cycle failed: ${message}`);
  }
}

export function startAnchorWorker(): void {
  if (intervalHandle) {
    return;
  }

  log('info', `[AUDIT SCRAPBOOK] Worker started — anchoring every ${ANCHOR_INTERVAL_MS / 1000}s`);

  // Run immediately on boot, then on interval.
  void runAnchorCycle();
  intervalHandle = setInterval(() => void runAnchorCycle(), ANCHOR_INTERVAL_MS);
}

export function stopAnchorWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    log('info', '[AUDIT SCRAPBOOK] Worker stopped');
  }
}
