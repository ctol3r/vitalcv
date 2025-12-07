import { z, ZodError } from 'zod';
import { MessageEnvelope, SinkConfig } from './types';

const stringArraySchema = z.array(z.string().min(1));

export const messageEnvelopeSchema = z.object({
  sink: z.string().min(1, 'sink is required'),
  signature: z.string().min(1).optional(),
  payload: z.unknown(),
  timestamp: z.number().int().optional(),
  allowed_sinks: stringArraySchema.optional(),
  audience: z.union([z.string().min(1), stringArraySchema]).optional(),
});

export const guardConfigSchema = z.object({
  allowedSinks: stringArraySchema.min(1, 'allowedSinks must include at least one sink'),
  publicKey: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  requireSignature: z.boolean().optional(),
  requireAudience: z.boolean().optional(),
  environment: z.string().optional(),
});

export type ValidatedEnvelope = z.infer<typeof messageEnvelopeSchema>;
export type ValidatedGuardConfig = z.infer<typeof guardConfigSchema> & SinkConfig;

export function validateMessageEnvelope(envelope: unknown): MessageEnvelope {
  return messageEnvelopeSchema.parse(envelope);
}

export function validateGuardConfig(config: SinkConfig & { environment?: string }): ValidatedGuardConfig {
  return guardConfigSchema.parse(config) as ValidatedGuardConfig;
}

export function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return error.message;
  }
  return `${issue.path.join('.') || 'payload'}: ${issue.message}`;
}

