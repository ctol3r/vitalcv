import { PrismaClient } from '@prisma/client';
import { Agent } from './types.js';
import { upsertTags } from './utils.js';

const prisma = new PrismaClient();

export const ClinicianAgent: Agent = {
  name: 'ClinicianAgent',
  async run({ npi }) {
    const claim = await prisma.npiClaim.findUnique({ where: { npi } });
    if (!claim) return { notes: ['no claim'] };

    const notes: string[] = [];
    const patch: Record<string, string[]> = {};

    if (claim.level < 1) {
      patch.nextAction = ['sendOTP'];
      notes.push('Prompt: complete Level 1');
    } else if (claim.level === 1) {
      patch.nextAction = ['uploadDocs'];
      notes.push('Prompt: proceed to Level 2');
    } else if (claim.level === 2) {
      patch.nextAction = ['requestAttestation'];
      notes.push('Prompt: request L3');
    } else {
      patch.nextAction = ['none'];
      notes.push('Fully verified (L3)');
    }

    const tags = await upsertTags(npi, patch);
    return { tags, notes };
  },
};
