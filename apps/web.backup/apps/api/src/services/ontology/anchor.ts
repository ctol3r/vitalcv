import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';
import type { GlobalClinicianOntology } from '@prisma/client';

/**
 * Anchor ontology version snapshot
 */
export function anchorOntologySnapshot(ontology: GlobalClinicianOntology) {
  const ontologyHash = createHash('sha256')
    .update(JSON.stringify(ontology.ontology))
    .digest('hex');

  return anchorEvent('ontologyAnchored', {
    ontologyId: ontology.id,
    version: ontology.version,
    ontologyHash,
    snapshotAt: ontology.updatedAt.toISOString(),
  });
}








