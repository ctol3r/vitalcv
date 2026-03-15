process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DISABLE_BACKGROUND_JOBS = process.env.DISABLE_BACKGROUND_JOBS ?? '1';

function writeJson(stream: NodeJS.WriteStream, payload: Record<string, unknown>): void {
  stream.write(`${JSON.stringify(payload)}\n`);
}

async function main(): Promise<number> {
  const { loadEnv } = await import('../config/env');
  loadEnv();
  const { default: app } = await import('../app');
  const { runQaSweep, withEphemeralQaServer } = await import('./qaRuntime');

  const summary = await withEphemeralQaServer(app, async (baseUrl) =>
    runQaSweep({
      trigger: 'build',
      app,
      baseUrl,
      includeDynamicProbes: true,
      allowAutoFix: false,
    }),
  );

  const criticalCount =
    summary.qaFindings.filter((finding) => finding.severity === 'critical').length
    + summary.dataSanityFindings.filter((finding) => finding.severity === 'critical').length
    + summary.performanceFindings.filter((finding) => finding.severity === 'critical').length;

  writeJson(process.stdout, {
    trigger: summary.trigger,
    startedAt: summary.startedAt,
    completedAt: summary.completedAt,
    qaFindings: summary.qaFindings.length,
    dataSanityFindings: summary.dataSanityFindings.length,
    performanceFindings: summary.performanceFindings.length,
    autoFixActions: summary.autoFixActions.length,
    criticalCount,
  });

  if (process.env.QA_FAIL_ON_CRITICAL === '1' && criticalCount > 0) {
    return 1;
  }

  return 0;
}

void main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    writeJson(process.stderr, {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
