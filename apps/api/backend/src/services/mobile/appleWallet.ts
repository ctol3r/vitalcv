/**
 * appleWallet.ts — Wave 52: Apple Wallet Pass Generator
 *
 * Generates cryptographically signed .pkpass bundles for iOS Wallet.
 * The pass displays:
 *   - Clinician name + photo
 *   - Credential Readiness Score (CRS) with color-coded band
 *   - Dynamic QR code linking to the public OIDC4VP presentation endpoint
 *
 * PRODUCTION TODO:
 *   - Replace stub signing with real Apple WWDR certificate + pass type cert
 *   - Implement actual .pkpass ZIP assembly (pass.json, icon.png, strip.png, manifest.json, signature)
 *   - Integrate with Apple Push Notification service for pass updates
 */

import { createHash } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export interface PassField {
  key: string;
  label: string;
  value: string;
  textAlignment?: 'PKTextAlignmentLeft' | 'PKTextAlignmentCenter' | 'PKTextAlignmentRight';
  changeMessage?: string;
}

export interface ApplePassData {
  formatVersion: 1;
  passTypeIdentifier: string;
  serialNumber: string;
  teamIdentifier: string;
  organizationName: string;
  description: string;
  logoText: string;
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
  generic: {
    headerFields: PassField[];
    primaryFields: PassField[];
    secondaryFields: PassField[];
    auxiliaryFields: PassField[];
    backFields: PassField[];
  };
  barcode: {
    format: 'PKBarcodeFormatQR';
    message: string;
    messageEncoding: 'iso-8859-1';
    altText: string;
  };
  relevantDate?: string;
  expirationDate?: string;
  voided?: boolean;
}

export interface PassGenerationInput {
  clinicianName: string;
  npi: string;
  crsScore: number;
  crsBand: 'GREEN' | 'YELLOW' | 'RED';
  credentials: string[];
  expiresAt?: string;
  photoUrl?: string;
}

export interface GeneratedPass {
  passId: string;
  serialNumber: string;
  passData: ApplePassData;
  /** In production, this would be the signed .pkpass binary */
  passBuffer: Buffer;
  downloadUrl: string;
  qrCodeUrl: string;
}

// ── Configuration ─────────────────────────────────────────────────────────

const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID ?? 'pass.com.vitalcv.credentials';
const TEAM_ID = process.env.APPLE_TEAM_ID ?? 'XXXXXXXXXX';
const BASE_URL = process.env.VITALCV_BASE_URL ?? 'https://app.vitalcv.com';

// CRS band → pass colors
const BAND_COLORS: Record<string, { bg: string; fg: string }> = {
  GREEN: { bg: 'rgb(34, 139, 34)', fg: 'rgb(255, 255, 255)' },
  YELLOW: { bg: 'rgb(218, 165, 32)', fg: 'rgb(33, 33, 33)' },
  RED: { bg: 'rgb(178, 34, 34)', fg: 'rgb(255, 255, 255)' },
};

// ── Generator ─────────────────────────────────────────────────────────────

function generateSerialNumber(npi: string): string {
  const hash = createHash('sha256').update(`${npi}:${Date.now()}`).digest('hex');
  return hash.slice(0, 16).toUpperCase();
}

export async function generateApplePass(
  input: PassGenerationInput,
): Promise<GeneratedPass> {
  const serialNumber = generateSerialNumber(input.npi);
  const colors = BAND_COLORS[input.crsBand] ?? BAND_COLORS.RED;
  const qrCodeUrl = `${BASE_URL}/verify/${input.npi}`;

  const passData: ApplePassData = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    serialNumber,
    teamIdentifier: TEAM_ID,
    organizationName: 'VitalCV',
    description: 'VitalCV Credential Pass',
    logoText: 'VitalCV',
    foregroundColor: colors.fg,
    backgroundColor: colors.bg,
    labelColor: 'rgb(200, 200, 200)',
    generic: {
      headerFields: [
        {
          key: 'crs-band',
          label: 'STATUS',
          value: input.crsBand,
          textAlignment: 'PKTextAlignmentRight',
        },
      ],
      primaryFields: [
        {
          key: 'clinician-name',
          label: 'CLINICIAN',
          value: input.clinicianName,
        },
      ],
      secondaryFields: [
        {
          key: 'crs-score',
          label: 'READINESS SCORE',
          value: `${input.crsScore}%`,
          changeMessage: 'CRS updated to %@',
        },
        {
          key: 'npi',
          label: 'NPI',
          value: input.npi,
        },
      ],
      auxiliaryFields: input.credentials.slice(0, 4).map((cred, i) => ({
        key: `credential-${i}`,
        label: `CREDENTIAL ${i + 1}`,
        value: cred,
      })),
      backFields: [
        {
          key: 'verification-info',
          label: 'Verification Details',
          value: `This pass represents the verified credential status of ${input.clinicianName} (NPI: ${input.npi}). ` +
            `The Credential Readiness Score (CRS) of ${input.crsScore}% was computed by VitalCV's deterministic trust engine. ` +
            `Scan the QR code on the front of this pass to perform a real-time OIDC4VP verification.`,
        },
        {
          key: 'legal',
          label: 'Legal Notice',
          value: 'This pass is issued by VitalCV Inc. and represents a point-in-time credential assessment. ' +
            'For authoritative verification, always scan the QR code for real-time status.',
        },
      ],
    },
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: qrCodeUrl,
      messageEncoding: 'iso-8859-1',
      altText: `Verify: ${input.npi}`,
    },
  };

  if (input.expiresAt) {
    passData.expirationDate = input.expiresAt;
  }

  // TODO: Production implementation:
  // 1. Create pass.json from passData
  // 2. Add icon.png, icon@2x.png, logo.png, logo@2x.png, strip.png
  // 3. If photoUrl provided, download and add thumbnail.png
  // 4. Generate manifest.json (SHA-1 hashes of all files)
  // 5. Sign manifest with Apple WWDR intermediate + pass type certificate
  // 6. ZIP everything into .pkpass bundle
  const passBuffer = Buffer.from(JSON.stringify(passData), 'utf-8');

  const passId = `pass-${serialNumber}`;
  const downloadUrl = `${BASE_URL}/api/wallet/apple/${passId}`;

  log('info', 'apple_wallet: pass generated', {
    passId,
    npi: input.npi.slice(0, 4) + '****',
    crsBand: input.crsBand,
    crsScore: input.crsScore,
  });

  return {
    passId,
    serialNumber,
    passData,
    passBuffer,
    downloadUrl,
    qrCodeUrl,
  };
}

export const appleWalletService = { generateApplePass };
