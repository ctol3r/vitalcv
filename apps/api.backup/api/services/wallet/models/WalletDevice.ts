import { PrismaClient, type WalletDevice as WalletDeviceRecord } from '@prisma/client';
import type {
  WalletDeviceMetadata,
  WalletDevicePublicKey,
  WalletSignatureAlgorithm,
} from '@domain/identity/contracts';
import { WALLET_SIGNATURE_ALGS } from '@domain/identity/contracts';
import { z } from 'zod';

export interface WalletDeviceRegistrationInput {
  clinicianId: string;
  publicKeyJwk: WalletDevicePublicKey;
  metadata?: WalletDeviceMetadata | null;
}

export const WalletDeviceMetadataSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, 'label cannot be empty')
      .max(120, 'label limited to 120 characters')
      .optional(),
    platform: z
      .string()
      .trim()
      .min(1, 'platform cannot be empty')
      .max(120, 'platform limited to 120 characters')
      .optional(),
    userAgent: z
      .string()
      .trim()
      .min(1, 'userAgent cannot be empty')
      .max(512, 'userAgent limited to 512 characters')
      .optional(),
    appVersion: z
      .string()
      .trim()
      .min(1, 'appVersion cannot be empty')
      .max(64, 'appVersion limited to 64 characters')
      .optional(),
  })
  .partial()
  .refine(
    (value) => Object.values(value).some((entry) => entry !== undefined),
    'metadata must include at least one property when present'
  )
  .optional();

const BaseJwkSchema = z
  .object({
    kty: z.enum(['OKP', 'EC']),
    crv: z.string().min(2),
    alg: z.enum(WALLET_SIGNATURE_ALGS).optional(),
    kid: z.string().optional(),
    x: z.string().optional(),
    y: z.string().optional(),
  })
  .passthrough();

const WalletDeviceRegistrationSchema = z.object({
  clinicianId: z
    .string()
    .min(1, 'clinicianId is required')
    .max(64, 'clinicianId longer than 64 characters is not supported'),
  publicKeyJwk: BaseJwkSchema,
  metadata: WalletDeviceMetadataSchema,
});

export type WalletDeviceRegistrationPayload = z.infer<typeof WalletDeviceRegistrationSchema>;

export function normalizeWalletDeviceRegistration(
  input: WalletDeviceRegistrationInput
): WalletDeviceRegistrationPayload {
  const parsed = WalletDeviceRegistrationSchema.parse(input);
  const normalizedJwk = normalizePublicKeyJwk(parsed.publicKeyJwk);
  const sanitizedMetadata = parsed.metadata ? sanitizeMetadata(parsed.metadata) : undefined;

  return {
    clinicianId: parsed.clinicianId.trim(),
    publicKeyJwk: normalizedJwk,
    metadata: sanitizedMetadata,
  };
}

function sanitizeMetadata(metadata: WalletDeviceMetadata): WalletDeviceMetadata | undefined {
const trimmedEntries = Object.entries(metadata).reduce<WalletDeviceMetadata>((acc, [key, value]) => {
    if (typeof value === 'string') {
      const cleaned = value.trim();
      if (cleaned.length > 0) {
        acc[key as keyof WalletDeviceMetadata] = cleaned;
      }
    }
    return acc;
  }, {});

  return Object.keys(trimmedEntries).length > 0 ? trimmedEntries : undefined;
}

export function normalizePublicKeyJwk(jwk: z.infer<typeof BaseJwkSchema>): WalletDevicePublicKey {
  const base = BaseJwkSchema.parse(jwk);
  const normalizedAlg: WalletSignatureAlgorithm =
    base.alg ?? (base.kty === 'OKP' ? 'EdDSA' : 'ES256');

  if (!WALLET_SIGNATURE_ALGS.includes(normalizedAlg)) {
    throw new Error(`alg must be one of ${WALLET_SIGNATURE_ALGS.join(', ')}`);
  }

  if (base.kty === 'OKP') {
    if (base.crv !== 'Ed25519') {
      throw new Error(`OKP keys must use Ed25519 curve (received ${base.crv})`);
    }
    if (!base.x) {
      throw new Error('OKP keys require x coordinate');
    }
  } else if (base.kty === 'EC') {
    if (base.crv !== 'P-256') {
      throw new Error(`EC keys must use P-256 curve (received ${base.crv})`);
    }
    if (!base.x || !base.y) {
      throw new Error('EC keys require both x and y coordinates');
    }
  } else {
    throw new Error(`Unsupported JWK kty: ${base.kty}`);
  }

  return {
    ...base,
    alg: normalizedAlg,
  };
}

export async function createWalletDevice(
  prisma: PrismaClient,
  input: WalletDeviceRegistrationInput
): Promise<WalletDeviceRecord> {
  const payload = normalizeWalletDeviceRegistration(input);

  return prisma.walletDevice.create({
    data: {
      clinicianId: payload.clinicianId,
      publicKeyJwk: payload.publicKeyJwk,
      metadata: payload.metadata ?? null,
    },
  });
}

export async function getWalletDeviceById(
  prisma: PrismaClient,
  deviceId: string
): Promise<WalletDeviceRecord | null> {
  if (!deviceId || deviceId.length < 3) {
    throw new Error('deviceId is required');
  }

  return prisma.walletDevice.findUnique({
    where: { deviceId },
  });
}

export async function touchWalletDevice(
  prisma: PrismaClient,
  deviceId: string
): Promise<WalletDeviceRecord | null> {
  if (!deviceId || deviceId.length < 3) {
    throw new Error('deviceId is required');
  }

  return prisma.walletDevice.update({
    where: { deviceId },
    data: { lastUsedAt: new Date() },
  });
}

