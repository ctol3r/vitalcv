// Command Registry - defines available commands for natural language processing
export interface Command {
  id: string;
  title: string;
  description?: string;
  rolesAllowed?: string[];
  paramsSchema?: any; // zod schema
}

export const COMMANDS: Command[] = [
  {
    id: "npi.validate",
    title: "Validate NPI",
    description: "Validate a National Provider Identifier",
    rolesAllowed: ["clinician", "admin"],
  },
  {
    id: "claim.new",
    title: "New Claim",
    description: "Start a new claim",
    rolesAllowed: ["clinician"],
  },
  {
    id: "ai.explain",
    title: "AI Explain",
    description: "Get AI explanation for a subject",
    rolesAllowed: ["clinician", "admin"],
  },
];
