import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as Sentry from '@sentry/node';
import { loadEnv } from './config/env';
import app from './app';
import { initializeTelemetry, shutdownTelemetry } from './telemetry';

function resolvePrismaSchemaPath(): string {
  const override = process.env.PRISMA_SCHEMA_PATH;
  if (override) {
    const resolved = path.resolve(process.cwd(), override);
    if (fs.existsSync(resolved)) {
      return resolved;
    }

    throw new Error(`Specified PRISMA_SCHEMA_PATH does not exist: ${resolved}`);
  }

  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (true) {
    const localCandidate = path.resolve(currentDir, 'prisma', 'schema.prisma');
    const monorepoCandidate = path.resolve(currentDir, 'apps', 'api', 'backend', 'prisma', 'schema.prisma');

    if (fs.existsSync(localCandidate)) {
      return localCandidate;
    }

    if (fs.existsSync(monorepoCandidate)) {
      return monorepoCandidate;
    }

    if (currentDir === root) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
  if (fs.existsSync(schemaPath)) {
    return schemaPath;
  }

  throw new Error(`Prisma schema file not found. Expected apps/api/backend/prisma/schema.prisma.`);
}

function runPrismaMigrateDeploy(): void {
  const schemaPath = resolvePrismaSchemaPath();
  const migrationsDir = path.resolve(schemaPath, '..', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(
      `Missing Prisma migrations directory. Expected: ${path.relative(process.cwd(), migrationsDir)}`,
    );
  }

  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'migrate', 'deploy', '--schema', schemaPath],
    {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    },
  );

  if (result.error) {
    throw new Error(`Prisma migrate deploy failed to execute: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error('Prisma migrate deploy failed in production startup check.');
  }
}

async function main() {
  const config = loadEnv();

  if (config.NODE_ENV === 'production') {
    runPrismaMigrateDeploy();
  }

  initializeTelemetry('vitalcv-agent');

  // Initialize Sentry if DSN is configured
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: config.NODE_ENV,
      tracesSampleRate: config.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
    console.log('Sentry initialized');
  }

  app.listen(config.PORT, () => {
    console.log(`Server ready at http://localhost:${config.PORT} [${config.NODE_ENV}]`);
  });
}

process.on('SIGTERM', () => {
  void shutdownTelemetry();
});

process.on('SIGINT', () => {
  void shutdownTelemetry();
});

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
