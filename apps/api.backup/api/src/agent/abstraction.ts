import OpenAI from "openai";
import { McpManifest } from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

/**
 * Abstract a successful task trace into a reusable MCP tool
 * Uses LLM to generalize the trace into a structured workflow
 */
export async function abstractTraceToMcp(trace: any) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const sys = `You are a senior AI systems engineer. Generalize successful task traces into reusable tools (MCPs).

- Replace constants with inputs.
- Standardize to {name, description, inputs[], outputs[], steps[], scope, tags[]}.
- Steps should reference generic tools (ocr, parseResume, verifyLicense, npiLookup, boardCheck, matcher)
- Keep it short and executable by an agent orchestrator.
- Return ONLY valid JSON, no markdown or code blocks.`;

  const user = `Trace (JSON):
${JSON.stringify(trace, null, 2)}

Return ONLY a JSON object matching the MCP schema.`;

  const model = process.env.AGENT_MODEL || "gpt-4o-mini";

  const rsp = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.1,
  });

  const text = rsp.choices[0].message?.content || "{}";

  // Remove markdown code blocks if present
  const cleanedText = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const json = JSON.parse(cleanedText);
  return McpManifest.parse(json);
}

/**
 * Plan execution strategy for a given task
 * Returns which MCPs to use and in what order
 */
export async function planTaskExecution(
  task: string,
  availableMcps: any[],
  context: any = {}
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const sys = `You are an agent orchestrator. Given a task and available MCPs, create an execution plan.

Return a JSON object with:
- mcp_id: ID of the MCP to use
- parameters: Input parameters for the MCP
- reasoning: Why this MCP was chosen

If multiple MCPs are needed, return an array of plans.
Return ONLY valid JSON, no markdown.`;

  const user = `Task: ${task}

Available MCPs:
${JSON.stringify(availableMcps, null, 2)}

Context:
${JSON.stringify(context, null, 2)}

Create an execution plan.`;

  const model = process.env.AGENT_MODEL || "gpt-4o-mini";

  const rsp = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.2,
  });

  const text = rsp.choices[0].message?.content || "{}";
  const cleanedText = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return JSON.parse(cleanedText);
}

