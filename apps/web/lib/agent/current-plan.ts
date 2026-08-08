/**
 * The one way a route obtains a plan: rebuild the canonical context and
 * regenerate it server-side.
 *
 * Both the consent route and the execute route need "the plan as it is right
 * now", and both must refuse to treat anything a client sent as a plan. This
 * helper is that single path, so the two surfaces cannot drift into
 * different notions of "current".
 */
import 'server-only';
import { assembleStartAgentContext } from './context-assembler';
import { generateStartPlanV2 } from './policy/start-policy-v2';
import { buildProductionReaders } from './server-readers';
import { buildStartAgentTools } from './tools/canonical-tools';
import { createToolRegistry, type ToolRegistry } from './tools/registry';
import type { StartAgentContext, StartPlan } from './types';

export interface CurrentPlan {
  plan: StartPlan;
  context: StartAgentContext;
  registry: ToolRegistry;
  inputGaps: string[];
}

export async function buildCurrentPlan(options: {
  subjectRef: string;
  npi?: string;
  contextClass: string;
  now?: string;
}): Promise<CurrentPlan> {
  const registry = createToolRegistry(buildStartAgentTools(buildProductionReaders(options.subjectRef)));
  const { context, inputGaps } = await assembleStartAgentContext({
    subject: { profileRef: options.subjectRef, ...(options.npi ? { npi: options.npi } : {}) },
    contextClass: options.contextClass,
    now: options.now ?? new Date().toISOString(),
    registry,
  });
  const plan = generateStartPlanV2(context, { now: context.collectedAt });
  return { plan, context, registry, inputGaps };
}
