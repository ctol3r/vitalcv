import { enqueueJob } from '../../services/queue/producer.js';
import {
  mobilityEngine,
  type EvaluateMobilityPayload,
} from '../../services/workforce/matching/mobilityEngine.js';
import { parseArgs } from '../utils/args.js';
import { readJsonFile } from '../utils/io.js';

export async function runMobilityEvaluation(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);

  const payload = await buildPayload(flags);
  const jobId = await enqueueJob('MOBILITY_EVALUATE_ORG', payload);
  const decision = await mobilityEngine.evaluateOrg(payload);

  // eslint-disable-next-line no-console
  console.log(
    `Mobility readiness for clinician ${payload.clinicianId} at ${payload.targetOrgId}: ${decision.readiness.status} (${decision.reason ?? 'no reason'})`,
  );
  // eslint-disable-next-line no-console
  console.log(`Enqueued MOBILITY_EVALUATE_ORG job ${jobId}`);
}

async function buildPayload(
  flags: Record<string, string | boolean>,
): Promise<EvaluateMobilityPayload> {
  if (typeof flags.request === 'string') {
    return (await readJsonFile<EvaluateMobilityPayload>(flags.request)) as EvaluateMobilityPayload;
  }

  const clinicianId = asString(flags.clinician ?? flags.c);
  const clinicianOrgId = asString(flags['clinician-org']);
  const targetOrgId = asString(flags['target-org']);

  if (!clinicianId || !clinicianOrgId || !targetOrgId) {
    throw new Error(
      'Flags --clinician, --clinician-org, and --target-org are required unless --request is provided',
    );
  }

  const payload: EvaluateMobilityPayload = {
    clinicianId,
    clinicianOrgId,
    targetOrgId,
  };

  if (typeof flags.profile === 'string') {
    payload.clinicianProfile = await readJsonFile(flags.profile);
  }

  return payload;
}

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
import { enqueueJob } from '../../services/queue/producer.js';
import {
  mobilityEngine,
  type EvaluateMobilityPayload,
} from '../../services/workforce/matching/mobilityEngine.js';
import { parseArgs } from '../utils/args.js';
import { readJsonFile } from '../utils/io.js';

export async function runMobilityEvaluation(argv: string[]): Promise<void> {
  const { flags } = parseArgs(argv);

  const payload = await buildPayload(flags);
  const jobId = await enqueueJob('MOBILITY_EVALUATE_ORG', payload);
  const decision = await mobilityEngine.evaluateOrg(payload);

  // eslint-disable-next-line no-console
  console.log(
    `Mobility readiness for clinician ${payload.clinicianId} at ${payload.targetOrgId}: ${decision.readiness.status} (${decision.reason ?? 'no reason'})`,
  );
  // eslint-disable-next-line no-console
  console.log(`Enqueued MOBILITY_EVALUATE_ORG job ${jobId}`);
}

async function buildPayload(
  flags: Record<string, string | boolean>,
): Promise<EvaluateMobilityPayload> {
  if (typeof flags.request === 'string') {
    return (await readJsonFile<EvaluateMobilityPayload>(flags.request)) as EvaluateMobilityPayload;
  }

  const clinicianId = asString(flags.clinician ?? flags.c);
  const clinicianOrgId = asString(flags['clinician-org']);
  const targetOrgId = asString(flags['target-org']);

  if (!clinicianId || !clinicianOrgId || !targetOrgId) {
    throw new Error(
      'Flags --clinician, --clinician-org, and --target-org are required unless --request is provided',
    );
  }

  const payload: EvaluateMobilityPayload = {
    clinicianId,
    clinicianOrgId,
    targetOrgId,
  };

  if (typeof flags.profile === 'string') {
    payload.clinicianProfile = await readJsonFile(flags.profile);
  }

  return payload;
}

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

