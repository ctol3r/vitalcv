/**
 * shareLink.ts — Wave 88: Shareable Credential URL Generator
 */

import { sha256Hex } from '../../utils/deterministic';

export interface ShareableLink {
  url: string;
  token: string;
  npi: string;
  generatedAt: string;
  expiresAt: string;
}

const APP_ORIGIN = process.env.APP_ORIGIN || 'https://app.vitalcv.com';

export function generateShareLink(npi: string): ShareableLink {
  const now = new Date();
  const token = sha256Hex(`${npi}:${now.toISOString()}:share`).slice(0, 16);
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  return {
    url: `${APP_ORIGIN}/p/${npi}?t=${token}`,
    token,
    npi,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}
