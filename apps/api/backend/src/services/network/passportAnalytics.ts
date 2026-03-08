/**
 * passportAnalytics.ts — Wave 167: Passport Viral Sharing Analytics
 *
 * Tracks clinician passport sharing activity:
 *   - share count (link copies, QR views)
 *   - verifier accepts
 *   - bundle downloads
 *
 * Storage: in-memory (process-scoped). Survives restarts via Prisma in a future wave.
 *
 * Functions:
 *   recordShare()        — increment share count for an NPI
 *   recordVerifierAccept()— increment accept count for an NPI
 *   recordBundleDownload()— increment bundle download count for an NPI
 *   getPassportAnalytics()— get stats for a specific NPI
 *   getNetworkPassportSummary() — aggregate across all NPIs
 */

import { log } from '../../obs/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ShareEvent = 'link_copy' | 'qr_view' | 'bundle_download' | 'verifier_accept';

export interface NpiAnalytics {
  npi: string;
  shareCount: number;
  qrViews: number;
  bundleDownloads: number;
  verifierAccepts: number;
  firstSharedAt: string | null;
  lastSharedAt: string | null;
  /** Viral coefficient: verifierAccepts / shareCount (0–∞) */
  viralCoefficient: number;
}

export interface PassportNetworkSummary {
  totalShares: number;
  totalQrViews: number;
  totalBundleDownloads: number;
  totalVerifierAccepts: number;
  uniquePassports: number;
  topPassports: NpiAnalytics[];
  overallViralCoefficient: number;
  computedAt: string;
}

// ── Storage ───────────────────────────────────────────────────────────────────

interface NpiRecord {
  shareCount: number;
  qrViews: number;
  bundleDownloads: number;
  verifierAccepts: number;
  firstSharedAt: string;
  lastSharedAt: string;
}

const store = new Map<string, NpiRecord>();

function getOrCreate(npi: string): NpiRecord {
  if (!store.has(npi)) {
    const now = new Date().toISOString();
    store.set(npi, {
      shareCount: 0,
      qrViews: 0,
      bundleDownloads: 0,
      verifierAccepts: 0,
      firstSharedAt: now,
      lastSharedAt: now,
    });
  }
  return store.get(npi)!;
}

function toNpiAnalytics(npi: string, rec: NpiRecord): NpiAnalytics {
  const vc = rec.shareCount > 0 ? rec.verifierAccepts / rec.shareCount : 0;
  return {
    npi,
    shareCount: rec.shareCount,
    qrViews: rec.qrViews,
    bundleDownloads: rec.bundleDownloads,
    verifierAccepts: rec.verifierAccepts,
    firstSharedAt: rec.firstSharedAt,
    lastSharedAt: rec.lastSharedAt,
    viralCoefficient: Math.round(vc * 100) / 100,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Record a share event (link copy or direct share). */
export function recordShare(npi: string): void {
  const rec = getOrCreate(npi);
  rec.shareCount++;
  rec.lastSharedAt = new Date().toISOString();
  log('info', 'passport_share', { npi, shareCount: rec.shareCount });
}

/** Record a QR code view (scan or display). */
export function recordQrView(npi: string): void {
  const rec = getOrCreate(npi);
  rec.qrViews++;
  rec.lastSharedAt = new Date().toISOString();
  log('info', 'passport_qr_view', { npi, qrViews: rec.qrViews });
}

/** Record a bundle download. */
export function recordBundleDownload(npi: string): void {
  const rec = getOrCreate(npi);
  rec.bundleDownloads++;
  rec.lastSharedAt = new Date().toISOString();
  log('info', 'passport_bundle_download', { npi, bundleDownloads: rec.bundleDownloads });
}

/** Record a verifier accept event (verifier used a shared passport). */
export function recordVerifierAccept(npi: string): void {
  const rec = getOrCreate(npi);
  rec.verifierAccepts++;
  rec.lastSharedAt = new Date().toISOString();
  log('info', 'passport_verifier_accept', { npi, verifierAccepts: rec.verifierAccepts });
}

/** Get analytics for a specific NPI. Returns null if never shared. */
export function getPassportAnalytics(npi: string): NpiAnalytics | null {
  const rec = store.get(npi);
  if (!rec) return null;
  return toNpiAnalytics(npi, rec);
}

/** Get network-wide passport sharing summary. */
export function getNetworkPassportSummary(): PassportNetworkSummary {
  let totalShares = 0;
  let totalQrViews = 0;
  let totalBundleDownloads = 0;
  let totalVerifierAccepts = 0;

  const all: NpiAnalytics[] = [];

  for (const [npi, rec] of store) {
    totalShares += rec.shareCount;
    totalQrViews += rec.qrViews;
    totalBundleDownloads += rec.bundleDownloads;
    totalVerifierAccepts += rec.verifierAccepts;
    all.push(toNpiAnalytics(npi, rec));
  }

  const topPassports = all
    .sort((a, b) => b.shareCount - a.shareCount || b.verifierAccepts - a.verifierAccepts)
    .slice(0, 10);

  const overallVC = totalShares > 0 ? Math.round((totalVerifierAccepts / totalShares) * 100) / 100 : 0;

  return {
    totalShares,
    totalQrViews,
    totalBundleDownloads,
    totalVerifierAccepts,
    uniquePassports: store.size,
    topPassports,
    overallViralCoefficient: overallVC,
    computedAt: new Date().toISOString(),
  };
}
