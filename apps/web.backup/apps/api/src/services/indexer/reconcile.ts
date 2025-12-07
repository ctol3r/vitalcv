import { PrismaClient } from '@prisma/client';
import { buildMasterCredentialIndex } from './build-index';
import { diffIndexSnapshots, type IndexDiffResult } from './diff';
import type { IndexSnapshot } from './types';

const prisma = new PrismaClient();

export interface IndexReconciliationSummary {
  deleted: string[];
  inserted: string[];
  signatureUpdated: string[];
  issuerVersionChanged: string[];
}

export interface IndexReconcileResult {
  clinicianId: string;
  generatedAt: string;
  snapshot: IndexSnapshot;
  diff: IndexDiffResult;
  mismatches: IndexReconciliationSummary;
}

export async function reconcileMasterCredentialIndex(
  clinicianId: string,
  options: { prisma?: PrismaClient } = {},
): Promise<IndexReconcileResult> {
  if (!clinicianId) {
    throw new Error('clinicianId is required to reconcile the credential index');
  }

  const client = options.prisma ?? prisma;
  const previousRows = await client.masterCredentialIndex.findMany({
    where: { clinicianId },
  });

  const snapshot = await buildMasterCredentialIndex(clinicianId, { prisma: client });
  const diff = diffIndexSnapshots(clinicianId, previousRows, snapshot.rows);
  const mismatches = summarizeDiff(diff);

  return {
    clinicianId,
    generatedAt: snapshot.generatedAt,
    snapshot,
    diff,
    mismatches,
  };
}

function summarizeDiff(diff: IndexDiffResult): IndexReconciliationSummary {
  const deleted: string[] = [];
  const inserted: string[] = [];
  const signatureUpdated: string[] = [];
  const issuerVersionChanged: string[] = [];

  for (const entry of diff.diffs) {
    const key = `${entry.credentialType}:${entry.credentialId}`;
    for (const change of entry.changes) {
      if (change.field === 'presence') {
        if (change.previous === 'present' && change.next === 'absent') {
          deleted.push(key);
        } else if (change.previous === 'absent' && change.next === 'present') {
          inserted.push(key);
        }
      }
      if (change.field === 'lastUpdated') {
        signatureUpdated.push(key);
      }
      if (change.field === 'issuerDid') {
        issuerVersionChanged.push(key);
      }
    }
  }

  return {
    deleted,
    inserted,
    signatureUpdated,
    issuerVersionChanged,
  };
}



