import type { Express } from 'express';

const bootTime = Date.now();
let demoIssuances = 0;
let verifications = 0;

export function incrementDemoIssuance(): void {
  demoIssuances += 1;
}

export function incrementVerification(): void {
  verifications += 1;
}

export function registerPublicMetricsRoutes(app: Express): void {
  app.get('/metrics/public', (_req, res) => {
    const uptimeSeconds = Math.floor((Date.now() - bootTime) / 1000);

    res.json({
      status: 'operational',
      uptime_seconds: uptimeSeconds,
      demo_issuances: demoIssuances,
      verifications_performed: verifications,
      generated_at: new Date().toISOString(),
    });
  });
}
