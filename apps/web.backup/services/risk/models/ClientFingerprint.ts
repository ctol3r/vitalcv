/**
 * B160A-BOT-001: Client fingerprint domain model + validation helpers
 */

import { z } from 'zod';

export const ClientScreenSignalSchema = z
  .object({
    width: z.number().int().min(0).max(10000).optional(),
    height: z.number().int().min(0).max(10000).optional(),
    colorDepth: z.number().int().min(1).max(64).optional(),
  })
  .strict()
  .partial();

export type ClientScreenSignal = z.infer<typeof ClientScreenSignalSchema>;

export const ClientSignalsSchema = z
  .object({
    userAgent: z.string().min(1).max(512).optional(),
    timezone: z.string().min(1).max(100).optional(),
    tzOffset: z.number().int().min(-720).max(840).optional(),
    languages: z.array(z.string().min(2).max(35)).min(1).max(8).optional(),
    screen: ClientScreenSignalSchema.optional(),
    platform: z.string().min(1).max(120).optional(),
    hardwareConcurrency: z.number().int().min(1).max(64).optional(),
  })
  .strict()
  .partial();

export type ClientSignals = z.infer<typeof ClientSignalsSchema>;

export const ClientTelemetryBodySchema = z.object({
  deviceId: z
    .string()
    .uuid({ message: 'deviceId must be a UUID' })
    .describe('Stable device identifier stored in localStorage'),
  signals: ClientSignalsSchema.refine(
    (value) => Object.keys(value).length > 0,
    'signals must include at least one field'
  ),
});

export type ClientTelemetryBody = z.infer<typeof ClientTelemetryBodySchema>;

export interface ClientFingerprintRecord {
  deviceId: string;
  userId: string | null;
  signals: ClientSignals;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

/**
 * Remove undefined / empty values before persistence to avoid noisy JSON.
 */
export function normalizeSignals(signals: ClientSignals): ClientSignals {
  const normalized: ClientSignals = {};

  for (const [key, value] of Object.entries(signals)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (key === 'screen' && typeof value === 'object' && !Array.isArray(value)) {
      const screenValue = Object.entries(value as ClientScreenSignal).reduce<
        ClientScreenSignal
      >((acc, [screenKey, screenVal]) => {
        if (screenVal === undefined || screenVal === null) {
          return acc;
        }
        (acc as Record<string, unknown>)[screenKey] = screenVal;
        return acc;
      }, {});

      if (Object.keys(screenValue).length > 0) {
        normalized.screen = screenValue;
      }
      continue;
    }

    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    (normalized as Record<string, unknown>)[key] = value;
  }

  return normalized;
}

export function parseTelemetryBody(body: unknown): ClientTelemetryBody {
  return ClientTelemetryBodySchema.parse(body);
}

