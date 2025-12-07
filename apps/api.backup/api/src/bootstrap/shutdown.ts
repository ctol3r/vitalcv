import type { Server } from 'http';
import type { PrismaClient } from '@prisma/client';
import type { RedisClientType } from 'redis';
import { createLogger, serializeError } from '@chai-vc/logging-core';

const shutdownLogger = createLogger({
  service: process.env.SERVICE_NAME || 'evidence-registry-api',
}).child({ defaultFields: { scope: 'shutdown' } });

export interface ShutdownTask {
  name: string;
  close: () => Promise<void> | void;
}

export interface ShutdownOptions {
  prisma?: PrismaClient;
  httpServer?: Server;
  redisClients?: Array<RedisClientType | null | undefined>;
  tasks?: ShutdownTask[];
  signals?: NodeJS.Signals[];
  timeoutMs?: number;
}

export function registerShutdownHooks(options: ShutdownOptions): void {
  const signals = options.signals ?? ['SIGINT', 'SIGTERM'];
  const timeoutMs = options.timeoutMs ?? 10_000;
  const resourceTasks = buildTasks(options);

  let shuttingDown = false;

  const handleSignal = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    shutdownLogger.info('Received shutdown signal', { signal });

    const timeout = setTimeout(() => {
      shutdownLogger.error('Forced shutdown after timeout', { timeoutMs });
      process.exit(1);
    }, timeoutMs);

    executeTasks(resourceTasks)
      .then((hadError) => {
        clearTimeout(timeout);
        if (hadError) {
          shutdownLogger.error('Shutdown completed with errors');
          process.exit(1);
        } else {
          shutdownLogger.info('Shutdown completed cleanly');
          process.exit(0);
        }
      })
      .catch((error) => {
        clearTimeout(timeout);
        shutdownLogger.error('Unexpected shutdown error', { error: serializeError(error) });
        process.exit(1);
      });
  };

  for (const signal of signals) {
    process.on(signal, handleSignal);
  }
}

function buildTasks(options: ShutdownOptions): ShutdownTask[] {
  const tasks: ShutdownTask[] = [];

  if (options.httpServer) {
    tasks.push({
      name: 'http-server',
      close: () =>
        new Promise<void>((resolve, reject) => {
          options.httpServer?.close((error) => {
            if (error) {
              return reject(error);
            }
            resolve();
          });
        }),
    });
  }

  if (options.prisma) {
    tasks.push({
      name: 'prisma',
      close: () => options.prisma?.$disconnect(),
    });
  }

  if (options.redisClients?.length) {
    options.redisClients.forEach((client, index) => {
      if (!client) {
        return;
      }
      tasks.push({
        name: `redis:${index}`,
        close: () => client.quit(),
      });
    });
  }

  if (options.tasks?.length) {
    tasks.push(...options.tasks);
  }

  return tasks;
}

async function executeTasks(tasks: ShutdownTask[]): Promise<boolean> {
  let hadError = false;

  for (const task of tasks) {
    try {
      await task.close();
      shutdownLogger.info('Closed resource', { resource: task.name });
    } catch (error) {
      hadError = true;
      shutdownLogger.error('Failed to close resource', {
        resource: task.name,
        error: serializeError(error),
      });
    }
  }

  return hadError;
}

