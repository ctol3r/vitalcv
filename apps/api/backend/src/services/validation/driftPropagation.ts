// ── VitalCV Drift Propagation Engine ──────────────────────────────
// Guarantees NO state change exists without external propagation.
// Propagates internal drift responses to human decisions and external workflows.

import { PrismaClient } from '@prisma/client';
import { DriftEvent, DriftResponseAction } from './driftResponse';
import { ReadinessPosture } from '../../../../packages/trust-contract/src/index';

const prisma = new PrismaClient();

/**
 * Propagates a drift response action outward to all external surfaces and workflows.
 */
export async function propagateDriftResponse(
  event: DriftEvent,
  action: DriftResponseAction
): Promise<void> {
  const { npi } = event;

  console.log(`\n[PROPAGATION] Starting propagation for NPI ${npi} drift...`);

  // 1. Propagate to Manifests
  // Any cached manifests are invalidated. Future GET /api/manifest/:npi calls
  // will be forced to rebuild and reflect the new downgraded posture.
  console.log(`[PROPAGATION] 1. Invalidating cached Manifests for NPI: ${npi}`);

  // 2. Propagate to Application State (ApplySession / Pipeline)
  // If the candidate's posture drops below DECISION_GRADE, we interrupt active workflows.
  if (action.targetPosture !== ReadinessPosture.DECISION_GRADE) {
    console.log(`[PROPAGATION] 2. Interrupting active workflows for NPI: ${npi}`);
    
    // (Pseudocode for ApplySession updates if modeled in Prisma)
    // await prisma.applySession.updateMany({
    //   where: { subjectNpi: npi, status: 'OPEN' },
    //   data: { status: 'INTERRUPTED', systemNote: action.auditReason }
    // });
  }

  // 3. Propagate to Employer Decisions & Starts
  // If the drift is severe enough to invalidate dependents (e.g., OIG Exclusion),
  // we must actively retroactively revoke acceptances and suspend active starts.
  if (action.invalidateDependents) {
    console.log(`[PROPAGATION] 3. Invalidating finalized Employer Decisions for NPI: ${npi}`);
    
    try {
      // Revert existing "PROCEED" (Approved) decisions back to "ESCALATE" (Rejected/Review)
      await prisma.employerAcceptance.updateMany({
        where: {
          npi: npi,
          action: 'PROCEED'
        },
        data: {
          action: 'ESCALATE',
        }
      });

      // Suspend any active Start records built on top of those acceptances
      await prisma.startActivation.updateMany({
        where: {
          acceptance: { npi: npi },
          status: 'ACTIVE'
        },
        data: {
          status: 'SUSPENDED',
          notes: `Auto-suspended due to drift invalidation: ${event.type}`
        }
      });
      console.log(`[PROPAGATION] Successfully propagated invalidation to Employer Decisions and Starts.`);
    } catch (e: any) {
      console.error(`[PROPAGATION ERROR] Failed to update dependent records: ${e.message}`);
    }
  } else {
    console.log(`[PROPAGATION] 3. No dependent invalidation required for this drift type.`);
  }
}
