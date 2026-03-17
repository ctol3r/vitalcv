export function isAutomatedTestRuntime(): boolean {
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  return nodeEnv === 'test' || typeof process.env.JEST_WORKER_ID === 'string';
}
