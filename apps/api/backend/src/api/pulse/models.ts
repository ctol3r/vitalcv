import crypto from 'crypto';

export type PulseSeverity = 'info' | 'notice' | 'warn' | 'critical';

export type PulseEventInput = {
  type: string;
  title: string;
  message: string;
  severity?: PulseSeverity;
  source?: string;
  scope?: string;
  metadata?: Record<string, unknown>;
};

export type PulseEventDto = {
  id: number;
  type: string;
  title: string;
  message: string;
  severity: PulseSeverity;
  source?: string | null;
  scope?: string | null;
  occurrences: number;
  calmUntil?: string | null;
  lastEmittedAt: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_PULSE_LIMIT = 50;
export const MAX_PULSE_LIMIT = 200;

export type PulseEventRecord = {
  id: number;
  type: string;
  title: string;
  message: string;
  severity: string;
  source?: string | null;
  scope?: string | null;
  occurrences: number;
  calmUntil?: Date | null;
  lastEmittedAt: Date;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export function pulseFingerprint(input: PulseEventInput): string {
  const hash = crypto.createHash('sha256');
  hash.update(input.type.trim().toLowerCase());
  hash.update('|');
  hash.update(input.title.trim().toLowerCase());
  hash.update('|');
  hash.update(input.message.trim().toLowerCase());
  if (input.scope) hash.update(`|scope:${input.scope.trim().toLowerCase()}`);
  if (input.source) hash.update(`|source:${input.source.trim().toLowerCase()}`);
  if (input.metadata) hash.update(`|meta:${JSON.stringify(input.metadata)}`);
  return hash.digest('hex');
}

export function toPulseDto(event: PulseEventRecord): PulseEventDto {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    message: event.message,
    severity: (event.severity as PulseSeverity) || 'info',
    source: event.source,
    scope: event.scope,
    occurrences: event.occurrences,
    calmUntil: event.calmUntil?.toISOString?.() ?? null,
    lastEmittedAt: event.lastEmittedAt.toISOString(),
    metadata: (event.metadata as Record<string, unknown> | null) ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}
