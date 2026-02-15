import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as Sentry from '@sentry/node';
import { loadEnv } from './config/env';
import { initializeTelemetry, shutdownTelemetry } from './telemetry';
import { log } from './obs/logger';

const APP_READY_MESSAGE = 'Server ready';

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

  const productionDeployment = config.NODE_ENV === 'production';
  if (productionDeployment && !config.SYSTEM_FROZEN) {
    log('info', 'Applying Prisma migrations at startup', {
      event: 'migration_run',
      node_env: config.NODE_ENV,
    });
    runPrismaMigrateDeploy();
  } else {
    log('warn', 'Schema migrations skipped at startup', {
      event: 'migration_skip',
      reason: config.SYSTEM_FROZEN ? 'SYSTEM_FROZEN' : 'non_production',
      node_env: config.NODE_ENV,
    });
  }

  const { default: app } = await import('./app');
  initializeTelemetry('vitalcv-agent');

  // Initialize Sentry if DSN is configured
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: config.NODE_ENV,
      tracesSampleRate: config.NODE_ENV === 'production' ? 0.2 : 1.0,
    });
    log('info', 'Sentry initialized', {
      event: 'sentry_initialized',
      environment: config.NODE_ENV,
    });
  }

  app.listen(config.PORT, () => {
    if (config.SYSTEM_FROZEN) {
      log('warn', 'SYSTEM_FROZEN active: startup migration freeze is enabled', {
        event: 'startup_frozen',
        environment: config.NODE_ENV,
      });
    }
    log('info', APP_READY_MESSAGE, {
      event: 'server_started',
      url: `http://localhost:${config.PORT}`,
      environment: config.NODE_ENV,
      frozen: config.SYSTEM_FROZEN,
    });
  });
}

process.on('SIGTERM', () => {
  void shutdownTelemetry();
});

process.on('SIGINT', () => {
  void shutdownTelemetry();
});

main().catch((e) => {
  log('error', 'server startup failed', {
    event: 'server_startup_failed',
    error: e instanceof Error ? e.message : 'Unknown startup error',
    details: e instanceof Error ? e.stack : String(e),
  });
  process.exit(1);
});
