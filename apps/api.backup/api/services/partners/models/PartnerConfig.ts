/**
 * B132A-ATS-010: Partner config model for ATS/EHR integrations
 *
 * Configuration model for partner ATS/EHR systems with webhook support.
 */

import { z } from 'zod';

// Auth type enum
export enum AuthType {
  BEARER = 'bearer',
  HMAC = 'hmac',
  MUTUAL_TLS = 'mutual-tls',
}

// Partner config schema
export const PartnerConfigSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required'),
  partnerName: z.string().min(1, 'Partner name is required'),
  atsWebhookUrl: z.string().url().optional(),
  ehrWebhookUrl: z.string().url().optional(),
  authType: z.nativeEnum(AuthType).default(AuthType.BEARER),
  authSecret: z.string().optional(), // Will be encrypted
  allowedOrigins: z.array(z.string().url()).default([]),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export type PartnerConfigCreate = z.infer<typeof PartnerConfigSchema>;

// Widget token schema
export const WidgetTokenRequestSchema = z.object({
  partnerId: z.string().min(1, 'Partner ID is required'),
  jobId: z.string().optional(),
  ttlSeconds: z.number().int().positive().max(3600).default(1800), // Max 1 hour
  issuedBy: z.string().min(1, 'Issuer ID is required'),
});

export type WidgetTokenRequest = z.infer<typeof WidgetTokenRequestSchema>;

// Widget token payload
export interface WidgetTokenPayload {
  sub: string; // partnerId
  jobId?: string;
  scope: string; // 'widget:apply'
  iat: number;
  exp: number;
  iss: string; // Issuer
  aud: string; // 'vitalcv:widget'
}

export function validatePartnerConfig(data: unknown): PartnerConfigCreate {
  return PartnerConfigSchema.parse(data);
}

export function validateWidgetTokenRequest(data: unknown): WidgetTokenRequest {
  return WidgetTokenRequestSchema.parse(data);
}

