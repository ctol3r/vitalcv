import { randomUUID } from 'node:crypto';
import { SignJWT, importJWK, exportJWK, generateKeyPair, type JWK, type KeyLike } from 'jose';

import type { BasePassInput } from './applePass';

export type GoogleWalletPassVariant = 'license-status' | 'board-cert';

export interface GoogleWalletPassInput extends BasePassInput {
  variant: GoogleWalletPassVariant;
  licenseNumber?: string;
  stateCode?: string;
  boardName?: string;
  certification?: string;
}

export interface GoogleWalletPassResult {
  jwt: string;
  saveUrl: string;
  objectId: string;
}

const GOOGLE_WALLET_ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID ?? 'issuer.vitalcv';
const LICENSE_CLASS =
  process.env.GOOGLE_WALLET_CLASS_LICENSE ?? `${GOOGLE_WALLET_ISSUER_ID}.license_status`;
const BOARD_CLASS =
  process.env.GOOGLE_WALLET_CLASS_BOARD ?? `${GOOGLE_WALLET_ISSUER_ID}.board_cert`;

export async function buildGoogleWalletPass(
  input: GoogleWalletPassInput,
): Promise<GoogleWalletPassResult> {
  const signing = await getSigningMaterial();
  const classId = input.variant === 'license-status' ? LICENSE_CLASS : BOARD_CLASS;
  const objectId = `${GOOGLE_WALLET_ISSUER_ID}.${input.variant}.${input.credentialId}`;
  const genericObject = buildGenericObject(input, classId, objectId);

  const payload = {
    iss: GOOGLE_WALLET_ISSUER_ID,
    aud: 'google',
    typ: 'savetowallet',
    origins: [process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wallet.vitalcv.health'],
    payload: {
      genericObjects: [genericObject],
    },
  };

  const jwt = await new SignJWT(payload.payload)
    .setProtectedHeader({ alg: 'ES256', kid: signing.kid, typ: 'JWT' })
    .setIssuer(payload.iss)
    .setAudience(payload.aud)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(signing.key);

  return {
    jwt,
    objectId,
    saveUrl: `https://pay.google.com/gp/v/save/${encodeURIComponent(jwt)}`,
  };
}

interface SigningMaterial {
  key: KeyLike;
  kid: string;
}

let signingPromise: Promise<SigningMaterial> | null = null;

async function getSigningMaterial(): Promise<SigningMaterial> {
  if (!signingPromise) {
    signingPromise = loadSigningMaterial();
  }
  return signingPromise;
}

async function loadSigningMaterial(): Promise<SigningMaterial> {
  if (process.env.GOOGLE_WALLET_SIGNING_JWK) {
    const jwk = JSON.parse(process.env.GOOGLE_WALLET_SIGNING_JWK) as JWK;
    const key = await importJWK(jwk, 'ES256');
    return { key, kid: jwk.kid ?? `${GOOGLE_WALLET_ISSUER_ID}#wallet` };
  }

  console.warn(
    '[wallet][google] GOOGLE_WALLET_SIGNING_JWK not configured. Generating ephemeral ES256 key for development builds.',
  );
  const { privateKey } = await generateKeyPair('ES256');
  const jwk = await exportJWK(privateKey);
  return {
    key: privateKey,
    kid: jwk.kid ?? `${GOOGLE_WALLET_ISSUER_ID}#wallet-dev`,
  };
}

function buildGenericObject(
  input: GoogleWalletPassInput,
  classId: string,
  objectId: string,
): Record<string, unknown> {
  const validFrom = new Date(input.issuedAt).toISOString();
  const validTo = input.expiresAt ? new Date(input.expiresAt).toISOString() : undefined;
  const header = input.variant === 'license-status' ? 'License Status' : 'Board Certification';
  const heroText =
    input.variant === 'license-status'
      ? `${input.licenseNumber ?? 'Unknown'} · ${input.stateCode ?? 'N/A'}`
      : `${input.boardName ?? 'Board'} · ${input.certification ?? 'Credential'}`;

  return {
    id: objectId,
    classId,
    state: mapStatus(input.status),
    validTimeInterval: {
      start: {
        date: validFrom,
      },
      ...(validTo
        ? {
            end: {
              date: validTo,
            },
          }
        : {}),
    },
    heroImage: {
      sourceUri: {
        uri:
          input.variant === 'license-status'
            ? 'https://cdn.vitalcv.health/eudi/license-card.png'
            : 'https://cdn.vitalcv.health/eudi/board-card.png',
      },
      contentDescription: {
        defaultValue: {
          language: 'en-US',
          value: header,
        },
      },
    },
    textModulesData: [
      {
        id: 'detail',
        header,
        body: heroText,
      },
      {
        id: 'issuer',
        header: 'Issued By',
        body: `${input.issuerName} (${input.authority})`,
      },
    ],
    barcode: {
      type: 'QR_CODE',
      value: input.qrPayload ?? input.credentialId,
      alternateText: input.credentialId,
    },
    cardTitle: {
      defaultValue: {
        language: 'en-US',
        value: input.clinicianName,
      },
    },
    hexBackgroundColor: input.variant === 'license-status' ? '#0F172A' : '#1D4ED8',
  };
}

function mapStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('revoked') || normalized.includes('suspended')) {
    return 'EXPIRED';
  }
  if (normalized.includes('pending') || normalized.includes('expiring')) {
    return 'INACTIVE';
  }
  return 'ACTIVE';
}


