/**
 * Environment sanity checks for VitalCV.
 *
 * Goal: fail fast for demo/production runs when critical env is missing.
 *
 * Usage:
 *   pnpm check:env
 *   pnpm dev:local
 */

type Mode = 'dev' | 'demo' | 'production';

function parseMode(argv: string[]): Mode {
  const arg = argv.find((a) => a.startsWith('--mode='));
  const raw = arg ? arg.split('=')[1] : '';
  if (raw === 'dev' || raw === 'demo' || raw === 'production') return raw;
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  if (nodeEnv === 'production') return 'production';
  return 'dev';
}

function requiredForMode(mode: Mode): string[] {
  // Keep dev friction low; enforce stricter checks for demo/prod.
  if (mode === 'dev') return [];
  if (mode === 'demo') {
    return [
      // Frontend should point at a real reachable API in demo environments.
      'NEXT_PUBLIC_BACKEND_URL',
    ];
  }
  return [
    // Backend hardening
    'JWT_SECRET',
    'CORS_ORIGIN',
    'DEMO_SEED_TOKEN',
    // Frontend must point at the deployed API
    'NEXT_PUBLIC_BACKEND_URL',
  ];
}

function main() {
  const mode = parseMode(process.argv.slice(2));
  const required = requiredForMode(mode);
  const missing = required.filter((k) => !String(process.env[k] || '').trim());

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: missing.length === 0,
        mode,
        missing,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  if (missing.length) process.exit(1);
}

main();


