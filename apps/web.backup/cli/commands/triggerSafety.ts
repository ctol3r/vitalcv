import { randomUUID } from 'node:crypto';
import { enqueueJob } from '../../services/queue/producer.js';
import type {
  DriftSourceEvent,
  FusionScoreEvent,
} from '../../services/safety/collectors/signalCollector.js';
import { parseArgs } from '../utils/args.js';
import { readJsonFile } from '../utils/io.js';

type JsonValue = Record<string, unknown> | Record<string, unknown>[] | null;

export async function triggerSafetySweep(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);
  const clinicianId = asString(flags.clinician ?? flags.c);

  if (!clinicianId) {
    throw new Error('Missing required flag --clinician <id>');
  }

  const sweepId = asString(flags['sweep-id']) ?? `cli-safety-${randomUUID()}`;
  const reason = asString(flags.reason) ?? 'Manual safety sweep triggered via CLI';

  const driftEvents = await loadEventFile<DriftSourceEvent>(asString(flags.drift));
  const fusionEvents = await loadEventFile<FusionScoreEvent>(asString(flags.fusion));

  if (driftEvents.length === 0) {
    driftEvents.push({
      clinicianId,
      severity: 'warning',
      summary: reason,
      detectedAt: new Date().toISOString(),
    });
  }

  if (fusionEvents.length === 0) {
    fusionEvents.push({
      clinicianId,
      fusionScore: 0.42,
      source: 'cli',
      detectedAt: new Date().toISOString(),
    });
  }

  const payload = {
    sweepId,
    driftEvents,
    fusionEvents,
  };

  const jobId = await enqueueJob('SAFETY_SWEEP', payload);

  // eslint-disable-next-line no-console
  console.log(
    `Enqueued SAFETY_SWEEP job ${jobId} for clinician ${clinicianId} (sweep ${sweepId})`,
  );
}

function asString(value: string | boolean | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

async function loadEventFile<T>(filePath?: string): Promise<T[]> {
  if (!filePath) {
    return [];
  }

  const data = (await readJsonFile<JsonValue>(filePath)) ?? [];
  if (Array.isArray(data)) {
    return data as T[];
  }
  return [data as T];
}
import { randomUUID } from 'node:crypto';
import { enqueueJob } from '../../services/queue/producer.js';
import type {
  DriftSourceEvent,
  FusionScoreEvent,
} from '../../services/safety/collectors/signalCollector.js';
import { parseArgs } from '../utils/args.js';
import { readJsonFile } from '../utils/io.js';

type JsonValue = Record<string, unknown> | Record<string, unknown>[] | null;

export async function triggerSafetySweep(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);
  const clinicianId = asString(flags.clinician ?? flags.c);

  if (!clinicianId) {
    throw new Error('Missing required flag --clinician <id>');
  }

  const sweepId = asString(flags['sweep-id']) ?? `cli-safety-${randomUUID()}`;
  const reason = asString(flags.reason) ?? 'Manual safety sweep triggered via CLI';

  const driftEvents = await loadEventFile<DriftSourceEvent>(asString(flags.drift));
  const fusionEvents = await loadEventFile<FusionScoreEvent>(asString(flags.fusion));

  if (driftEvents.length === 0) {
    driftEvents.push({
      clinicianId,
      severity: 'warning',
      summary: reason,
      detectedAt: new Date().toISOString(),
    });
  }

  if (fusionEvents.length === 0) {
    fusionEvents.push({
      clinicianId,
      fusionScore: 0.42,
      source: 'cli',
      detectedAt: new Date().toISOString(),
    });
  }

  const payload = {
    sweepId,
    driftEvents,
    fusionEvents,
  };

  const jobId = await enqueueJob('SAFETY_SWEEP', payload);

  // eslint-disable-next-line no-console
  console.log(
    `Enqueued SAFETY_SWEEP job ${jobId} for clinician ${clinicianId} (sweep ${sweepId})`,
  );
}

function asString(value: string | boolean | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
}

async function loadEventFile<T>(filePath?: string): Promise<T[]> {
  if (!filePath) {
    return [];
  }

  const data = (await readJsonFile<JsonValue>(filePath)) ?? [];
  if (Array.isArray(data)) {
    return data as T[];
  }
  return [data as T];
}

