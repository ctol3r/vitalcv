import { PrismaClient } from '@prisma/client';
import { Agent } from './types.js';
import { upsertTags } from './utils.js';

const prisma = new PrismaClient();

export const AutoTagger: Agent = {
  name: 'AutoTagger',
  async run({ npi }) {
    const claim = await prisma.npiClaim.findUnique({ where: { npi } });
    if (!claim) return { notes: ['no claim row'] };

    const patch: Record<string, string[]> = {};

    // userGroup
    patch.userGroup = ['clinician']; // default; could switch to 'organization' for NPI-2 if needed by lookup cache

    // verification level
    patch.level = [`L${claim.level}`];

    // signals
    const evidence = claim.evidence as any;
    if (evidence?.identityConfidence && evidence.identityConfidence >= 90) {
      patch.signals = ['highIdentityConfidence'];
    }

    // specialty/taxonomy (if cached from NPPES lookup)
    // npi:<npi> cache contains transformed record; try to read taxonomyCode
    // injected via /api/npi/lookup; safe best-effort
    if (evidence?.specialty) {
      patch.specialty = Array.isArray(evidence.specialty)
        ? evidence.specialty
        : [evidence.specialty];
    }

    const tags = await upsertTags(npi, patch);
    return { tags, notes: ['auto-tag completed'] };
  },
};
