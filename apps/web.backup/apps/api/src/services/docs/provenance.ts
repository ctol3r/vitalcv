import { createHash } from 'crypto';

import { anchorProvenanceVerdict } from '../audit/anchor';

export interface ProvenanceExtractionInput {
  docId: string;
  clinicianId: string;
  buffer?: ArrayBuffer | Buffer | Uint8Array;
  metadata?: Record<string, unknown>;
  fileName?: string;
  mimeType?: string;
  anchor?: boolean;
}

export interface ProvenanceVerdict {
  docId: string;
  clinicianId: string;
  verdict: 'verified' | 'suspicious';
  confidence: number;
  warnings: string[];
  anomalies: string[];
  captureDevice: string | null;
  captureTimestamp: string | null;
  software: string | null;
  gps: { lat: number; lng: number; accuracyMeters: number } | null;
  hash: string;
  exif: Record<string, unknown>;
}

export function extractProvenanceExif(input: ProvenanceExtractionInput): ProvenanceVerdict {
  if (!input.docId) {
    throw new Error('docId is required for provenance extraction');
  }
  if (!input.clinicianId) {
    throw new Error('clinicianId is required for provenance extraction');
  }

  const buffer = coerceBuffer(input.buffer);
  const parsedExif = buffer ? parseExifFromBuffer(buffer) : null;
  const metadataExif = coerceMetadataExif(input.metadata);
  const exif = {
    ...metadataExif,
    ...(parsedExif ?? {}),
  };

  const captureDevice = deriveCaptureDevice(exif, input.metadata);
  const captureTimestamp = deriveTimestamp(exif, input.metadata);
  const software = deriveSoftware(exif, input.metadata);
  const gps = deriveGps(exif, input.metadata);

  const warnings = buildWarnings({
    captureTimestamp,
    gps,
    software,
    metadata: input.metadata,
  });
  const anomalies = buildAnomalies(exif, input.metadata);

  let confidence = 0.55;
  if (captureTimestamp) confidence += 0.1;
  if (gps) confidence += 0.12;
  if (captureDevice) confidence += 0.08;
  if (software && /photoshop|pixelmator|snapseed/i.test(software)) {
    confidence -= 0.2;
  }
  if (getString(input.metadata, 'sourceHint') === 'screenshot') {
    confidence -= 0.25;
  }
  const noiseFloor = getNumber(input.metadata, 'noiseFloor');
  if (noiseFloor !== null && noiseFloor < 0.3) {
    confidence -= 0.05;
  }
  confidence = clamp01(confidence);

  const verdict: 'verified' | 'suspicious' =
    confidence >= 0.65 && warnings.length < 3 ? 'verified' : 'suspicious';

  const hashSeed = `${input.docId}:${captureDevice ?? 'unknown'}:${captureTimestamp ?? 'na'}`;
  const hash = normalizeHash(createHash('sha256').update(hashSeed).digest('hex'));

  if (input.anchor !== false) {
    try {
      anchorProvenanceVerdict({
        docId: input.docId,
        clinicianId: input.clinicianId,
        verdict,
        confidence,
        captureTimestamp,
        captureDevice,
        gps,
        warnings,
      });
    } catch (error) {
      console.warn('[docs][provenance] Failed to anchor provenance verdict', error);
    }
  }

  return {
    docId: input.docId,
    clinicianId: input.clinicianId,
    verdict,
    confidence: Number(confidence.toFixed(4)),
    warnings: Array.from(new Set(warnings)),
    anomalies,
    captureDevice,
    captureTimestamp,
    software,
    gps,
    hash,
    exif,
  };
}

function coerceBuffer(
  payload?: ArrayBuffer | Buffer | Uint8Array,
): Buffer | null {
  if (!payload) {
    return null;
  }
  if (Buffer.isBuffer(payload)) {
    return payload;
  }
  if (payload instanceof ArrayBuffer) {
    return Buffer.from(payload);
  }
  if (payload instanceof Uint8Array) {
    return Buffer.from(payload);
  }
  return null;
}

function coerceMetadataExif(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata) {
    return {};
  }
  if (typeof metadata.exif === 'object' && metadata.exif) {
    return metadata.exif as Record<string, unknown>;
  }
  return metadata;
}

function deriveCaptureDevice(
  exif: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): string | null {
  const make = typeof exif.Make === 'string' ? exif.Make.trim() : '';
  const model = typeof exif.Model === 'string' ? exif.Model.trim() : '';
  if (make || model) {
    return `${make} ${model}`.trim();
  }
  const metadataDevice = getString(metadata, 'device');
  if (metadataDevice) {
    return metadataDevice;
  }
  const metadataCamera = getString(metadata, 'camera');
  if (metadataCamera) {
    return metadataCamera;
  }
  return null;
}

function deriveTimestamp(
  exif: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): string | null {
  const timestampCandidates = [
    exif.DateTimeOriginal,
    exif.DateTime,
    getString(metadata, 'captureTimestamp'),
    getString(metadata, 'createdAt'),
  ];
  for (const value of timestampCandidates) {
    if (typeof value === 'string' && value.trim().length) {
      const iso = normalizeTimestamp(value);
      if (iso) return iso;
    }
  }
  return null;
}

function deriveSoftware(
  exif: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): string | null {
  const software =
    (typeof exif.Software === 'string' && exif.Software) ||
    getString(metadata, 'software') ||
    getString(metadata, 'pipeline');
  return software ?? null;
}

function deriveGps(
  exif: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): { lat: number; lng: number; accuracyMeters: number } | null {
  const gpsMeta = getRecord(metadata, 'gps');
  if (gpsMeta) {
    const lat = getNumber(gpsMeta, 'lat');
    const lng = getNumber(gpsMeta, 'lng');
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const accuracy = getNumber(gpsMeta, 'accuracy') ?? 25;
      return {
        lat,
        lng,
        accuracyMeters: Number.isFinite(accuracy) ? accuracy : 25,
      };
    }
  }

  const gpsBlock = (exif.GPS ?? exif.GPSInfo) as Record<string, unknown> | undefined;
  if (!gpsBlock) {
    return null;
  }

  const lat = convertGpsCoordinate(gpsBlock.GPSLatitude, gpsBlock.GPSLatitudeRef);
  const lng = convertGpsCoordinate(gpsBlock.GPSLongitude, gpsBlock.GPSLongitudeRef);
  if (lat == null || lng == null) {
    return null;
  }

  return {
    lat,
    lng,
    accuracyMeters: 20,
  };
}

function convertGpsCoordinate(
  value: unknown,
  ref: unknown,
): number | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const [deg = 0, min = 0, sec = 0] = value.map((part) =>
    typeof part === 'number' ? part : Number(part),
  );
  if (![deg, min, sec].every((component) => Number.isFinite(component))) {
    return null;
  }
  let decimal = deg + min / 60 + sec / 3600;
  if (typeof ref === 'string' && /[sw]/i.test(ref)) {
    decimal *= -1;
  }
  return Number(decimal.toFixed(6));
}

function buildWarnings(context: {
  captureTimestamp: string | null;
  gps: { lat: number; lng: number } | null;
  software: string | null;
  metadata?: Record<string, unknown>;
}): string[] {
  const warnings: string[] = [];
  if (!context.captureTimestamp) {
    warnings.push('Missing capture timestamp');
  }
  if (!context.gps) {
    warnings.push('GPS lock unavailable');
  }
  if (context.software && /photoshop|pixelmator|afterlight/i.test(context.software)) {
    warnings.push('Editor watermark detected');
  }
  if (getString(context.metadata, 'sourceHint') === 'scan') {
    warnings.push('Scanned copy provided');
  }
  if (getBoolean(context.metadata, 'replayed')) {
    warnings.push('Potential screen replay detected');
  }
  return warnings;
}

function buildAnomalies(
  exif: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): string[] {
  const anomalies: string[] = [];
  const shadowScore = getNumber(metadata, 'shadowScore');
  if (shadowScore !== null && shadowScore < 0.3) {
    anomalies.push('Shallow shadows inconsistent with natural lighting');
  }
  if (typeof exif.Flash === 'number' && (exif.Flash as number) === 0) {
    anomalies.push('Flash metadata disabled despite indoor capture claim');
  }
  if (getString(metadata, 'noisePattern') === 'flat') {
    anomalies.push('Flat noise pattern associated with prints or screenshots');
  }
  return anomalies;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeTimestamp(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!Number.isNaN(Date.parse(trimmed))) {
    return new Date(trimmed).toISOString();
  }
  const exifStyle = trimmed.replace(/\s+/g, ' ');
  const parts = exifStyle.split(' ');
  if (parts.length === 2 && /^\d{4}:\d{2}:\d{2}$/.test(parts[0])) {
    return new Date(`${parts[0].replace(/:/g, '-') }T${parts[1]}`).toISOString();
  }
  return null;
}

function normalizeHash(value: string): string {
  if (!value) return '';
  const trimmed = value.trim().replace(/^0x/, '').toLowerCase();
  return `0x${trimmed}`;
}

function getString(source: Record<string, unknown> | undefined, key: string): string | null {
  if (!source) {
    return null;
  }
  const value = source[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

function getNumber(source: Record<string, unknown> | undefined, key: string): number | null {
  if (!source) {
    return null;
  }
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getBoolean(source: Record<string, unknown> | undefined, key: string): boolean | null {
  if (!source) {
    return null;
  }
  const value = source[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return null;
}

function getRecord(
  source: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!source) {
    return null;
  }
  const value = source[key];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseExifFromBuffer(buffer: Buffer): Record<string, unknown> | null {
  try {
    if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) {
      return null; // Only parse JPEG buffers
    }

    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        break;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker === 0xe1) {
        const header = buffer.slice(offset + 4, offset + 10);
        if (header.toString() === 'Exif\0\0') {
          const tiff = buffer.slice(offset + 10, offset + 2 + length);
          return parseTiffPayload(tiff);
        }
      }
      offset += 2 + length;
    }
  } catch (error) {
    console.warn('[docs][provenance] EXIF parse failed', error);
  }
  return null;
}

function parseTiffPayload(tiff: Buffer): Record<string, unknown> {
  const byteOrder = tiff.slice(0, 2).toString();
  const littleEndian = byteOrder === 'II';
  const firstIfdOffset = readUInt32(tiff, 4, littleEndian);
  const values: Record<string, unknown> = {};

  parseIfd(tiff, firstIfdOffset, littleEndian, values, false);

  if (typeof values.ExifIFDPointer === 'number') {
    parseIfd(tiff, values.ExifIFDPointer as number, littleEndian, values, false);
    delete values.ExifIFDPointer;
  }
  if (typeof values.GPSInfoIFDPointer === 'number') {
    const gps: Record<string, unknown> = {};
    parseIfd(tiff, values.GPSInfoIFDPointer as number, littleEndian, gps, true);
    values.GPS = gps;
    delete values.GPSInfoIFDPointer;
  }

  return values;
}

function parseIfd(
  data: Buffer,
  offset: number,
  littleEndian: boolean,
  target: Record<string, unknown>,
  isGps: boolean,
) {
  if (!Number.isFinite(offset) || offset < 0 || offset + 2 > data.length) {
    return;
  }

  const entryCount = readUInt16(data, offset, littleEndian);
  for (let i = 0; i < entryCount; i += 1) {
    const entryOffset = offset + 2 + i * 12;
    if (entryOffset + 12 > data.length) {
      break;
    }

    const tag = readUInt16(data, entryOffset, littleEndian);
    const type = readUInt16(data, entryOffset + 2, littleEndian);
    const count = readUInt32(data, entryOffset + 4, littleEndian);
    const dataOffsetBytes = data.slice(entryOffset + 8, entryOffset + 12);
    const valueSize = getTypeSize(type) * count;
    const actualOffset = readUInt32(dataOffsetBytes, 0, littleEndian);

    if (tag === 0x8769) {
      target.ExifIFDPointer = actualOffset;
      continue;
    }
    if (tag === 0x8825) {
      target.GPSInfoIFDPointer = actualOffset;
      continue;
    }

    const tagName = resolveTagName(tag, isGps);
    if (!tagName) {
      continue;
    }

    let rawValue: unknown = null;
    if (valueSize <= 4) {
      rawValue = decodeValue(dataOffsetBytes.slice(0, valueSize), type, count, littleEndian);
    } else if (actualOffset + valueSize <= data.length) {
      rawValue = decodeValue(data.slice(actualOffset, actualOffset + valueSize), type, count, littleEndian);
    }

    if (rawValue !== null && typeof rawValue !== 'undefined') {
      target[tagName] = rawValue;
    }
  }
}

function resolveTagName(tag: number, isGps: boolean): string | null {
  const STANDARD_TAGS: Record<number, string> = {
    0x010f: 'Make',
    0x0110: 'Model',
    0x0131: 'Software',
    0x0132: 'DateTime',
    0x9003: 'DateTimeOriginal',
    0x829d: 'FNumber',
    0x829a: 'ExposureTime',
    0x9209: 'Flash',
    0x920a: 'FocalLength',
    0xa002: 'PixelXDimension',
    0xa003: 'PixelYDimension',
  };

  const GPS_TAGS: Record<number, string> = {
    0x0001: 'GPSLatitudeRef',
    0x0002: 'GPSLatitude',
    0x0003: 'GPSLongitudeRef',
    0x0004: 'GPSLongitude',
    0x0005: 'GPSAltitudeRef',
    0x0006: 'GPSAltitude',
    0x0007: 'GPSTimeStamp',
    0x000d: 'GPSDateStamp',
  };

  if (isGps) {
    return GPS_TAGS[tag] ?? null;
  }
  return STANDARD_TAGS[tag] ?? null;
}

function decodeValue(
  buffer: Buffer,
  type: number,
  count: number,
  littleEndian: boolean,
): unknown {
  switch (type) {
    case 1: // BYTE
    case 7: // UNDEFINED
      return Array.from(buffer.slice(0, count));
    case 2: {
      const text = buffer.slice(0, count).toString('utf8').replace(/\0+$/, '');
      return text;
    }
    case 3: {
      const values: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const offset = i * 2;
        if (offset + 2 > buffer.length) break;
        values.push(
          littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset),
        );
      }
      return count === 1 ? values[0] : values;
    }
    case 4: {
      const values: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const offset = i * 4;
        if (offset + 4 > buffer.length) break;
        values.push(
          littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset),
        );
      }
      return count === 1 ? values[0] : values;
    }
    case 5: {
      const values: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const offset = i * 8;
        if (offset + 8 > buffer.length) break;
        const numerator = littleEndian
          ? buffer.readUInt32LE(offset)
          : buffer.readUInt32BE(offset);
        const denominator = littleEndian
          ? buffer.readUInt32LE(offset + 4)
          : buffer.readUInt32BE(offset + 4);
        if (!denominator) continue;
        values.push(Number((numerator / denominator).toFixed(6)));
      }
      return values.length === 1 ? values[0] : values;
    }
    default:
      return null;
  }
}

function readUInt16(buffer: Buffer, offset: number, littleEndian: boolean): number {
  return littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readUInt32(buffer: Buffer, offset: number, littleEndian: boolean): number {
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function getTypeSize(type: number): number {
  switch (type) {
    case 1:
    case 2:
    case 7:
      return 1;
    case 3:
      return 2;
    case 4:
      return 4;
    case 5:
      return 8;
    default:
      return 0;
  }
}

