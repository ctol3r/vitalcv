import cron from 'node-cron';
import { ChainClient } from '../services/chain/client';
import { statusListService } from '../services/status/statusList';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';

const chainClient = new ChainClient();
const log = getServiceLogger('api/workers/statuslist-refresh');

export async function runStatusListRefreshCycle(): Promise<void> {
  const expired = statusListService.expireEntries();
  if (expired > 0) {
    log.info('Expired credentials from status list', { expired });
  }

  const snapshot = statusListService.snapshot();

  await chainClient.commitBatchRoot({
    merkleRoot: snapshot.hash,
    entryCount: snapshot.length,
    entries: [
      {
        type: 'verification',
        hash: snapshot.hash,
        metadata: {
          listId: snapshot.listId,
          updatedAt: snapshot.updatedAt,
        },
      },
    ],
    committedAt: snapshot.updatedAt,
  });

  log.info('Anchored status list snapshot', {
    listId: snapshot.listId,
    hash: snapshot.hash,
    length: snapshot.length,
  });
}

export function startStatusListRefreshWorker(): void {
  const cronExpr = process.env.STATUSLIST_REFRESH_CRON || '0 */24 * * *';
  cron.schedule(cronExpr, () => {
    runStatusListRefreshCycle().catch((error) => {
      log.error('Status list refresh cycle failed', { error });
    });
  });
}

if (require.main === module) {
  log.info('Starting status list refresh worker');
  startStatusListRefreshWorker();
}










