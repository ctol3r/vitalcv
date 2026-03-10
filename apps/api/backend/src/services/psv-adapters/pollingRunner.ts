import { log } from '../../obs/logger';
import type { IPsvAdapter, PsvArtifact } from './types';

export function runPollingJob(
  adapter: IPsvAdapter,
  npis: string[],
  intervalMs: number,
  onArtifact: (artifact: PsvArtifact) => void,
): () => void {
  let stopped = false;
  let inFlight = false;

  const cycle = async (): Promise<void> => {
    if (stopped || inFlight) {
      return;
    }

    inFlight = true;

    try {
      await Promise.all(
        npis.map(async (npi) => {
          try {
            const artifact = await adapter.fetchArtifact(npi);
            onArtifact(artifact);
          } catch (error) {
            log('warn', 'psv_polling_job_npi_failed', {
              source: adapter.config.sourceId,
              npi,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }),
      );
    } finally {
      inFlight = false;
    }
  };

  void cycle();
  const intervalHandle = setInterval(() => void cycle(), intervalMs);

  return () => {
    stopped = true;
    clearInterval(intervalHandle);
  };
}
