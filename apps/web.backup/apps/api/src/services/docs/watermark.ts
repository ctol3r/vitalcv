import { createHash } from 'crypto';

export interface WatermarkRequest {
  clinicianId: string;
  documentId: string;
  payload: Buffer | Uint8Array | ArrayBuffer;
  timestamp?: string;
  salt?: string;
  spread?: number;
}

export interface WatermarkResult {
  watermarked: Buffer;
  message: string;
  digest: string;
  insertedAt: string;
  mutatedBytes: number;
  bitCount: number;
  traceVector: number[];
}

export function embedInvisibleWatermark(input: WatermarkRequest): WatermarkResult {
  if (!input.clinicianId) {
    throw new Error('clinicianId is required to embed a watermark');
  }
  if (!input.documentId) {
    throw new Error('documentId is required to embed a watermark');
  }

  const payload = coerceBuffer(input.payload);
  if (!payload.length) {
    throw new Error('payload must contain bytes to embed watermark');
  }

  const insertedAt = input.timestamp ?? new Date().toISOString();
  const salt = input.salt ?? createHash('sha256').update(`${input.clinicianId}-${insertedAt}`).digest('hex');
  const message = `${input.clinicianId}|${input.documentId}|${insertedAt}|${salt.slice(0, 16)}`;
  const bits = encodeMessageBits(message);

  if (bits.length >= payload.length) {
    throw new Error('payload too small for watermark message');
  }

  const mutated = Buffer.from(payload);
  const traceVector: number[] = [];
  const step = Math.max(1, input.spread ?? Math.floor(mutated.length / bits.length));
  const seed = createHash('sha256').update(`${salt}:${message}`).digest('hex');
  const seedOffset = parseInt(seed.slice(0, 6), 16) % mutated.length;
  let mutatedBytes = 0;

  bits.forEach((bit, idx) => {
    const index = (seedOffset + idx * step) % mutated.length;
    const original = mutated[index];
    const nextByte = (original & 0xfe) | bit;
    if (nextByte !== original) {
      mutatedBytes += 1;
    }
    mutated[index] = nextByte;
    traceVector.push(index);
  });

  const digest = createHash('sha256').update(mutated).digest('hex');

  return {
    watermarked: mutated,
    message,
    digest: `0x${digest}`,
    insertedAt,
    mutatedBytes,
    bitCount: bits.length,
    traceVector,
  };
}

function coerceBuffer(source: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(source)) {
    return source;
  }
  if (source instanceof ArrayBuffer) {
    return Buffer.from(source);
  }
  if (source instanceof Uint8Array) {
    return Buffer.from(source);
  }
  return Buffer.from([]);
}

function encodeMessageBits(message: string): number[] {
  const bytes = Buffer.from(message, 'utf8');
  const bits: number[] = [];
  bytes.forEach((byte) => {
    for (let i = 7; i >= 0; i -= 1) {
      bits.push((byte >> i) & 1);
    }
  });
  return bits;
}

