import { PrismaClient } from '@prisma/client';
import { didMethodMapper } from './method-mapper';
import { consistencyEngine } from './consistency';
import { walletSyncFlow } from './wallet-sync';
import { conflictResolver } from './conflict-resolver';
import { historyViewer } from './history';
import { downgradeAlert } from './downgrade-alert';
import { backupRestore } from './backup-restore';
import { anchorDidSync } from './anchor';

const prisma = new PrismaClient();

export async function getDidSync(clinicianId: string) {
  const existing = await prisma.multiDIDSynchronizer.findUnique({
    where: { clinicianId },
  });

  if (existing) {
    return { id: existing.id, dids: existing.dids };
  }

  const created = await prisma.multiDIDSynchronizer.create({
    data: {
      clinicianId,
      dids: {},
    },
  });

  return { id: created.id, dids: created.dids };
}

export async function mapDidMethod(did: string) {
  return didMethodMapper(did);
}

export async function checkConsistency(clinicianId: string) {
  return consistencyEngine(clinicianId);
}

export async function syncWalletDids(clinicianId: string, primaryDid: string) {
  return walletSyncFlow(clinicianId, primaryDid);
}

export async function resolveConflict(clinicianId: string, didA: string, didB: string) {
  return conflictResolver(clinicianId, didA, didB);
}

export async function viewDidHistory(clinicianId: string) {
  return historyViewer(clinicianId);
}

export async function checkDowngradeRisk(clinicianId: string) {
  return downgradeAlert(clinicianId);
}

export async function createBackupPack(clinicianId: string) {
  return backupRestore.create(clinicianId);
}

export async function restoreFromBackup(clinicianId: string, backupId: string) {
  return backupRestore.restore(clinicianId, backupId);
}

export async function anchorDidSyncSnapshot(clinicianId: string) {
  const sync = await prisma.multiDIDSynchronizer.findUnique({
    where: { clinicianId },
  });

  if (!sync) {
    throw new Error(`DID sync for clinician ${clinicianId} not found`);
  }

  return anchorDidSync(sync);
}

export {
  didMethodMapper,
  consistencyEngine,
  walletSyncFlow,
  conflictResolver,
  historyViewer,
  downgradeAlert,
  backupRestore,
  anchorDidSync,
};








