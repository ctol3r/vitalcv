import { PrismaClient } from '@prisma/client';
import { Agent } from './types.js';

const prisma = new PrismaClient();

export const IssuerAgent: Agent = {
  name: 'IssuerAgent',
  async run({ npi }) {
    const claim = await prisma.npiClaim.findUnique({ where: { npi } });
    if (!claim) return { notes: ['no claim'] };
    if (claim.level < 2) return { notes: ['hold: identity not verified (L2 required)'] };
    return { notes: ['readyForIssuerReview'] };
  },
};
