import { PrismaClient } from '@prisma/client';
import { Agent } from './types.js';

const prisma = new PrismaClient();

export const VerifierAgent: Agent = {
  name: 'VerifierAgent',
  async run({ npi }) {
    // Look for pending attestation requests (if AttestationRequest model exists)
    // For now, check audit events for attestation requests
    const pendingEvents = await prisma.auditEvent.findMany({
      where: {
        type: 'ATTEST_REQUESTED',
        subjectNpi: npi,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const pendingCount = pendingEvents.length;
    return { notes: [`pendingRequests=${pendingCount}`] };
  },
};
