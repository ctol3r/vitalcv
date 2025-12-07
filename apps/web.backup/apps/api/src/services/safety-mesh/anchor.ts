import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';
import type { SafetyComplianceMesh } from '@prisma/client';

/**
 * Anchor safety mesh snapshot
 */
export function anchorSafetyMesh(mesh: SafetyComplianceMesh) {
  const meshHash = createHash('sha256')
    .update(JSON.stringify(mesh.mesh))
    .digest('hex');

  return anchorEvent('safetyMeshAnchored', {
    meshId: mesh.id,
    meshHash,
    snapshotAt: mesh.updatedAt.toISOString(),
  });
}








