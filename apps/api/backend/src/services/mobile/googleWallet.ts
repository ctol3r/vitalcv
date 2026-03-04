/**
 * googleWallet.ts — Wave 52: Google Wallet Pass Generator
 *
 * Provisions Generic passes via the Google Wallet REST API.
 * Integrates with Android's DigitalCredential API for OIDC4VP presentation.
 *
 * The pass displays:
 *   - Clinician name and NPI
 *   - CRS score with color-coded header
 *   - QR code linking to OIDC4VP verification endpoint
 *   - Credential summary in rows
 *
 * PRODUCTION TODO:
 *   - Replace stub with real Google Wallet API calls (service account JWT auth)
 *   - Implement actual pass class creation via REST API
 *   - Set up Google Cloud project with Wallet API enabled
 *   - Implement pass update notifications via Google Wallet callback
 */

import { createHash } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export interface GooglePassObject {
  id: string;
  classId: string;
  genericType: 'GENERIC_TYPE_UNSPECIFIED';
  hexBackgroundColor: string;
  logo: {
    sourceUri: { uri: string };
    contentDescription: { defaultValue: { language: string; value: string } };
  };
  cardTitle: {
    defaultValue: { language: string; value: string };
  };
  subheader: {
    defaultValue: { language: string; value: string };
  };
  header: {
    defaultValue: { language: string; value: string };
  };
  textModulesData: Array<{
    id: string;
    header: string;
    body: string;
  }>;
  barcode: {
    type: 'QR_CODE';
    value: string;
    alternateText: string;
  };
  heroImage?: {
    sourceUri: { uri: string };
    contentDescription: { defaultValue: { language: string; value: string } };
  };
}

export interface GooglePassGenerationInput {
  clinicianName: string;
  npi: string;
  crsScore: number;
  crsBand: 'GREEN' | 'YELLOW' | 'RED';
  credentials: string[];
  expiresAt?: string;
}

export interface GeneratedGooglePass {
  passId: string;
  passObject: GooglePassObject;
  saveUrl: string;
  qrCodeUrl: string;
  /** JWT that can be used with Google Wallet "Add to Wallet" button */
  saveJwt: string;
}

// ── Configuration ─────────────────────────────────────────────────────────

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID ?? '0000000000000000000';
const CLASS_ID = `${ISSUER_ID}.vitalcv_credential_v1`;
const BASE_URL = process.env.VITALCV_BASE_URL ?? 'https://app.vitalcv.com';
const LOGO_URL = `${BASE_URL}/placeholder-logo.png`;

const BAND_COLORS: Record<string, string> = {
  GREEN: '#228B22',
  YELLOW: '#DAA520',
  RED: '#B22222',
};

// ── Generator ─────────────────────────────────────────────────────────────

function generateObjectId(npi: string): string {
  const hash = createHash('sha256').update(`${npi}:${Date.now()}`).digest('hex');
  return `${ISSUER_ID}.vitalcv_${hash.slice(0, 16)}`;
}

export async function generateGooglePass(
  input: GooglePassGenerationInput,
): Promise<GeneratedGooglePass> {
  const objectId = generateObjectId(input.npi);
  const qrCodeUrl = `${BASE_URL}/verify/${input.npi}`;

  const passObject: GooglePassObject = {
    id: objectId,
    classId: CLASS_ID,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    hexBackgroundColor: BAND_COLORS[input.crsBand] ?? BAND_COLORS.RED,
    logo: {
      sourceUri: { uri: LOGO_URL },
      contentDescription: {
        defaultValue: { language: 'en-US', value: 'VitalCV Logo' },
      },
    },
    cardTitle: {
      defaultValue: { language: 'en-US', value: 'VitalCV Credential' },
    },
    subheader: {
      defaultValue: { language: 'en-US', value: 'CLINICIAN' },
    },
    header: {
      defaultValue: { language: 'en-US', value: input.clinicianName },
    },
    textModulesData: [
      {
        id: 'npi',
        header: 'NPI',
        body: input.npi,
      },
      {
        id: 'crs',
        header: 'READINESS SCORE',
        body: `${input.crsScore}% — ${input.crsBand}`,
      },
      ...input.credentials.slice(0, 4).map((cred, i) => ({
        id: `cred-${i}`,
        header: `CREDENTIAL ${i + 1}`,
        body: cred,
      })),
    ],
    barcode: {
      type: 'QR_CODE' as const,
      value: qrCodeUrl,
      alternateText: `Verify NPI: ${input.npi}`,
    },
  };

  // TODO: Production implementation:
  // 1. Authenticate with Google Cloud service account
  // 2. Create/update pass class via POST https://walletobjects.googleapis.com/walletobjects/v1/genericClass
  // 3. Create pass object via POST https://walletobjects.googleapis.com/walletobjects/v1/genericObject
  // 4. Generate signed JWT for "Add to Google Wallet" button
  // 5. For DigitalCredential API:
  //    - Register OIDC4VP protocol handler in assetlinks.json
  //    - Implement navigator.credentials.get({ digital: { providers: [...] } }) flow
  //    - Return presentation response via Android Intent

  // Stub: generate a fake save JWT
  const saveJwtPayload = {
    iss: 'vitalcv-wallet-issuer',
    aud: 'google',
    typ: 'savetowallet',
    payload: { genericObjects: [passObject] },
    iat: Math.floor(Date.now() / 1000),
  };
  const saveJwt = Buffer.from(JSON.stringify(saveJwtPayload)).toString('base64url');
  const saveUrl = `https://pay.google.com/gp/v/save/${saveJwt}`;

  log('info', 'google_wallet: pass generated', {
    passId: objectId,
    npi: input.npi.slice(0, 4) + '****',
    crsBand: input.crsBand,
    crsScore: input.crsScore,
  });

  return {
    passId: objectId,
    passObject,
    saveUrl,
    qrCodeUrl,
    saveJwt,
  };
}

/**
 * Generate the Android DigitalCredential request payload for OIDC4VP.
 * This is used by the frontend to invoke navigator.credentials.get()
 * on Android devices with the DigitalCredential API.
 */
export function buildDigitalCredentialRequest(
  npi: string,
  nonce: string,
): Record<string, unknown> {
  return {
    digital: {
      providers: [
        {
          protocol: 'openid4vp',
          request: JSON.stringify({
            client_id: BASE_URL,
            client_id_scheme: 'web-origin',
            response_type: 'vp_token',
            nonce,
            presentation_definition: {
              id: `vitalcv-verify-${npi}`,
              input_descriptors: [
                {
                  id: 'clinician_credentials',
                  name: 'VitalCV Verified Credentials',
                  purpose: 'Verify clinician credential status',
                  constraints: {
                    fields: [
                      { path: ['$.credentialSubject.npi'], filter: { type: 'string', const: npi } },
                      { path: ['$.credentialSubject.crsScore'] },
                      { path: ['$.credentialSubject.crsBand'] },
                    ],
                  },
                },
              ],
            },
          }),
        },
      ],
    },
  };
}

export const googleWalletService = {
  generateGooglePass,
  buildDigitalCredentialRequest,
};
