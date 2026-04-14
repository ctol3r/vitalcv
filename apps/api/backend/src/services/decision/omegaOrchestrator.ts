import prisma from '../../graphql/prisma_client';
import { buildPassportDataByNpi } from '../passport/npiPassportContract';

/**
 * The Omega Orchestrator
 *
 * Implements the core VitalCV Algorithm Canon: Start = Recognition + Acceptance
 *
 * This is a thin layer governing the boundaries between the objective trust network
 * (Recognition) and the subjective employer decision (Acceptance), culminating in a
 * material hiring event (Start).
 */
export class OmegaOrchestrator {
  /**
   * Evaluates Recognition (Trust Engine snapshot) + Acceptance (Employer Action)
   * to potentially mint a new Start.
   */
  static async evaluateAction(
    npi: string,
    employerId: string,
    action: 'accept' | 'request_data' | 'flag',
    comment?: string,
  ) {
    // 1. The Recognition Layer: Retrieve the objective state of the network.
    const recognition = await buildPassportDataByNpi(npi);
    if (!recognition) throw new Error('Recognition layer failed: Passport missing');

    // 2. The Acceptance Layer: Materialize the subjective employer action.
    const acceptance = await prisma.employerAcceptance.create({
      data: {
        employerId,
        clinicianNpi: npi,
        status: action.toUpperCase(),
        acceptedAt: new Date(),
        metadata: {
          decisionPosture: recognition.decisionPosture,
          comment: comment || null,
        },
      },
    });

    // 3. The Start Layer: Mint a formal start attestation if accepted.
    if (action === 'accept') {
      await prisma.startAttestation.create({
        data: {
          acceptanceId: acceptance.id,
          startedAt: new Date(),
          role: 'CLINICIAN', // Replace with actual context later
          metadata: {
            recognitionSnapshot: recognition.truth,
          },
        },
      });

      return { startCreated: true, acceptanceId: acceptance.id };
    }

    return { startCreated: false, acceptanceId: acceptance.id };
  }
}