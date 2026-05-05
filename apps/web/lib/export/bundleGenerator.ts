/**
 * bundleGenerator.ts
 *
 * Generates a foundation-tier export bundle as a ZIP archive.
 * Truth contracts:
 *   - Bundle is foundation-tier; it is NOT a signed proof pack.
 *   - Output never contains PHI or NPI raw values — only redacted summary shape.
 *   - parsedEntries is always an empty array (parseLive: false).
 *   - auditEventSummary contains only counts/dateRange, not raw event payloads.
 */

export type BundleTier = 'foundation';

export interface RedactedPassportSummary {
  entityType: string;
  specialty: string;
  sourcesChecked: string[];
  trustBand: string;
  readinessScore: number;
  lastCheckedAt: string;
}

export interface ReceiptCandidateSummary {
  totalCount: number;
  byProofTier: Record<string, number>;
  byReviewState: Record<string, number>;
}

export interface AuditEventSummary {
  eventCount: number;
  dateRange: { earliest: string | null; latest: string | null };
}

export interface BundleInput {
  passportSummary: RedactedPassportSummary;
  receiptCandidateSummary: ReceiptCandidateSummary;
  auditEventSummary: AuditEventSummary;
}

export interface BundleManifest {
  schemaVersion: '1';
  bundleTier: BundleTier;
  generatedAt: string;
  disclaimer: string;
  files: string[];
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    let c = (crc ^ byte) & 0xff;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(val: number): Buffer {
  const b = Buffer.allocUnsafe(2);
  b.writeUInt16LE(val, 0);
  return b;
}

function u32(val: number): Buffer {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(val >>> 0, 0);
  return b;
}

// Builds a valid ZIP (STORE, no compression) from named entries.
function buildZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf-8');
    const crc = crc32(data);
    const size = data.length;

    const localHeader = Buffer.concat([
      u32(0x04034b50),        // local file header signature
      u16(20),                // version needed
      u16(0),                 // general purpose bit flag
      u16(0),                 // compression: STORE
      u16(0),                 // last mod file time
      u16(0),                 // last mod file date
      u32(crc),
      u32(size),              // compressed size
      u32(size),              // uncompressed size
      u16(nameBytes.length),
      u16(0),                 // extra field length
      nameBytes,
    ]);

    const centralHeader = Buffer.concat([
      u32(0x02014b50),        // central directory file header signature
      u16(20),                // version made by
      u16(20),                // version needed
      u16(0),                 // flags
      u16(0),                 // compression
      u16(0),                 // last mod time
      u16(0),                 // last mod date
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),                 // extra field length
      u16(0),                 // file comment length
      u16(0),                 // disk number start
      u16(0),                 // internal file attrs
      u32(0),                 // external file attrs
      u32(offset),            // relative offset of local header
      nameBytes,
    ]);

    localChunks.push(localHeader, data);
    centralChunks.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralDir = Buffer.concat(centralChunks);

  const eocd = Buffer.concat([
    u32(0x06054b50),          // end of central dir signature
    u16(0),                   // disk number
    u16(0),                   // disk with start of central dir
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),              // offset of central dir
    u16(0),                   // comment length
  ]);

  return Buffer.concat([...localChunks, centralDir, eocd]);
}

export function generateBundle(input: BundleInput): Buffer {
  const manifest: BundleManifest = {
    schemaVersion: '1',
    bundleTier: 'foundation',
    generatedAt: new Date().toISOString(),
    disclaimer:
      'This bundle is a foundation-tier export for review purposes. It is not a signed proof pack and does not constitute verified credentialing evidence.',
    files: [
      'manifest.json',
      'passport-summary.json',
      'receipt-candidates-summary.json',
      'audit-events-summary.json',
    ],
  };

  const entries: Array<{ name: string; data: Buffer }> = [
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8') },
    { name: 'passport-summary.json', data: Buffer.from(JSON.stringify(input.passportSummary, null, 2), 'utf-8') },
    { name: 'receipt-candidates-summary.json', data: Buffer.from(JSON.stringify(input.receiptCandidateSummary, null, 2), 'utf-8') },
    { name: 'audit-events-summary.json', data: Buffer.from(JSON.stringify(input.auditEventSummary, null, 2), 'utf-8') },
  ];

  return buildZip(entries);
}
