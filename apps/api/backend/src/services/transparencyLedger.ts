import type { Prisma } from '@prisma/client';
import { appendTransparencyEntry } from './transparencyLog';
import { isStrictTransitionMode } from '../utils/environment';
import { normalizeLifecycleState } from '../utils/lifecycleState';

type ArtifactSnapshotInput = {
  id: string;
  checksum: string;
  merkleRoot: string | null;
  lifecycleState: string;
  organizationId?: string | null;
};

type AppendOptions = {
  strict?: boolean;
  tx?: Prisma.TransactionClient;
};

function normalizeOrganizationId(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? null;
  return normalized !== null && normalized.length > 0 ? normalized : null;
}

function buildTransparencyInput(snapshot: ArtifactSnapshotInput) {
  return {
    id: snapshot.id,
    checksum: snapshot.checksum,
    merkleRoot: snapshot.merkleRoot,
    lifecycleState: snapshot.lifecycleState,
    organizationId: normalizeOrganizationId(snapshot.organizationId),
  };
}

function isStrictMode(rawStrict: boolean | undefined): boolean {
  if (rawStrict !== undefined) {
    return rawStrict;
  }
  return isStrictTransitionMode();
}

export async function appendArtifactLifecycleEntry(
  snapshot: ArtifactSnapshotInput,
  options: AppendOptions = {},
): Promise<void> {
  const strictMode = isStrictMode(options.strict);

  const input = buildTransparencyInput(snapshot);
  const normalizedLifecycle = normalizeLifecycleState(snapshot.lifecycleState);

  if (strictMode) {
    if (!input.id.trim() || !input.checksum.trim() || !input.merkleRoot?.trim() || !normalizedLifecycle) {
      throw new Error('Cannot append transparent lifecycle entry with incomplete artifact data.');
    }

    await appendTransparencyEntry(
      {
        id: input.id,
        checksum: input.checksum,
        merkleRoot: input.merkleRoot,
        lifecycleState: snapshot.lifecycleState,
        organizationId: input.organizationId,
      },
      options.tx,
    );
    return;
  }

  try {
    await appendTransparencyEntry(
      {
        id: input.id,
        checksum: input.checksum,
        merkleRoot: input.merkleRoot,
        lifecycleState: snapshot.lifecycleState,
        organizationId: input.organizationId,
      },
      options.tx,
    );
  } catch {
    return;
  }
}
