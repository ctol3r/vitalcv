import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { setRevoked } from '../ledger/statusListManager';

export class GraphCascader {
  /**
   * Collapses authority edges and updates status list when a clinician is revoked.
   * @param npi The clinician's NPI
   * @param source The source of the revocation
   */
  async revokeClinician(npi: string, source: string): Promise<number> {
    log('info', `[GraphCascader] Initiating instant revocation for clinician NPI: ${npi}`);
    let edgesRevoked = 0;

    // 1. Find the KnowledgeNode for the clinician
    const clinicianNodes = await prisma.knowledgeNode.findMany({
      where: {
        entityType: 'CLINICIAN',
      },
    });

    const matchedClinicianNodes = clinicianNodes.filter(node => {
      const attrs = node.attributes as any;
      return attrs && attrs.npi === npi;
    });

    let clinicianNodeIds = matchedClinicianNodes.map(n => n.id);

    // Fallback: look up Provider by NPI and find its corresponding node
    if (clinicianNodeIds.length === 0) {
      const provider = await prisma.provider.findUnique({ where: { npi } });
      if (provider) {
        const node = await prisma.knowledgeNode.findUnique({
          where: {
            entityType_entityId: {
              entityType: 'CLINICIAN',
              entityId: provider.id,
            },
          },
        });
        if (node) clinicianNodeIds.push(node.id);
      }
    }

    if (clinicianNodeIds.length === 0) {
      log('warn', `[GraphCascader] No KnowledgeNode found for clinician NPI: ${npi}`);
      return 0;
    }

    // 2. Transverse connected AuthorityEdges (e.g., ISSUED_TO, VERIFIED_BY, ATTESTED_BY)
    // We want to mark edges radiating from or to this clinician node related to trust as REVOKED.
    // Specifically, if a credential was issued to them, we revoke that credential's active status.
    for (const nodeId of clinicianNodeIds) {
      // Find all edges where target is this clinician (e.g., ISSUED_TO)
      const inEdges = await prisma.authorityEdge.findMany({
        where: { targetNodeId: nodeId, relationType: 'ISSUED_TO' },
      });

      for (const edge of inEdges) {
        // Mark edge metadata as revoked
        const currentMeta = (edge.metadata as any) || {};
        await prisma.authorityEdge.update({
          where: { id: edge.id },
          data: {
            metadata: {
              ...currentMeta,
              status: 'REVOKED',
              revokedAt: new Date().toISOString(),
              revocationSource: source,
            },
            weight: 0.0, // Trust goes to 0
          },
        });
        edgesRevoked++;

        // 3. Update the Credential / Artifact directly
        const credentialNode = await prisma.knowledgeNode.findUnique({
          where: { id: edge.sourceNodeId },
        });

        if (credentialNode && credentialNode.entityType === 'CREDENTIAL') {
           const artifactId = credentialNode.entityId;
           // Update VerificationArtifact
           try {
             await prisma.verificationArtifact.updateMany({
               where: { id: artifactId },
               data: {
                 lifecycleState: 'revoked',
                 revokedAt: new Date(),
                 revocationReason: `Automated revocation via continuous monitoring (${source})`,
                 trustState: 'revoked',
               }
             });

             // 4. Flip the artifact's bit in the Bitstring Status List so the
             //    revocation is visible to verifiers. setRevoked() decodes the
             //    list, sets the bit, re-encodes, bumps the version (which
             //    busts both the ETag and the in-memory cache), and assigns an
             //    index first if this artifact predates status-list
             //    integration. It is idempotent on an already-set bit.
             await setRevoked(artifactId);
           } catch (err) {
             log('error', `[GraphCascader] Error updating verification artifact ${artifactId}`, { error: err });
           }
        }
      }
    }

    log('info', `[GraphCascader] Revocation complete for NPI: ${npi}. Edges collapsed: ${edgesRevoked}`);
    return edgesRevoked;
  }

  // setRevocationBit() was removed in favour of delegating to
  // statusListManager.setRevoked(). It only incremented the version to bust
  // verifier caches and never decoded, set, or re-encoded the bitstring, so a
  // cascaded revocation still read "not revoked" to every verifier.
}

export const graphCascader = new GraphCascader();
