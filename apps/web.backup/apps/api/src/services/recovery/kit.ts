import { PrismaClient } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();
const DEFAULT_SECRET = process.env.RECOVERY_KIT_SECRET ?? 'vital-kit-secret';

export interface RecoveryKitExport {
  blob: string;
  secret: string;
  credentialCount: number;
  deviceCount: number;
  createdAt: string;
  checksum: string;
}

export interface RecoveryKitPayload {
  clinicianId: string;
  credentials: Array<{
    credentialId: string;
    type: string;
    issuedAt: string;
  }>;
  devices: Array<{
    deviceId: string;
    createdAt: string;
  }>;
}

export async function generateRecoveryKit(
  clinicianId: string,
  secret = DEFAULT_SECRET,
): Promise<RecoveryKitExport> {
  const [credentials, devices] = await Promise.all([
    prisma.walletCredential.findMany({
      where: { clinicianId },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    }),
    prisma.walletDevice.findMany({
      where: { clinicianId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const payload: RecoveryKitPayload = {
    clinicianId,
    credentials: credentials.map((credential) => ({
      credentialId: credential.credentialId,
      type: credential.type,
      issuedAt: credential.issuedAt.toISOString(),
    })),
    devices: devices.map((device) => ({
      deviceId: device.deviceId,
      createdAt: device.createdAt.toISOString(),
    })),
  };

  const encrypted = encryptPayload(payload, secret);
  return {
    blob: encrypted.blob,
    secret: encrypted.secret,
    credentialCount: payload.credentials.length,
    deviceCount: payload.devices.length,
    createdAt: new Date().toISOString(),
    checksum: encrypted.checksum,
  };
}

export function restoreRecoveryKit(blob: string, secret: string): RecoveryKitPayload {
  return decryptPayload(blob, secret);
}

function encryptPayload(payload: RecoveryKitPayload, secret: string) {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const serialized = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(serialized), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, authTag, encrypted]).toString('base64');
  const checksum = createHash('sha256').update(blob).digest('hex');
  return { blob, secret, checksum };
}

function decryptPayload(blob: string, secret: string): RecoveryKitPayload {
  const buffer = Buffer.from(blob, 'base64');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);
  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as RecoveryKitPayload;
}










