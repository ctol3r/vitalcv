// packages/command-registry/src/index.ts

import { z } from 'zod';

/**
 * Command Registry - single source of truth for command palette.
 *
 * Export this package to frontend and backend as a monorepo shared lib.
 */

// --- Param schemas

export const Params = {
  npi: z.object({ npi: z.string().length(10) }),
  claimId: z.object({ claimId: z.string() }),
  jobQuery: z.object({ specialty: z.string().optional(), loc: z.string().optional() }),
  genericText: z.object({ text: z.string().min(1) }),
};

// --- Types

export type CommandId =
  | 'npi.validate'
  | 'claim.new'
  | 'claim.resume'
  | 'issue.vc'
  | 'revoke.vc'
  | 'link.linkedin'
  | 'match.jobs'
  | 'ai.explain'
  | 'metrics.slo'
  | 'agent.autotag'
  | 'dev.pr.create';

export type CommandDef = {
  id: CommandId;
  title: string;
  description: string;
  usage?: string;
  paramsSchema?: z.ZodTypeAny;
  rolesAllowed?: string[]; // e.g., ["admin","verifier","clinician"]
  preview?: (params: any) => string;
};

// --- Registry

export const COMMANDS: CommandDef[] = [
  {
    id: 'npi.validate',
    title: 'Validate NPI',
    description: 'Validate NPI format and query NPPES.',
    usage: '/npi validate <npi>',
    paramsSchema: Params.npi,
    rolesAllowed: ['clinician', 'verifier', 'admin'],
    preview: (p: any) => `Lookup provider for NPI ${p.npi}`,
  },
  {
    id: 'claim.new',
    title: 'Start Claim Wizard',
    description: 'Open the Claim Wizard and prefill with context if provided.',
    usage: '/claim new',
    rolesAllowed: ['clinician'],
  },
  {
    id: 'claim.resume',
    title: 'Resume Claim',
    description: 'Resume an incomplete NPI claim at current level.',
    usage: '/claim resume <claimId>',
    paramsSchema: Params.claimId,
    rolesAllowed: ['clinician'],
    preview: (p: any) => `Resume claim ${p.claimId}`,
  },
  {
    id: 'issue.vc',
    title: 'Issue Verifiable Credential',
    description: 'Trigger VC issuance for a given template and subject.',
    usage: '/issue-vc template:<id> to:npi:<npi>',
    paramsSchema: z.object({ template: z.string(), toNPI: z.string() }),
    rolesAllowed: ['issuer', 'admin'],
    preview: (p: any) => `Issue ${p.template} to NPI ${p.toNPI}`,
  },
  {
    id: 'revoke.vc',
    title: 'Revoke Credential',
    description: 'Revoke a previously issued verifiable credential.',
    usage: '/revoke vc:<hash> reason:<text>',
    paramsSchema: z.object({ vcHash: z.string(), reason: z.string().optional() }),
    rolesAllowed: ['issuer', 'admin'],
    preview: (p: any) => `Revoke credential ${p.vcHash}`,
  },
  {
    id: 'link.linkedin',
    title: 'Link LinkedIn Profile',
    description: "Associate a clinician's LinkedIn profile with their NPI.",
    usage: '/link linkedin <url> npi:<npi>',
    paramsSchema: z.object({ url: z.string().url(), npi: z.string().length(10) }),
    rolesAllowed: ['clinician', 'admin'],
  },
  {
    id: 'match.jobs',
    title: 'Find Job Matches',
    description: 'Search for job opportunities matching credentials.',
    usage: '/match jobs specialty:<specialty> loc:<location>',
    paramsSchema: Params.jobQuery,
    rolesAllowed: ['clinician'],
    preview: (p: any) =>
      `Search jobs${p.specialty ? ` for ${p.specialty}` : ''}${p.loc ? ` in ${p.loc}` : ''}`,
  },
  {
    id: 'ai.explain',
    title: 'AI: Explain',
    description: 'Explain a claim, metric, or process in plain language.',
    usage: '/ai:explain claim <id>',
    paramsSchema: z.object({ subjectType: z.string(), subjectId: z.string() }),
    rolesAllowed: ['clinician', 'verifier', 'admin'],
    preview: (p: any) => `Explain ${p.subjectType} ${p.subjectId}`,
  },
  {
    id: 'metrics.slo',
    title: 'View SLO Metrics',
    description: 'Display service level objective metrics and health.',
    usage: '/metrics slo',
    rolesAllowed: ['admin', 'issuer', 'verifier'],
  },
  {
    id: 'agent.autotag',
    title: 'Trigger Auto-Tagging',
    description: 'Manually trigger the auto-tagging agent for an NPI.',
    usage: '/agent autotag npi:<npi>',
    paramsSchema: Params.npi,
    rolesAllowed: ['admin'],
    preview: (p: any) => `Run auto-tagger for NPI ${p.npi}`,
  },
  {
    id: 'dev.pr.create',
    title: 'Create Pull Request',
    description: 'Generate a PR template (development only).',
    usage: '/dev pr create',
    rolesAllowed: ['admin'],
  },
];

// --- Helpers

export function findCommands(query: string): CommandDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMANDS;

  return COMMANDS.filter(
    (c) =>
      c.id.includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q),
  );
}

export function getCommand(id: CommandId): CommandDef | undefined {
  return COMMANDS.find((c) => c.id === id);
}

export function validateParams(
  commandId: CommandId,
  params: any,
): { valid: boolean; data?: any; error?: string } {
  const cmd = getCommand(commandId);
  if (!cmd || !cmd.paramsSchema) {
    return { valid: true, data: params };
  }

  try {
    const parsed = cmd.paramsSchema.parse(params);
    return { valid: true, data: parsed };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

export function filterByRole(userRoles: string[]): CommandDef[] {
  return COMMANDS.filter((cmd) => {
    if (!cmd.rolesAllowed) return true;
    return cmd.rolesAllowed.some((role) => userRoles.includes(role));
  });
}
