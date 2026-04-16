export const REQUIRES_REAL_EXECUTION = 'REQUIRES_REAL_EXECUTION' as const;

export interface ExecutionIntegrityContext {
  executionTag?: typeof REQUIRES_REAL_EXECUTION;
  requiresExecution?: boolean;
  outputIsSimulated?: boolean;
  operation?: string;
}

const TRUTHY_FLAG_RE = /^(1|true|yes|on)$/i;

function readBooleanFlag(value: string | undefined): boolean {
  return typeof value === 'string' && TRUTHY_FLAG_RE.test(value.trim());
}

export function detectSimulatedExecution(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    readBooleanFlag(env.SIMULATED_EXECUTION)
    || readBooleanFlag(env.OUTPUT_IS_SIMULATED)
    || readBooleanFlag(env.DRY_RUN)
    || readBooleanFlag(env.MOCK_EXECUTION)
  );
}

export function buildRealExecutionContext(
  context: Partial<ExecutionIntegrityContext> = {},
): ExecutionIntegrityContext {
  return {
    executionTag: REQUIRES_REAL_EXECUTION,
    requiresExecution: true,
    outputIsSimulated: detectSimulatedExecution(),
    operation: 'unknown',
    ...context,
  };
}

export function requireRealExecution(context: ExecutionIntegrityContext): void {
  const requiresExecution =
    context.requiresExecution ?? context.executionTag === REQUIRES_REAL_EXECUTION;

  if (requiresExecution && context.outputIsSimulated) {
    throw new Error('Execution integrity violation');
  }
}
