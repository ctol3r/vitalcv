import { randomUUID } from 'crypto';
import { PrismaClient, type WalletDevice as WalletDeviceRecord } from '@prisma/client';
import { importJWK, jwtVerify, type JWK as JoseJwk, type JWTHeaderParameters } from 'jose';

const DEFAULT_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_IAT_SKEW_SECONDS = 120; // ±2 minutes skew
const ALLOWED_CHALLENGE_ALGS = ['EdDSA', 'ES256'] as const;

type AllowedChallengeAlg = (typeof ALLOWED_CHALLENGE_ALGS)[number];

interface ChallengeState {
  nonce: string;
  expiresAt: number;
}

export interface IssuedDeviceChallenge {
  nonce: string;
  expiresAt: string;
}

export interface VerifyDeviceChallengeOptions {
  prisma: PrismaClient;
  deviceId: string;
  proof: string;
  method: string;
  url: string;
}

export interface VerifyDeviceChallengeResult {
  device: WalletDeviceRecord;
  nextChallenge: IssuedDeviceChallenge;
}

interface WalletDeviceJwk extends Record<string, unknown> {
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  alg?: AllowedChallengeAlg;
}

export class DeviceChallengeService {
  private readonly ttlMs: number;
  private readonly challenges = new Map<string, ChallengeState>();

  constructor(ttlMs: number = DEFAULT_CHALLENGE_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  issueChallenge(deviceId: string): IssuedDeviceChallenge {
    if (!deviceId) {
      throw new Error('deviceId is required to issue a challenge');
    }
    this.cleanup();

    const nonce = randomUUID();
    const expiresAtDate = new Date(Date.now() + this.ttlMs);

    this.challenges.set(deviceId, {
      nonce,
      expiresAt: expiresAtDate.getTime(),
    });

    return {
      nonce,
      expiresAt: expiresAtDate.toISOString(),
    };
  }

  async verifyChallenge({
    prisma,
    deviceId,
    proof,
    method,
    url,
  }: VerifyDeviceChallengeOptions): Promise<VerifyDeviceChallengeResult> {
    const challenge = this.challenges.get(deviceId);
    if (!challenge || challenge.expiresAt < Date.now()) {
      this.challenges.delete(deviceId);
      throw new Error('challenge_expired');
    }

    const device = await prisma.walletDevice.findUnique({
      where: { deviceId },
    });

    if (!device) {
      throw new Error('device_not_found');
    }

    const storedJwk = this.ensureWalletJwk(device.publicKeyJwk);
    const expectedAlg: AllowedChallengeAlg =
      storedJwk.alg ?? (storedJwk.kty === 'OKP' ? 'EdDSA' : 'ES256');
    if (!ALLOWED_CHALLENGE_ALGS.includes(expectedAlg)) {
      throw new Error(`unsupported_alg: ${storedJwk.alg ?? 'unknown'}`);
    }

    const cryptoKey = await importJWK(storedJwk as JoseJwk, expectedAlg);
    const { payload, protectedHeader } = await jwtVerify(proof, cryptoKey, {
      algorithms: ALLOWED_CHALLENGE_ALGS,
    });

    if (!payload.nonce || payload.nonce !== challenge.nonce) {
      throw new Error('nonce_mismatch');
    }

    const expectedMethod = method.toUpperCase();
    if (!payload.htm || String(payload.htm).toUpperCase() !== expectedMethod) {
      throw new Error('htm_mismatch');
    }

    if (!payload.htu || payload.htu !== url) {
      throw new Error('htu_mismatch');
    }

    if (!payload.iat || typeof payload.iat !== 'number') {
      throw new Error('iat_missing');
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - payload.iat) > MAX_IAT_SKEW_SECONDS) {
      throw new Error('iat_out_of_window');
    }

    const header = protectedHeader as JWTHeaderParameters & { jwk?: WalletDeviceJwk };
    if (!header.typ || header.typ.toLowerCase() !== 'dpop+jwt') {
      throw new Error('invalid_typ');
    }
    if (!header.jwk) {
      throw new Error('missing_jwk_header');
    }

    if (!this.areJwksEqual(header.jwk, storedJwk)) {
      throw new Error('jwk_mismatch');
    }

    // Rotate challenge after successful verification
    this.challenges.delete(deviceId);
    const nextChallenge = this.issueChallenge(deviceId);

    await prisma.walletDevice.update({
      where: { deviceId },
      data: { lastUsedAt: new Date() },
    });

    return {
      device,
      nextChallenge,
    };
  }

  private ensureWalletJwk(value: unknown): WalletDeviceJwk {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('invalid_public_key_jwk');
    }
    const jwk = value as WalletDeviceJwk;
    if (!jwk.kty) {
      throw new Error('invalid_public_key_jwk');
    }
    return jwk;
  }

  private areJwksEqual(a: WalletDeviceJwk, b: WalletDeviceJwk): boolean {
    const keys: Array<keyof WalletDeviceJwk> = ['kty', 'crv', 'x', 'y'];
    return keys.every((key) => a[key] === b[key]);
  }

  private cleanup() {
    const now = Date.now();
    for (const [deviceId, record] of this.challenges.entries()) {
      if (record.expiresAt < now) {
        this.challenges.delete(deviceId);
      }
    }
  }
}

export const deviceChallengeService = new DeviceChallengeService();
export default deviceChallengeService;

