import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { PassportV3Builder } from '../../services/passport/v3/builder';
import { PassportProofBinder } from '../../services/passport/v3/proofBinder';
import { encryptPassportPayload } from '../../services/passport/v3/encryption';
import { signPassportBundle } from '../../services/passport/signPassport';
import { passportStore } from '../../services/wallet/passportStore';
import { recordPassportBundle } from '../../services/passport/models/PassportBundle';

const prisma = new PrismaClient();
const builder = new PassportV3Builder(prisma);
const proofBinder = new PassportProofBinder({ prisma });

const SERVER_KEY = process.env.PASSPORT_V3_SERVER_KEY
  ? Buffer.from(process.env.PASSPORT_V3_SERVER_KEY, 'base64')
  : null;

export async function runPassportV3RevocationCycle(): Promise<void> {
  const lookbackMinutes = Number(process.env.PASSPORT_V3_REGEN_LOOKBACK_MINUTES || 30);
  const since = new Date(Date.now() - lookbackMinutes * 60 * 1000);
  const clinicianIds = await collectClinicianIdsSince(since);

  for (const clinicianId of clinicianIds) {
    try {
      await regeneratePassportForClinician(clinicianId);
    } catch (error) {
      console.error('[passportV3][revocation] Failed to regenerate', {
        clinicianId,
        error,
      });
    }
  }
}

async function collectClinicianIdsSince(since: Date): Promise<Set<string>> {
  const clinicianIds = new Set<string>();

  const licenses = await prisma.stateLicenseVerification.findMany({
    where: { updatedAt: { gte: since } },
    select: { clinicianId: true },
  });
  licenses.forEach((entry) => clinicianIds.add(entry.clinicianId));

  const oppeCases = await prisma.oPPECase.findMany({
    where: { updatedAt: { gte: since } },
    select: { clinicianId: true },
  });
  oppeCases.forEach((entry) => clinicianIds.add(entry.clinicianId));

  const credentialUsers = await prisma.credential.findMany({
    where: {
      type: { in: ['BoardCertification', 'DEARegistration'] },
      updatedAt: { gte: since },
    },
    select: { userId: true },
  });
  if (credentialUsers.length) {
    const profiles = await prisma.clinicianProfile.findMany({
      where: {
        userId: {
          in: credentialUsers.map((record) => String(record.userId)),
        },
      },
      select: { id: true },
    });
    profiles.forEach((profile) => clinicianIds.add(profile.id));
  }

  const privilegeDids = await prisma.privilegeGranted.findMany({
    where: { updatedAt: { gte: since } },
    select: { clinicianDid: true },
  });
  if (privilegeDids.length) {
    const dids = privilegeDids
      .map((entry) => entry.clinicianDid)
      .filter((did): did is string => Boolean(did));
    if (dids.length) {
      const users = await prisma.user.findMany({
        where: { did: { in: dids } },
        select: { id: true },
      });
      const profiles = await prisma.clinicianProfile.findMany({
        where: {
          userId: { in: users.map((user) => String(user.id)) },
        },
        select: { id: true },
      });
      profiles.forEach((profile) => clinicianIds.add(profile.id));
    }
  }

  return clinicianIds;
}

async function regeneratePassportForClinician(clinicianId: string): Promise<void> {
  const envelope = await builder.build({ clinicianId });
  const envelopeWithProofs = await proofBinder.bind(envelope);

  const anchor = await signPassportBundle({
    bundleId: envelopeWithProofs.passportId,
    clinicianId,
    userId: envelopeWithProofs.holder.userId,
    bundleHash: envelopeWithProofs.bundleHash!,
    manifest: envelopeWithProofs.manifest,
  });

  envelopeWithProofs.signature = anchor;

  await recordPassportBundle({
    clinicianId,
    bundleHash: envelopeWithProofs.bundleHash!,
  });

  const encrypted =
    SERVER_KEY && SERVER_KEY.length === 32
      ? encryptPassportPayload(
          Buffer.from(JSON.stringify(envelopeWithProofs), 'utf-8'),
          SERVER_KEY,
        )
      : undefined;

  await passportStore.save({
    passportId: envelopeWithProofs.passportId,
    clinicianId,
    deviceId: 'system-regeneration',
    version: envelopeWithProofs.version,
    hash: envelopeWithProofs.bundleHash!,
    issuedAt: envelopeWithProofs.issuedAt,
    ciphertext: encrypted?.ciphertext,
    iv: encrypted?.iv,
    authTag: encrypted?.authTag,
    envelopeSummary: envelopeWithProofs.summary,
    signature: anchor,
    metadata: { regeneratedAt: new Date().toISOString() },
    channel: 'system',
  });

  await passportStore.revokeOlderVersions(
    clinicianId,
    envelopeWithProofs.passportId,
    'auto_regeneration',
  );
}

export function schedulePassportV3RevocationJob(): void {
  const cronSchedule = process.env.PASSPORT_V3_REVOCATION_CRON || '*/30 * * * *';
  cron.schedule(cronSchedule, () => {
    runPassportV3RevocationCycle().catch((error) => {
      console.error('[passportV3][revocation] cycle failed', error);
    });
  });
}

if (require.main === module) {
  console.log('[passportV3][revocation] starting scheduler');
  schedulePassportV3RevocationJob();
}

