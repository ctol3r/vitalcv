import { gzipSync } from 'zlib';
import { PassportV3Builder } from './v3/builder';
import { toBundleManifest } from './v3/utils';
import type { PassportBundleManifest } from './v3/types';

const builder = new PassportV3Builder();

export interface GeneratePassportBundleInput {
  clinicianId?: string;
  userId?: string | number;
}

export interface PassportBundleResult {
  bundleId: string;
  clinicianId: string;
  userId: string;
  bundleHash: string;
  manifest: PassportBundleManifest;
  zipBuffer: Buffer;
}

export async function generatePassportBundle(
  input: GeneratePassportBundleInput,
): Promise<PassportBundleResult> {
  const envelope = await builder.build({
    clinicianId: input.clinicianId,
    userId: input.userId,
    deviceBinding: {
      walletId: 'passport-v2',
    },
  });

  const manifest = toBundleManifest(envelope);
  const payload = Buffer.from(JSON.stringify(envelope, null, 2), 'utf-8');
  const zipBuffer = gzipSync(payload);

  return {
    bundleId: envelope.passportId,
    clinicianId: envelope.holder.clinicianId,
    userId: envelope.holder.userId,
    bundleHash: envelope.bundleHash!,
    manifest,
    zipBuffer,
  };
}

export type { PassportBundleManifest };

