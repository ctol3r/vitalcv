import { z, ZodTypeAny } from "zod";

export interface CommandDefinition<TSchema extends ZodTypeAny = ZodTypeAny> {
  id: string;
  title: string;
  description?: string;
  rolesAllowed?: string[];
  paramsSchema?: TSchema;
}

const npiValidateSchema = z.object({
  npi: z
    .string()
    .regex(/^[12]\d{9}$/u, "NPI must be a 10-digit number starting with 1 or 2"),
});

const aiExplainSchema = z.object({
  subjectType: z.string().min(1, "subjectType is required"),
  subjectId: z.string().optional().default(""),
});

export const COMMANDS: CommandDefinition[] = [
  {
    id: "npi.validate",
    title: "Validate NPI",
    description: "Validate an NPI against internal or NPPES sources.",
    rolesAllowed: ["clinician", "admin"],
    paramsSchema: npiValidateSchema,
  },
  {
    id: "claim.new",
    title: "Start Claim",
    description: "Create a new pre-populated claim shell for later completion.",
    rolesAllowed: ["clinician", "admin"],
  },
  {
    id: "ai.explain",
    title: "Explain Subject",
    description: "Generate an AI explanation for a claim, credential, or other entity.",
    rolesAllowed: ["clinician", "compliance", "admin"],
    paramsSchema: aiExplainSchema,
  },
];

export type CommandId = (typeof COMMANDS)[number]["id"];

