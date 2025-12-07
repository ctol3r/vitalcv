import { librarianSelect } from './librarian';
import { executeMcp } from './executeMcp';
import { McpManifestT } from './types';

export type PlanStep = {
  name: string;
  manifest: McpManifestT;
};

/**
 * Plan and execute multiple MCPs for a complex task
 * Retrieves up to 3 relevant MCPs and runs them sequentially, merging context
 */
export async function planAndExecute(
  task: string,
  input: any,
  scopes: string[] = []
): Promise<{ plan: PlanStep[]; output: any }> {
  // Retrieve best candidates for the current task
  const picks = await librarianSelect(task, scopes, 3);

  // Build execution plan
  const plan: PlanStep[] = picks.map((p) => ({
    name: p.name,
    manifest: p.manifest,
  }));

  // Execute MCPs sequentially, merging context between steps
  let ctx = { ...input };

  for (const step of plan) {
    try {
      const result = await executeMcp(step.manifest, ctx);

      if (result.success) {
        // Merge successful outputs into context
        ctx = { ...ctx, ...result.output };
      } else {
        // On failure, log but continue with existing context
        console.warn(`[Planner] Step ${step.name} failed:`, result.error);
      }
    } catch (error: any) {
      console.error(`[Planner] Error executing ${step.name}:`, error.message);
      // Continue with remaining steps
    }
  }

  return { plan, output: ctx };
}

/**
 * Naive task decomposition - splits a complex task into subtasks
 * For more sophisticated planning, integrate with LLM-based task breakdown
 */
export function decomposeTask(task: string): string[] {
  // Simple heuristic: split on common separators
  const separators = [' then ', ' and ', ', ', ' -> '];

  for (const sep of separators) {
    if (task.includes(sep)) {
      return task.split(sep).map(s => s.trim());
    }
  }

  // Single task
  return [task];
}

/**
 * Multi-task planner: decomposes complex tasks and plans each subtask
 */
export async function planMultiTask(
  task: string,
  input: any,
  scopes: string[] = []
): Promise<{ plan: PlanStep[]; output: any }> {
  const subtasks = decomposeTask(task);

  if (subtasks.length === 1) {
    // Single task - use normal planner
    return planAndExecute(task, input, scopes);
  }

  // Execute subtasks sequentially
  let ctx = { ...input };
  const fullPlan: PlanStep[] = [];

  for (const subtask of subtasks) {
    const { plan, output } = await planAndExecute(subtask, ctx, scopes);
    fullPlan.push(...plan);
    ctx = output;
  }

  return { plan: fullPlan, output: ctx };
}

