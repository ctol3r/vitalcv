import cron from 'node-cron';
import { promises as fs } from 'fs';
import path from 'path';

const CERT_DIR = process.env.MTLS_CERT_DIR ?? path.resolve(process.cwd(), 'tmp', 'mtls');
const TRUST_STORE_PATH =
  process.env.MTLS_TRUST_STORE ?? path.resolve(CERT_DIR, 'trust-store.json');
const ROTATION_CRON = process.env.MTLS_ROTATION_CRON ?? '0 3 * * *';

let scheduledTask: cron.ScheduledTask | null = null;

export interface RotationOptions {
  dryRun?: boolean;
  services?: string[];
}

export interface RotationResult {
  issuedFor: string[];
  rotatedAt: string;
  trustStoreUpdated: boolean;
  restartedServices: string[];
}

export function startMtlsRotationWorker(): cron.ScheduledTask {
  if (scheduledTask) {
    return scheduledTask;
  }

  scheduledTask = cron.schedule(ROTATION_CRON, async () => {
    try {
      await rotateMtlsCertificates();
      console.info('[mtls-rotate] rotation complete');
    } catch (error) {
      console.error('[mtls-rotate] rotation failed', error);
    }
  });

  console.info('[mtls-rotate] worker scheduled', { cron: ROTATION_CRON });
  return scheduledTask;
}

export async function rotateMtlsCertificates(
  options: RotationOptions = {},
): Promise<RotationResult> {
  await fs.mkdir(CERT_DIR, { recursive: true });
  const issued = await issueCertificates(options.dryRun === true);
  const trustStoreUpdated =
    options.dryRun === true ? false : await updateTrustStore(issued.bundlePath);
  const restartedServices =
    options.dryRun === true ? [] : await restartServices(options.services);

  return {
    issuedFor: issued.targets,
    rotatedAt: new Date().toISOString(),
    trustStoreUpdated,
    restartedServices,
  };
}

async function issueCertificates(dryRun: boolean) {
  const targets = ['issuer-api', 'verifier-api', 'worker'];
  const bundlePath = path.join(CERT_DIR, `trust-bundle-${Date.now()}.pem`);
  if (!dryRun) {
    const payload = targets
      .map(
        (target) =>
          `-----BEGIN CERTIFICATE-----\n${Buffer.from(`${target}:${Date.now()}`).toString('base64')}\n-----END CERTIFICATE-----`,
      )
      .join('\n');
    await fs.writeFile(bundlePath, payload, 'utf-8');
  }
  return { targets, bundlePath };
}

async function updateTrustStore(bundlePath: string): Promise<boolean> {
  try {
    const records = JSON.parse(
      (await fs.readFile(TRUST_STORE_PATH, 'utf-8').catch(() => '[]')) as string,
    ) as Array<{ bundlePath: string; updatedAt: string }>;
    records.push({ bundlePath, updatedAt: new Date().toISOString() });
    await fs.writeFile(TRUST_STORE_PATH, JSON.stringify(records.slice(-20), null, 2));
    return true;
  } catch (error) {
    console.error('[mtls-rotate] failed to update trust store', error);
    return false;
  }
}

async function restartServices(services?: string[]): Promise<string[]> {
  const targets = services && services.length ? services : ['issuer-api', 'verifier-api'];
  for (const service of targets) {
    console.info('[mtls-rotate] restarting service', { service });
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return targets;
}

