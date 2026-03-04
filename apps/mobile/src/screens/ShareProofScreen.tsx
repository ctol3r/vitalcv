/**
 * ShareProofScreen.tsx — Wave 62: Share Credential Proof
 *
 * Generates QR code and deep link for credential sharing.
 *
 * Flow:
 *   1. Call POST /api/share/trust with NPI
 *   2. Receive signed token + URL
 *   3. Display QR code (expo-camera for scanning, SVG for display)
 *   4. Offer native share via Share API
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface ShareProofData {
  token: string;
  url: string;
  qrPayload: string;
  expiresAt: string;
}

export interface ShareProofScreenProps {
  npi: string;
  crsScore: number;
  crsBand: string;
}

// ── API ───────────────────────────────────────────────────────────────────

export async function createShareLink(npi: string, baseUrl: string): Promise<ShareProofData> {
  const res = await fetch(`${baseUrl}/api/share/trust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npi, expiresInHours: 72 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ShareProofData>;
}

/**
 * ShareProofScreen layout:
 *
 *   - CRS badge (score + band)
 *   - QR code (generated from qrPayload)
 *   - Deep link: vitalcv://verify/:npi
 *   - "Share via..." button (native Share API)
 *   - "Copy Link" button
 *   - Expiry notice
 */

export const DEEP_LINK_PREFIX = 'vitalcv://verify/';
